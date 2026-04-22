import { fail, ok, parseBody } from '../../_lib/response'
import { listRows } from '../../_lib/db'

const LIST_SQL = `SELECT data FROM bills
ORDER BY date(bill_date) DESC, datetime(updated_at) DESC`

export const onRequestGet = async ({ env }) => {
  const bills = await listRows(env.DB, LIST_SQL)
  return ok({ data: bills })
}

export const onRequestPost = async ({ request, env }) => {
  const body = await parseBody(request)
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

  if (!bill.id) return fail('单据ID无效', 400)

  await env.DB
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

  return ok({ data: bill }, 201)
}
