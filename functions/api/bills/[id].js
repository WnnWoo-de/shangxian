import { fail, ok, parseBody } from '../../_lib/response'

export const onRequestPut = async ({ request, env, params }) => {
  const id = String(params.id || '')
  if (!id) return fail('缺少单据ID', 400)

  const existingRow = await env.DB.prepare('SELECT data FROM bills WHERE id = ?1').bind(id).first()
  if (!existingRow) return fail('单据不存在', 404)

  const existing = JSON.parse(existingRow.data)
  const payload = await parseBody(request)
  const updated = {
    ...existing,
    ...payload,
    id,
    type: payload.type ? (payload.type === 'sale' ? 'sale' : 'purchase') : (existing.type === 'sale' ? 'sale' : 'purchase'),
    updatedAt: new Date().toISOString(),
  }

  await env.DB
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

  return ok({ data: updated })
}

export const onRequestDelete = async ({ env, params }) => {
  const id = String(params.id || '')
  if (!id) return fail('缺少单据ID', 400)

  await env.DB.prepare('DELETE FROM bills WHERE id = ?1').bind(id).run()
  return ok({ data: { id } })
}
