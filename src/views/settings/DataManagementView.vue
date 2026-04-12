<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import request from '../../utils/request'
import { fetchStatisticsOverviewApi } from '../../api/statistics'
import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useFabricStore } from '../../stores/fabric'
import { incrementalSync, forceRefreshAll, getSyncStatus, startAutoSync, stopAutoSync } from '../../utils/sync'
import { getCache } from '../../utils/cache'

const loading = ref(false)
const status = ref('')
const stats = ref(null)
const serverStatus = ref('disconnected')
const syncing = ref(false)
const autoSyncEnabled = ref(false)
const lastSyncTime = ref('')

const billRecordStore = useBillRecordStore()
const customerStore = useCustomerStore()
const fabricStore = useFabricStore()

const setStatus = (message, type = 'info') => {
  status.value = { message, type }
  setTimeout(() => {
    status.value = ''
  }, 4000)
}

const checkServer = async () => {
  try {
    serverStatus.value = 'checking'
    await request.get('/health')
    serverStatus.value = 'connected'
  } catch (error) {
    serverStatus.value = 'disconnected'
    throw error
  }
}

const loadStats = async () => {
  const data = await fetchStatisticsOverviewApi()
  stats.value = {
    records: Number(data.billCount || 0),
    customers: Number(data.customerCount || 0),
    fabrics: Number(data.fabricCount || 0),
  }
}

const refreshAllData = async () => {
  loading.value = true
  try {
    await checkServer()
    await Promise.all([
      billRecordStore.refresh(),
      customerStore.refresh(),
      fabricStore.refresh(),
    ])
    await loadStats()
    setStatus('云端数据已刷新', 'success')
  } catch (error) {
    console.error('刷新云端数据失败:', error)
    setStatus('刷新失败，请稍后重试', 'error')
  } finally {
    loading.value = false
  }
}

const syncData = async () => {
  syncing.value = true
  try {
    const result = await incrementalSync(true)
    if (result.success) {
      await loadStats()
      updateLastSyncTime()
    }
  } finally {
    syncing.value = false
  }
}

const forceSyncData = async () => {
  syncing.value = true
  try {
    const result = await forceRefreshAll()
    if (result.success) {
      await loadStats()
      updateLastSyncTime()
    }
  } finally {
    syncing.value = false
  }
}

const toggleAutoSync = () => {
  autoSyncEnabled.value = !autoSyncEnabled.value
  if (autoSyncEnabled.value) {
    startAutoSync(30000) // 每30秒同步一次
    setStatus('自动同步已开启', 'success')
  } else {
    stopAutoSync()
    setStatus('自动同步已关闭', 'info')
  }
}

const updateLastSyncTime = () => {
  const syncStatus = getSyncStatus()
  if (syncStatus.lastSyncTime) {
    lastSyncTime.value = new Date(syncStatus.lastSyncTime).toLocaleString('zh-CN')
  }
}

const checkLastSyncTime = () => {
  const cached = getCache('last_sync_time')
  if (cached) {
    lastSyncTime.value = new Date(cached).toLocaleString('zh-CN')
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await checkServer()
    await loadStats()
    checkLastSyncTime()
  } catch (error) {
    console.error('加载数据管理页失败:', error)
    setStatus('服务器连接失败，请检查登录状态或网络', 'error')
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (autoSyncEnabled.value) {
    stopAutoSync()
  }
})
</script>

