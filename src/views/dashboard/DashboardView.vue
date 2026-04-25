<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useFabricStore } from '@/stores/fabric'
import { useBillRecordStore } from '@/stores/billRecord'
import logoUrl from '@/assets/logo.png'
import { ElMessageBox } from 'element-plus'
import IconPurchase from '@/components/icons/IconPurchase.vue'
import IconSale from '@/components/icons/IconSale.vue'
import IconList from '@/components/icons/IconList.vue'
import IconCustomer from '@/components/icons/IconCustomer.vue'
import IconFabric from '@/components/icons/IconFabric.vue'
import IconReport from '@/components/icons/IconReport.vue'
import IconStatistics from '@/components/icons/IconStatistics.vue'
import { onBillDataChanged } from '@/utils/bill-events'

const router = useRouter()
const authStore = useAuthStore()
const customerStore = useCustomerStore()
const fabricStore = useFabricStore()
const billRecordStore = useBillRecordStore()
const loading = ref(true)
const timeRange = ref('today') // today, week, month
let disposeBillChangedListener = null
let syncingRecentBills = false

// 快捷操作 - 简化为核心功能
const shortcuts = [
  { label: '进货开单', route: '/purchase/create', icon: IconPurchase, color: '#1a915c' },
  { label: '出货开单', route: '/sale/create', icon: IconSale, color: '#2c3e50' },
  { label: '进货记录', route: '/purchase/list', icon: IconList, color: '#d4a76a' },
  { label: '出货记录', route: '/sale/list', icon: IconReport, color: '#62c29a' },
  { label: '客户管理', route: '/customer', icon: IconCustomer, color: '#9ecfc2' },
  { label: '品种管理', route: '/fabric', icon: IconFabric, color: '#e67e22' },
]

// 获取日期范围
const getDateRange = () => {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  if (timeRange.value === 'today') {
    return { start: today, end: today }
  } else if (timeRange.value === 'week') {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    return {
      start: weekStart.toISOString().slice(0, 10),
      end: today
    }
  } else {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      start: monthStart.toISOString().slice(0, 10),
      end: today
    }
  }
}

// 筛选指定日期范围内的单据
const filteredBills = computed(() => {
  const { start, end } = getDateRange()
  return billRecordStore.records.filter(item => {
    const billDate = item.billDate || item.createdAt?.slice?.(0, 10)
    return billDate >= start && billDate <= end
  })
})

const purchaseBills = computed(() => filteredBills.value.filter(item => item.type === 'purchase'))
const saleBills = computed(() => filteredBills.value.filter(item => item.type === 'sale'))

// 计算统计数据
const stats = computed(() => {
  const purchaseCount = purchaseBills.value.length
  const saleCount = saleBills.value.length
  const purchaseAmount = purchaseBills.value.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const saleAmount = saleBills.value.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const profit = saleAmount - purchaseAmount

  return [
    { label: '进货单数', value: purchaseCount, suffix: '单', color: '#1a915c', icon: IconPurchase },
    { label: '出货单数', value: saleCount, suffix: '单', color: '#2c3e50', icon: IconSale },
    { label: '进货金额', value: Number(purchaseAmount).toFixed(2), prefix: '¥ ', color: '#d4a76a', icon: IconList },
    { label: '出货金额', value: Number(saleAmount).toFixed(2), prefix: '¥ ', color: '#62c29a', icon: IconReport },
    { label: '经营利润', value: Number(profit).toFixed(2), prefix: '¥ ', color: profit >= 0 ? '#1a915c' : '#e74c3c', icon: IconStatistics },
    { label: '活跃客户', value: customerStore.activeCount, suffix: '位', color: '#9ecfc2', icon: IconCustomer },
  ]
})

// 最近单据
const recentBills = computed(() => {
  return [...billRecordStore.records]
    .sort((a, b) => new Date(b.createdAt || b.billDate) - new Date(a.createdAt || a.billDate))
})

