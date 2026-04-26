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

export const getUserByUsername = async (db, username) => {
  const result = await db.prepare('SELECT data FROM users WHERE username = ?1 LIMIT 1').bind(username).first()
  return mapRow(result)
}

export const countActiveRows = async (db, table) => {
  const result = await db.prepare(`SELECT COUNT(1) AS total FROM ${table} WHERE deleted_at IS NULL`).first()
  return Number(result?.total || 0)
}

export const checkConnection = async (db) => {
  await db.prepare('SELECT 1').first()
}
