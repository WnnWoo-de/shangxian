import { fail, ok, parseBody } from '../../_lib/response'
import { listRows } from '../../_lib/db'

const LIST_SQL = 'SELECT data FROM customers ORDER BY datetime(updated_at) DESC'

export const onRequestGet = async ({ env }) => {
  const customers = await listRows(env.DB, LIST_SQL)
  return ok({ data: customers })
}

export const onRequestPost = async ({ request, env }) => {
  const body = await parseBody(request)
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
    return fail('客户名称不能为空', 400)
  }

  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO customers (id, name, status, data, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(customer.id, customer.name, customer.status, JSON.stringify(customer), customer.createdAt, customer.updatedAt)
    .run()

  return ok({ data: customer }, 201)
}
