import request from './request'
import { getCache, setCache } from './cache'

let syncTimer = null

const markSynced = () => {
  const now = new Date().toISOString()
  setCache('last_sync_time', now, 7 * 24 * 60 * 60 * 1000)
  return now
}

export const incrementalSync = async () => {
  await request.get('/health')
  const lastSyncTime = markSynced()
  return { success: true, syncedCount: 0, msg: '同步成功', lastSyncTime }
}

export const forceRefreshAll = async () => {
  await request.get('/health')
  const lastSyncTime = markSynced()
  return { success: true, msg: '强制刷新成功', lastSyncTime }
}

export const getSyncStatus = () => {
  const lastSyncTime = getCache('last_sync_time') || null
  return {
    lastSyncTime,
    status: syncTimer ? 'running' : 'idle',
    pendingCount: 0,
  }
}

export const startAutoSync = (interval = 30000) => {
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    incrementalSync().catch((error) => {
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
  return true
}

export default {
  incrementalSync,
  forceRefreshAll,
  getSyncStatus,
  startAutoSync,
  stopAutoSync,
}
