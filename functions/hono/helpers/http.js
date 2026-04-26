import { fail as sharedFail, ok as sharedOk, parseBody as sharedParseBody } from '../../_lib/response.js'
import { listRows } from '../../_lib/db.js'

export const ok = (c, data = {}, status = 200) => sharedOk(data, status)

export const fail = (c, message = 'Request failed', status = 400, extra = {}) =>
  sharedFail(message, status, extra)

export const parseBody = async (c) => sharedParseBody(c.req)

export const publicUser = (user) => {
  if (!user) return null
  const { password, ...safeUser } = user
  return safeUser
}

export { listRows }
