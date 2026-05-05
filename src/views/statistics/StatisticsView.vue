<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import AppIcon from '../../components/icons/AppIcon.vue'
import { fetchStatisticsSummaryApi } from '../../api/statistics'
import { BILL_DATA_CHANGED_EVENT } from '../../utils/bill-events'
import { formatMoney } from '../../utils/money'

const LEDGER_PAGE_SIZE = 5
const FABRIC_PAGE_SIZE = 4

const selectedMonth = ref('')
const loading = ref(false)
const months = ref([])
const suppressMonthWatch = ref(false)
const barMotionReady = ref(false)

const ledgerPage = ref(1)
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
  ledgerPage.value = 1
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
const summary = computed(() => {
  const s = summaryData.value.overview
  return {
    totalIncome: Math.round(Number(s.totalIncome || 0)),
    totalExpense: Math.round(Number(s.totalExpense || 0)),
    totalWeight: Math.round(Number(s.totalWeight || 0) * 100) / 100,
    billCount: Number(s.billCount || 0),
    netAmount: Math.round(Number(s.netAmount || 0)),
    totalTransactionAmount: Math.round(Number(s.totalTransactionAmount || 0)),
  }
})

const trendData = computed(() => {
  const daily = summaryData.value.daily || []
  return daily.slice(-7).map((item) => ({
    day: item.day,
    income: Math.round(Number(item.income || 0)),
    expense: Math.round(Number(item.expense || 0)),
  }))
})

const trendPeak = computed(() => Math.max(...trendData.value.map((item) => Math.max(item.income, item.expense)), 1))

const dailyLedger = computed(() => {
  const source = Array.isArray(summaryData.value.daily) ? summaryData.value.daily : []
  const toMoney = (value) => Math.round(Number(value || 0))
  const maxActualAmount = Math.max(
    ...source.flatMap((item) => [
      toMoney(item.actualIncome ?? item.income),
      toMoney(item.actualExpense ?? item.expense),
    ]),
    1
  )

  return source.filter((item) => {
    return Number(item.billCount || item.count || 0) > 0
      || toMoney(item.income) > 0
      || toMoney(item.expense) > 0
      || toMoney(item.actualIncome) > 0
      || toMoney(item.actualExpense) > 0
      || toMoney(item.pendingIncome) > 0
      || toMoney(item.pendingExpense) > 0
  }).map((item) => ({
    ...item,
    income: toMoney(item.income),
    expense: toMoney(item.expense),
    actualIncome: toMoney(item.actualIncome ?? item.income),
    actualExpense: toMoney(item.actualExpense ?? item.expense),
    pendingIncome: toMoney(item.pendingIncome),
    pendingExpense: toMoney(item.pendingExpense),
    billCount: Number(item.billCount || item.count || 0),
    saleCount: Number(item.saleCount || 0),
    purchaseCount: Number(item.purchaseCount || 0),
    net: toMoney(item.cashNet ?? item.net ?? item.netAmount ?? (Number(item.actualIncome || 0) - Number(item.actualExpense || 0))),
    incomeWidth: Number((item.actualIncome ?? item.income) || 0) > 0
      ? Math.max(10, Math.round((toMoney(item.actualIncome ?? item.income) / maxActualAmount) * 100))
      : 0,
    expenseWidth: Number((item.actualExpense ?? item.expense) || 0) > 0
      ? Math.max(10, Math.round((toMoney(item.actualExpense ?? item.expense) / maxActualAmount) * 100))
      : 0,
  })).sort((a, b) => Number(a.day) - Number(b.day))
})

const ledgerPageCount = computed(() => Math.max(1, Math.ceil(dailyLedger.value.length / LEDGER_PAGE_SIZE)))
const pagedLedger = computed(() => paginate(dailyLedger.value, ledgerPage.value, LEDGER_PAGE_SIZE))
const animatedPagedLedger = computed(() => pagedLedger.value.map((item) => ({
  ...item,
  renderIncomeWidth: barMotionReady.value ? item.incomeWidth : 0,
  renderExpenseWidth: barMotionReady.value ? item.expenseWidth : 0,
})))

