import { ok } from '../helpers/http.js'
import { countActiveRows } from '../../_lib/db.js'

export const registerStatsRoutes = (app) => {
  app.get('/api/stats/overview', async (c) => {
    const [billCount, customerCount, fabricCount] = await Promise.all([
      countActiveRows(c.env.DB, 'bills'),
      countActiveRows(c.env.DB, 'customers'),
      countActiveRows(c.env.DB, 'fabrics'),
    ])

    return ok(c, {
      data: {
        billCount,
        customerCount,
        fabricCount,
      },
    })
  })
}
