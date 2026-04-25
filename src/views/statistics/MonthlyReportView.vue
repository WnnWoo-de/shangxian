<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import AppIcon from '../../components/icons/AppIcon.vue'
import { fetchStatisticsSummaryApi } from '../../api/statistics'
import { formatMoney } from '../../utils/money'
import { BILL_DATA_CHANGED_EVENT } from '../../utils/bill-events'

const CUSTOMER_PAGE_SIZE = 5
const FABRIC_PAGE_SIZE = 5

const selectedMonth = ref('')
const months = ref([])
const loading = ref(false)
const suppressMonthWatch = ref(false)
const chartMotionReady = ref(false)
const customerPage = ref(1)
const fabricPage = ref(1)
const summaryData = ref({
  overview: {
    totalIncome: 0,
    totalExpense: 0,
    totalWeight: 0,
    billCount: 0,
    netAmount: 0,
    totalTransactionAmount: 0,
  },
  daily: [],
  customerRanking: [],
  fabricDistribution: [],
})

const clampPage = (page, pageCount) => Math.min(Math.max(page, 1), pageCount)

const paginate = (list, page, pageSize) => {
  const start = (page - 1) * pageSize
  return list.slice(start, start + pageSize)
}

const resetPanelPages = () => {
  customerPage.value = 1
  fabricPage.value = 1
}

const loadStatistics = async (month = '') => {
  loading.value = true
  try {
    const data = await fetchStatisticsSummaryApi(month ? { month } : {})
    months.value = Array.isArray(data.months) ? data.months : []

    const nextMonth = data.selectedMonth || months.value[0] || ''
    if (selectedMonth.value !== nextMonth) {
      suppressMonthWatch.value = true
      selectedMonth.value = nextMonth
      await nextTick()
      suppressMonthWatch.value = false
    }

    summaryData.value = {
      overview: data.overview || {
        totalIncome: 0,
        totalExpense: 0,
        totalWeight: 0,
        billCount: 0,
        netAmount: 0,
        totalTransactionAmount: 0,
      },
      daily: Array.isArray(data.daily) ? data.daily : [],
      customerRanking: Array.isArray(data.customerRanking) ? data.customerRanking : [],
      fabricDistribution: Array.isArray(data.fabricDistribution) ? data.fabricDistribution : [],
    }
  } finally {
    loading.value = false
  }
}

const availableMonths = computed(() => months.value)

const monthlyStats = computed(() => ({
  totalAmount: Number(summaryData.value.overview?.totalTransactionAmount || 0),
  totalWeight: Number(summaryData.value.overview?.totalWeight || 0),
  billCount: Number(summaryData.value.overview?.billCount || 0),
}))

const dailyTrend = computed(() => {
  const list = Array.isArray(summaryData.value.daily) ? summaryData.value.daily : []
  const maxAmount = Math.max(...list.map((item) => Number(item.totalAmount || 0)), 1)

  return list.map((item) => ({
    day: Number(item.day || 0),
    amount: Number(item.totalAmount || 0),
    height: Math.max(2, (Number(item.totalAmount || 0) / maxAmount) * 100),
  }))
})

const animatedDailyTrend = computed(() => dailyTrend.value.map((item) => ({
  ...item,
  renderHeight: chartMotionReady.value ? item.height : 0,
})))

const byCustomer = computed(() => {
  const list = Array.isArray(summaryData.value.customerRanking) ? summaryData.value.customerRanking : []
  return list.map((item, index) => ({
    ...item,
    rank: index + 1,
    billCount: Number(item.billCount || 0),
    totalWeight: Number(item.totalWeight || 0),
    totalAmount: Number(item.totalAmount || 0),
  }))
})

const customerPageCount = computed(() => Math.max(1, Math.ceil(byCustomer.value.length / CUSTOMER_PAGE_SIZE)))
const pagedCustomers = computed(() => paginate(byCustomer.value, customerPage.value, CUSTOMER_PAGE_SIZE))

