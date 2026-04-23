import { ok } from '../helpers/http'

export const registerStatsRoutes = (app) => {
  app.get('/api/stats/overview', async (c) => {
    const [billCount, customerCount, fabricCount] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(1) AS total FROM bills WHERE deleted_at IS NULL').first(),
      c.env.DB.prepare('SELECT COUNT(1) AS total FROM customers WHERE deleted_at IS NULL').first(),
      c.env.DB.prepare('SELECT COUNT(1) AS total FROM fabrics WHERE deleted_at IS NULL').first(),
    ])

    return ok(c, {
      data: {
        billCount: Number(billCount?.total || 0),
        customerCount: Number(customerCount?.total || 0),
        fabricCount: Number(fabricCount?.total || 0),
      },
    })
  })
}
