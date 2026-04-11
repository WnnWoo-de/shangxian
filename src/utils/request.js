// HTTP 请求工具（纯前端模拟）
// 由于是纯前端项目，这里提供模拟请求功能

import { showErrorToast } from './toast'

// 创建请求实例
const request = {
  get: async (url, params = {}) => {
    console.log('GET request:', url, params)
    // 模拟请求延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    return { data: {}, msg: 'success' }
  },
  post: async (url, data = {}) => {
    console.log('POST request:', url, data)
    await new Promise(resolve => setTimeout(resolve, 300))
    return { data: {}, msg: 'success' }
  },
  put: async (url, data = {}) => {
    console.log('PUT request:', url, data)
    await new Promise(resolve => setTimeout(resolve, 300))
    return { data: {}, msg: 'success' }
  },
  delete: async (url) => {
    console.log('DELETE request:', url)
    await new Promise(resolve => setTimeout(resolve, 300))
    return { data: {}, msg: 'success' }
  }
}

export default request
