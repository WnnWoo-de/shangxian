import { fail, listRows, ok, parseBody } from '../helpers/http'

export const registerCustomerRoutes = (app) => {
  app.get('/api/customers', async (c) => {
    const customers = await listRows(c.env.DB, 'SELECT data FROM customers ORDER BY datetime(updated_at) DESC')
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

    await c.env.DB
      .prepare(
        `INSERT OR REPLACE INTO customers (id, name, status, data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(customer.id, customer.name, customer.status, JSON.stringify(customer), customer.createdAt, customer.updatedAt)
      .run()

    return ok(c, { data: customer }, 201)
  })

  app.put('/api/customers/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少客户ID', 400)

    const existingRow = await c.env.DB.prepare('SELECT data FROM customers WHERE id = ?1').bind(id).first()
    if (!existingRow?.data) return fail(c, '客户不存在', 404)

    const existing = JSON.parse(existingRow.data)
    const payload = await parseBody(c)
    const updated = {
      ...existing,
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
    }

    await c.env.DB
      .prepare(
        `UPDATE customers
           SET name = ?2, status = ?3, data = ?4, updated_at = ?5
         WHERE id = ?1`
      )
      .bind(id, String(updated.name || ''), String(updated.status || 'active'), JSON.stringify(updated), updated.updatedAt)
      .run()

    return ok(c, { data: updated })
  })

  app.delete('/api/customers/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少客户ID', 400)
    await c.env.DB.prepare('DELETE FROM customers WHERE id = ?1').bind(id).run()
    return ok(c, { data: { id } })
  })
}
