import axios from 'axios'

import storage from '@/utils/storage'
import { showErrorToast } from '@/utils/toast'

const DEFAULT_API_BASE = '/api'
const LEGACY_API_HOSTS = new Set([
  'my-cloudflare-backend.wnnwwnnw0705.workers.dev',
])

const isLegacyApiUrl = (input) => {
  if (!/^https?:\/\//i.test(input)) return false
  try {
    return LEGACY_API_HOSTS.has(new URL(input).host)
  } catch {
    return false
  }
}

const stripApiPrefix = (pathname) => {
  const normalized = String(pathname || '').replace(/^\/+/, '')
  return normalized.startsWith('api/') ? normalized.slice(4) : normalized
}

const normalizeApiBase = (base, fallback = '') => {
  const input = String(base || '').trim()
  if (!input) return fallback
  return isLegacyApiUrl(input) ? DEFAULT_API_BASE : input
}

const PRIMARY_API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL, DEFAULT_API_BASE)
const FALLBACK_API_BASE = normalizeApiBase(import.meta.env.VITE_FALLBACK_API_BASE_URL)
const DEFAULT_TIMEOUT_MS = import.meta.env.PROD ? 30000 : 12000
const DEFAULT_MAX_TIMEOUT_MS = 60000
const DEFAULT_GET_RETRY_COUNT = 2
const DEFAULT_RETRY_BASE_DELAY_MS = 600
const DEFAULT_ERROR_TOAST_COOLDOWN_MS = 8000

const parseTimeoutMs = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const REQUEST_TIMEOUT_MS = parseTimeoutMs(import.meta.env.VITE_API_TIMEOUT, DEFAULT_TIMEOUT_MS)
const MAX_TIMEOUT_MS = parseTimeoutMs(import.meta.env.VITE_API_MAX_TIMEOUT, DEFAULT_MAX_TIMEOUT_MS)
const GET_MAX_RETRY_COUNT = parseTimeoutMs(import.meta.env.VITE_API_GET_RETRY_COUNT, DEFAULT_GET_RETRY_COUNT)
const RETRY_BASE_DELAY_MS = parseTimeoutMs(import.meta.env.VITE_API_RETRY_BASE_DELAY, DEFAULT_RETRY_BASE_DELAY_MS)
const ERROR_TOAST_COOLDOWN_MS = parseTimeoutMs(import.meta.env.VITE_API_ERROR_TOAST_COOLDOWN, DEFAULT_ERROR_TOAST_COOLDOWN_MS)

const MOBILE_UA_REGEX = /Android|iPhone|iPad|iPod|Mobile/i

let lastToastMessage = ''
let lastToastAt = 0

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const getNetworkSlowFactor = () => {
  if (typeof navigator === 'undefined') return 1

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  let factor = MOBILE_UA_REGEX.test(navigator.userAgent || '') ? 1.25 : 1

  if (!connection) {
    return factor
  }

  if (connection.saveData) {
    factor = Math.max(factor, 1.8)
  }

  const type = String(connection.effectiveType || '').toLowerCase()
  if (type === 'slow-2g') factor = Math.max(factor, 3)
  if (type === '2g') factor = Math.max(factor, 2.6)
  if (type === '3g') factor = Math.max(factor, 1.8)
  if (type === '4g') factor = Math.max(factor, 1.2)

  const downlink = Number(connection.downlink || 0)
  if (downlink > 0 && downlink < 1) {
    factor = Math.max(factor, 2.3)
  } else if (downlink >= 1 && downlink < 1.5) {
    factor = Math.max(factor, 1.9)
  }

  return factor
}

const resolveAdaptiveTimeout = (baseTimeout) => {
  const target = Math.round(baseTimeout * getNetworkSlowFactor())
  return clamp(target, baseTimeout, MAX_TIMEOUT_MS)
}

const normalizeUrl = (base, url = '') => {
  if (!url) return '/'
  if (/^https?:\/\//i.test(url)) {
    if (isLegacyApiUrl(url)) {
      const parsed = new URL(url)
      return stripApiPrefix(parsed.pathname) || '/'
    }
    return url
  }

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
  const requestTimeout = parseTimeoutMs(config?.timeout, REQUEST_TIMEOUT_MS)
  config.timeout = resolveAdaptiveTimeout(requestTimeout)
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
const isNetworkError = (error) => {
  if (error?.response) return false
  if (error?.code === 'ERR_NETWORK') return true
  return /network error/i.test(String(error?.message || ''))
}

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
  let lastError = null

  for (let attempt = 0; attempt <= GET_MAX_RETRY_COUNT; attempt += 1) {
    try {
      return await requestOnce(client, method, endpoint, payload)
    } catch (error) {
      lastError = error
      const canRetry = method === 'get' && attempt < GET_MAX_RETRY_COUNT && (isTimeoutError(error) || isNetworkError(error))
      if (!canRetry) {
        throw error
      }
      const backoffMs = RETRY_BASE_DELAY_MS * (2 ** attempt)
      await sleep(backoffMs)
    }
  }
  throw lastError
}

const showErrorToastThrottled = (message) => {
  const now = Date.now()
  if (message === lastToastMessage && now - lastToastAt < ERROR_TOAST_COOLDOWN_MS) {
    return
  }
  lastToastMessage = message
  lastToastAt = now
  showErrorToast(message)
}

const buildErrorMessage = (error) => {
  const code = error?.code
  const status = error?.response?.status
  const apiMessage = error?.response?.data?.message
  const timeoutMs = parseTimeoutMs(error?.config?.timeout, REQUEST_TIMEOUT_MS)

  if (code === 'ECONNABORTED') {
    return `网络较慢，请稍后重试（请求超时 ${timeoutMs}ms）`
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
        showErrorToastThrottled(`${fallbackMessage}（主服务故障且兜底失败）`)
        throw fallbackError
      }
    }

    const message = buildErrorMessage(error)
    showErrorToastThrottled(message)
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