const recentPageSizeOptions = [5, 10, 20]
const recentCurrentPage = ref(1)
const recentPageSize = ref(5)
const recentTotalPages = computed(() => Math.max(1, Math.ceil(recentBills.value.length / recentPageSize.value)))
const recentPaginationStart = computed(() => recentBills.value.length ? (recentCurrentPage.value - 1) * recentPageSize.value + 1 : 0)
const recentPaginationEnd = computed(() => Math.min(recentCurrentPage.value * recentPageSize.value, recentBills.value.length))
const paginatedRecentBills = computed(() => {
  const start = (recentCurrentPage.value - 1) * recentPageSize.value
  return recentBills.value.slice(start, start + recentPageSize.value)
})
const recentVisiblePages = computed(() => {
  const count = Math.min(5, recentTotalPages.value)
  let start = Math.max(1, recentCurrentPage.value - Math.floor(count / 2))
  let end = Math.min(recentTotalPages.value, start + count - 1)
  start = Math.max(1, end - count + 1)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const goToRecentPage = (page) => {
  recentCurrentPage.value = Math.min(Math.max(Number(page) || 1, 1), recentTotalPages.value)
}

watch([() => recentBills.value.length, recentPageSize], () => {
  goToRecentPage(recentCurrentPage.value)
})

// 快捷提示
const getQuickTip = () => {
  if (recentBills.value.length === 0) {
    return '欢迎使用！点击上方按钮开始创建第一张单据。'
  }
  const todayCount = filteredBills.value.length
  if (todayCount === 0) {
    return '今天还没有开单，从进货或出货开始吧！'
  }
  return `今天已开 ${todayCount} 单，继续保持！`
}

const navigateTo = (route) => router.push(route)
const viewBill = (bill) => {
  const type = bill.type === 'purchase' ? 'purchase' : 'sale'
  router.push(`/${type}/view/${bill.id}`)
}
const logout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await authStore.logout()
  } catch {
    // 用户取消
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const getBillTypeLabel = (type) => type === 'purchase' ? '进货' : '出货'
const getBillTypeColor = (type) => type === 'purchase' ? '#1a915c' : '#2c3e50'

const syncBillsFromCloud = async () => {
  if (syncingRecentBills) return
  syncingRecentBills = true
  try {
    await billRecordStore.refresh?.()
  } catch (error) {
    console.warn('Dashboard sync bills failed:', error)
  } finally {
    syncingRecentBills = false
  }
}

const handlePageVisible = () => {
  if (document.visibilityState === 'visible') {
    void syncBillsFromCloud()
  }
}

onMounted(async () => {
  await Promise.all([
    customerStore.init?.(),
    fabricStore.init?.(),
    syncBillsFromCloud()
  ])

  disposeBillChangedListener = onBillDataChanged(() => {
    void syncBillsFromCloud()
  })
  document.addEventListener('visibilitychange', handlePageVisible)
  loading.value = false
})

onUnmounted(() => {
  disposeBillChangedListener?.()
  disposeBillChangedListener = null
  document.removeEventListener('visibilitychange', handlePageVisible)
})
</script>

<template>
  <div class="dashboard-page">
    <!-- 欢迎区域 -->
    <section class="welcome-section">
      <div class="welcome-content">
        <div class="welcome-header">
          <div class="logo-badge">
            <img :src="logoUrl" alt="logo" class="logo-img" />
            <span>皖盛布碎</span>
          </div>
          <button class="logout-btn" @click="logout">退出</button>
        </div>
        <h1>你好，{{ authStore.user?.name || '用户' }}</h1>
        <p class="welcome-tip">{{ getQuickTip() }}</p>
      </div>
    </section>

    <!-- 时间范围选择 -->
    <section class="time-range-section">
      <div class="time-range-tabs">
        <button
          v-for="range in [
            { key: 'today', label: '今日' },
            { key: 'week', label: '本周' },
            { key: 'month', label: '本月' }
          ]"
          :key="range.key"
          :class="['time-tab', { active: timeRange === range.key }]"
          @click="timeRange = range.key"
        >
          {{ range.label }}
        </button>
      </div>
    </section>

    <!-- 统计卡片 -->
    <section class="stats-section" v-if="!loading">
      <div class="stats-grid">
        <article v-for="item in stats" :key="item.label" class="stat-card" :style="{ borderTopColor: item.color }">
          <div class="stat-icon" :style="{ background: item.color + '15' }">
            <component :is="item.icon" style="width: 24px; height: 24px;" />
          </div>
          <div class="stat-content">
            <span class="stat-label">{{ item.label }}</span>
            <div class="stat-value">{{ item.prefix || '' }}{{ item.value }}{{ item.suffix || '' }}</div>
          </div>
        </article>
      </div>
    </section>

    <!-- 快捷操作 -->
    <section class="shortcuts-section">
      <h2 class="section-title">快速开始</h2>
      <div class="shortcuts-grid">
        <button
          v-for="item in shortcuts"
          :key="item.label"
          class="shortcut-card"
          @click="navigateTo(item.route)"
        >
          <span class="shortcut-icon" :style="{ background: item.color + '15', color: item.color }">
            <component :is="item.icon" style="width: 24px; height: 24px;" />
          </span>
          <span class="shortcut-label">{{ item.label }}</span>
        </button>
      </div>
    </section>

    <!-- 最近单据 -->
    <section class="recent-section" v-if="!loading && recentBills.length > 0">
      <div class="section-header">
        <div>
          <h2 class="section-title">最近单据</h2>
          <p class="section-subtitle">共 {{ recentBills.length }} 条，当前显示 {{ recentPaginationStart }}-{{ recentPaginationEnd }} 条</p>
        </div>
      </div>
      <div class="recent-list">
        <article
          v-for="bill in paginatedRecentBills"
          :key="bill.id"
          class="recent-item"
          @click="viewBill(bill)"
        >
          <div class="recent-type" :style="{ background: getBillTypeColor(bill.type) + '15', color: getBillTypeColor(bill.type) }">
            {{ getBillTypeLabel(bill.type) }}
          </div>
          <div class="recent-info">
            <div class="recent-partner">{{ bill.partnerName || '未命名' }}</div>
            <div class="recent-meta">
              <span>{{ formatDate(bill.billDate || bill.createdAt) }}</span>
              <span>·</span>
              <span>{{ bill.billNo || '-' }}</span>
            </div>
          </div>
          <div class="recent-amount">
            ¥ {{ Number(bill.totalAmount || 0).toFixed(2) }}
          </div>
        </article>
      </div>
      <div class="recent-pagination">
        <div class="recent-page-size">
          <span>每页</span>
          <select v-model.number="recentPageSize">
            <option v-for="option in recentPageSizeOptions" :key="option" :value="option">{{ option }}</option>
          </select>
          <span>条</span>
        </div>
        <div class="recent-page-actions">
          <button type="button" :disabled="recentCurrentPage <= 1" @click="goToRecentPage(1)">首页</button>
          <button type="button" :disabled="recentCurrentPage <= 1" @click="goToRecentPage(recentCurrentPage - 1)">上一页</button>
          <button
            v-for="page in recentVisiblePages"
            :key="page"
            type="button"
            :class="{ active: page === recentCurrentPage }"
            @click="goToRecentPage(page)"
          >
            {{ page }}
          </button>
          <button type="button" :disabled="recentCurrentPage >= recentTotalPages" @click="goToRecentPage(recentCurrentPage + 1)">下一页</button>
          <button type="button" :disabled="recentCurrentPage >= recentTotalPages" @click="goToRecentPage(recentTotalPages)">末页</button>
        </div>
        <div class="recent-page-summary">第 {{ recentCurrentPage }} / {{ recentTotalPages }} 页</div>
      </div>
    </section>

    <!-- 空状态提示 -->
    <section class="empty-section" v-if="!loading && recentBills.length === 0">
      <div class="empty-card">
        <div class="empty-icon">
          <IconList style="width: 48px; height: 48px; color: #d4a76a;" />
        </div>
        <h3>还没有单据</h3>
        <p>点击上方的"进货开单"或"出货开单"开始创建你的第一张单据</p>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.dashboard-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fffaf3 0%, #f5ebde 100%);
  padding: 16px;
  padding-bottom: 32px;
}

