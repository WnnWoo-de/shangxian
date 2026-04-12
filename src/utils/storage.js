// 本地存储工具
// 使用 localStorage 进行数据持久化

// 存储键名前缀
const STORAGE_PREFIX = 'wsbs_'

// 默认存储配置
const DEFAULT_CONFIG = {
  prefix: STORAGE_PREFIX,
  expires: null // 永不过期
}

// 存储项类型
const StorageTypes = {
  // 用户认证
  TOKEN: 'token',
  USER: 'user',

  // 业务数据
  CUSTOMERS: 'customers',
  FABRICS: 'fabrics',
  BILLS: 'bills',

  // 草稿与状态
  DRAFT_BILL: 'draft_bill',
  RECENT_CUSTOMERS: 'recent_customers',
  RECENT_FABRICS: 'recent_fabrics',
  APP_CONFIG: 'app_config',

  // 统计缓存
  STATS_CACHE: 'stats_cache'
}

/**
 * 获取存储键名（带前缀）
 * @param {string} key - 原始键名
 * @param {Object} options - 配置选项
 * @returns {string} 带前缀的键名
 */
function getKey(key, options = {}) {
  const prefix = options.prefix || DEFAULT_CONFIG.prefix
  return `${prefix}${key}`
}

/**
 * 基础存储方法
 * @param {string} key - 存储键名
 * @param {any} value - 存储值
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否成功
 */
function set(key, value, options = {}) {
  try {
    const data = {
      value,
      timestamp: Date.now(),
      expires: options.expires || DEFAULT_CONFIG.expires
    }
    localStorage.setItem(getKey(key, options), JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Storage set error:', error)
    return false
  }
}

/**
 * 基础获取方法
 * @param {string} key - 存储键名
 * @param {any} defaultValue - 默认值
 * @param {Object} options - 配置选项
 * @returns {any} 存储值或默认值
 */
function get(key, defaultValue = null, options = {}) {
  try {
    const rawData = localStorage.getItem(getKey(key, options))
    if (!rawData) {
      return defaultValue
    }

    const data = JSON.parse(rawData)
    const { value, timestamp, expires } = data

    // 检查过期时间
    if (expires && Date.now() > timestamp + expires) {
      remove(key, options)
      return defaultValue
    }

    return value
  } catch (error) {
    console.error('Storage get error:', error)
    return defaultValue
  }
}

/**
 * 删除存储项
 * @param {string} key - 存储键名
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否成功
 */
function remove(key, options = {}) {
  try {
    localStorage.removeItem(getKey(key, options))
    return true
  } catch (error) {
    console.error('Storage remove error:', error)
    return false
  }
}

/**
 * 清空所有存储（带前缀的）
 * @param {Object} options - 配置选项
 */
function clear(options = {}) {
  const prefix = options.prefix || DEFAULT_CONFIG.prefix
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  })
}

/**
 * 检查键是否存在
 * @param {string} key - 存储键名
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否存在
 */
function has(key, options = {}) {
  return !!localStorage.getItem(getKey(key, options))
}

/**
 * 获取存储大小
 * @param {Object} options - 配置选项
 * @returns {number} 存储大小（字节）
 */
function getSize(options = {}) {
  const prefix = options.prefix || DEFAULT_CONFIG.prefix
  let size = 0
  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      size += localStorage[key].length
    }
  })
  return size
}

/**
 * 存储数据并设置过期时间（分钟）
 * @param {string} key - 存储键名
 * @param {any} value - 存储值
 * @param {number} minutes - 过期时间（分钟）
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否成功
 */
function setWithExpiry(key, value, minutes, options = {}) {
  return set(key, value, {
    ...options,
    expires: minutes * 60 * 1000
  })
}

/**
 * 存储数据并设置过期时间（小时）
 * @param {string} key - 存储键名
 * @param {any} value - 存储值
 * @param {number} hours - 过期时间（小时）
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否成功
 */
function setWithHours(key, value, hours, options = {}) {
  return set(key, value, {
    ...options,
    expires: hours * 60 * 60 * 1000
  })
}

/**
 * 存储数据并设置过期时间（天）
 * @param {string} key - 存储键名
 * @param {any} value - 存储值
 * @param {number} days - 过期时间（天）
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否成功
 */
function setWithDays(key, value, days, options = {}) {
  return set(key, value, {
    ...options,
    expires: days * 24 * 60 * 60 * 1000
  })
}

/**
 * 获取所有带前缀的键名
 * @param {Object} options - 配置选项
 * @returns {Array} 键名数组
 */
