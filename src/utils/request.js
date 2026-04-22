import axios from 'axios'

import storage from './storage'
import { showErrorToast } from './toast'

const DEFAULT_API_BASE = '/api'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE

const normalizeUrl = (url = '') => {
  if (!url) return '/'

  // 如果 baseURL 已以 /api 结尾，则传入 /api/* 时去重
  if (API_BASE.endsWith('/api') && url.startsWith('/api/')) {
    return url.slice(4)
  }

  return url
}

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

client.interceptors.request.use((config) => {
  const token = storage.getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const handleError = (error) => {
  const message = error?.response?.data?.message || error?.message || '请求失败'
  showErrorToast(message)
  throw error
}

const request = {
  get: async (url, params = {}) => {
    try {
      const response = await client.get(normalizeUrl(url), { params })
      return response.data
    } catch (error) {
      return handleError(error)
    }
  },
  post: async (url, data = {}) => {
    try {
      const response = await client.post(normalizeUrl(url), data)
      return response.data
    } catch (error) {
      return handleError(error)
    }
  },
  put: async (url, data = {}) => {
    try {
      const response = await client.put(normalizeUrl(url), data)
      return response.data
    } catch (error) {
      return handleError(error)
    }
  },
  delete: async (url) => {
    try {
      const response = await client.delete(normalizeUrl(url))
      return response.data
    } catch (error) {
      return handleError(error)
    }
  },
}

export default request