/* 欢迎区域 */
.welcome-section {
  margin-bottom: 20px;
}

.welcome-content {
  .welcome-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .logo-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(227, 187, 122, 0.16);
    border-radius: 999px;
    border: 1px solid rgba(227, 187, 122, 0.35);

    .logo-img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    span {
      font-size: 13px;
      font-weight: 600;
      color: #9b7e5c;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  }

  .logout-btn {
    padding: 8px 16px;
    background: rgba(255, 250, 241, 0.7);
    border: 1px solid rgba(28, 43, 51, 0.1);
    border-radius: 999px;
    color: #4a4137;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(217, 124, 112, 0.14);
      border-color: rgba(217, 124, 112, 0.28);
    }
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    color: #231f1c;
    line-height: 1.1;
    margin: 0 0 8px;
  }

  .welcome-tip {
    font-size: 15px;
    color: #645a4e;
    line-height: 1.5;
    margin: 0;
  }
}

/* 时间范围选择 */
.time-range-section {
  margin-bottom: 20px;
}

.time-range-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 250, 241, 0.8);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.time-tab {
  padding: 8px 20px;
  border: none;
  background: transparent;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: #6a5d52;
  cursor: pointer;
  transition: all 0.2s ease;

  &.active {
    background: linear-gradient(135deg, #e3bb7a 0%, #d6a85e 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(227, 187, 122, 0.3);
  }

  &:hover:not(.active) {
    background: rgba(255, 255, 255, 0.6);
  }
}

/* 统计卡片 */
.stats-section {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stat-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 250, 241, 0.9);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-top: 3px solid;
  box-shadow: 0 12px 30px rgba(187, 161, 130, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 20px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-label {
  font-size: 12px;
  color: #8b7d70;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #231f1c;
  line-height: 1.2;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 快捷操作 */
.shortcuts-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #231f1c;
  margin: 0 0 14px;
}

.section-subtitle {
  margin: -8px 0 0;
  color: #8b7d70;
  font-size: 12px;
  font-weight: 600;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(6, 1fr);
  }
}

.shortcut-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 12px;
  background: rgba(255, 250, 241, 0.9);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 12px 30px rgba(187, 161, 130, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 40px rgba(187, 161, 130, 0.12);
    background: rgba(255, 248, 235, 0.96);
  }

  &:active {
    transform: translateY(0);
  }
}