function getKeys(options = {}) {
  const prefix = options.prefix || DEFAULT_CONFIG.prefix
  return Object.keys(localStorage).filter(key => key.startsWith(prefix))
}

/**
 * 获取存储数据信息
 * @param {Object} options - 配置选项
 * @returns {Array} 存储信息数组
 */
function getStorageInfo(options = {}) {
  const keys = getKeys(options)
  return keys.map(key => {
    try {
      const data = JSON.parse(localStorage[key])
      return {
        key: key.slice((options.prefix || DEFAULT_CONFIG.prefix).length),
        size: localStorage[key].length,
        timestamp: data.timestamp,
        expires: data.expires,
        value: data.value
      }
    } catch (error) {
      console.error('Error parsing storage item:', key, error)
      return null
    }
  }).filter(info => info)
}

/**
 * 清理过期的存储项
 * @param {Object} options - 配置选项
 * @returns {number} 清理的数量
 */
function cleanupExpired(options = {}) {
  let count = 0
  const storageInfo = getStorageInfo(options)
  storageInfo.forEach(info => {
    if (info.expires && Date.now() > info.timestamp + info.expires) {
      remove(info.key, options)
      count++
    }
  })
  return count
}

// 应用相关的存储操作
const storage = {
  // Token 操作
  setToken: (token) => set(StorageTypes.TOKEN, token),
  getToken: () => get(StorageTypes.TOKEN, null),
  removeToken: () => remove(StorageTypes.TOKEN),

  // 用户信息
  setUser: (user) => set(StorageTypes.USER, user),
  getUser: () => get(StorageTypes.USER, null),
  removeUser: () => remove(StorageTypes.USER),

  // 草稿单据
  setDraftBill: (bill) => set(StorageTypes.DRAFT_BILL, bill),
  getDraftBill: () => get(StorageTypes.DRAFT_BILL, null),
  removeDraftBill: () => remove(StorageTypes.DRAFT_BILL),

  // 最近使用客户
  setRecentCustomers: (customers) => set(StorageTypes.RECENT_CUSTOMERS, customers),
  getRecentCustomers: () => get(StorageTypes.RECENT_CUSTOMERS, []),
  addRecentCustomer: (customer) => {
    const recent = storage.getRecentCustomers()
    const filtered = recent.filter(item => item.id !== customer.id)
    filtered.unshift(customer)
    storage.setRecentCustomers(filtered.slice(0, 10)) // 最多保留10个
  },

  // 最近使用布料
  setRecentFabrics: (fabrics) => set(StorageTypes.RECENT_FABRICS, fabrics),
  getRecentFabrics: () => get(StorageTypes.RECENT_FABRICS, []),
  addRecentFabric: (fabric) => {
    const recent = storage.getRecentFabrics()
    const filtered = recent.filter(item => item.id !== fabric.id)
    filtered.unshift(fabric)
    storage.setRecentFabrics(filtered.slice(0, 10)) // 最多保留10个
  },

  // 应用配置
  setAppConfig: (config) => set(StorageTypes.APP_CONFIG, config),
  getAppConfig: () => get(StorageTypes.APP_CONFIG, {}),

  // 业务数据 - 客户
  setCustomers: (customers) => set(StorageTypes.CUSTOMERS, customers),
  getCustomers: () => get(StorageTypes.CUSTOMERS, []),
  removeCustomers: () => remove(StorageTypes.CUSTOMERS),

  // 业务数据 - 布料
  setFabrics: (fabrics) => set(StorageTypes.FABRICS, fabrics),
  getFabrics: () => get(StorageTypes.FABRICS, []),
  removeFabrics: () => remove(StorageTypes.FABRICS),

  // 业务数据 - 单据
  setBills: (bills) => set(StorageTypes.BILLS, bills),
  getBills: () => get(StorageTypes.BILLS, []),
  removeBills: () => remove(StorageTypes.BILLS),

  // 统计缓存
  setStatsCache: (stats) => set(StorageTypes.STATS_CACHE, stats),
  getStatsCache: () => get(StorageTypes.STATS_CACHE, null),
  removeStatsCache: () => remove(StorageTypes.STATS_CACHE),

  // 通用方法
  set,
  get,
  remove,
  clear,
  has,
  getSize,
  getKeys,
  getStorageInfo,
  cleanupExpired,
  setWithExpiry,
  setWithHours,
  setWithDays,
  readJson: get,
  writeJson: set,
  removeItem: remove
}

// 导出 StorageTypes 供外部使用
export { StorageTypes }

// 命名导出
export const readJson = storage.get
export const writeJson = storage.set
export const removeItem = storage.remove

export default storage
