import { ok } from '../_lib/response'

export const onRequestGet = async ({ env }) => {
  try {
    await env.DB.prepare('SELECT 1').first()
    return ok({ message: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'database disconnected', error: String(error?.message || error) }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  }
}
