import { ok } from '../../_lib/response'

export const onRequestGet = async ({ env }) => {
  const [billCount, customerCount, fabricCount] = await Promise.all([
    env.DB.prepare('SELECT COUNT(1) AS total FROM bills').first(),
    env.DB.prepare('SELECT COUNT(1) AS total FROM customers').first(),
    env.DB.prepare('SELECT COUNT(1) AS total FROM fabrics').first(),
  ])

  return ok({
    data: {
      billCount: Number(billCount?.total || 0),
      customerCount: Number(customerCount?.total || 0),
      fabricCount: Number(fabricCount?.total || 0),
    },
  })
}