const byFabric = computed(() => {
  const list = Array.isArray(summaryData.value.fabricDistribution) ? summaryData.value.fabricDistribution : []
  const topAmount = Math.max(...list.map((item) => Number(item.totalAmount || 0)), 1)

  return list.map((item) => ({
    fabricName: item.fabricName,
    totalWeight: Number(item.totalWeight || 0),
    totalAmount: Number(item.totalAmount || 0),
    ratio: Math.max(5, Math.round((Number(item.totalAmount || 0) / topAmount) * 100)),
  }))
})

const fabricPageCount = computed(() => Math.max(1, Math.ceil(byFabric.value.length / FABRIC_PAGE_SIZE)))
const pagedFabrics = computed(() => paginate(byFabric.value, fabricPage.value, FABRIC_PAGE_SIZE))

const goCustomerPage = (page) => {
  customerPage.value = clampPage(page, customerPageCount.value)
}

const goFabricPage = (page) => {
  fabricPage.value = clampPage(page, fabricPageCount.value)
}

const handlePageReactiveRefresh = () => {
  if (document.visibilityState === 'visible') {
    loadStatistics(selectedMonth.value)
  }
}

watch(selectedMonth, async (value, oldValue) => {
  if (suppressMonthWatch.value || !value || value === oldValue) return
  resetPanelPages()
  chartMotionReady.value = false
  await loadStatistics(value)
  await nextTick()
  chartMotionReady.value = true
})

watch(byCustomer, () => {
  customerPage.value = clampPage(customerPage.value, customerPageCount.value)
})

watch(byFabric, () => {
  fabricPage.value = clampPage(fabricPage.value, fabricPageCount.value)
})

watch(
  [dailyTrend, pagedFabrics],
  async () => {
    chartMotionReady.value = false
    await nextTick()
    chartMotionReady.value = true
  },
  { flush: 'post' }
)

onMounted(async () => {
  await loadStatistics()
  await nextTick()
  chartMotionReady.value = true
  window.addEventListener('focus', handlePageReactiveRefresh)
  document.addEventListener('visibilitychange', handlePageReactiveRefresh)
  window.addEventListener(BILL_DATA_CHANGED_EVENT, handlePageReactiveRefresh)
})

onUnmounted(() => {
  window.removeEventListener('focus', handlePageReactiveRefresh)
  document.removeEventListener('visibilitychange', handlePageReactiveRefresh)
  window.removeEventListener(BILL_DATA_CHANGED_EVENT, handlePageReactiveRefresh)
})
</script>