<template>
  <div class="data-management-container">
    <div class="header-box">
      <h2 class="title">数据管理</h2>
      <p class="subtitle">查看云端连接状态，进行数据同步与多端数据更新。</p>
    </div>

    <div v-if="status" :class="['status-banner', status.type]">
      {{ status.message }}
    </div>

    <section class="panel status-panel">
      <div class="panel-header">
        <h3>服务器状态</h3>
        <div :class="['server-status', serverStatus]">
          <span class="status-dot"></span>
          {{ serverStatus === 'connected' ? '已连接' : serverStatus === 'checking' ? '检查中...' : '未连接' }}
        </div>
      </div>
      <button class="action-btn" @click="refreshAllData" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新状态与数据' }}
      </button>
    </section>

    <section class="panel sync-panel">
      <div class="panel-header">
        <h3>数据同步</h3>
      </div>
      <div class="sync-info">
        <div class="sync-status-item">
          <span class="label">最后同步：</span>
          <span class="value">{{ lastSyncTime || '从未同步' }}</span>
        </div>
        <div class="sync-status-item">
          <span class="label">自动同步：</span>
          <span class="value">{{ autoSyncEnabled ? '已开启' : '已关闭' }}</span>
        </div>
      </div>
      <div class="action-group">
        <button class="action-btn primary" @click="syncData" :disabled="syncing || serverStatus !== 'connected'">
          {{ syncing ? '同步中...' : '立即同步' }}
        </button>
        <button class="action-btn" @click="forceSyncData" :disabled="syncing || serverStatus !== 'connected'">
          强制全量同步
        </button>
        <button class="action-btn" :class="{ primary: autoSyncEnabled }" @click="toggleAutoSync">
          {{ autoSyncEnabled ? '关闭自动同步' : '开启自动同步' }}
        </button>
      </div>
      <p class="hint">开启自动同步后，每30秒会自动从云端获取最新数据到本地。</p>
    </section>

    <section class="panel stats-panel" v-if="stats">
      <div class="panel-header">
        <h3>云端数据统计</h3>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ stats.records }}</span>
          <span class="stat-label">单据</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.customers }}</span>
          <span class="stat-label">客户</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.fabrics }}</span>
          <span class="stat-label">布料</span>
        </div>
      </div>
    </section>

    <section class="panel actions-panel">
      <div class="panel-header">
        <h3>多端同步说明</h3>
      </div>
      <div class="sync-instructions">
        <p><strong>如何实现多端同步：</strong></p>
        <ol>
          <li>在任意设备上登录同一个账号</li>
          <li>在一台设备上添加/修改/删除数据后，数据会保存到云端数据库</li>
          <li>在另一台设备上，点击「立即同步」按钮，即可获取最新数据</li>
          <li>或开启「自动同步」，系统每30秒自动获取最新数据</li>
        </ol>
        <p><strong>支持同步的数据：</strong>单据、客户、布料</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.data-management-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header-box .title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-normal);
}

.header-box .subtitle {
  font-size: 15px;
  color: var(--text-muted);
  margin-top: 6px;
}

.status-banner {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.status-banner.success {
  background: #d1fae5;
  color: #065f46;
}

.status-banner.error {
  background: #fee2e2;
  color: #991b1b;
}

.status-banner.info {
  background: #dbeafe;
  color: #1e40af;
}

.panel {
  padding: 20px;
  border-radius: 12px;
  background: var(--bg-soft);
  border: 1px solid var(--input-border);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-normal);
}

.server-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.server-status.connected {
  background: rgba(16, 185, 129, 0.14);
  color: #047857;
}

.server-status.checking {
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
}

.server-status.disconnected {
  background: rgba(239, 68, 68, 0.14);
  color: #b91c1c;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.sync-panel .sync-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.sync-status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.sync-status-item .label {
  color: var(--text-muted);
}

.sync-status-item .value {
  color: var(--text-normal);
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  padding: 18px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--input-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-normal);
}

.stat-label,
.hint {
  color: var(--text-muted);
  font-size: 14px;
}

.actions-panel {
  display: flex;
  flex-direction: column;
}

.sync-instructions {
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  margin-top: 16px;
}

.sync-instructions p {
  margin-bottom: 12px;
  line-height: 1.6;
}

.sync-instructions ol {
  padding-left: 20px;
  margin-bottom: 12px;
}

.sync-instructions li {
  margin-bottom: 8px;
  line-height: 1.6;
}

.action-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.action-btn {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--accent-blue);
  background: #fff;
  color: var(--accent-blue-deep);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn.primary {
  background: var(--accent-blue-deep);
  color: #fff;
  border-color: var(--accent-blue-deep);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .action-group {
    flex-direction: column;
  }
  .sync-panel .action-btn {
    width: 100%;
  }
}
</style>