const expenseDays = computed(() => dailyLedger.value.filter((item) => item.expense > 0).length)
const averageExpensePerBill = computed(() => (
  summary.value.billCount
    ? Math.round(Number(summary.value.totalExpense || 0) / Number(summary.value.billCount || 1))
    : 0
))
const averageExpensePerDay = computed(() => (
  expenseDays.value
    ? Math.round(Number(summary.value.totalExpense || 0) / expenseDays.value)
    : 0
))

const insightCards = computed(() => [
  {
    key: 'expense-days',
    label: '有支出天数',
    value: `${expenseDays.value} 天`,
    note: '统计本月发生进货支出的日期数',
    tone: 'income',
    icon: 'calendar',
  },
  {
    key: 'expense-per-bill',
    label: '单笔平均支出',
    value: formatMoney(averageExpensePerBill.value),
    note: '按全部单据折算的平均支出金额',
    tone: 'expense',
    icon: 'return',
  },
  {
    key: 'expense-per-day',
    label: '日均支出',
    value: formatMoney(averageExpensePerDay.value),
    note: '仅按发生支出的日期计算',
    tone: 'side',
    icon: 'trend',
  },
  {
    key: 'transaction-total',
    label: '月交易总额',
    value: formatMoney(summary.value.totalTransactionAmount),
    note: '收入与支出合计后的总交易规模',
    tone: 'muted',
    icon: 'clock',
  },
])

const expenseByFabric = computed(() => {
  const list = Array.isArray(summaryData.value.fabricDistribution) ? summaryData.value.fabricDistribution : []
  const totalAmount = list.reduce((sum, item) => sum + Math.round(Number(item.totalAmount || 0)), 0)
  const topAmount = Math.max(...list.map((item) => Math.round(Number(item.totalAmount || 0))), 1)

  return list.map((item) => {
    const amount = Math.round(Number(item.totalAmount || 0))
    return {
      ...item,
      amount,
      weight: Math.round(Number(item.totalWeight || 0) * 100) / 100,
      ratio: amount > 0 ? Math.max(12, Math.round((amount / topAmount) * 100)) : 0,
      share: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
    }
  })
})

const fabricPageCount = computed(() => Math.max(1, Math.ceil(expenseByFabric.value.length / FABRIC_PAGE_SIZE)))
const pagedFabrics = computed(() => paginate(expenseByFabric.value, fabricPage.value, FABRIC_PAGE_SIZE))

const goLedgerPage = (page) => {
  ledgerPage.value = clampPage(page, ledgerPageCount.value)
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
  barMotionReady.value = false

  await loadStatistics(value)
  await nextTick()

  barMotionReady.value = true
})

watch(dailyLedger, () => {
  ledgerPage.value = clampPage(ledgerPage.value, ledgerPageCount.value)
})

watch(expenseByFabric, () => {
  fabricPage.value = clampPage(fabricPage.value, fabricPageCount.value)
})

watch(
  [pagedLedger, pagedFabrics],
  async () => {
    barMotionReady.value = false
    await nextTick()
    barMotionReady.value = true
  },
  { flush: 'post' }
)

