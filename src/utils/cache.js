// 缓存工具（纯前端模拟）
const cache = {}

export const setCache = (key, value, ttl = 300000) => { // 默认5分钟
  cache[key] = {
    value,
    timestamp: Date.now(),
    ttl
  }
}

export const getCache = (key) => {
  const item = cache[key]
  if (!item) return null
  if (Date.now() - item.timestamp > item.ttl) {
    delete cache[key]
    return null
  }
  return item.value
}

export const removeCache = (key) => {
  delete cache[key]
}

export const clearCache = () => {
  Object.keys(cache).forEach(key => delete cache[key])
}

export default {
  setCache,
  getCache,
  removeCache,
  clearCache
}
