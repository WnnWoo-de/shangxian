import { fail, ok } from '../helpers/http.js'
import { checkConnection } from '../../_lib/db.js'

export const registerHealthRoutes = (app) => {
  app.get('/api/health', async (c) => {
    try {
      await checkConnection(c.env.DB)
      return ok(c, {
        data: {
          database: 'connected',
          timestamp: new Date().toISOString(),
        },
        message: 'ok',
      })
    } catch (error) {
      return fail(c, 'database disconnected', 500, { error: String(error?.message || error) })
    }
  })
}