<template>
  <section class="stats-page slide-up-enter-active">
    <header class="stats-header">
      <div class="title-area">
        <h1>月度报表 <span class="subtitle">Monthly Financial Report</span></h1>
        <div class="month-picker">
          <label>选择查询月份：</label>
          <select v-model="selectedMonth" class="modern-select">
            <option v-for="month in availableMonths" :key="month" :value="month">{{ month }}</option>
          </select>
        </div>
      </div>
    </header>

    <div class="overview-grid">
      <article class="panel overview-panel main-stats">
        <div class="stats-cards">
          <div class="mini-card">
            <span class="l">月交易总额</span>
            <span class="v primary">{{ formatMoney(monthlyStats.totalAmount) }}</span>
          </div>
          <div class="mini-card border">
            <span class="l">月累计重量 (斤)</span>
            <span class="v">{{ monthlyStats.totalWeight.toFixed(2) }}</span>
          </div>
          <div class="mini-card">
            <span class="l">当月单据数</span>
            <span class="v">{{ monthlyStats.billCount }} <small>笔</small></span>
          </div>
        </div>

        <div class="trend-section">
          <h3>
            每日收支趋势
            <span class="tip">单位：元</span>
          </h3>
          <div class="trend-chart">
            <div
              v-for="item in animatedDailyTrend"
              :key="item.day"
              class="chart-bar-wrap"
              :title="`第 ${item.day} 日: ¥ ${formatMoney(item.amount)}`"
            >
              <div
                class="bar-actual"
                :style="{ height: `${item.renderHeight}%` }"
                :class="{ active: item.amount > 0, ready: chartMotionReady }"
              ></div>
              <span class="bar-label">{{ item.day }}</span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="detail-grid">
      <article class="panel stat-panel">
        <div class="panel-head">
          <div class="panel-title-group">
            <h2>客户交易排名 <span class="badge">Ranking</span></h2>
            <span v-if="byCustomer.length > 0" class="panel-count">{{ byCustomer.length }} 位客户</span>
          </div>
          <div v-if="byCustomer.length > 0" class="pager-inline">
            <button type="button" class="pager-btn" :disabled="customerPage === 1" @click="goCustomerPage(customerPage - 1)">
              <AppIcon name="chevron-left" />
            </button>
            <span class="pager-text">{{ customerPage }} / {{ customerPageCount }}</span>
            <button
              type="button"
              class="pager-btn"
              :disabled="customerPage === customerPageCount"
              @click="goCustomerPage(customerPage + 1)"
            >
              <AppIcon name="chevron-right" />
            </button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排名 / 客户</th>
                <th>笔数</th>
                <th>总重量</th>
                <th>总金额</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedCustomers" :key="item.customerName">
                <td>
                  <div class="customer-cell">
                    <span class="rank-num" :class="{ 'top-3': item.rank <= 3 }">{{ item.rank }}</span>
                    {{ item.customerName }}
                  </div>
                </td>
                <td><span class="val-box">{{ item.billCount }}</span></td>
                <td><span class="val-box weight">{{ Number(item.totalWeight || 0).toFixed(2) }}</span></td>
                <td><span class="amount-text">{{ formatMoney(item.totalAmount) }}</span></td>
              </tr>
              <tr v-if="!loading && byCustomer.length === 0">
                <td colspan="4" class="empty">该月份暂无流水记录</td>
              </tr>
              <tr v-if="loading">
                <td colspan="4" class="empty">月报数据加载中...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel stat-panel">
        <div class="panel-head">
          <div class="panel-title-group">
            <h2>品种构成分析 <span class="badge">Distribution</span></h2>
            <span v-if="byFabric.length > 0" class="panel-count">{{ byFabric.length }} 个品类</span>
          </div>
          <div v-if="byFabric.length > 0" class="pager-inline">
            <button type="button" class="pager-btn" :disabled="fabricPage === 1" @click="goFabricPage(fabricPage - 1)">
              <AppIcon name="chevron-left" />
            </button>
            <span class="pager-text">{{ fabricPage }} / {{ fabricPageCount }}</span>
            <button
              type="button"
              class="pager-btn"
              :disabled="fabricPage === fabricPageCount"
              @click="goFabricPage(fabricPage + 1)"
            >
              <AppIcon name="chevron-right" />
            </button>
          </div>
        </div>
        <div class="bar-chart">
          <div v-for="item in pagedFabrics" :key="item.fabricName" class="bar-row">
            <span class="label">{{ item.fabricName }}</span>
            <div class="bar-track">
              <div class="bar-fill" :class="{ ready: chartMotionReady }" :style="{ width: `${chartMotionReady ? item.ratio : 0}%` }"></div>
            </div>
            <span class="value">{{ formatMoney(item.totalAmount) }}</span>
          </div>
          <div v-if="!loading && byFabric.length === 0" class="empty">暂无报表数据</div>
          <div v-if="loading" class="empty">月报数据加载中...</div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-header {
  margin-bottom: 8px;
}

.title-area {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
}

.title-area h1 {
  font-size: 28px;
  color: var(--text-normal);
  font-weight: 800;
  margin: 0;
}

.subtitle {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
  margin-left: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.month-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-picker label {
  font-size: 14px;
  color: var(--text-muted);
}

.modern-select {
  background: var(--panel-bg);
  border: 1px solid var(--panel-line);
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--primary-dark);
  cursor: pointer;
  outline: none;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s;
}

.modern-select:hover {
  border-color: var(--primary);
}

