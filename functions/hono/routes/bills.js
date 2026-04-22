import { fail, listRows, ok, parseBody } from '../helpers/http'

export const registerBillRoutes = (app) => {
  app.get('/api/bills', async (c) => {
    const bills = await listRows(
      c.env.DB,
      `SELECT data FROM bills
       ORDER BY date(bill_date) DESC, datetime(updated_at) DESC`
    )
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

    await c.env.DB
      .prepare(
        `INSERT OR REPLACE INTO bills
        (id, bill_no, type, bill_date, customer_name, status, total_amount, total_weight, data, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(
        bill.id,
        bill.billNo,
        bill.type,
        bill.billDate,
        bill.customerName,
        bill.status,
        bill.totalAmount,
        bill.totalWeight,
        JSON.stringify(bill),
        bill.createdAt,
        bill.updatedAt
      )
      .run()

    return ok(c, { data: bill }, 201)
  })

  app.put('/api/bills/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少单据ID', 400)

    const existingRow = await c.env.DB.prepare('SELECT data FROM bills WHERE id = ?1').bind(id).first()
    if (!existingRow?.data) return fail(c, '单据不存在', 404)

    const existing = JSON.parse(existingRow.data)
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

    await c.env.DB
      .prepare(
        `UPDATE bills
           SET bill_no = ?2,
               type = ?3,
               bill_date = ?4,
               customer_name = ?5,
               status = ?6,
               total_amount = ?7,
               total_weight = ?8,
               data = ?9,
               updated_at = ?10
         WHERE id = ?1`
      )
      .bind(
        id,
        String(updated.billNo || ''),
        String(updated.type || 'purchase'),
        String(updated.billDate || ''),
        String(updated.customerName || updated.partnerName || ''),
        String(updated.status || 'confirmed'),
        Number(updated.totalAmount || 0),
        Number(updated.totalWeight || 0),
        JSON.stringify(updated),
        updated.updatedAt
      )
      .run()

    return ok(c, { data: updated })
  })

  app.delete('/api/bills/:id', async (c) => {
    const id = String(c.req.param('id') || '')
    if (!id) return fail(c, '缺少单据ID', 400)
    await c.env.DB.prepare('DELETE FROM bills WHERE id = ?1').bind(id).run()
    return ok(c, { data: { id } })
  })
}
