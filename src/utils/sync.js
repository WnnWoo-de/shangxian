import { getCache, setCache } from './cache'
import storage from './storage'
import { pullSyncApi, pushSyncApi } from '@/api/cloud'
import { getSyncQueue, getSyncQueueStats, removeSyncQueueByOpIds } from './sync-queue'

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

const markSynced = (time) => {
  const now = String(time || new Date().toISOString())
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

const countRemoteChanges = (changes = {}) => ({
  bills: toList(changes?.bills?.upserts).length + toList(changes?.bills?.deletes).length,
  customers: toList(changes?.customers?.upserts).length + toList(changes?.customers?.deletes).length,
  fabrics: toList(changes?.fabrics?.upserts).length + toList(changes?.fabrics?.deletes).length,
})

const pickRefreshTargets = (detail, force, pushResult = {}) => {
  const conflictEntities = new Set()
  toList(pushResult.conflicts).forEach((item) => conflictEntities.add(String(item?.entity || '')))
  toList(pushResult.invalid).forEach((item) => conflictEntities.add(String(item?.entity || '')))

  return {
    bills: force || detail.bills > 0 || conflictEntities.has('bills'),
    customers: force || detail.customers > 0 || conflictEntities.has('customers'),
    fabrics: force || detail.fabrics > 0 || conflictEntities.has('fabrics'),
  }
}

const refreshByTargets = async (stores, targets) => {
  const jobs = []
  if (targets.bills) jobs.push(stores.billRecordStore.refresh())
  if (targets.customers) jobs.push(stores.customerStore.refresh())
  if (targets.fabrics) jobs.push(stores.fabricStore.refresh())
  await Promise.all(jobs)
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

    const pendingQueue = getSyncQueue()
    let pushResult = {
      appliedCount: 0,
      conflictCount: 0,
      invalidCount: 0,
      appliedOpIds: [],
      conflicts: [],
      invalid: [],
      serverTime: null,
    }

    if (pendingQueue.length > 0) {
      pushResult = await pushSyncApi(pendingQueue)
      const handledOpIds = [
        ...toList(pushResult.appliedOpIds),
        ...toList(pushResult.conflicts).map((item) => item?.opId),
        ...toList(pushResult.invalid).map((item) => item?.opId),
      ].filter(Boolean)
      removeSyncQueueByOpIds(handledOpIds)
    }

    const since = force ? null : readLastSyncTime()
    const pullResult = await pullSyncApi(since, force || !since)
    const detail = countRemoteChanges(pullResult?.changes || {})
    const refreshTargets = pickRefreshTargets(detail, force, pushResult)

    const needRefresh = refreshTargets.bills || refreshTargets.customers || refreshTargets.fabrics
    if (needRefresh) {
      const before = getStoreDataSnapshot(stores)
      await refreshByTargets(stores, refreshTargets)
      const after = getStoreDataSnapshot(stores)
      if (refreshTargets.bills) detail.bills = Math.max(detail.bills, diffCount(before.bills, after.bills))
      if (refreshTargets.customers) detail.customers = Math.max(detail.customers, diffCount(before.customers, after.customers))
      if (refreshTargets.fabrics) detail.fabrics = Math.max(detail.fabrics, diffCount(before.fabrics, after.fabrics))
    }

    const syncedCount = detail.bills + detail.customers + detail.fabrics
    const lastSyncTime = markSynced(pullResult?.serverTime || pushResult?.serverTime)
    const pendingStats = getSyncQueueStats()
    const conflictCount = Number(pushResult.conflictCount || 0)
    const invalidCount = Number(pushResult.invalidCount || 0)

    const msgParts = []
    if (pushResult.appliedCount > 0) msgParts.push(`已上传 ${pushResult.appliedCount} 条本地改动`)
    if (syncedCount > 0) msgParts.push(`已拉取 ${syncedCount} 条云端更新`)
    if (!msgParts.length) msgParts.push('同步完成，暂无更新')
    if (conflictCount > 0) msgParts.push(`检测到 ${conflictCount} 条冲突，已保留云端版本`)
    if (invalidCount > 0) msgParts.push(`${invalidCount} 条无效改动已忽略`)

    return {
      success: true,
      syncedCount,
      detail,
      msg: msgParts.join('；'),
      lastSyncTime,
      push: {
        appliedCount: Number(pushResult.appliedCount || 0),
        conflictCount,
        invalidCount,
      },
      pendingCount: pendingStats.total,
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
  const pendingStats = getSyncQueueStats()
  return {
    lastSyncTime,
    status: syncInProgress ? 'syncing' : (syncTimer ? 'running' : 'idle'),
    pendingCount: pendingStats.total,
    pendingDetail: pendingStats.byEntity,
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