.overview-grid {
  display: grid;
  grid-template-columns: 1fr;
}

.main-stats {
  padding: 0;
  overflow: hidden;
}

.stats-cards {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  background: rgba(255, 255, 255, 0.3);
  border-bottom: 1px solid var(--panel-line);
}

.mini-card {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-card.border {
  border-left: 1px solid var(--panel-line);
  border-right: 1px solid var(--panel-line);
}

.mini-card .l {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}

.mini-card .v {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-normal);
  font-family: 'Outfit', sans-serif;
}

.mini-card .v.primary {
  color: var(--accent-blue-deep);
  font-size: 32px;
}

.mini-card .v small {
  font-size: 16px;
  font-weight: 500;
  margin-left: 4px;
}

.trend-section {
  padding: 32px;
}

.trend-section h3 {
  font-size: 16px;
  color: var(--text-normal);
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trend-section h3 .tip {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: normal;
}

.trend-chart {
  height: 160px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-bottom: 24px;
  border-bottom: 1px dashed var(--panel-line);
}

.chart-bar-wrap {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  position: relative;
}

.bar-actual {
  width: 100%;
  background: rgba(146, 196, 236, 0.15);
  border-radius: 4px;
  transform-origin: bottom;
  transition: height 0s;
  will-change: height;
}

.bar-actual.ready {
  transition: height 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.05), background 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease, filter 0.3s ease;
}

.bar-actual.active {
  background: linear-gradient(180deg, #3ccfd3 0%, var(--accent-blue-deep) 100%);
  box-shadow: 0 4px 8px rgba(36, 127, 214, 0.2);
}

.chart-bar-wrap:hover .bar-actual.active {
  transform: scaleX(1.2);
  filter: brightness(1.1);
}

.bar-label {
  font-size: 10px;
  color: var(--text-muted);
  position: absolute;
  bottom: -20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
}

.stat-panel {
  padding: 32px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.panel-title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-normal);
  margin-bottom: 0;
  font-size: 18px;
  font-weight: 700;
}

.panel-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(38, 115, 199, 0.08);
  color: var(--primary-dark);
  font-size: 12px;
  font-weight: 700;
}

.badge {
  font-size: 11px;
  background: var(--primary-soft);
  color: var(--primary-dark);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.pager-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pager-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: var(--panel-bg);
  color: var(--text-normal);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s, opacity 0.2s;
}

.pager-btn svg {
  width: 16px;
  height: 16px;
}

.pager-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: rgba(38, 115, 199, 0.05);
  color: var(--primary-dark);
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager-text {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 16px 12px;
  text-align: left;
  border-bottom: 1px solid var(--panel-line);
}

th {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.01);
}

.customer-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.rank-num {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
}

.rank-num.top-3 {
  background: var(--primary);
  color: #fff;
}

.val-box {
  background: var(--bg);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.amount-text {
  font-family: 'Outfit', monospace;
  font-weight: 700;
  color: var(--accent-blue-deep);
}

.bar-chart {
  display: grid;
  gap: 24px;
}

.bar-row {
  display: grid;
  grid-template-columns: 80px 1fr 110px;
  align-items: center;
  gap: 16px;
}

.label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}

.bar-track {
  height: 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 99px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3ccfd3, var(--accent-blue-deep));
  transition: none;
}

.bar-fill.ready {
  transition: width 0.6s ease;
}

.value {
  font-size: 14px;
  font-weight: 700;
  text-align: right;
  font-family: monospace;
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .mini-card.border {
    border: none;
    border-top: 1px solid var(--panel-line);
    border-bottom: 1px solid var(--panel-line);
  }
}

@media (max-width: 768px) {
  .title-area {
    flex-direction: column;
    align-items: flex-start;
  }

  .month-picker {
    width: 100%;
    flex-wrap: wrap;
  }

  .modern-select {
    width: 100%;
  }

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .bar-row {
    grid-template-columns: 1fr;
  }

  .value {
    text-align: left;
  }
}
</style>
