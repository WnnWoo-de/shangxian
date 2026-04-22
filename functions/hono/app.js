import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { fail } from './helpers/http'
import { registerHealthRoutes } from './routes/health'
import { registerAuthRoutes } from './routes/auth'
import { registerCustomerRoutes } from './routes/customers'
import { registerFabricRoutes } from './routes/fabrics'
import { registerBillRoutes } from './routes/bills'
import { registerStatsRoutes } from './routes/stats'

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

app.all('/api/*', (c) => fail(c, 'Not Found', 404))

export default app
