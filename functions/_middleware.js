import app from './hono/app'

export const onRequest = (context) => {
  const url = new URL(context.request.url)
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return app.fetch(context.request, context.env)
  }
  return context.next()
}
