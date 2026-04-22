import { nowIso } from './response'

export const mapRow = (row) => {
  if (!row) return null
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

export const listRows = async (db, sql) => {
  const result = await db.prepare(sql).all()
  const rows = Array.isArray(result.results) ? result.results : []
  return rows.map(mapRow).filter(Boolean)
}

export const getRowById = async (db, table, id) => {
  const result = await db.prepare(`SELECT data FROM ${table} WHERE id = ?1`).bind(id).first()
  return mapRow(result)
}

export const upsertRow = async (db, table, payload, extra = {}) => {
  const now = nowIso()
  const id = String(payload.id || `${table}-${Date.now()}`)
  const next = {
    ...payload,
    id,
    createdAt: payload.createdAt || now,
    updatedAt: now,
  }

  await db
    .prepare(extra.sql)
    .bind(...extra.bind(next), JSON.stringify(next), next.createdAt, next.updatedAt)
    .run()

  return next
}