onMounted(async () => {
  await loadStatistics()
  await nextTick()

  barMotionReady.value = true

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
  <section class="income-expense-page slide-up-enter-active">
    <header class="stats-header">
      <div class="title-block">
        <div class="title-content">
          <h1>收支统计 <span class="subtitle">Income / Expense Overview</span></h1>
          <p class="desc">当前页面已按真实后端单据汇总统计，收入来自出货单，支出来自进货单。</p>
        </div>
        <div class="month-picker">
          <label>统计月份</label>
          <select v-model="selectedMonth" class="modern-select">
            <option v-for="month in availableMonths" :key="month" :value="month">{{ month }}</option>
          </select>
        </div>
      </div>
    </header>

    <div v-if="trendData.length > 1" class="trend-section panel">
      <div class="trend-header">
        <h3>近7日趋势</h3>
        <span class="trend-legend">
          <span class="legend-item income"><span class="dot"></span>收入</span>
          <span class="legend-item expense"><span class="dot"></span>支出</span>
        </span>
      </div>
      <div class="trend-chart">
        <div class="trend-bars">
          <div v-for="item in trendData" :key="item.day" class="trend-bar-group">
            <div class="bar-values">
              <span v-if="item.income > 0" class="bar-value income-text">{{ formatMoney(item.income) }}</span>
              <span v-if="item.expense > 0" class="bar-value expense-text">{{ formatMoney(item.expense) }}</span>
            </div>
            <div class="bar-pair">
              <div
                class="mini-bar income-mini"
                :style="{ height: `${Math.max(4, (item.income / trendPeak) * 60)}px` }"
              ></div>
              <div
                class="mini-bar expense-mini"
                :style="{ height: `${Math.max(4, (item.expense / trendPeak) * 60)}px` }"
              ></div>
            </div>
            <span class="bar-label">{{ item.day }}日</span>
          </div>
        </div>
      </div>
    </div>

    <div class="overview-grid">
      <article class="panel metric income-card">
        <div class="metric-icon">
          <AppIcon name="arrow-up" />
        </div>
        <span class="metric-label">总收入</span>
        <strong class="metric-value income">{{ formatMoney(summary.totalIncome) }}</strong>
        <small class="metric-note">来自出货单据</small>
        <div class="metric-glow income-glow"></div>
      </article>

      <article class="panel metric expense-card">
        <div class="metric-icon">
          <AppIcon name="arrow-down" />
        </div>
        <span class="metric-label">总支出</span>
        <strong class="metric-value expense">{{ formatMoney(summary.totalExpense) }}</strong>
        <small class="metric-note">来自进货单据</small>
        <div class="metric-glow expense-glow"></div>
      </article>

      <article class="panel metric net-card">
        <div class="metric-icon">
          <AppIcon name="swap-vertical" />
        </div>
        <span class="metric-label">净收支</span>
        <strong class="metric-value" :class="summary.netAmount >= 0 ? 'income' : 'expense'">
          {{ formatMoney(Math.abs(summary.netAmount)) }}
        </strong>
        <small class="metric-note">{{ summary.netAmount >= 0 ? '净流入' : '净流出' }}</small>
        <div class="metric-glow" :class="summary.netAmount >= 0 ? 'income-glow' : 'expense-glow'"></div>
      </article>

      <article class="panel metric side-card">
        <div class="metric-icon">
          <AppIcon name="box" />
        </div>
        <span class="metric-label">总重量 / 单据</span>
        <strong class="metric-value side">{{ summary.totalWeight.toFixed(2) }} 斤</strong>
        <small class="metric-note">{{ summary.billCount }} 笔单据</small>
        <div class="metric-glow side-glow"></div>
      </article>
    </div>

    <div class="content-grid-2x2">
      <article class="panel ledger-panel">
        <div class="panel-head panel-head--stack">
          <div class="panel-title-group">
            <h2>每日收支台账</h2>
            <div class="panel-meta">
              <span class="panel-tip">Daily Income &amp; Expense</span>
              <span v-if="dailyLedger.length > 0" class="panel-count">{{ dailyLedger.length }} 天</span>
            </div>
          </div>
          <div v-if="dailyLedger.length > 0" class="pager-inline">
            <button type="button" class="pager-btn" :disabled="ledgerPage === 1" @click="goLedgerPage(ledgerPage - 1)">
              <AppIcon name="chevron-left" />
            </button>
            <span class="pager-text">{{ ledgerPage }} / {{ ledgerPageCount }}</span>
            <button
              type="button"
              class="pager-btn"
              :disabled="ledgerPage === ledgerPageCount"
              @click="goLedgerPage(ledgerPage + 1)"
            >
              <AppIcon name="chevron-right" />
            </button>
          </div>
        </div>

        <div class="ledger-list">
          <div v-if="loading" class="empty">统计数据加载中...</div>
          <div v-else-if="dailyLedger.length === 0" class="empty">暂无统计数据</div>
          <div v-for="item in animatedPagedLedger" :key="item.day" class="ledger-row">
            <div class="day-pill">{{ item.day }}日</div>
            <div class="ledger-main">
              <div class="ledger-values">
                <span class="income-text">
                  <AppIcon name="arrow-up" />
                  已收 {{ formatMoney(item.actualIncome) }}
                </span>
                <span class="expense-text">
                  <AppIcon name="arrow-down" />
                  已付 {{ formatMoney(item.actualExpense) }}
                </span>
                <span class="pending-income-text">未收 {{ formatMoney(item.pendingIncome) }}</span>
                <span class="pending-expense-text">未付 {{ formatMoney(item.pendingExpense) }}</span>
              </div>
              <div class="ledger-bars">
                <div class="ledger-bar-line">
                  <span class="ledger-bar-label income-text">收</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill income-fill"
                      :class="{ ready: barMotionReady }"
                      :style="{ width: `${item.renderIncomeWidth}%` }"
                    ></div>
                  </div>
                </div>
                <div class="ledger-bar-line">
                  <span class="ledger-bar-label expense-text">付</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill expense-fill"
                      :class="{ ready: barMotionReady }"
                      :style="{ width: `${item.renderExpenseWidth}%` }"
                    ></div>
                  </div>
                </div>
              </div>
              <div class="ledger-footnote">
                <span>应收 {{ formatMoney(item.income) }}</span>
                <span>应付 {{ formatMoney(item.expense) }}</span>
                <span>{{ item.billCount }} 笔</span>
              </div>
            </div>
            <span class="net-badge" :class="item.net >= 0 ? 'net-positive' : 'net-negative'">
              {{ item.net >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(item.net)) }}
            </span>
          </div>
        </div>
      </article>

      <article class="panel summary-panel">
        <div class="panel-head panel-head--stack">
          <div class="panel-title-group">
            <h2>收支摘要</h2>
            <div class="panel-meta">
              <span class="panel-tip">Month Snapshot</span>
              <span class="panel-count">{{ insightCards.length }} 项</span>
            </div>
          </div>
        </div>

        <div class="insight-list">
          <div v-for="item in insightCards" :key="item.key" class="insight-item">
            <div class="insight-icon" :class="`${item.tone}-icon`">
              <AppIcon :name="item.icon" />
            </div>
            <div class="insight-content">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.note }}</small>
            </div>
          </div>
        </div>
      </article>

      <article class="panel fabric-panel">
        <div class="panel-head panel-head--stack">
          <div class="panel-title-group">
            <h2>品种金额分布</h2>
            <div class="panel-meta">
              <span class="panel-tip">Fabric Distribution</span>
              <span v-if="expenseByFabric.length > 0" class="panel-count">{{ expenseByFabric.length }} 个品类</span>
            </div>
          </div>
          <div v-if="expenseByFabric.length > FABRIC_PAGE_SIZE" class="pager-inline">
            <button
              type="button"
              class="pager-btn"
              :disabled="fabricPage === 1"
              @click="goFabricPage(fabricPage - 1)"
            >
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

        <div class="table-wrap">
          <table class="fabric-table">
            <thead>
              <tr>
                <th>品种</th>
                <th>重量</th>
                <th>金额</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="4" class="empty-cell">加载中...</td>
              </tr>
              <tr v-else-if="expenseByFabric.length === 0">
                <td colspan="4" class="empty-cell">暂无品种数据</td>
              </tr>
              <tr v-for="item in pagedFabrics" :key="item.fabricName">
                <td class="partner-cell">{{ item.fabricName }}</td>
                <td class="accent-cell">{{ item.weight.toFixed(1) }} 斤</td>
                <td class="expense-cell">{{ formatMoney(item.amount) }}</td>
                <td>{{ item.share.toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="expenseByFabric.length > FABRIC_PAGE_SIZE" class="panel-bottom-pager">
          <div class="pager-inline">
            <button type="button" class="pager-btn" :disabled="fabricPage === 1" @click="goFabricPage(fabricPage - 1)">
              <AppIcon name="chevron-left" />
            </button>
            <span class="pager-text">{{ fabricPage }} / {{ fabricPageCount }}</span>
            <button type="button" class="pager-btn" :disabled="fabricPage === fabricPageCount" @click="goFabricPage(fabricPage + 1)">
              <AppIcon name="chevron-right" />
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.income-expense-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-header {
  margin-bottom: 4px;
}

.title-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h1,
h2,
h3 {
  margin: 0;
  color: var(--text-normal);
}

h1 {
  font-size: 26px;
  font-weight: 800;
}

h2 {
  font-size: 18px;
  font-weight: 700;
}

h3 {
  font-size: 15px;
  font-weight: 600;
}

.subtitle,
.desc,
.metric-label,
.metric-note,
.month-picker label,
.panel-tip,
.empty,
.pager-text,
.trend-legend,
.amount-label {
  color: var(--text-muted);
}

.subtitle {
  margin-left: 10px;
  font-size: 13px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.desc {
  margin: 8px 0 0;
  font-size: 13px;
}

.month-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 170px;
}

.modern-select {
  background: var(--panel-bg);
  border: 1px solid var(--panel-line);
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-dark);
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.modern-select:hover {
  border-color: var(--primary);
}

.modern-select:focus {
  box-shadow: 0 0 0 3px rgba(38, 115, 199, 0.15);
  border-color: var(--primary);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-line);
  transition: transform 0.25s, box-shadow 0.25s;
}

.metric:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.metric-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  padding: 8px;
  border-radius: 10px;
  opacity: 0.7;
}

