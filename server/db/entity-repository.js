import { bindablePlaceholders, first, getSqlDialect, listRows, mapRow, run } from './db.js'

const fieldValues = (fields, entity) => fields.map((field) => field.value(entity))

const buildUpsertSql = (db, table, columns) => {
  const dialect = getSqlDialect(db)
  const base = `${dialect.upsertKeyword} INTO ${table} (${columns.join(', ')}) VALUES (${bindablePlaceholders(columns.length, db)})`

  if (dialect.upsertKeyword === 'REPLACE') return base

  return base
}

export const listActiveEntities = async (db, table, orderBy) => {
  const dialect = getSqlDialect(db)
  const safeOrderBy = orderBy || `${dialect.dateTime('updated_at')} DESC`
  return listRows(db, `SELECT data FROM ${table} WHERE deleted_at IS NULL ORDER BY ${safeOrderBy}`)
}

export const getEntityById = async (db, table, id, options = {}) => {
  const deletedClause = options.includeDeleted ? '' : ' AND deleted_at IS NULL'
  const row = await first(db, `SELECT data FROM ${table} WHERE id = ?${deletedClause}`, [id])
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

  await run(db, buildUpsertSql(db, config.table, columns), values)
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

  await run(db, `UPDATE ${config.table} SET ${setColumns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`, values)
}

export const softDeleteEntity = async (db, config, id, entity) => {
  const status = String(entity.status || 'inactive')

  await run(
    db,
    `UPDATE ${config.table} SET status = ?, data = ?, updated_at = ?, deleted_at = ? WHERE id = ?`,
    [status, JSON.stringify(entity), entity.updatedAt, entity.deletedAt, id]
  )
}
