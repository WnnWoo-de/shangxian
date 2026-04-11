// 数据同步工具（纯前端模拟）
export const incrementalSync = async (force = false) => {
  console.log('开始增量同步')
  await new Promise(resolve => setTimeout(resolve, 800))
  return { success: true, syncedCount: 0, msg: '同步成功' }
}

export const forceRefreshAll = async () => {
  console.log('开始强制刷新')
  await new Promise(resolve => setTimeout(resolve, 1200))
  return { success: true, msg: '强制刷新成功' }
}

export const getSyncStatus = () => {
  return {
    lastSyncTime: '2025-01-15 10:30:00',
    status: 'idle',
    pendingCount: 0
  }
}

export const startAutoSync = () => {
  console.log('自动同步已启用')
  return true
}

export const stopAutoSync = () => {
  console.log('自动同步已停用')
  return true
}

export default {
  incrementalSync,
  forceRefreshAll,
  getSyncStatus,
  startAutoSync,
  stopAutoSync
}
