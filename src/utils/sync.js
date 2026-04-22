import { getCache, setCache } from './cache'
import storage from './storage'

let syncTimer = null
let syncInProgress = false
let lastSyncError = ''
let eventListenersBound = false
let foregroundTriggerAt = 0
let visibilityHandler = null
let focusHandler = null
let onlineHandler = null

const LAST_SYNC_CACHE_KEY = 'last_sync_time'
const LAST_SYNC_STORAGE_KEY = 'wsbs_last_sync_time'
const FOREGROUND_SYNC_COOLDOWN_MS = 10000

const toList = (value) => (Array.isArray(value) ? value : [])

const readLastSyncTime = () => {
  const cached = getCache(LAST_SYNC_CACHE_KEY)
  if (cached) return cached

  if (typeof window !== 'undefined') {
    const persisted = window.localStorage.getItem(LAST_SYNC_STORAGE_KEY)
    if (persisted) return persisted
  }
  return null
}

const markSynced = () => {
  const now = new Date().toISOString()
  setCache(LAST_SYNC_CACHE_KEY, now, 7 * 24 * 60 * 60 * 1000)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, now)
  }
  return now
}

const buildMap = (list) => {
  const map = new Map()
  toList(list).forEach((item) => {
    const id = String(item?.id ?? '')
    if (!id) return
    const stamp = String(item?.updatedAt ?? item?.createdAt ?? '')
    map.set(id, stamp)
  })
  return map
}

const diffCount = (beforeList, afterList) => {
  const before = buildMap(beforeList)
  const after = buildMap(afterList)
  let changed = 0

  after.forEach((stamp, id) => {
    if (!before.has(id) || before.get(id) !== stamp) {
      changed += 1
    }
  })
  before.forEach((_, id) => {
    if (!after.has(id)) {
      changed += 1
    }
  })

  return changed
}

const getStoreDataSnapshot = (stores) => ({
  bills: toList(stores.billRecordStore?.records),
  customers: toList(stores.customerStore?.customers),
  fabrics: toList(stores.fabricStore?.fabrics),
})

const resolveStores = async () => {
  const [{ useBillRecordStore }, { useCustomerStore }, { useFabricStore }] = await Promise.all([
    import('@/stores/billRecord'),
    import('@/stores/customer'),
    import('@/stores/fabric'),
  ])

  return {
    billRecordStore: useBillRecordStore(),
    customerStore: useCustomerStore(),
    fabricStore: useFabricStore(),
  }
}

const runSync = async (force = false) => {
  if (!storage.getToken()) {
    return { success: false, syncedCount: 0, msg: '未登录，无法同步', lastSyncTime: readLastSyncTime() }
  }
  if (syncInProgress) {
    return { success: false, syncedCount: 0, msg: '同步进行中，请稍候', lastSyncTime: readLastSyncTime() }
  }

  syncInProgress = true
  lastSyncError = ''

  try {
    const stores = await resolveStores()
    const isBusy = stores.billRecordStore.loading || stores.customerStore.loading || stores.fabricStore.loading
    if (isBusy && !force) {
      return { success: false, syncedCount: 0, msg: '当前有数据操作，稍后自动重试', lastSyncTime: readLastSyncTime() }
    }

    const before = getStoreDataSnapshot(stores)
    await Promise.all([
      stores.billRecordStore.refresh(),
      stores.customerStore.refresh(),
      stores.fabricStore.refresh(),
    ])
    const after = getStoreDataSnapshot(stores)

    const detail = {
      bills: diffCount(before.bills, after.bills),
      customers: diffCount(before.customers, after.customers),
      fabrics: diffCount(before.fabrics, after.fabrics),
    }
    const syncedCount = detail.bills + detail.customers + detail.fabrics
    const lastSyncTime = markSynced()
    return {
      success: true,
      syncedCount,
      detail,
      msg: syncedCount > 0 ? `同步完成，更新 ${syncedCount} 条` : '同步完成，暂无更新',
      lastSyncTime,
    }
  } catch (error) {
    lastSyncError = error?.message || '同步失败'
    return {
      success: false,
      syncedCount: 0,
      msg: `同步失败：${lastSyncError}`,
      lastSyncTime: readLastSyncTime(),
    }
  } finally {
    syncInProgress = false
  }
}

const triggerForegroundSync = () => {
  const now = Date.now()
  if (now - foregroundTriggerAt < FOREGROUND_SYNC_COOLDOWN_MS) return
  foregroundTriggerAt = now
  runSync(false).catch((error) => {
    console.error('前台同步失败:', error)
  })
}

const bindForegroundListeners = () => {
  if (eventListenersBound || typeof window === 'undefined') return
  eventListenersBound = true

  visibilityHandler = () => {
    if (!document.hidden) {
      triggerForegroundSync()
    }
  }
  focusHandler = () => triggerForegroundSync()
  onlineHandler = () => triggerForegroundSync()

  document.addEventListener('visibilitychange', visibilityHandler)
  window.addEventListener('focus', focusHandler)
  window.addEventListener('online', onlineHandler)
}

const unbindForegroundListeners = () => {
  if (!eventListenersBound || typeof window === 'undefined') return
  eventListenersBound = false

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  if (focusHandler) {
    window.removeEventListener('focus', focusHandler)
    focusHandler = null
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler)
    onlineHandler = null
  }
}

export const incrementalSync = async () => {
  return runSync(false)
}

export const forceRefreshAll = async () => {
  return runSync(true)
}

export const getSyncStatus = () => {
  const lastSyncTime = readLastSyncTime()
  return {
    lastSyncTime,
    status: syncInProgress ? 'syncing' : (syncTimer ? 'running' : 'idle'),
    pendingCount: 0,
    lastError: lastSyncError || null,
  }
}

export const startAutoSync = (interval = 30000) => {
  if (syncTimer) clearInterval(syncTimer)
  bindForegroundListeners()
  triggerForegroundSync()

  syncTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }
    runSync(false).catch((error) => {
      console.error('自动同步失败:', error)
    })
  }, interval)
  return true
}

export const stopAutoSync = () => {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  unbindForegroundListeners()
  return true
}

export default {
  incrementalSync,
  forceRefreshAll,
  getSyncStatus,
  startAutoSync,
  stopAutoSync,
}
