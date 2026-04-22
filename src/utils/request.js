import axios from 'axios'

import storage from './storage'
import { showErrorToast } from './toast'

const DEFAULT_API_BASE = '/api'
const PRIMARY_API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
const FALLBACK_API_BASE = (import.meta.env.VITE_FALLBACK_API_BASE_URL || '').trim()
const DEFAULT_TIMEOUT_MS = import.meta.env.PROD ? 20000 : 10000

const parseTimeoutMs = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const REQUEST_TIMEOUT_MS = parseTimeoutMs(import.meta.env.VITE_API_TIMEOUT, DEFAULT_TIMEOUT_MS)

const normalizeUrl = (base, url = '') => {
  if (!url) return '/'
  if (/^https?:\/\//i.test(url)) return url

  let path = String(url).trim()
  if (path.startsWith('/')) {
    path = path.slice(1)
  }

  if (base.endsWith('/api') && path.startsWith('api/')) {
    path = path.slice(4)
  }

  return path || '/'
}

const createClient = (baseURL) => axios.create({ baseURL, timeout: REQUEST_TIMEOUT_MS })

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
  return noResponse || status >= 500 || status === 404
}

const isTimeoutError = (error) => error?.code === 'ECONNABORTED'

const requestOnce = async (client, method, endpoint, payload) => {
  if (method === 'get') {
    const response = await client.get(endpoint, { params: payload || {} })
    return response.data
  }
  if (method === 'delete') {
    const response = await client.delete(endpoint)
    return response.data
  }
  const response = await client[method](endpoint, payload || {})
  return response.data
}

const requestWithTimeoutRetry = async (client, method, endpoint, payload) => {
  try {
    return await requestOnce(client, method, endpoint, payload)
  } catch (error) {
    if (method === 'get' && isTimeoutError(error)) {
      return requestOnce(client, method, endpoint, payload)
    }
    throw error
  }
}

const buildErrorMessage = (error) => {
  const code = error?.code
  const status = error?.response?.status
  const apiMessage = error?.response?.data?.message

  if (code === 'ECONNABORTED') {
    return `网络较慢，请稍后重试（请求超时 ${REQUEST_TIMEOUT_MS}ms）`
  }

  if (!error?.response) {
    return '网络连接异常，请检查网络后重试'
  }

  if (apiMessage) return apiMessage
  if (status === 500) return '服务器内部错误（500），请稍后重试或联系管理员'
  if (status) return `请求失败（${status}）`
  return error?.message || '请求失败'
}

const execute = async (method, url, payload) => {
  const endpoint = normalizeUrl(PRIMARY_API_BASE, url)

  try {
    return await requestWithTimeoutRetry(primaryClient, method, endpoint, payload)
  } catch (error) {
    if (shouldRetryWithFallback(error)) {
      try {
        const fallbackEndpoint = normalizeUrl(FALLBACK_API_BASE, url)
        return await requestWithTimeoutRetry(fallbackClient, method, fallbackEndpoint, payload)
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
