import { fail, ok, parseBody } from '../helpers/http.js'
import {
  getEntityById,
  insertEntity,
  listActiveEntities,
  softDeleteEntity,
  updateEntity,
} from '../../_lib/entity-repository.js'
import { entityConfigs } from '../../_lib/entity-configs.js'

const fabricConfig = entityConfigs.fabrics

export const registerFabricRoutes = (app) => {
  app.get('/api/fabrics', async (c) => {
    const fabrics = await listActiveEntities(c.env.DB, fabricConfig.table)
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

    await insertEntity(c.env.DB, fabricConfig, fabric)

    return ok(c, { data: fabric }, 201)
  })

  app.put('/api/fabrics/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少布料ID', 400)

    const existing = await getEntityById(c.env.DB, fabricConfig.table, id)
    if (!existing) return fail(c, '布料不存在', 404)

    const payload = await parseBody(c)
    const updated = {
      ...existing,
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
    }

    await updateEntity(c.env.DB, fabricConfig, id, updated)

    return ok(c, { data: updated })
  })

  app.delete('/api/fabrics/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少布料ID', 400)
    const existing = await getEntityById(c.env.DB, fabricConfig.table, id, { includeDeleted: true })
    if (!existing) return ok(c, { data: { id } })

    const now = new Date().toISOString()
    const deleted = {
      ...existing,
      id,
      status: 'inactive',
      updatedAt: now,
      deletedAt: now,
    }

    await softDeleteEntity(c.env.DB, fabricConfig, id, deleted)
    return ok(c, { data: { id, deletedAt: now } })
  })
}
