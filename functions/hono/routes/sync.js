import { fail, ok, parseBody } from '../helpers/http'

const ENTITY_CONFIG = {
  customers: { table: 'customers' },
  fabrics: { table: 'fabrics' },
  bills: { table: 'bills' },
}

const EPOCH_ISO = '1970-01-01T00:00:00.000Z'

const toIsoString = (value, fallback = EPOCH_ISO) => {
  const date = new Date(value || fallback)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

const toMillis = (value) => {
  const date = new Date(value || EPOCH_ISO)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const parseRowData = (raw) => {
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

const normalizeOperation = (raw = {}, index = 0) => {
  const action = raw.action === 'delete' ? 'delete' : 'upsert'
  const entity = String(raw.entity || '').trim()
  const recordId = String(raw.recordId || raw.id || raw.record?.id || '').trim()
  const updatedAt = toIsoString(raw.updatedAt || raw.record?.updatedAt || new Date().toISOString())
  return {
    opId: String(raw.opId || `op-${Date.now()}-${index}`),
    entity,
    action,
    recordId,
    record: raw.record && typeof raw.record === 'object' ? raw.record : null,
    updatedAt,
  }
}

const normalizeOperations = (body = {}) => {
  if (Array.isArray(body?.operations)) {
    return body.operations.map((item, index) => normalizeOperation(item, index))
  }
  return []
}

const buildRecordByEntity = (entity, input, existingData, recordId, updatedAt) => {
  const now = new Date().toISOString()
  const merged = {
    ...(existingData || {}),
    ...(input || {}),
    id: recordId,
    createdAt: existingData?.createdAt || input?.createdAt || now,
    updatedAt,
  }

  if (entity === 'customers') {
    return {
      ...merged,
      name: String(merged.name || '').trim(),
      status: String(merged.status || 'active'),
      deletedAt: null,
    }
  }

  if (entity === 'fabrics') {
    return {
      ...merged,
      code: String(merged.code || `FAB${Date.now().toString().slice(-4)}`),
      name: String(merged.name || '').trim(),
      status: String(merged.status || 'active'),
      deletedAt: null,
    }
  }

  return {
    ...merged,
    billNo: String(merged.billNo || `B${Date.now()}`),
    type: merged.type === 'sale' ? 'sale' : 'purchase',
    billDate: String(merged.billDate || now.slice(0, 10)),
    customerName: String(merged.customerName || merged.partnerName || ''),
    status: String(merged.status || 'confirmed'),
    totalAmount: Number(merged.totalAmount || 0),
    totalWeight: Number(merged.totalWeight || 0),
    deletedAt: null,
  }
}

const upsertRow = async (db, entity, record) => {
  if (entity === 'customers') {
    await db
      .prepare(
        `INSERT OR REPLACE INTO customers (id, name, status, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`
      )
      .bind(
        record.id,
        record.name,
        record.status,
        JSON.stringify(record),
        record.createdAt,
        record.updatedAt
      )
      .run()
    return
  }

  if (entity === 'fabrics') {
    await db
      .prepare(
        `INSERT OR REPLACE INTO fabrics (id, code, name, status, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL)`
      )
      .bind(
        record.id,
        record.code,
        record.name,
        record.status,
        JSON.stringify(record),
        record.createdAt,
        record.updatedAt
      )
      .run()
    return
  }

  await db
    .prepare(
      `INSERT OR REPLACE INTO bills
      (id, bill_no, type, bill_date, customer_name, status, total_amount, total_weight, data, created_at, updated_at, deleted_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL)`
    )
    .bind(
      record.id,
      record.billNo,
      record.type,
      record.billDate,
      record.customerName,
      record.status,
      record.totalAmount,
      record.totalWeight,
      JSON.stringify(record),
      record.createdAt,
      record.updatedAt
    )
    .run()
}

const softDeleteRow = async (db, entity, recordId, updatedAt) => {
  const { table } = ENTITY_CONFIG[entity]
  const row = await db
    .prepare(`SELECT data FROM ${table} WHERE id = ?1`)
    .bind(recordId)
    .first()

  if (!row?.data) return

  const existing = parseRowData(row.data)
  const status = entity === 'bills' ? 'deleted' : 'inactive'
  const deleted = {
    ...existing,
    id: recordId,
    status,
    updatedAt,
    deletedAt: updatedAt,
  }

  await db
    .prepare(
      `UPDATE ${table}
         SET data = ?2,
             status = ?3,
             updated_at = ?4,
             deleted_at = ?5
       WHERE id = ?1`
    )
    .bind(recordId, JSON.stringify(deleted), status, updatedAt, updatedAt)
    .run()
}

const applyOperation = async (db, operation) => {
  const config = ENTITY_CONFIG[operation.entity]
  if (!config) {
    return { status: 'invalid', reason: 'unsupported_entity' }
  }
  if (!operation.recordId) {
    return { status: 'invalid', reason: 'missing_record_id' }
  }

  const existing = await db
    .prepare(`SELECT data, updated_at FROM ${config.table} WHERE id = ?1`)
    .bind(operation.recordId)
    .first()

  const serverUpdatedAt = toIsoString(existing?.updated_at || EPOCH_ISO)
  if (existing && toMillis(operation.updatedAt) < toMillis(serverUpdatedAt)) {
    return {
      status: 'conflict',
      reason: 'stale_operation',
      serverUpdatedAt,
    }
  }

  if (operation.action === 'delete') {
    if (existing && toMillis(operation.updatedAt) === toMillis(serverUpdatedAt)) {
      return { status: 'applied' }
    }
    await softDeleteRow(db, operation.entity, operation.recordId, operation.updatedAt)
    return { status: 'applied' }
  }

  const existingData = existing ? parseRowData(existing.data) : null
  const nextRecord = buildRecordByEntity(
    operation.entity,
    operation.record,
    existingData,
    operation.recordId,
    operation.updatedAt
  )

  if (operation.entity !== 'bills' && !nextRecord.name) {
    return { status: 'invalid', reason: 'missing_name' }
  }

  if (existing && toMillis(operation.updatedAt) === toMillis(serverUpdatedAt)) {
    return { status: 'applied' }
  }

  await upsertRow(db, operation.entity, nextRecord)
  return { status: 'applied' }
}

const listEntityChanges = async (db, entity, since) => {
  const { table } = ENTITY_CONFIG[entity]
  const upserts = await db
    .prepare(
      `SELECT data FROM ${table}
       WHERE deleted_at IS NULL
         AND datetime(updated_at) > datetime(?1)
       ORDER BY datetime(updated_at) ASC`
    )
    .bind(since)
    .all()

  const deletes = await db
    .prepare(
      `SELECT id, deleted_at FROM ${table}
       WHERE deleted_at IS NOT NULL
         AND datetime(deleted_at) > datetime(?1)
       ORDER BY datetime(deleted_at) ASC`
    )
    .bind(since)
    .all()

  return {
    upserts: (upserts?.results || []).map((row) => parseRowData(row.data)).filter((row) => !!row.id),
    deletes: (deletes?.results || []).map((row) => ({
      id: String(row.id || ''),
      deletedAt: toIsoString(row.deleted_at || new Date().toISOString()),
    })).filter((row) => !!row.id),
  }
}

export const registerSyncRoutes = (app) => {
  app.get('/api/sync/pull', async (c) => {
    const forceFull = c.req.query('full') === '1'
    const since = forceFull ? EPOCH_ISO : toIsoString(c.req.query('since') || EPOCH_ISO)

    const [customers, fabrics, bills] = await Promise.all([
      listEntityChanges(c.env.DB, 'customers', since),
      listEntityChanges(c.env.DB, 'fabrics', since),
      listEntityChanges(c.env.DB, 'bills', since),
    ])

    return ok(c, {
      data: {
        serverTime: new Date().toISOString(),
        since,
        changes: { customers, fabrics, bills },
      },
    })
  })

  app.post('/api/sync/push', async (c) => {
    const body = await parseBody(c)
    const operations = normalizeOperations(body)
    if (!operations.length) {
      return fail(c, '缺少待同步操作', 400)
    }

    const appliedOpIds = []
    const conflicts = []
    const invalid = []

    for (const operation of operations) {
      const result = await applyOperation(c.env.DB, operation)
      if (result.status === 'applied') {
        appliedOpIds.push(operation.opId)
      } else if (result.status === 'conflict') {
        conflicts.push({
          opId: operation.opId,
          entity: operation.entity,
          recordId: operation.recordId,
          reason: result.reason,
          serverUpdatedAt: result.serverUpdatedAt,
        })
      } else {
        invalid.push({
          opId: operation.opId,
          entity: operation.entity,
          recordId: operation.recordId,
          reason: result.reason,
        })
      }
    }

    return ok(c, {
      data: {
        serverTime: new Date().toISOString(),
        appliedCount: appliedOpIds.length,
        conflictCount: conflicts.length,
        invalidCount: invalid.length,
        appliedOpIds,
        conflicts,
        invalid,
      },
    })
  })
}
