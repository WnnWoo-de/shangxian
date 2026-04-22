export const json = (data, init = {}) => {
  const headers = new Headers(init.headers || {})
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export const ok = (data = {}, status = 200) => json({ success: true, ...data }, { status })

export const fail = (message = 'Request failed', status = 400, extra = {}) => {
  return json({ success: false, message, ...extra }, { status })
}

export const methodNotAllowed = () => fail('Method Not Allowed', 405)

export const parseBody = async (request) => {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export const nowIso = () => new Date().toISOString()