.shortcut-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 24px;
}

.shortcut-label {
  font-size: 13px;
  font-weight: 600;
  color: #231f1c;
  text-align: center;
  line-height: 1.3;
}

/* 最近单据 */
.recent-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 250, 241, 0.9);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 24px rgba(187, 161, 130, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateX(2px);
    background: rgba(255, 248, 235, 0.96);
    border-color: rgba(227, 187, 122, 0.35);
  }
}

.recent-type {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.recent-info {
  flex: 1;
  min-width: 0;
}

.recent-partner {
  font-size: 15px;
  font-weight: 600;
  color: #231f1c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  font-size: 12px;
  color: #8b7d70;
  margin-top: 4px;
  display: flex;
  gap: 6px;
}

.recent-amount {
  font-size: 16px;
  font-weight: 700;
  color: #231f1c;
  flex-shrink: 0;
}

.recent-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(139, 125, 112, 0.12);
}

.recent-page-size,
.recent-page-summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #8b7d70;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.recent-page-size select {
  height: 34px;
  padding: 0 28px 0 10px;
  border: 1px solid rgba(139, 125, 112, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  color: #231f1c;
  font-weight: 700;
  outline: none;
}

.recent-page-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-page-actions button {
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(139, 125, 112, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: #6a5d52;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(227, 187, 122, 0.16);
    border-color: rgba(212, 167, 106, 0.42);
    color: #7f633f;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &.active {
    background: #1a915c;
    border-color: #1a915c;
    color: #fff;
  }
}

/* 空状态 */
.empty-section {
  margin-top: 20px;
}

.empty-card {
  padding: 32px 24px;
  background: rgba(255, 250, 241, 0.8);
  border-radius: 24px;
  border: 1px dashed rgba(227, 187, 122, 0.4);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-card h3 {
  font-size: 18px;
  font-weight: 700;
  color: #231f1c;
  margin: 0 0 8px;
}

.empty-card p {
  font-size: 14px;
  color: #6a5d52;
  line-height: 1.5;
  margin: 0;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
}
</style>