.metric-icon svg {
  width: 100%;
  height: 100%;
}

.income-card .metric-icon {
  background: rgba(22, 155, 98, 0.1);
  color: #169b62;
}

.expense-card .metric-icon {
  background: rgba(210, 89, 89, 0.1);
  color: #d25959;
}

.net-card .metric-icon {
  background: rgba(42, 131, 219, 0.1);
  color: var(--accent-blue-deep);
}

.side-card .metric-icon {
  background: rgba(75, 131, 216, 0.1);
  color: var(--accent-blue-deep);
}

.metric-glow {
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  opacity: 0.15;
  filter: blur(30px);
  pointer-events: none;
}

.income-glow {
  background: #169b62;
}

.expense-glow {
  background: #d25959;
}

.side-glow {
  background: var(--accent-blue-deep);
}

.metric-value {
  font: 800 28px/1.1 'Outfit', sans-serif;
  color: var(--text-normal);
}

.income {
  color: #169b62;
}

.expense {
  color: #d25959;
}

.side {
  color: var(--accent-blue-deep);
}

.income-card {
  background: linear-gradient(135deg, rgba(22, 155, 98, 0.06) 0%, rgba(255, 255, 255, 0.95) 100%);
  border-color: rgba(22, 155, 98, 0.2);
}

