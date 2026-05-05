export const getDatabase = (source) => source?.DB || source

export const mapRow = (row) => {
  if (!row) return null
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

export const listRows = async (db, sql) => {
  const database = getDatabase(db)
  const result = await database.prepare(sql).all()
  const rows = Array.isArray(result.results) ? result.results : []
  return rows.map(mapRow).filter(Boolean)
}

export const getUserByUsername = async (db, username) => {
  const database = getDatabase(db)
  const result = await database.prepare('SELECT data FROM users WHERE username = ?1 LIMIT 1').bind(username).first()
  return mapRow(result)
}

export const countActiveRows = async (db, table) => {
  const database = getDatabase(db)
  const result = await database.prepare(`SELECT COUNT(1) AS total FROM ${table} WHERE deleted_at IS NULL`).first()
  return Number(result?.total || 0)
}

export const checkConnection = async (db) => {
  const database = getDatabase(db)
  await database.prepare('SELECT 1').first()
}
