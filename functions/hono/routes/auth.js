import { fail, ok, parseBody, publicUser } from '../helpers/http'

export const registerAuthRoutes = (app) => {
  app.post('/api/auth/login', async (c) => {
    const body = await parseBody(c)
    const username = String(body.username || '').trim()
    const password = String(body.password || '').trim()

    if (!username || !password) {
      return fail(c, '用户名和密码不能为空', 400)
    }

    const row = await c.env.DB.prepare('SELECT data FROM users WHERE username = ?1 LIMIT 1').bind(username).first()
    if (!row?.data) {
      return fail(c, '用户名或密码错误', 401)
    }

    const user = JSON.parse(row.data)
    if (user.password !== password) {
      return fail(c, '用户名或密码错误', 401)
    }

    const token = btoa(`${user.id}:${Date.now()}`)
    return ok(c, { token, user: publicUser(user) })
  })
}
