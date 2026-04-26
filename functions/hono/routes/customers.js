import { fail, ok, parseBody } from '../helpers/http.js'
import {
  getEntityById,
  insertEntity,
  listActiveEntities,
  softDeleteEntity,
  updateEntity,
} from '../../_lib/entity-repository.js'
import { entityConfigs } from '../../_lib/entity-configs.js'

const customerConfig = entityConfigs.customers

export const registerCustomerRoutes = (app) => {
  app.get('/api/customers', async (c) => {
    const customers = await listActiveEntities(c.env.DB, customerConfig.table)
    return ok(c, { data: customers })
  })

  app.post('/api/customers', async (c) => {
    const body = await parseBody(c)
    const now = new Date().toISOString()
    const customer = {
      ...body,
      id: String(body.id || `cust-${Date.now()}`),
      name: String(body.name || '').trim(),
      status: String(body.status || 'active'),
      createdAt: body.createdAt || now,
      updatedAt: now,
    }

    if (!customer.name) {
      return fail(c, '客户名称不能为空', 400)
    }

    await insertEntity(c.env.DB, customerConfig, customer)

    return ok(c, { data: customer }, 201)
  })

  app.put('/api/customers/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少客户ID', 400)

    const existing = await getEntityById(c.env.DB, customerConfig.table, id)
    if (!existing) return fail(c, '客户不存在', 404)

    const payload = await parseBody(c)
    const updated = {
      ...existing,
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
    }

    await updateEntity(c.env.DB, customerConfig, id, updated)

    return ok(c, { data: updated })
  })

  app.delete('/api/customers/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少客户ID', 400)
    const existing = await getEntityById(c.env.DB, customerConfig.table, id, { includeDeleted: true })
    if (!existing) return ok(c, { data: { id } })

    const now = new Date().toISOString()
    const deleted = {
      ...existing,
      id,
      status: 'inactive',
      updatedAt: now,
      deletedAt: now,
    }

    await softDeleteEntity(c.env.DB, customerConfig, id, deleted)

    return ok(c, { data: { id, deletedAt: now } })
  })
}
