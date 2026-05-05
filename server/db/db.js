const SQL_DIALECTS = {
  d1: {
    placeholder: (index) => `?${index}`,
    dateTime: (expression) => `datetime(${expression})`,
    date: (expression) => `date(${expression})`,
    upsertKeyword: 'INSERT OR REPLACE',
    currentTimestamp: "datetime('now')",
  },
  mysql: {
    placeholder: () => '?',
    dateTime: (expression) => expression,
    date: (expression) => `DATE(${expression})`,
    upsertKeyword: 'REPLACE',
    currentTimestamp: 'CURRENT_TIMESTAMP(3)',
  },
}

const normalizeDialect = (dialect) => (dialect === 'mysql' ? 'mysql' : 'd1')

export const getDatabase = (source) => source?.DB || source

export const getDialect = (source) => normalizeDialect(source?.DB_DIALECT || source?.dialect || source?.databaseDialect)

export const getSqlDialect = (source) => SQL_DIALECTS[getDialect(source)]

export const bindablePlaceholders = (count, source) => {
  const dialect = getSqlDialect(source)
  return Array.from({ length: count }, (_, index) => dialect.placeholder(index + 1)).join(', ')
}

export const mapRow = (row) => {
  if (!row) return null
  try {
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  } catch {
    return null
  }
}

const runD1 = async (database, sql, params = [], mode = 'run') => {
  const statement = database.prepare(sql)
  const bound = params.length ? statement.bind(...params) : statement
  return bound[mode]()
}

const runMysqlLike = async (database, sql, params = [], mode = 'run') => {
  if (typeof database.execute === 'function') {
    const [rows] = await database.execute(sql, params)
    if (mode === 'first') return Array.isArray(rows) ? rows[0] || null : rows
    if (mode === 'all') return { results: Array.isArray(rows) ? rows : [] }
    return rows
  }

  if (typeof database.query === 'function') {
    const result = await database.query(sql, params)
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    if (mode === 'first') return Array.isArray(rows) ? rows[0] || null : rows
    if (mode === 'all') return { results: Array.isArray(rows) ? rows : [] }
    return rows
  }

  throw new Error('Unsupported MySQL database client. Expected execute() or query().')
}

export const execute = async (source, sql, params = [], mode = 'run') => {
  const database = getDatabase(source)
  if (!database) throw new Error('Database binding is missing')

  if (getDialect(source) === 'mysql') {
    return runMysqlLike(database, sql, params, mode)
  }

  return runD1(database, sql, params, mode)
}

export const first = (source, sql, params = []) => execute(source, sql, params, 'first')

export const all = (source, sql, params = []) => execute(source, sql, params, 'all')

export const run = (source, sql, params = []) => execute(source, sql, params, 'run')

export const listRows = async (db, sql, params = []) => {
  const result = await all(db, sql, params)
  const rows = Array.isArray(result.results) ? result.results : []
  return rows.map(mapRow).filter(Boolean)
}

export const getUserByUsername = async (db, username) => {
  const row = await first(db, 'SELECT data FROM users WHERE username = ? LIMIT 1', [username])
  return mapRow(row)
}

export const countActiveRows = async (db, table) => {
  const row = await first(db, `SELECT COUNT(1) AS total FROM ${table} WHERE deleted_at IS NULL`)
  return Number(row?.total || 0)
}

export const checkConnection = async (db) => {
  await first(db, 'SELECT 1')
}
