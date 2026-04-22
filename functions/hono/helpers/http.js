export const ok = (c, data = {}, status = 200) => c.json({ success: true, ...data }, status)

export const fail = (c, message = 'Request failed', status = 400, extra = {}) =>
  c.json({ success: false, message, ...extra }, status)

export const parseBody = async (c) => {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

export const publicUser = (user) => {
  if (!user) return null
  const { password, ...safeUser } = user
  return safeUser
}

export const listRows = async (db, sql) => {
  const result = await db.prepare(sql).all()
  const rows = Array.isArray(result?.results) ? result.results : []
  return rows
    .map((row) => {
      try {
        return JSON.parse(row.data)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}
