import { fail, ok, parseBody } from '../helpers/http.js'
import {
  getEntityById,
  insertEntity,
  listActiveEntities,
  softDeleteEntity,
  updateEntity,
} from '../../_lib/entity-repository.js'
import { entityConfigs } from '../../_lib/entity-configs.js'

const billConfig = entityConfigs.bills

export const registerBillRoutes = (app) => {
  app.get('/api/bills', async (c) => {
    const bills = await listActiveEntities(c.env.DB, billConfig.table, 'date(bill_date) DESC, datetime(updated_at) DESC')
    return ok(c, { data: bills })
  })

  app.post('/api/bills', async (c) => {
    const body = await parseBody(c)
    const now = new Date().toISOString()
    const bill = {
      ...body,
      id: String(body.id || `bill-${Date.now()}`),
      billNo: String(body.billNo || `B${Date.now()}`),
      type: body.type === 'sale' ? 'sale' : 'purchase',
      billDate: String(body.billDate || now.slice(0, 10)),
      customerName: String(body.customerName || body.partnerName || ''),
      status: String(body.status || 'confirmed'),
      totalAmount: Number(body.totalAmount || 0),
      totalWeight: Number(body.totalWeight || 0),
      createdAt: body.createdAt || now,
      updatedAt: now,
    }

    if (!bill.id) return fail(c, '单据ID无效', 400)

    await insertEntity(c.env.DB, billConfig, bill)

    return ok(c, { data: bill }, 201)
  })

  app.put('/api/bills/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少单据ID', 400)

    const existing = await getEntityById(c.env.DB, billConfig.table, id)
    if (!existing) return fail(c, '单据不存在', 404)

    const payload = await parseBody(c)
    const updated = {
      ...existing,
      ...payload,
      id,
      type: payload.type
        ? (payload.type === 'sale' ? 'sale' : 'purchase')
        : (existing.type === 'sale' ? 'sale' : 'purchase'),
      updatedAt: new Date().toISOString(),
    }

    await updateEntity(c.env.DB, billConfig, id, updated)

    return ok(c, { data: updated })
  })

  app.delete('/api/bills/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少单据ID', 400)
    const existing = await getEntityById(c.env.DB, billConfig.table, id, { includeDeleted: true })
    if (!existing) return ok(c, { data: { id } })

    const now = new Date().toISOString()
    const deleted = {
      ...existing,
      id,
      status: 'deleted',
      updatedAt: now,
      deletedAt: now,
    }

    await softDeleteEntity(c.env.DB, billConfig, id, deleted)

    return ok(c, { data: { id, deletedAt: now } })
  })
}
