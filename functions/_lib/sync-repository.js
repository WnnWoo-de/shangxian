import { getEntityConfig } from './entity-configs.js'

export const getSyncEntityConfig = (entity) => getEntityConfig(entity)

export const parseStoredData = (raw) => {
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

export const getSyncRecordSnapshot = async (db, entity, recordId) => {
  const config = getSyncEntityConfig(entity)
  if (!config) return null

  const row = await db
    .prepare(`SELECT data, updated_at FROM ${config.table} WHERE id = ?1`)
    .bind(recordId)
    .first()

  if (!row) return null
  return {
    data: parseStoredData(row.data),
    rawData: row.data,
    updatedAt: row.updated_at,
  }
}

export const upsertSyncRecord = async (db, entity, record) => {
  if (entity === 'customers') {
    await db
      .prepare(
        `INSERT OR REPLACE INTO customers (id, name, status, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`
      )
      .bind(record.id, record.name, record.status, JSON.stringify(record), record.createdAt, record.updatedAt)
      .run()
    return
  }

  if (entity === 'fabrics') {
    await db
      .prepare(
        `INSERT OR REPLACE INTO fabrics (id, code, name, status, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL)`
      )
      .bind(record.id, record.code, record.name, record.status, JSON.stringify(record), record.createdAt, record.updatedAt)
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

export const softDeleteSyncRecord = async (db, entity, recordId, record) => {
  const config = getSyncEntityConfig(entity)
  if (!config) return

  await db
    .prepare(
      `UPDATE ${config.table}
         SET data = ?2,
             status = ?3,
             updated_at = ?4,
             deleted_at = ?5
       WHERE id = ?1`
    )
    .bind(recordId, JSON.stringify(record), record.status, record.updatedAt, record.deletedAt)
    .run()
}

export const listEntityChanges = async (db, entity, since, toIsoString) => {
  const config = getSyncEntityConfig(entity)
  if (!config) {
    return { upserts: [], deletes: [] }
  }

  const upserts = await db
    .prepare(
      `SELECT data FROM ${config.table}
       WHERE deleted_at IS NULL
         AND datetime(updated_at) > datetime(?1)
       ORDER BY datetime(updated_at) ASC`
    )
    .bind(since)
    .all()

  const deletes = await db
    .prepare(
      `SELECT id, deleted_at FROM ${config.table}
       WHERE deleted_at IS NOT NULL
         AND datetime(deleted_at) > datetime(?1)
       ORDER BY datetime(deleted_at) ASC`
    )
    .bind(since)
    .all()

  return {
    upserts: (upserts?.results || []).map((row) => parseStoredData(row.data)).filter((row) => !!row.id),
    deletes: (deletes?.results || [])
      .map((row) => ({
        id: String(row.id || ''),
        deletedAt: toIsoString(row.deleted_at || new Date().toISOString()),
      }))
      .filter((row) => !!row.id),
  }
}
