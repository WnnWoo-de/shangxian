import { fail, listRows, ok, parseBody } from '../helpers/http'

export const registerFabricRoutes = (app) => {
  app.get('/api/fabrics', async (c) => {
    const fabrics = await listRows(
      c.env.DB,
      'SELECT data FROM fabrics WHERE deleted_at IS NULL ORDER BY datetime(updated_at) DESC'
    )
    return ok(c, { data: fabrics })
  })

  app.post('/api/fabrics', async (c) => {
    const body = await parseBody(c)
    const now = new Date().toISOString()
    const fabric = {
      ...body,
      id: String(body.id || `fab-${Date.now()}`),
      code: String(body.code || `FAB${Date.now().toString().slice(-4)}`),
      name: String(body.name || '').trim(),
      status: String(body.status || 'active'),
      createdAt: body.createdAt || now,
      updatedAt: now,
    }

    if (!fabric.name) {
      return fail(c, '布料名称不能为空', 400)
    }

    await c.env.DB
      .prepare(
        `INSERT OR REPLACE INTO fabrics (id, code, name, status, data, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL)`
      )
      .bind(fabric.id, fabric.code, fabric.name, fabric.status, JSON.stringify(fabric), fabric.createdAt, fabric.updatedAt)
      .run()

    return ok(c, { data: fabric }, 201)
  })

  app.put('/api/fabrics/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少布料ID', 400)

    const existingRow = await c.env.DB.prepare('SELECT data FROM fabrics WHERE id = ?1 AND deleted_at IS NULL').bind(id).first()
    if (!existingRow?.data) return fail(c, '布料不存在', 404)

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
        `UPDATE fabrics
           SET code = ?2, name = ?3, status = ?4, data = ?5, updated_at = ?6, deleted_at = NULL
         WHERE id = ?1`
      )
      .bind(
        id,
        String(updated.code || ''),
        String(updated.name || ''),
        String(updated.status || 'active'),
        JSON.stringify(updated),
        updated.updatedAt
      )
      .run()

    return ok(c, { data: updated })
  })

  app.delete('/api/fabrics/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少布料ID', 400)
    const existingRow = await c.env.DB.prepare('SELECT data FROM fabrics WHERE id = ?1').bind(id).first()
    if (!existingRow?.data) return ok(c, { data: { id } })

    const now = new Date().toISOString()
    const existing = JSON.parse(existingRow.data)
    const deleted = {
      ...existing,
      id,
      status: 'inactive',
      updatedAt: now,
      deletedAt: now,
    }

    await c.env.DB
      .prepare(
        `UPDATE fabrics
           SET status = ?2, data = ?3, updated_at = ?4, deleted_at = ?5
         WHERE id = ?1`
      )
      .bind(id, 'inactive', JSON.stringify(deleted), now, now)
      .run()
    return ok(c, { data: { id, deletedAt: now } })
  })
}
