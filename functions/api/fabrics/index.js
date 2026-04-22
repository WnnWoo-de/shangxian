import { fail, ok, parseBody } from '../../_lib/response'
import { listRows } from '../../_lib/db'

const LIST_SQL = 'SELECT data FROM fabrics ORDER BY datetime(updated_at) DESC'

export const onRequestGet = async ({ env }) => {
  const fabrics = await listRows(env.DB, LIST_SQL)
  return ok({ data: fabrics })
}

export const onRequestPost = async ({ request, env }) => {
  const body = await parseBody(request)
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
    return fail('布料名称不能为空', 400)
  }

  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO fabrics (id, code, name, status, data, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(fabric.id, fabric.code, fabric.name, fabric.status, JSON.stringify(fabric), fabric.createdAt, fabric.updatedAt)
    .run()

  return ok({ data: fabric }, 201)
}
