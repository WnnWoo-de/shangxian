import { getEntityConfig } from './entity-configs.js'
import { bindablePlaceholders, all, first, getSqlDialect, run } from './db.js'

export const getSyncEntityConfig = (entity) => getEntityConfig(entity)

export const parseStoredData = (raw) => {
  try {
    return typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {}
  } catch {
    return {}
  }
}

const buildUpsertSql = (db, table, columns) => {
  const dialect = getSqlDialect(db)
  return `${dialect.upsertKeyword} INTO ${table} (${columns.join(', ')}) VALUES (${bindablePlaceholders(columns.length, db)})`
}

export const getSyncRecordSnapshot = async (db, entity, recordId) => {
  const config = getSyncEntityConfig(entity)
  if (!config) return null

  const row = await first(db, `SELECT data, updated_at FROM ${config.table} WHERE id = ?`, [recordId])

  if (!row) return null
  return {
    data: parseStoredData(row.data),
    rawData: row.data,
    updatedAt: row.updated_at,
  }
}

export const upsertSyncRecord = async (db, entity, record) => {
  if (entity === 'customers') {
    await run(
      db,
      buildUpsertSql(db, 'customers', ['id', 'name', 'status', 'data', 'created_at', 'updated_at', 'deleted_at']),
      [record.id, record.name, record.status, JSON.stringify(record), record.createdAt, record.updatedAt, null]
    )
    return
  }

  if (entity === 'fabrics') {
    await run(
      db,
      buildUpsertSql(db, 'fabrics', ['id', 'code', 'name', 'status', 'data', 'created_at', 'updated_at', 'deleted_at']),
      [record.id, record.code, record.name, record.status, JSON.stringify(record), record.createdAt, record.updatedAt, null]
    )
    return
  }

  await run(
    db,
    buildUpsertSql(db, 'bills', [
      'id',
      'bill_no',
      'type',
      'bill_date',
      'customer_name',
      'status',
      'total_amount',
      'total_weight',
      'data',
      'created_at',
      'updated_at',
      'deleted_at',
    ]),
    [
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
      record.updatedAt,
      null,
    ]
  )
}

export const softDeleteSyncRecord = async (db, entity, recordId, record) => {
  const config = getSyncEntityConfig(entity)
  if (!config) return

  await run(
    db,
    `UPDATE ${config.table}
       SET data = ?,
           status = ?,
           updated_at = ?,
           deleted_at = ?
     WHERE id = ?`,
    [JSON.stringify(record), record.status, record.updatedAt, record.deletedAt, recordId]
  )
}

export const listEntityChanges = async (db, entity, since, toIsoString) => {
  const config = getSyncEntityConfig(entity)
  if (!config) {
    return { upserts: [], deletes: [] }
  }

  const dialect = getSqlDialect(db)
  const updatedAt = dialect.dateTime('updated_at')
  const deletedAt = dialect.dateTime('deleted_at')
  const sinceValue = dialect.dateTime('?')

  const upserts = await all(
    db,
    `SELECT data FROM ${config.table}
     WHERE deleted_at IS NULL
       AND ${updatedAt} > ${sinceValue}
     ORDER BY ${updatedAt} ASC`,
    [since]
  )

  const deletes = await all(
    db,
    `SELECT id, deleted_at FROM ${config.table}
     WHERE deleted_at IS NOT NULL
       AND ${deletedAt} > ${sinceValue}
     ORDER BY ${deletedAt} ASC`,
    [since]
  )

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
