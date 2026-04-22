import { fail, ok, parseBody } from '../../_lib/response'

export const onRequestPut = async ({ request, env, params }) => {
  const id = String(params.id || '')
  if (!id) return fail('缺少客户ID', 400)

  const existingRow = await env.DB.prepare('SELECT data FROM customers WHERE id = ?1').bind(id).first()
  if (!existingRow) return fail('客户不存在', 404)

  const existing = JSON.parse(existingRow.data)
  const payload = await parseBody(request)
  const updated = {
    ...existing,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  }

  await env.DB
    .prepare(
      `UPDATE customers
         SET name = ?2, status = ?3, data = ?4, updated_at = ?5
       WHERE id = ?1`
    )
    .bind(id, String(updated.name || ''), String(updated.status || 'active'), JSON.stringify(updated), updated.updatedAt)
    .run()

  return ok({ data: updated })
}

export const onRequestDelete = async ({ env, params }) => {
  const id = String(params.id || '')
  if (!id) return fail('缺少客户ID', 400)

  await env.DB.prepare('DELETE FROM customers WHERE id = ?1').bind(id).run()
  return ok({ data: { id } })
}
