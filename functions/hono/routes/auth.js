import { fail, ok, parseBody, publicUser } from '../helpers/http.js'
import { getUserByUsername } from '../../_lib/db.js'

export const registerAuthRoutes = (app) => {
  app.post('/api/auth/login', async (c) => {
    const body = await parseBody(c)
    const username = String(body.username || '').trim()
    const password = String(body.password || '').trim()

    if (!username || !password) {
      return fail(c, '用户名和密码不能为空', 400)
    }

    const user = await getUserByUsername(c.env.DB, username)
    if (!user) {
      return fail(c, '用户名或密码错误', 401)
    }

    if (user.password !== password) {
      return fail(c, '用户名或密码错误', 401)
    }

    const token = btoa(`${user.id}:${Date.now()}`)
    return ok(c, { data: { token, user: publicUser(user) } })
  })
}
