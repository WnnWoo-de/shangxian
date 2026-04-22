import axios from 'axios'

import storage from './storage'
import { showErrorToast } from './toast'

const PROD_WORKER_API_BASE = 'https://my-cloudflare-backend.wnnwwnnw0705.workers.dev/api'
const DEFAULT_API_BASE = import.meta.env.DEV ? '/api' : PROD_WORKER_API_BASE
const PRIMARY_API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
const FALLBACK_API_BASE = (
  import.meta.env.VITE_FALLBACK_API_BASE_URL
  || (PRIMARY_API_BASE === '/api' ? PROD_WORKER_API_BASE : '')
).trim()

const normalizeUrl = (base, url = '') => {
  if (!url) return '/'
  if (base.endsWith('/api') && url.startsWith('/api/')) {
    return url.slice(4)
  }
  return url
}

const createClient = (baseURL) => axios.create({ baseURL, timeout: 10000 })

const primaryClient = createClient(PRIMARY_API_BASE)
const fallbackClient = FALLBACK_API_BASE ? createClient(FALLBACK_API_BASE) : null

const addAuthHeader = (config) => {
  const token = storage.getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

primaryClient.interceptors.request.use(addAuthHeader)
if (fallbackClient) {
  fallbackClient.interceptors.request.use(addAuthHeader)
}

const shouldRetryWithFallback = (error) => {
  if (!fallbackClient) return false
  if (PRIMARY_API_BASE === FALLBACK_API_BASE) return false
  const status = Number(error?.response?.status || 0)
  const noResponse = !error?.response
  return noResponse || status >= 500
}

const buildErrorMessage = (error) => {
  const status = error?.response?.status
  const apiMessage = error?.response?.data?.message
  if (apiMessage) return apiMessage
  if (status === 500) return '服务器内部错误（500），请稍后重试或联系管理员'
  if (status) return `请求失败（${status}）`
  return error?.message || '请求失败'
}

const execute = async (method, url, payload) => {
  const endpoint = normalizeUrl(PRIMARY_API_BASE, url)

  try {
    if (method === 'get') {
      const response = await primaryClient.get(endpoint, { params: payload || {} })
      return response.data
    }
    if (method === 'delete') {
      const response = await primaryClient.delete(endpoint)
      return response.data
    }
    const response = await primaryClient[method](endpoint, payload || {})
    return response.data
  } catch (error) {
    if (shouldRetryWithFallback(error)) {
      try {
        const fallbackEndpoint = normalizeUrl(FALLBACK_API_BASE, url)
        if (method === 'get') {
          const response = await fallbackClient.get(fallbackEndpoint, { params: payload || {} })
          return response.data
        }
        if (method === 'delete') {
          const response = await fallbackClient.delete(fallbackEndpoint)
          return response.data
        }
        const response = await fallbackClient[method](fallbackEndpoint, payload || {})
        return response.data
      } catch (fallbackError) {
        const fallbackMessage = buildErrorMessage(fallbackError)
        showErrorToast(`${fallbackMessage}（主服务故障且兜底失败）`)
        throw fallbackError
      }
    }

    const message = buildErrorMessage(error)
    showErrorToast(message)
    throw error
  }
}

const request = {
  get: async (url, params = {}) => execute('get', url, params),
  post: async (url, data = {}) => execute('post', url, data),
  put: async (url, data = {}) => execute('put', url, data),
  delete: async (url) => execute('delete', url),
}

export default request
