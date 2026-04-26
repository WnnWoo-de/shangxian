import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { fail } from './helpers/http.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerCustomerRoutes } from './routes/customers.js'
import { registerFabricRoutes } from './routes/fabrics.js'
import { registerBillRoutes } from './routes/bills.js'
import { registerStatsRoutes } from './routes/stats.js'
import { registerSyncRoutes } from './routes/sync.js'

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

registerHealthRoutes(app)
registerAuthRoutes(app)
registerCustomerRoutes(app)
registerFabricRoutes(app)
registerBillRoutes(app)
registerStatsRoutes(app)
registerSyncRoutes(app)

app.all('/api/*', (c) => fail(c, 'Not Found', 404))

export default app
