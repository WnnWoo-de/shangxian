<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import AppIcon from '../../components/icons/AppIcon.vue'
import { fetchStatisticsSummaryApi } from '../../api/statistics'
import { formatMoney } from '../../utils/money'
import { BILL_DATA_CHANGED_EVENT } from '../../utils/bill-events'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const CUSTOMER_PAGE_SIZE = 5
const FABRIC_PAGE_SIZE = 5

const padNumber = (value) => String(value).padStart(2, '0')
const formatMonthKey = (date) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`
const CURRENT_MONTH_KEY = formatMonthKey(new Date())

const getMonthDate = (monthKey) => {
  const [yearText = '', monthText = ''] = String(monthKey || '').split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const fallback = new Date()
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1)
  }
  return new Date(year, month - 1, 1)
}

const getMonthTitle = (monthKey) => {
  const monthDate = getMonthDate(monthKey)
  return `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`
}

const shiftMonth = (monthKey, offset) => {
  const monthDate = getMonthDate(monthKey)
  monthDate.setMonth(monthDate.getMonth() + offset)
  return formatMonthKey(monthDate)
}

const getDaysInMonth = (monthKey) => {
  const monthDate = getMonthDate(monthKey)
  return new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
}

const selectedMonth = ref(CURRENT_MONTH_KEY)
const loading = ref(false)
const chartMotionReady = ref(false)
const customerPage = ref(1)
const fabricPage = ref(1)
const trendChartRef = ref(null)

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

let trendChartInstance = null

const clampPage = (page, pageCount) => Math.min(Math.max(page, 1), pageCount)

const paginate = (list, page, pageSize) => {
  const start = (page - 1) * pageSize
  return list.slice(start, start + pageSize)
}

const getCssVarValue = (name, fallback) => {
  if (typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const resetPanelPages = () => {
  customerPage.value = 1
  fabricPage.value = 1
}

const loadStatistics = async (month = selectedMonth.value || CURRENT_MONTH_KEY) => {
  loading.value = true
  try {
    const data = await fetchStatisticsSummaryApi({ month })
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

const selectedMonthTitle = computed(() => getMonthTitle(selectedMonth.value))
const canGoNextMonth = computed(() => selectedMonth.value < CURRENT_MONTH_KEY)

const monthlyStats = computed(() => ({
  totalAmount: Number(summaryData.value.overview?.totalTransactionAmount || 0),
  totalWeight: Number(summaryData.value.overview?.totalWeight || 0),
  billCount: Number(summaryData.value.overview?.billCount || 0),
}))

const dailyTrend = computed(() => {
  const source = Array.isArray(summaryData.value.daily) ? summaryData.value.daily : []
  const byDay = new Map(source.map((item) => [
    Number(item.day || 0),
    {
      income: Number(item.income || 0),
      expense: Number(item.expense || 0),
    },
  ]))

  return Array.from({ length: getDaysInMonth(selectedMonth.value) }, (_, index) => {
    const day = index + 1
    const matched = byDay.get(day)
    const income = Number(matched?.income || 0)
    const expense = Number(matched?.expense || 0)
    return {
      day,
      label: `${day}日`,
      income,
      expense,
      net: Number((income - expense).toFixed(2)),
    }
  })
})

const hasTrendData = computed(() => dailyTrend.value.some((item) => item.income > 0 || item.expense > 0))
const trendChartWidth = computed(() => Math.max(720, dailyTrend.value.length * 34))

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

const goPrevMonth = () => {
  if (loading.value) return
  selectedMonth.value = shiftMonth(selectedMonth.value, -1)
}

const goNextMonth = () => {
  if (loading.value || !canGoNextMonth.value) return
  selectedMonth.value = shiftMonth(selectedMonth.value, 1)
}

const goCustomerPage = (page) => {
  customerPage.value = clampPage(page, customerPageCount.value)
}

const goFabricPage = (page) => {
  fabricPage.value = clampPage(page, fabricPageCount.value)
}

const renderTrendChart = () => {
  if (!trendChartRef.value) return

  if (!trendChartInstance) {
    trendChartInstance = echarts.init(trendChartRef.value)
  }

  const textMuted = getCssVarValue('--text-muted', '#7c8698')
  const textNormal = getCssVarValue('--text-normal', '#1f2937')
  const panelLine = getCssVarValue('--panel-line', 'rgba(201, 214, 230, 0.7)')
  const primaryDark = getCssVarValue('--primary-dark', '#2a78d1')
  const data = dailyTrend.value

  trendChartInstance.setOption({
    animationDuration: 450,
    animationEasing: 'cubicOut',
    color: ['#169b62', '#d25959', '#2a78d1'],
    grid: {
      left: 20,
      right: 20,
      top: 62,
      bottom: 24,
      containLabel: true,
    },
    legend: {
      top: 12,
      left: 12,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: {
        color: textMuted,
        fontSize: 12,
      },
      data: ['收入', '支出', '净额'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(38, 115, 199, 0.06)',
        },
      },
      backgroundColor: 'rgba(19, 29, 44, 0.92)',
      borderWidth: 0,
      textStyle: {
        color: '#ffffff',
        fontSize: 12,
      },
      extraCssText: 'border-radius:12px;box-shadow:0 12px 24px rgba(0,0,0,0.16);',
      formatter: (params) => {
        const rows = [`<strong>${params[0]?.axisValueLabel || ''}</strong>`]
        params.forEach((item) => {
          rows.push(`${item.marker}${item.seriesName}：${formatMoney(item.value)}`)
        })
        return rows.join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.label),
      axisLine: {
        lineStyle: {
          color: panelLine,
        },
      },
      axisTick: {
        alignWithLabel: true,
      },
      axisLabel: {
        interval: 0,
        color: textMuted,
        fontSize: 12,
        margin: 14,
      },
    },
    yAxis: {
      type: 'value',
      name: '元',
      nameTextStyle: {
        color: textMuted,
        fontSize: 12,
        padding: [0, 0, 8, 0],
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: textMuted,
        fontSize: 12,
        formatter: (value) => {
          if (Math.abs(value) >= 10000) {
            const tenThousands = value / 10000
            return Number.isInteger(tenThousands) ? `${tenThousands}万` : `${tenThousands.toFixed(1)}万`
          }
          return String(value)
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(201, 214, 230, 0.55)',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barWidth: 10,
        itemStyle: {
          color: '#169b62',
          borderRadius: [6, 6, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: '#11a164',
          },
        },
        data: data.map((item) => item.income),
      },
      {
        name: '支出',
        type: 'bar',
        barWidth: 10,
        itemStyle: {
          color: '#d25959',
          borderRadius: [6, 6, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: '#c94c4c',
          },
        },
        data: data.map((item) => item.expense),
      },
      {
        name: '净额',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        z: 3,
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            show: true,
            formatter: '0 元',
            color: textMuted,
            fontSize: 11,
            padding: [0, 6, 0, 0],
          },
          lineStyle: {
            color: 'rgba(42, 120, 209, 0.45)',
            type: 'dashed',
            width: 1.5,
          },
          data: [
            {
              yAxis: 0,
            },
          ],
        },
        lineStyle: {
          width: 3,
          color: '#2a78d1',
        },
        itemStyle: {
          color: '#2a78d1',
          borderColor: '#ffffff',
          borderWidth: 2,
        },
        emphasis: {
          scale: true,
          itemStyle: {
            color: '#1d66c3',
          },
        },
        data: data.map((item) => item.net),
      },
    ],
    graphic: hasTrendData.value
      ? []
      : [
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            silent: true,
            style: {
              text: '本月暂无收支记录',
              fill: textNormal,
              fontSize: 14,
              fontWeight: 600,
            },
          },
          {
            type: 'text',
            left: 'center',
            top: 'middle',
            silent: true,
            style: {
              text: '整月日期已保留，金额按 0 展示',
              fill: textMuted,
              fontSize: 12,
            },
            y: 24,
          },
        ],
  }, true)

  if (loading.value) {
    trendChartInstance.showLoading('default', {
      text: '月报数据加载中...',
      color: primaryDark,
      textColor: textMuted,
      maskColor: 'rgba(255,255,255,0.68)',
    })
  } else {
    trendChartInstance.hideLoading()
  }

  trendChartInstance.resize()
}

const resizeTrendChart = () => {
  trendChartInstance?.resize()
}

const handlePageReactiveRefresh = () => {
  if (document.visibilityState === 'visible') {
    loadStatistics(selectedMonth.value)
  }
}

watch(selectedMonth, async (value, oldValue) => {
  if (!value || value === oldValue) return
  resetPanelPages()
  chartMotionReady.value = false
  await loadStatistics(value)
  await nextTick()
  chartMotionReady.value = true
  renderTrendChart()
})

watch(byCustomer, () => {
  customerPage.value = clampPage(customerPage.value, customerPageCount.value)
})

watch(byFabric, () => {
  fabricPage.value = clampPage(fabricPage.value, fabricPageCount.value)
})

watch(
  [dailyTrend, loading],
  async () => {
    await nextTick()
    renderTrendChart()
  },
  { flush: 'post' }
)

watch(
  pagedFabrics,
  async () => {
    chartMotionReady.value = false
    await nextTick()
    chartMotionReady.value = true
  },
  { flush: 'post' }
)

onMounted(async () => {
  await loadStatistics(selectedMonth.value)
  await nextTick()
  chartMotionReady.value = true
  renderTrendChart()
  window.addEventListener('resize', resizeTrendChart)
  window.addEventListener('focus', handlePageReactiveRefresh)
  document.addEventListener('visibilitychange', handlePageReactiveRefresh)
  window.addEventListener(BILL_DATA_CHANGED_EVENT, handlePageReactiveRefresh)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeTrendChart)
  window.removeEventListener('focus', handlePageReactiveRefresh)
  document.removeEventListener('visibilitychange', handlePageReactiveRefresh)
  window.removeEventListener(BILL_DATA_CHANGED_EVENT, handlePageReactiveRefresh)
  trendChartInstance?.dispose()
  trendChartInstance = null
})
</script>

<template>
  <section class="stats-page slide-up-enter-active">
    <header class="stats-header">
      <div class="title-area">
        <div class="title-copy">
          <h1>月度报表 <span class="subtitle">Monthly Financial Report</span></h1>
          <p class="page-tip">按整月查看每日收入与支出，空白日期也会完整展示。</p>
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
          <div class="trend-head">
            <div class="trend-title-group">
              <h3>每日收支趋势</h3>
              <span class="tip">双柱对比收入 / 支出，单位：元</span>
            </div>
            <div class="month-pager">
              <button type="button" class="pager-btn" :disabled="loading" @click="goPrevMonth">
                <AppIcon name="chevron-left" />
              </button>
              <div class="month-title-card">
                <span class="month-card-label">当前月份</span>
                <strong>{{ selectedMonthTitle }}</strong>
              </div>
              <button type="button" class="pager-btn" :disabled="loading || !canGoNextMonth" @click="goNextMonth">
                <AppIcon name="chevron-right" />
              </button>
            </div>
          </div>
          <div class="trend-chart-shell">
            <div class="trend-chart-scroll">
              <div ref="trendChartRef" class="trend-chart-canvas" :style="{ width: `${trendChartWidth}px` }"></div>
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
  align-items: flex-start;
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

.page-tip {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-muted);
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

.trend-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.trend-title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trend-section h3 {
  font-size: 18px;
  color: var(--text-normal);
  margin: 0;
}

.trend-title-group .tip {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.month-pager {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.month-title-card {
  min-width: 148px;
  padding: 8px 16px;
  border-radius: 14px;
  border: 1px solid rgba(38, 115, 199, 0.12);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(243, 247, 255, 0.92));
  box-shadow: 0 10px 24px rgba(24, 52, 93, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.month-card-label {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1;
}

.month-title-card strong {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary-dark);
  line-height: 1.15;
}

.trend-chart-shell {
  margin-top: 24px;
  padding-top: 18px;
  border-bottom: 1px dashed var(--panel-line);
  border-top: 1px dashed var(--panel-line);
}

.trend-chart-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 10px;
}

.trend-chart-canvas {
  height: 360px;
  min-width: 100%;
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

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .trend-head {
    align-items: stretch;
  }

  .month-pager {
    width: 100%;
    justify-content: space-between;
  }

  .month-title-card {
    flex: 1;
    min-width: 0;
  }

  .trend-chart-canvas {
    height: 320px;
  }

  .bar-row {
    grid-template-columns: 1fr;
  }

  .value {
    text-align: left;
  }
}
</style>
