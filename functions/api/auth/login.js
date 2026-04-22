import { fail, ok, parseBody } from '../../_lib/response'

const publicUser = (user) => {
  if (!user) return null
  const { password, ...safeUser } = user
  return safeUser
}

export const onRequestPost = async ({ request, env }) => {
  const body = await parseBody(request)
  const username = String(body.username || '').trim()
  const password = String(body.password || '').trim()

  if (!username || !password) {
    return fail('用户名和密码不能为空', 400)
  }

  const row = await env.DB
    .prepare('SELECT data FROM users WHERE username = ?1 LIMIT 1')
    .bind(username)
    .first()

  if (!row) {
    return fail('用户名或密码错误', 401)
  }

  const user = JSON.parse(row.data)
  if (user.password !== password) {
    return fail('用户名或密码错误', 401)
  }

  const token = btoa(`${user.id}:${Date.now()}`)
  return ok({ token, user: publicUser(user) })
}
