import { listRows, mapRow } from './db.js'

const placeholders = (count) => Array.from({ length: count }, () => '?').join(', ')

const fieldValues = (fields, entity) => fields.map((field) => field.value(entity))

export const listActiveEntities = async (db, table, orderBy = 'datetime(updated_at) DESC') => {
  return listRows(db, `SELECT data FROM ${table} WHERE deleted_at IS NULL ORDER BY ${orderBy}`)
}

export const getEntityById = async (db, table, id, options = {}) => {
  const deletedClause = options.includeDeleted ? '' : ' AND deleted_at IS NULL'
  const row = await db.prepare(`SELECT data FROM ${table} WHERE id = ?${deletedClause}`).bind(id).first()
  return mapRow(row)
}

export const insertEntity = async (db, config, entity) => {
  const columns = [
    'id',
    ...config.fields.map((field) => field.column),
    'data',
    'created_at',
    'updated_at',
    'deleted_at',
  ]
  const values = [
    entity.id,
    ...fieldValues(config.fields, entity),
    JSON.stringify(entity),
    entity.createdAt,
    entity.updatedAt,
    null,
  ]

  await db
    .prepare(`INSERT OR REPLACE INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders(columns.length)})`)
    .bind(...values)
    .run()
}

export const updateEntity = async (db, config, id, entity) => {
  const setColumns = [
    ...config.fields.map((field) => field.column),
    'data',
    'updated_at',
    'deleted_at',
  ]
  const values = [
    ...fieldValues(config.fields, entity),
    JSON.stringify(entity),
    entity.updatedAt,
    null,
    id,
  ]

  await db
    .prepare(`UPDATE ${config.table} SET ${setColumns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()
}

export const softDeleteEntity = async (db, config, id, entity) => {
  const status = String(entity.status || 'inactive')

  await db
    .prepare(`UPDATE ${config.table} SET status = ?, data = ?, updated_at = ?, deleted_at = ? WHERE id = ?`)
    .bind(status, JSON.stringify(entity), entity.updatedAt, entity.deletedAt, id)
    .run()
}
