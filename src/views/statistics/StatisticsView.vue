<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { fetchStatisticsSummaryApi } from '../../api/statistics'
import { formatMoney } from '../../utils/money'
import { BILL_DATA_CHANGED_EVENT } from '../../utils/bill-events'

const selectedMonth = ref('')
const ledgerPage = ref(1)
const ledgerPageSize = 4
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
        <div>
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

    <div class="overview-grid">
      <article class="panel metric income-card">
        <span class="metric-label">总收入</span>
        <strong class="metric-value income">{{ formatMoney(summary.totalIncome) }}</strong>
        <small class="metric-note">来自出货单据</small>
      </article>
      <article class="panel metric expense-card">
        <span class="metric-label">总支出</span>
        <strong class="metric-value expense">{{ formatMoney(summary.totalExpense) }}</strong>
        <small class="metric-note">来自进货单据</small>
      </article>
      <article class="panel metric net-card">
        <span class="metric-label">净收支</span>
        <strong class="metric-value" :class="summary.netAmount >= 0 ? 'income' : 'expense'">{{ formatMoney(Math.abs(summary.netAmount)) }}</strong>
        <small class="metric-note">{{ summary.netAmount >= 0 ? '净流入' : '净流出' }}</small>
      </article>
      <article class="panel metric side-card">
        <span class="metric-label">总重量 / 单据</span>
        <strong class="metric-value side">{{ summary.totalWeight.toFixed(2) }} 斤</strong>
        <small class="metric-note">{{ summary.billCount }} 笔单据</small>
      </article>
    </div>

    <div class="content-grid top-grid">
      <article class="panel">
        <div class="panel-head ledger-head">
          <div>
            <h2>每日收支台账</h2>
            <span class="panel-tip">收入 / 支出 / 净额</span>
          </div>
          <div v-if="dailyLedger.length > 0" class="pager-inline">
            <button type="button" class="pager-btn" :disabled="ledgerPage === 1" @click="goLedgerPage(ledgerPage - 1)">上一页</button>
            <span class="pager-text">第 {{ ledgerPage }} / {{ ledgerPageCount }} 页</span>
            <button type="button" class="pager-btn" :disabled="ledgerPage === ledgerPageCount" @click="goLedgerPage(ledgerPage + 1)">下一页</button>
          </div>
        </div>
        <div class="ledger-list">
          <div v-if="loading" class="empty">统计数据加载中...</div>
          <div v-else-if="dailyLedger.length === 0" class="empty">暂无统计数据</div>
          <div v-for="item in animatedPagedLedger" :key="item.day" class="ledger-row">
            <div class="day-pill">{{ item.day }}日</div>
            <div class="bar-track">
              <div class="bar-fill expense-fill" :class="{ ready: barMotionReady }" :style="{ width: `${item.renderExpenseWidth}%` }"></div>
            </div>
            <div class="ledger-values">
              <span class="income-text">收入 {{ formatMoney(item.income) }}</span>
              <span class="expense-text">支出 {{ formatMoney(item.expense) }}</span>
              <span class="net-text" :class="item.net >= 0 ? 'income-text' : 'expense-text'">净额 {{ item.net >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(item.net)) }}</span>
            </div>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>收支摘要</h2>
          <span class="panel-tip">Month Snapshot</span>
        </div>
        <div class="insight-list">
          <div class="insight-item"><span>有支出天数</span><strong>{{ expenseDays }} 天</strong></div>
          <div class="insight-item"><span>单笔平均支出</span><strong>{{ formatMoney(averageExpensePerBill) }}</strong></div>
          <div class="insight-item"><span>日均支出</span><strong>{{ formatMoney(averageExpensePerDay) }}</strong></div>
          <div class="insight-item muted"><span>月交易总额</span><strong>{{ formatMoney(summary.totalTransactionAmount) }}</strong></div>
        </div>
      </article>
    </div>

    <div class="content-grid bottom-grid">
      <article class="panel">
        <div class="panel-head">
          <h2>交易对象排行</h2>
          <span class="panel-tip">Expense Ranking</span>
        </div>
        <table>
          <thead>
            <tr><th>对象</th><th>单据数</th><th>总重量</th><th>支出金额</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="4" class="empty">统计数据加载中...</td></tr>
            <tr v-else-if="expenseByCustomer.length === 0"><td colspan="4" class="empty">暂无对象交易数据</td></tr>
            <tr v-for="(item, index) in expenseByCustomer" :key="item.customerName">
              <td><div class="customer-cell"><span class="rank-num" :class="{ 'top-3': index < 3 }">{{ index + 1 }}</span>{{ item.customerName }}</div></td>
              <td>{{ item.billCount }}</td>
              <td>{{ Number(item.totalWeight || 0).toFixed(2) }}</td>
              <td class="expense-text strong">{{ formatMoney(item.totalAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>布料金额分布</h2>
          <span class="panel-tip">Fabric Distribution</span>
        </div>
        <div class="category-list">
          <div v-if="loading" class="empty">统计数据加载中...</div>
          <div v-else-if="expenseByFabric.length === 0" class="empty">暂无布料统计数据</div>
          <div v-for="item in expenseByFabric" :key="item.fabricName" class="category-row">
            <div class="category-meta"><span class="name">{{ item.fabricName }}</span><span class="weight">{{ Number(item.weight || 0).toFixed(2) }} 斤</span></div>
            <div class="bar-track"><div class="bar-fill category-fill" :class="{ ready: barMotionReady }" :style="{ width: `${barMotionReady ? item.ratio : 0}%` }"></div></div>
            <div class="category-amount">{{ formatMoney(item.amount) }}</div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.income-expense-page,.ledger-list,.insight-list,.category-list{display:flex;flex-direction:column}.income-expense-page{gap:24px}.title-block,.panel-head,.insight-item,.customer-cell,.pager-inline{display:flex;align-items:center}.stats-header{margin-bottom:4px}.title-block,.panel-head,.insight-item{justify-content:space-between;gap:12px}h1,h2{margin:0;color:var(--text-normal)}h1{font-size:28px;font-weight:800}h2{font-size:18px}.subtitle,.desc,.metric-label,.metric-note,.month-picker label,.panel-tip,.category-meta .weight,th,.empty,.pager-text{color:var(--text-muted)}.subtitle{margin-left:10px;font-size:14px;letter-spacing:1px;text-transform:uppercase}.desc{margin:10px 0 0;font-size:13px}.month-picker{display:flex;flex-direction:column;gap:8px;min-width:180px}.modern-select{background:var(--panel-bg);border:1px solid var(--panel-line);padding:9px 14px;border-radius:10px;font-size:15px;font-weight:600;color:var(--primary-dark);outline:none}.overview-grid,.content-grid{display:grid;gap:20px}.overview-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.top-grid{grid-template-columns:1.7fr .9fr}.bottom-grid{grid-template-columns:1.2fr 1fr}.metric{display:flex;flex-direction:column;gap:10px}.metric-value{font:800 31px/1.1 'Outfit',sans-serif;color:var(--text-normal)}.income{color:#169b62}.expense,.expense-text{color:#d25959}.side{color:var(--accent-blue-deep)}.income-card{background:linear-gradient(180deg,rgba(49,174,111,.09),rgba(255,255,255,.92))}.expense-card{background:linear-gradient(180deg,rgba(210,89,89,.1),rgba(255,255,255,.92))}.net-card{background:linear-gradient(180deg,rgba(42,131,219,.1),rgba(255,255,255,.92))}.side-card{background:linear-gradient(180deg,rgba(75,131,216,.1),rgba(255,255,255,.92))}.ledger-list,.insight-list,.category-list{gap:14px}.ledger-row,.category-row{display:grid;gap:14px;align-items:center}.ledger-row{grid-template-columns:62px minmax(0,1fr) 280px;padding:12px 0;border-bottom:1px solid var(--panel-line)}.day-pill,.rank-num{display:grid;place-items:center}.day-pill{height:34px;border-radius:999px;background:rgba(38,115,199,.08);color:var(--accent-blue-deep);font-size:13px;font-weight:700}.ledger-values{display:flex;flex-direction:column;gap:4px;font-size:13px}.bar-track{height:10px;background:rgba(0,0,0,.05);border-radius:999px;overflow:hidden}.bar-fill{height:100%;border-radius:999px;transition:none}.bar-fill.ready{transition:width .45s ease}.expense-fill{background:linear-gradient(90deg,#ff8f8f 0%,#d25959 100%)}.category-fill{background:linear-gradient(90deg,#4fd5c3 0%,var(--accent-blue-deep) 100%)}.income-text{color:#169b62}.net-text,.strong,.category-amount{font-weight:700}.insight-item{padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.55);border:1px solid rgba(201,214,230,.7)}.insight-item strong,.category-meta .name{color:var(--text-normal)}.insight-item.muted strong{color:var(--accent-blue-deep)}.ledger-head{align-items:flex-start}.pager-inline{gap:10px;flex-wrap:wrap;justify-content:flex-end}.pager-btn{height:34px;padding:0 12px;border:1px solid var(--panel-line);border-radius:10px;background:var(--panel-bg);color:var(--text-normal);cursor:pointer;transition:.2s}.pager-btn:hover:not(:disabled){border-color:var(--primary);color:var(--primary-dark)}.pager-btn:disabled{opacity:.45;cursor:not-allowed}table{width:100%;border-collapse:collapse}th,td{padding:15px 12px;text-align:left;border-bottom:1px solid var(--panel-line)}th{font-size:13px;font-weight:600}.customer-cell{gap:12px;font-weight:600}.rank-num{width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.06);color:var(--text-muted);font-size:12px;font-weight:700}.rank-num.top-3{background:var(--primary);color:#fff}.category-row{grid-template-columns:120px minmax(0,1fr) 120px}.category-meta{display:flex;flex-direction:column;gap:4px}.category-meta .name{font-size:14px;font-weight:700}.empty{padding:32px;text-align:center;font-size:14px}@media (max-width:1200px){.overview-grid,.top-grid,.bottom-grid{grid-template-columns:1fr}}@media (max-width:768px){.title-block,.panel-head{flex-direction:column;align-items:flex-start}.month-picker{width:100%}.modern-select{width:100%}.ledger-row,.category-row{grid-template-columns:1fr}.pager-inline{width:100%;justify-content:space-between}}
</style>
