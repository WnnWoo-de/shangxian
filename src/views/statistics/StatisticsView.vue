<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { fetchStatisticsSummaryApi } from '../../api/statistics'
import { formatMoney } from '../../utils/money'
import { BILL_DATA_CHANGED_EVENT } from '../../utils/bill-events'

const selectedMonth = ref('')
const ledgerPage = ref(1)
const ledgerPageSize = 5
const loading = ref(false)
const months = ref([])
const suppressMonthWatch = ref(false)
const barMotionReady = ref(false)
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

// 新增：趋势线数据（最近7天的收支趋势）
const trendData = computed(() => {
  const daily = summaryData.value.daily || []
  return daily.slice(-7).map(item => ({
    day: item.day,
    income: Number(item.income || 0),
    expense: Number(item.expense || 0),
  }))
})

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
const summary = computed(() => summaryData.value.overview)

const dailyLedger = computed(() => {
  const source = Array.isArray(summaryData.value.daily) ? summaryData.value.daily : []
  const maxExpense = Math.max(...source.map((item) => Number(item.expense || 0)), 1)
  return source.map((item) => ({
    ...item,
    expenseWidth: Number(item.expense || 0) > 0 ? Math.max(10, Math.round((Number(item.expense || 0) / maxExpense) * 100)) : 0,
  }))
})

const animatedPagedLedger = computed(() => pagedLedger.value.map((item) => ({
  ...item,
  renderExpenseWidth: barMotionReady.value ? item.expenseWidth : 0,
})))

const expenseByCustomer = computed(() => summaryData.value.customerRanking || [])
const expenseByFabric = computed(() => {
  const list = summaryData.value.fabricDistribution || []
  const top = list[0]?.totalAmount || 1
  return list.map((item) => ({
    ...item,
    amount: Number(item.totalAmount || 0),
    weight: Number(item.totalWeight || 0),
    ratio: Math.max(6, Math.round((Number(item.totalAmount || 0) / top) * 100)),
  }))
})

const expenseDays = computed(() => dailyLedger.value.filter((item) => Number(item.expense || 0) > 0).length)
const averageExpensePerBill = computed(() => (summary.value.billCount ? Number(summary.value.totalExpense || 0) / Number(summary.value.billCount || 1) : 0))
const averageExpensePerDay = computed(() => (expenseDays.value ? Number(summary.value.totalExpense || 0) / expenseDays.value : 0))

const ledgerPageCount = computed(() => Math.max(1, Math.ceil(dailyLedger.value.length / ledgerPageSize)))

const pagedLedger = computed(() => {
  const start = (ledgerPage.value - 1) * ledgerPageSize
  return dailyLedger.value.slice(start, start + ledgerPageSize)
})

const goLedgerPage = (page) => {
  ledgerPage.value = Math.min(Math.max(page, 1), ledgerPageCount.value)
}

const handlePageReactiveRefresh = () => {
  if (document.visibilityState === 'visible') {
    loadStatistics(selectedMonth.value)
  }
}

watch(selectedMonth, async (value, oldValue) => {
  if (suppressMonthWatch.value || !value || value === oldValue) return
  ledgerPage.value = 1
  barMotionReady.value = false
  await loadStatistics(value)
  await nextTick()
  barMotionReady.value = true
})

watch(dailyLedger, () => {
  if (ledgerPage.value > ledgerPageCount.value) {
    ledgerPage.value = ledgerPageCount.value
  }
})