.expense-card {
  background: linear-gradient(135deg, rgba(210, 89, 89, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%);
  border-color: rgba(210, 89, 89, 0.2);
}

.net-card {
  background: linear-gradient(135deg, rgba(42, 131, 219, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%);
  border-color: rgba(42, 131, 219, 0.2);
}

.side-card {
  background: linear-gradient(135deg, rgba(75, 131, 216, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%);
  border-color: rgba(75, 131, 216, 0.2);
}

.trend-section {
  padding: 18px 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
  border: 1px solid var(--panel-line);
  border-radius: 16px;
}

.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.trend-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-item.income .dot {
  background: #169b62;
}

.legend-item.expense .dot {
  background: #d25959;
}

.trend-chart {
  overflow-x: auto;
  padding-bottom: 4px;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  min-height: 120px;
  min-width: 300px;
}

.trend-bar-group {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.bar-values {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 40px;
  max-height: 50px;
  overflow: hidden;
}

.bar-value {
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.bar-value:hover {
  white-space: normal;
  overflow: visible;
}

.bar-pair {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 50px;
}

.mini-bar {
  width: 14px;
  border-radius: 4px 4px 0 0;
  transition: height 0.4s ease;
}

.income-mini {
  background: linear-gradient(180deg, #169b62, #4ade80);
}

.expense-mini {
  background: linear-gradient(180deg, #d25959, #f87171);
}

.bar-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.content-grid-2x2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-head--stack {
  align-items: flex-start;
  flex-wrap: wrap;
}

.panel-title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.panel-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.panel-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(38, 115, 199, 0.08);
  color: var(--accent-blue-deep);
  font-size: 12px;
  font-weight: 700;
}

.pager-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
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
  transition: 0.2s;
}

.pager-btn svg {
  width: 16px;
  height: 16px;
}

.pager-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary-dark);
  background: rgba(38, 115, 199, 0.05);
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager-text {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
}

.ledger-list,
.insight-list {
  display: flex;
  flex-direction: column;
}

.ledger-list {
  gap: 0;
}

.insight-list {
  gap: 12px;
}

.panel-bottom-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.table-wrap {
  overflow-x: auto;
  border-radius: 14px;
  border: 1px solid var(--panel-line);
  background: var(--surface-strong);
}

.fabric-table {
  width: 100%;
  min-width: 400px;
  border-collapse: collapse;
}

.fabric-table th {
  padding: 12px 14px;
  color: var(--text-muted);
  background: rgba(255, 250, 241, 0.74);
  font-size: 12px;
  font-weight: 800;
  text-align: left;
  border-bottom: 1px solid var(--panel-line);
}

.fabric-table td {
  padding: 13px 14px;
  border-bottom: 1px solid var(--panel-line);
  white-space: nowrap;
}

.fabric-table tbody tr:last-child td {
  border-bottom: none;
}

.fabric-table tbody tr:hover td {
  background: rgba(125, 183, 173, 0.06);
}

.rank-badge {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(38, 115, 199, 0.08);
  color: var(--accent-blue-deep);
  font-size: 12px;
  font-weight: 700;
}

.rank-badge.top-3 {
  background: linear-gradient(135deg, var(--primary), #4f8ff7);
  color: #fff;
}

.partner-cell {
  font-weight: 700;
  color: var(--text-normal);
}

.accent-cell {
  color: var(--primary);
  font-weight: 800;
}

.expense-cell {
  color: #d25959;
  font-weight: 800;
}

.empty-cell {
  text-align: center;
  color: var(--text-muted);
  padding: 28px 14px;
}

.rank-badge-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  vertical-align: middle;
}

.ledger-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--panel-line);
}

.ledger-row:last-child {
  border-bottom: none;
}

.day-pill,
.rank-badge {
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
}

.day-pill {
  min-width: 52px;
  height: 30px;
  border-radius: 8px;
  background: rgba(38, 115, 199, 0.08);
  color: var(--accent-blue-deep);
}

.bar-track,
.fabric-bar-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill,
.fabric-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: none;
}

.bar-fill.ready,
.fabric-bar-fill.ready {
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.income-fill {
  background: linear-gradient(90deg, #67d58d 0%, #169b62 100%);
}

.expense-fill {
  background: linear-gradient(90deg, #ff8a8a 0%, #d25959 100%);
}

.ledger-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ledger-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ledger-bar-line {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.ledger-bar-label {
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
}

.ledger-values {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  font-size: 12px;
}

.ledger-values span {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 5px 7px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  overflow-wrap: anywhere;
  line-height: 1.25;
}

.ledger-values svg {
  width: 10px;
  height: 10px;
  opacity: 0.7;
}

.income-text {
  color: #169b62;
}

.expense-text {
  color: #d25959;
}

.pending-income-text {
  color: #5d8f72;
}

.pending-expense-text {
  color: #b57637;
}

.ledger-footnote {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.net-badge {
  min-width: 92px;
  padding: 4px 8px;
  border-radius: 999px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.net-positive {
  background: rgba(22, 155, 98, 0.1);
  color: #169b62;
}

.net-negative {
  background: rgba(210, 89, 89, 0.1);
  color: #d25959;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(247, 249, 252, 0.75));
  border: 1px solid rgba(201, 214, 230, 0.7);
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}

.insight-item:hover,
.customer-row:hover,
.fabric-row:hover {
  transform: translateY(-1px);
}

.insight-item:hover {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(38, 115, 199, 0.22);
}

.insight-icon {
  width: 38px;
  height: 38px;
  padding: 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.insight-icon svg {
  width: 100%;
  height: 100%;
}

.income-icon {
  background: rgba(22, 155, 98, 0.1);
  color: #169b62;
}

.expense-icon {
  background: rgba(210, 89, 89, 0.1);
  color: #d25959;
}

.side-icon {
  background: rgba(75, 131, 216, 0.1);
  color: var(--accent-blue-deep);
}

.muted-icon {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-muted);
}

.insight-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.insight-content span {
  font-size: 12px;
  color: var(--text-muted);
}

.insight-content strong {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-normal);
}

.insight-content small {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}

.customer-row,
.fabric-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(207, 217, 229, 0.75);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(249, 250, 252, 0.88));
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.customer-row:hover,
.fabric-row:hover {
  border-color: rgba(38, 115, 199, 0.2);
  box-shadow: 0 10px 24px rgba(26, 46, 79, 0.05);
}

.customer-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.customer-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.rank-badge {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(38, 115, 199, 0.08);
  color: var(--accent-blue-deep);
  font-size: 13px;
  flex-shrink: 0;
}

.rank-badge.top-3 {
  background: linear-gradient(135deg, var(--primary), #4f8ff7);
  color: #fff;
}

.customer-copy {
  min-width: 0;
}

.customer-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.customer-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-normal);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.customer-chip,
.fabric-weight {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(22, 155, 98, 0.08);
  color: #169b62;
  font-size: 12px;
  font-weight: 700;
}

.customer-meta,
.fabric-footnote {
  font-size: 12px;
  color: var(--text-muted);
}

.customer-meta {
  margin-top: 6px;
}

.customer-amount {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  text-align: right;
  flex-shrink: 0;
}

.customer-amount strong,
.fabric-amount {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.1;
}

.fabric-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.fabric-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}

.fabric-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-normal);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.fabric-bar-track {
  height: 10px;
}

.fabric-bar-fill {
  background: linear-gradient(90deg, #3ccfd3 0%, #7cc5a2 55%, #c9a771 100%);
}

.fabric-footnote {
  display: flex;
  justify-content: flex-end;
}

.empty {
  padding: 28px;
  text-align: center;
  font-size: 13px;
}

@media (max-width: 1200px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid-2x2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .title-block {
    flex-direction: column;
    align-items: stretch;
  }

  .month-picker {
    min-width: 0;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .trend-header,
  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .ledger-row {
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: flex-start;
  }

  .ledger-values {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .net-badge {
    grid-column: 2;
    justify-self: flex-start;
  }

  .customer-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .customer-amount {
    align-items: flex-start;
    text-align: left;
  }

  .fabric-topline {
    flex-direction: column;
  }

  .fabric-footnote {
    justify-content: flex-start;
  }
}
</style>
