import { ok } from '../helpers/http'

export const registerHealthRoutes = (app) => {
  app.get('/api/health', async (c) => {
    try {
      await c.env.DB.prepare('SELECT 1').first()
      return ok(c, { message: 'ok', database: 'connected', timestamp: new Date().toISOString() })
    } catch (error) {
      return c.json(
        { success: false, message: 'database disconnected', error: String(error?.message || error) },
        500
      )
    }
  })
}