watch(
  [pagedLedger, expenseByFabric],
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

    <!-- 趋势迷你图 -->
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
              <span class="bar-value income-text" v-if="item.income > 0">{{ formatMoney(item.income) }}</span>
              <span class="bar-value expense-text" v-if="item.expense > 0">{{ formatMoney(item.expense) }}</span>
            </div>
            <div class="bar-pair">
              <div class="mini-bar income-mini" :style="{ height: `${Math.max(4, (item.income / Math.max(...trendData.map(t => Math.max(t.income, t.expense)), 1)) * 60)}px` }"></div>
              <div class="mini-bar expense-mini" :style="{ height: `${Math.max(4, (item.expense / Math.max(...trendData.map(t => Math.max(t.income, t.expense)), 1)) * 60)}px` }"></div>
            </div>
            <span class="bar-label">{{ item.day }}日</span>
          </div>
        </div>
      </div>
    </div>

    <div class="overview-grid">
      <article class="panel metric income-card">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 7l-5-5-5 5"/>
          </svg>
        </div>
        <span class="metric-label">总收入</span>
        <strong class="metric-value income">{{ formatMoney(summary.totalIncome) }}</strong>
        <small class="metric-note">来自出货单据</small>
        <div class="metric-glow income-glow"></div>
      </article>
      <article class="panel metric expense-card">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22V2M7 17l5 5 5-5"/>
          </svg>
        </div>
        <span class="metric-label">总支出</span>
        <strong class="metric-value expense">{{ formatMoney(summary.totalExpense) }}</strong>
        <small class="metric-note">来自进货单据</small>
        <div class="metric-glow expense-glow"></div>
      </article>
      <article class="panel metric net-card">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v12M8 10l4-4 4 4M8 14l4 4 4-4"/>
          </svg>
        </div>
        <span class="metric-label">净收支</span>
        <strong class="metric-value" :class="summary.netAmount >= 0 ? 'income' : 'expense'">{{ formatMoney(Math.abs(summary.netAmount)) }}</strong>
        <small class="metric-note">{{ summary.netAmount >= 0 ? '净流入' : '净流出' }}</small>
        <div class="metric-glow" :class="summary.netAmount >= 0 ? 'income-glow' : 'expense-glow'"></div>
      </article>
      <article class="panel metric side-card">
        <div class="metric-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </div>
        <span class="metric-label">总重量 / 单据</span>
        <strong class="metric-value side">{{ summary.totalWeight.toFixed(2) }} 斤</strong>
        <small class="metric-note">{{ summary.billCount }} 笔单据</small>
        <div class="metric-glow side-glow"></div>
      </article>
    </div>

    <!-- 2x2 网格布局：每日收支台账 | 收支摘要 | 交易对象排行 | 布料金额分布 -->
    <div class="content-grid-2x2">
      <!-- 每日收支台账 -->
      <article class="panel ledger-panel">
        <div class="panel-head ledger-head">
          <div>
            <h2>每日收支台账</h2>
            <span class="panel-tip">Daily Income & Expense</span>
          </div>
          <div v-if="dailyLedger.length > 0" class="pager-inline">
            <button type="button" class="pager-btn" :disabled="ledgerPage === 1" @click="goLedgerPage(ledgerPage - 1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span class="pager-text">{{ ledgerPage }} / {{ ledgerPageCount }}</span>
            <button type="button" class="pager-btn" :disabled="ledgerPage === ledgerPageCount" @click="goLedgerPage(ledgerPage + 1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        <div class="ledger-list compact">
          <div v-if="loading" class="empty">统计数据加载中...</div>
          <div v-else-if="dailyLedger.length === 0" class="empty">暂无统计数据</div>
          <div v-for="item in animatedPagedLedger" :key="item.day" class="ledger-row compact">
            <div class="day-pill">{{ item.day }}日</div>
            <div class="bar-track">
              <div class="bar-fill expense-fill" :class="{ ready: barMotionReady }" :style="{ width: `${item.renderExpenseWidth}%` }"></div>
            </div>
            <div class="ledger-values">
              <span class="income-text">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                {{ formatMoney(item.income) }}
              </span>
              <span class="expense-text">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                {{ formatMoney(item.expense) }}
              </span>
            </div>
            <span class="net-badge" :class="item.net >= 0 ? 'net-positive' : 'net-negative'">
              {{ item.net >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(item.net)) }}
            </span>
          </div>
        </div>
      </article>

      <!-- 收支摘要 -->
      <article class="panel summary-panel">
        <div class="panel-head">
          <h2>收支摘要</h2>
          <span class="panel-tip">Month Snapshot</span>
        </div>
        <div class="insight-list">
          <div class="insight-item">
            <div class="insight-icon income-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div class="insight-content"><span>有支出天数</span><strong>{{ expenseDays }} 天</strong></div>
          </div>
          <div class="insight-item">
            <div class="insight-icon expense-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/></svg>
            </div>
            <div class="insight-content"><span>单笔平均支出</span><strong>{{ formatMoney(averageExpensePerBill) }}</strong></div>
          </div>
          <div class="insight-item">
            <div class="insight-icon side-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 9l-5 5-4-4-3 3"/></svg>
            </div>
            <div class="insight-content"><span>日均支出</span><strong>{{ formatMoney(averageExpensePerDay) }}</strong></div>
          </div>
          <div class="insight-item">
            <div class="insight-icon muted-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div class="insight-content"><span>月交易总额</span><strong>{{ formatMoney(summary.totalTransactionAmount) }}</strong></div>
          </div>
        </div>
      </article>

      <!-- 交易对象排行 -->
      <article class="panel">
        <div class="panel-head">
          <h2>交易对象排行</h2>
          <span class="panel-tip">Top Customers</span>
        </div>
        <div class="table-wrapper compact-table">
          <table>
            <thead>
              <tr><th>#</th><th>对象</th><th>笔数</th><th>重量</th><th>金额</th></tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="5" class="empty">加载中...</td></tr>
              <tr v-else-if="expenseByCustomer.length === 0"><td colspan="5" class="empty">暂无数据</td></tr>
              <tr v-for="(item, index) in expenseByCustomer" :key="item.customerName" class="rank-row">
                <td><span class="rank-badge" :class="{ 'top-3': index < 3 }">{{ index + 1 }}</span></td>
                <td><div class="customer-cell">{{ item.customerName }}</div></td>
                <td>{{ item.billCount }}</td>
                <td>{{ Number(item.totalWeight || 0).toFixed(1) }}</td>
                <td class="expense-text strong">{{ formatMoney(item.totalAmount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <!-- 布料金额分布 -->
      <article class="panel">
        <div class="panel-head">
          <h2>布料金额分布</h2>
          <span class="panel-tip">Fabric Distribution</span>
        </div>
        <div class="fabric-chart">
          <div v-if="loading" class="empty">加载中...</div>
          <div v-else-if="expenseByFabric.length === 0" class="empty">暂无布料数据</div>
          <div v-for="item in expenseByFabric" :key="item.fabricName" class="fabric-row">
            <div class="fabric-info">
              <span class="fabric-name">{{ item.fabricName }}</span>
              <span class="fabric-weight">{{ Number(item.weight || 0).toFixed(1) }} 斤</span>
            </div>
            <div class="fabric-bar-wrap">
              <div class="fabric-bar-track">
                <div class="fabric-bar-fill" :class="{ ready: barMotionReady }" :style="{ width: `${barMotionReady ? item.ratio : 0}%` }"></div>
              </div>
              <span class="fabric-amount">{{ formatMoney(item.amount) }}</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.income-expense-page,.ledger-list,.insight-list,.category-list{display:flex;flex-direction:column}.income-expense-page{gap:20px}.title-block,.panel-head,.insight-item,.customer-cell,.pager-inline{display:flex;align-items:center}.stats-header{margin-bottom:4px}.title-block,.panel-head,.insight-item{justify-content:space-between;gap:12px}h1,h2,h3{margin:0;color:var(--text-normal)}h1{font-size:26px;font-weight:800}h2{font-size:17px}h3{font-size:15px;font-weight:600}.subtitle,.desc,.metric-label,.metric-note,.month-picker label,.panel-tip,.category-meta .weight,th,.empty,.pager-text,.trend-legend{color:var(--text-muted)}.subtitle{margin-left:10px;font-size:13px;letter-spacing:.5px;text-transform:uppercase}.desc{margin:8px 0 0;font-size:13px}.month-picker{display:flex;flex-direction:column;gap:6px;min-width:170px}.modern-select{background:var(--panel-bg);border:1px solid var(--panel-line);padding:8px 12px;border-radius:10px;font-size:14px;font-weight:600;color:var(--primary-dark);outline:none;cursor:pointer;transition:border-color .2s,box-shadow .2s}.modern-select:hover{border-color:var(--primary)}.modern-select:focus{box-shadow:0 0 0 3px rgba(38,115,199,.15);border-color:var(--primary)}.overview-grid,.content-grid{display:grid;gap:16px}.overview-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.top-grid{grid-template-columns:1.6fr 1fr}.bottom-grid{grid-template-columns:1.1fr 1fr}.metric{position:relative;display:flex;flex-direction:column;gap:6px;padding:20px;overflow:hidden;border-radius:16px;background:var(--panel-bg);border:1px solid var(--panel-line);transition:transform .25s,box-shadow .25s}.metric:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}.metric-icon{position:absolute;top:14px;right:14px;width:36px;height:36px;padding:8px;border-radius:10px;opacity:.7}.metric-icon svg{width:100%;height:100%}.income-card .metric-icon{background:rgba(22,155,98,.1);color:#169b62}.expense-card .metric-icon{background:rgba(210,89,89,.1);color:#d25959}.net-card .metric-icon{background:rgba(42,131,219,.1);color:var(--accent-blue-deep)}.side-card .metric-icon{background:rgba(75,131,216,.1);color:var(--accent-blue-deep)}.metric-glow{position:absolute;bottom:-20px;right:-20px;width:80px;height:80px;border-radius:50%;opacity:.15;filter:blur(30px);pointer-events:none}.income-glow{background:#169b62}.expense-glow{background:#d25959}.side-glow{background:var(--accent-blue-deep)}.metric-value{font:800 28px/1.1 'Outfit',sans-serif;color:var(--text-normal)}.income{color:#169b62}.expense{color:#d25959}.side{color:var(--accent-blue-deep)}.income-card{background:linear-gradient(135deg,rgba(22,155,98,.06) 0%,rgba(255,255,255,.95) 100%);border-color:rgba(22,155,98,.2)}.expense-card{background:linear-gradient(135deg,rgba(210,89,89,.08) 0%,rgba(255,255,255,.95) 100%);border-color:rgba(210,89,89,.2)}.net-card{background:linear-gradient(135deg,rgba(42,131,219,.08) 0%,rgba(255,255,255,.95) 100%);border-color:rgba(42,131,219,.2)}.side-card{background:linear-gradient(135deg,rgba(75,131,216,.08) 0%,rgba(255,255,255,.95) 100%);border-color:rgba(75,131,216,.2)}.trend-section{padding:18px 20px;background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,255,255,.7));border:1px solid var(--panel-line);border-radius:16px}.trend-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.trend-legend{display:flex;gap:16px;font-size:12px}.legend-item{display:flex;align-items:center;gap:5px}.legend-item .dot{width:8px;height:8px;border-radius:50%}.legend-item.income .dot{background:#169b62}.legend-item.expense .dot{background:#d25959}.trend-chart{overflow-x:auto}.trend-bars{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;height:90px;min-width:300px}.trend-bar-group{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1}.bar-values{display:flex;flex-direction:column;align-items:center;gap:2px;height:36px}.bar-value{font-size:10px;font-weight:600;white-space:nowrap}.bar-pair{display:flex;align-items:flex-end;gap:3px;height:50px}.mini-bar{width:14px;border-radius:4px 4px 0 0;transition:height .4s ease}.income-mini{background:linear-gradient(180deg,#169b62,#4ade80)}.expense-mini{background:linear-gradient(180deg,#d25959,#f87171)}.bar-label{font-size:11px;color:var(--text-muted);font-weight:500}.ledger-list,.insight-list,.category-list{gap:12px}.ledger-row,.category-row{display:grid;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid var(--panel-line)}.ledger-row:last-child,.category-row:last-child{border-bottom:none}.day-pill,.rank-badge{display:grid;place-items:center;font-weight:700;font-size:12px}.day-pill{min-width:52px;height:30px;border-radius:8px;background:rgba(38,115,199,.08);color:var(--accent-blue-deep)}.ledger-values{display:flex;flex-direction:column;gap:5px;font-size:13px}.ledger-values span{display:flex;align-items:center;gap:4px}.ledger-values svg{width:12px;height:12px;opacity:.7}.bar-track{height:8px;background:rgba(0,0,0,.04);border-radius:6px;overflow:hidden}.bar-fill{height:100%;border-radius:6px;transition:none}.bar-fill.ready{transition:width .5s cubic-bezier(.4,0,.2,1)}.expense-fill{background:linear-gradient(90deg,#ff8a8a 0%,#d25959 100%)}.category-fill{background:linear-gradient(90deg,#4fd5c3 0%,var(--accent-blue-deep) 100%)}.income-text{color:#169b62}.expense-text{color:#d25959}.net-text{font-weight:600}.strong,.category-amount{font-weight:700}.insight-item{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.5);border:1px solid rgba(201,214,230,.6);transition:background .2s,border-color .2s}.insight-item:hover{background:rgba(255,255,255,.8);border-color:rgba(38,115,199,.2)}.insight-icon{width:34px;height:34px;padding:7px;border-radius:8px;flex-shrink:0}.insight-icon svg{width:100%;height:100%}.income-icon{background:rgba(22,155,98,.1);color:#169b62}.expense-icon{background:rgba(210,89,89,.1);color:#d25959}.side-icon{background:rgba(75,131,216,.1);color:var(--accent-blue-deep)}.muted-icon{background:rgba(0,0,0,.05);color:var(--text-muted)}.insight-content{display:flex;flex-direction:column;gap:2px}.insight-content span{font-size:12px;color:var(--text-muted)}.insight-content strong{font-size:15px;font-weight:700;color:var(--text-normal)}.insight-item.muted .insight-content strong{color:var(--accent-blue-deep)}.ledger-head,.summary-panel .panel-head{align-items:flex-start}.pager-inline{gap:8px;flex-wrap:nowrap}.pager-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--panel-line);border-radius:8px;background:var(--panel-bg);color:var(--text-normal);cursor:pointer;transition:.2s}.pager-btn svg{width:16px;height:16px}.pager-btn:hover:not(:disabled){border-color:var(--primary);color:var(--primary-dark);background:rgba(38,115,199,.05)}.pager-btn:disabled{opacity:.4;cursor:not-allowed}.pager-text{font-size:12px;color:var(--text-muted);min-width:40px;text-align:center}.table-wrapper{overflow-x:auto;border-radius:12px;border:1px solid var(--panel-line)}table{width:100%;border-collapse:collapse;min-width:400px}th,td{padding:13px 14px;text-align:left;border-bottom:1px solid var(--panel-line)}th{font-size:12px;font-weight:600;background:rgba(0,0,0,.02);color:var(--text-muted)}.rank-row{transition:background .15s}.rank-row:hover{background:rgba(38,115,199,.03)}.rank-row:last-child td{border-bottom:none}.rank-badge{min-width:22px;height:22px;border-radius:6px;background:rgba(0,0,0,.06);color:var(--text-muted);font-size:11px}.rank-badge.top-3{background:var(--primary);color:#fff}.customer-cell{font-weight:600;font-size:14px}.category-row{grid-template-columns:110px minmax(0,1fr) 110px}.category-meta{display:flex;flex-direction:column;gap:3px}.category-meta .name{font-size:13px;font-weight:700}.empty{padding:28px;text-align:center;font-size:13px}.content-grid-2x2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.ledger-panel .panel-head,
.summary-panel .panel-head {
  align-items: flex-start;
}

.ledger-list.compact { gap: 0; }
.ledger-row.compact {
  display: grid;
  grid-template-columns: 52px 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--panel-line);
}
.ledger-row.compact:last-child { border-bottom: none; }
.ledger-row.compact .ledger-values {
  flex-direction: row;
  gap: 8px;
  font-size: 12px;
}
.ledger-row.compact .ledger-values span { flex-direction: column; gap: 1px; }
.ledger-row.compact .ledger-values svg { width: 10px; height: 10px; }
.net-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  min-width: 70px;
  text-align: center;
}
.net-positive { background: rgba(22,155,98,.1); color: #169b62; }
.net-negative { background: rgba(210,89,89,.1); color: #d25959; }

.summary-panel .insight-list { gap: 8px; }
.summary-panel .insight-item { padding: 12px 14px; }

.compact-table { border-radius: 10px; }
.compact-table table { min-width: 320px; }
.compact-table th, .compact-table td { padding: 10px 12px; font-size: 13px; }

.fabric-chart { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
.fabric-row { display: grid; grid-template-columns: 90px 1fr 110px; align-items: center; gap: 12px; }
.fabric-info { display: flex; flex-direction: column; gap: 2px; }
.fabric-name { font-size: 13px; font-weight: 700; }
.fabric-weight { font-size: 11px; color: var(--text-muted); }
.fabric-bar-wrap { display: flex; align-items: center; gap: 10px; }
.fabric-bar-track { flex: 1; height: 8px; background: rgba(0,0,0,.04); border-radius: 6px; overflow: hidden; }
.fabric-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3ccfd3, var(--accent-blue-deep));
  border-radius: 6px;
  transition: width .5s cubic-bezier(.4,0,.2,1);
}
.fabric-amount { font-size: 13px; font-weight: 700; color: var(--text-normal); min-width: 90px; text-align: right; }

@media (max-width:1200px) {
  .content-grid-2x2 { grid-template-columns: 1fr; }
  .fabric-row { grid-template-columns: 80px 1fr 90px; }
}
@media (max-width:768px) {
  .ledger-row.compact { grid-template-columns: 52px 1fr auto; }
  .ledger-row.compact .ledger-values { display: none; }
  .fabric-row { grid-template-columns: 1fr; gap: 4px; }
  .fabric-bar-wrap { order: 2; }
  .fabric-amount { order: 3; text-align: left; }
}
</style>
