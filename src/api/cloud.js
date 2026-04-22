import request from '@/utils/request'

const getData = (res, fallback = null) => {
  if (res && typeof res === 'object' && 'data' in res) {
    return res.data
  }
  return fallback
}

export const loginApi = async (username, password) => {
  const res = await request.post('/auth/login', { username, password })
  return { token: res?.token, user: res?.user }
}

export const fetchCustomersApi = async () => {
  const res = await request.get('/customers')
  return getData(res, []) || []
}

export const createCustomerApi = async (payload) => {
  const res = await request.post('/customers', payload)
  return getData(res, payload)
}

export const updateCustomerApi = async (id, payload) => {
  const res = await request.put(`/customers/${id}`, payload)
  return getData(res, payload)
}

export const deleteCustomerApi = async (id) => {
  const res = await request.delete(`/customers/${id}`)
  return getData(res, { id })
}

export const fetchFabricsApi = async () => {
  const res = await request.get('/fabrics')
  return getData(res, []) || []
}

export const createFabricApi = async (payload) => {
  const res = await request.post('/fabrics', payload)
  return getData(res, payload)
}

export const updateFabricApi = async (id, payload) => {
  const res = await request.put(`/fabrics/${id}`, payload)
  return getData(res, payload)
}

export const deleteFabricApi = async (id) => {
  const res = await request.delete(`/fabrics/${id}`)
  return getData(res, { id })
}

export const fetchBillsApi = async () => {
  const res = await request.get('/bills')
  return getData(res, []) || []
}

export const createBillApi = async (payload) => {
  const res = await request.post('/bills', payload)
  return getData(res, payload)
}

export const updateBillApi = async (id, payload) => {
  const res = await request.put(`/bills/${id}`, payload)
  return getData(res, payload)
}

export const deleteBillApi = async (id) => {
  const res = await request.delete(`/bills/${id}`)
  return getData(res, { id })
}

export const fetchStatsOverviewApi = async () => {
  const res = await request.get('/stats/overview')
  return getData(res, { billCount: 0, customerCount: 0, fabricCount: 0 })
}
