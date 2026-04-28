<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import AppIcon from '../../components/icons/AppIcon.vue'
import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useFabricStore } from '../../stores/fabric'
import { fetchStatisticsSummaryApi } from '../../api/statistics'
import { formatMoney } from '../../utils/money'
import { formatWeight } from '../../utils/weight'
import { dayjs } from '../../utils/date'
import { BILL_DATA_CHANGED_EVENT } from '../../utils/bill-events'
import { getExportImageBrandName } from '../../utils/app-config'
import { showToast } from '../../utils/toast'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const CUSTOMER_PAGE_SIZE = 6
const FABRIC_PAGE_SIZE = 6

const billRecordStore = useBillRecordStore()
const customerStore = useCustomerStore()
const fabricStore = useFabricStore()

const loadExcelJS = async () => {
  const module = await import('exceljs')
  return module.default
}

const padNumber = (value) => String(value).padStart(2, '0')
const formatMonthKey = (date) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`
const CURRENT_MONTH_KEY = formatMonthKey(new Date())

const selectedMonth = ref(CURRENT_MONTH_KEY)
const selectedCustomer = ref('all')
const selectedFabric = ref('all')
const selectedBillType = ref('all')
const selectedSettlement = ref('all')
const loading = ref(false)
const chartMotionReady = ref(false)
const customerPage = ref(1)
const fabricPage = ref(1)
const trendChartRef = ref(null)
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)

const summaryData = ref({
  summary: null,
  overview: {},
  daily: [],
  dailyTrend: [],
  customerRanking: [],
  fabricDistribution: [],
  settlementOverview: [],
  purchaseOutboundStats: [],
  productAnalysis: [],
})

let trendChartInstance = null

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100

const formatPercent = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0.0%'
  return `${(number * 100).toFixed(1)}%`
}

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

const clampPage = (page, pageCount) => Math.min(Math.max(page, 1), pageCount)
const paginate = (list, page, pageSize) => list.slice((page - 1) * pageSize, page * pageSize)

const getCssVarValue = (name, fallback) => {
  if (typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const matchesSettlement = (record) => {
  if (selectedSettlement.value === 'all') return true
  const unsettledAmount = toNumber(record.unsettledAmount)
  return selectedSettlement.value === 'settled' ? unsettledAmount <= 0 : unsettledAmount > 0
}

const recordHasFabric = (record, fabricKey) => {
  if (fabricKey === 'all') return true
  return (record.items || []).some((item) => {
    return String(item.fabricId || '') === String(fabricKey) || String(item.fabricName || '') === String(fabricKey)
  })
}

const monthRecords = computed(() => {
  const records = Array.isArray(billRecordStore.records) ? billRecordStore.records : []
  return records.filter((record) => String(record.billDate || '').startsWith(selectedMonth.value))
})

const filteredRecords = computed(() => {
  return monthRecords.value.filter((record) => {
    const billTypeMatched = selectedBillType.value === 'all' || record.type === selectedBillType.value
    const customerMatched = selectedCustomer.value === 'all'
      || String(record.partnerId || record.customerId || '') === String(selectedCustomer.value)
      || String(record.partnerName || record.customerName || record.supplier || '') === String(selectedCustomer.value)

    return billTypeMatched
      && customerMatched
      && recordHasFabric(record, selectedFabric.value)
      && matchesSettlement(record)
  })
})

const selectedMonthTitle = computed(() => getMonthTitle(selectedMonth.value))
const canGoNextMonth = computed(() => selectedMonth.value < CURRENT_MONTH_KEY)

const customerOptions = computed(() => {
  const fromStore = (customerStore.customers || []).map((item) => ({
    value: item.id || item.name,
    label: item.name,
  }))
  const fromBills = monthRecords.value.map((record) => ({
    value: record.partnerId || record.customerId || record.partnerName || record.customerName || record.supplier,
    label: record.partnerName || record.customerName || record.supplier,
  }))
  return [...fromStore, ...fromBills]
    .filter((item) => item.value && item.label)
    .filter((item, index, list) => list.findIndex((next) => String(next.value) === String(item.value)) === index)
})

const fabricOptions = computed(() => {
  const fromStore = (fabricStore.fabrics || []).map((item) => ({
    value: item.id || item.name,
    label: item.name,
  }))
  const fromBills = monthRecords.value.flatMap((record) => (record.items || []).map((item) => ({
    value: item.fabricId || item.fabricName,
    label: item.fabricName,
  })))
  return [...fromStore, ...fromBills]
    .filter((item) => item.value && item.label)
    .filter((item, index, list) => list.findIndex((next) => String(next.value) === String(item.value)) === index)
})

const monthlySummary = computed(() => {
  if (summaryData.value.summary) {
    return {
      monthlyIncome: roundMoney(summaryData.value.summary.monthlyIncome),
      monthlyExpense: roundMoney(summaryData.value.summary.monthlyExpense),
      monthlyNetAmount: roundMoney(summaryData.value.summary.monthlyNetAmount),
      monthlyOrderCount: toNumber(summaryData.value.summary.monthlyOrderCount),
      unsettledAmount: roundMoney(summaryData.value.summary.unsettledAmount),
    }
  }

  const saleRecords = filteredRecords.value.filter((record) => record.type === 'sale')
  const purchaseRecords = filteredRecords.value.filter((record) => record.type === 'purchase')
  const monthlyIncome = roundMoney(saleRecords.reduce((sum, record) => sum + toNumber(record.totalAmount), 0))
  const monthlyExpense = roundMoney(purchaseRecords.reduce((sum, record) => sum + toNumber(record.totalAmount), 0))
  const unsettledAmount = roundMoney(filteredRecords.value.reduce((sum, record) => sum + toNumber(record.unsettledAmount), 0))

  return {
    monthlyIncome,
    monthlyExpense,
    monthlyNetAmount: roundMoney(monthlyIncome - monthlyExpense),
    monthlyOrderCount: filteredRecords.value.length,
    unsettledAmount,
  }
})

const purchaseOutboundStats = computed(() => {
  if (Array.isArray(summaryData.value.purchaseOutboundStats) && summaryData.value.purchaseOutboundStats.length) {
    return summaryData.value.purchaseOutboundStats.map((item) => ({
      ...item,
      orderCount: toNumber(item.orderCount),
      totalWeight: roundMoney(item.totalWeight),
      totalAmount: roundMoney(item.totalAmount),
      averagePrice: roundMoney(item.averagePrice),
      amountRatio: toNumber(item.amountRatio),
    }))
  }

  const totalTransactionAmount = filteredRecords.value.reduce((sum, record) => sum + toNumber(record.totalAmount), 0)
  return [
    { type: 'purchase', typeName: '进货' },
    { type: 'sale', typeName: '出货' },
  ].map((item) => {
    const records = filteredRecords.value.filter((record) => record.type === item.type)
    const totalWeight = roundMoney(records.reduce((sum, record) => sum + toNumber(record.totalWeight), 0))
    const totalAmount = roundMoney(records.reduce((sum, record) => sum + toNumber(record.totalAmount), 0))
    return {
      ...item,
      orderCount: records.length,
      totalWeight,
      totalAmount,
      averagePrice: totalWeight > 0 ? roundMoney(totalAmount / totalWeight) : 0,
      amountRatio: totalTransactionAmount > 0 ? totalAmount / totalTransactionAmount : 0,
    }
  })
})

const dailyTrend = computed(() => {
  const remoteDaily = Array.isArray(summaryData.value.dailyTrend) && summaryData.value.dailyTrend.length
    ? summaryData.value.dailyTrend
    : summaryData.value.daily

  if (Array.isArray(remoteDaily) && remoteDaily.length) {
    return remoteDaily.map((item, index) => {
      const day = toNumber(item.day) || index + 1
      const income = roundMoney(item.income)
      const expense = roundMoney(item.expense)
      return {
        date: item.date || `${selectedMonth.value}-${padNumber(day)}`,
        day,
        dayLabel: item.dayLabel || item.label || `${day}日`,
        income,
        expense,
        netAmount: roundMoney(item.netAmount ?? item.net ?? income - expense),
      }
    })
  }

  const byDay = new Map()
  filteredRecords.value.forEach((record) => {
    const day = Number(String(record.billDate || '').slice(8, 10)) || 1
    const current = byDay.get(day) || { income: 0, expense: 0 }
    if (record.type === 'sale') {
      current.income += toNumber(record.totalAmount)
    } else {
      current.expense += toNumber(record.totalAmount)
    }
    byDay.set(day, current)
  })

  return Array.from({ length: getDaysInMonth(selectedMonth.value) }, (_, index) => {
    const day = index + 1
    const matched = byDay.get(day) || { income: 0, expense: 0 }
    return {
      date: `${selectedMonth.value}-${padNumber(day)}`,
      day,
      dayLabel: `${day}日`,
      income: roundMoney(matched.income),
      expense: roundMoney(matched.expense),
      netAmount: roundMoney(matched.income - matched.expense),
    }
  })
})

const hasTrendData = computed(() => dailyTrend.value.some((item) => item.income > 0 || item.expense > 0))
const trendChartWidth = computed(() => {
  if (viewportWidth.value <= 768) return Math.max(760, dailyTrend.value.length * 34)
  if (viewportWidth.value <= 1180) return Math.max(640, viewportWidth.value - 96)
  return Math.max(760, dailyTrend.value.length * 34)
})

const customerRanking = computed(() => {
  if (Array.isArray(summaryData.value.customerRanking) && summaryData.value.customerRanking.length) {
    return summaryData.value.customerRanking.map((item, index) => ({
      ...item,
      rank: toNumber(item.rank) || index + 1,
      transactionCount: toNumber(item.transactionCount ?? item.billCount),
      totalWeight: roundMoney(item.totalWeight),
      totalAmount: roundMoney(item.totalAmount),
      unpaidAmount: roundMoney(item.unpaidAmount),
      amountRatio: toNumber(item.amountRatio),
    }))
  }

  const saleRecords = filteredRecords.value.filter((record) => record.type === 'sale')
  const customerMap = new Map()

  saleRecords.forEach((record) => {
    const customerName = record.partnerName || record.customerName || '未命名客户'
    const key = record.partnerId || record.customerId || customerName
    const current = customerMap.get(key) || {
      customerId: key,
      customerName,
      transactionCount: 0,
      totalWeight: 0,
      totalAmount: 0,
      unpaidAmount: 0,
    }

    current.transactionCount += 1
    current.totalWeight += toNumber(record.totalWeight)
    current.totalAmount += toNumber(record.totalAmount)
    current.unpaidAmount += toNumber(record.unsettledAmount)
    customerMap.set(key, current)
  })

  const totalAmount = Array.from(customerMap.values()).reduce((sum, item) => sum + item.totalAmount, 0)
  return Array.from(customerMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount || b.transactionCount - a.transactionCount)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      totalWeight: roundMoney(item.totalWeight),
      totalAmount: roundMoney(item.totalAmount),
      unpaidAmount: roundMoney(item.unpaidAmount),
      amountRatio: totalAmount > 0 ? item.totalAmount / totalAmount : 0,
    }))
})

const customerPageCount = computed(() => Math.max(1, Math.ceil(customerRanking.value.length / CUSTOMER_PAGE_SIZE)))
const pagedCustomers = computed(() => paginate(customerRanking.value, customerPage.value, CUSTOMER_PAGE_SIZE))

const productAnalysis = computed(() => {
  if (Array.isArray(summaryData.value.productAnalysis) && summaryData.value.productAnalysis.length) {
    return summaryData.value.productAnalysis.map((item) => ({
      ...item,
      productId: item.productId || item.fabricName || item.productName,
      productName: item.productName || item.fabricName || '其他品种',
      outboundWeight: roundMoney(item.outboundWeight ?? item.totalWeight),
      outboundAmount: roundMoney(item.outboundAmount ?? item.totalAmount),
      purchaseCost: item.purchaseCost == null ? null : roundMoney(item.purchaseCost),
      grossProfit: item.grossProfit == null ? null : roundMoney(item.grossProfit),
      grossProfitRate: item.grossProfitRate == null ? null : toNumber(item.grossProfitRate),
      amountRatio: toNumber(item.amountRatio),
    }))
  }

  const productMap = new Map()

  filteredRecords.value.forEach((record) => {
    ;(record.items || []).forEach((item) => {
      if (selectedFabric.value !== 'all'
        && String(item.fabricId || '') !== String(selectedFabric.value)
        && String(item.fabricName || '') !== String(selectedFabric.value)) {
        return
      }

      const productName = item.fabricName || '其他品种'
      const productId = item.fabricId || productName
      const current = productMap.get(productId) || {
        productId,
        productName,
        outboundWeight: 0,
        outboundAmount: 0,
        purchaseCost: 0,
      }
      const weight = toNumber(item.totalWeight ?? item.quantity)
      const amount = toNumber(item.amount)

      if (record.type === 'sale') {
        current.outboundWeight += weight
        current.outboundAmount += amount
      } else {
        current.purchaseCost += amount
      }

      productMap.set(productId, current)
    })
  })

  const totalOutboundAmount = Array.from(productMap.values()).reduce((sum, item) => sum + item.outboundAmount, 0)
  return Array.from(productMap.values())
    .sort((a, b) => b.outboundAmount - a.outboundAmount || b.outboundWeight - a.outboundWeight)
    .map((item) => {
      const hasCost = item.purchaseCost > 0
      const grossProfit = hasCost ? roundMoney(item.outboundAmount - item.purchaseCost) : null
      return {
        ...item,
        outboundWeight: roundMoney(item.outboundWeight),
        outboundAmount: roundMoney(item.outboundAmount),
        purchaseCost: hasCost ? roundMoney(item.purchaseCost) : null,
        grossProfit,
        grossProfitRate: hasCost && item.outboundAmount > 0 ? grossProfit / item.outboundAmount : null,
        amountRatio: totalOutboundAmount > 0 ? item.outboundAmount / totalOutboundAmount : 0,
      }
    })
})

const fabricPageCount = computed(() => Math.max(1, Math.ceil(productAnalysis.value.length / FABRIC_PAGE_SIZE)))
const pagedFabrics = computed(() => paginate(productAnalysis.value, fabricPage.value, FABRIC_PAGE_SIZE))

const settlementOverview = computed(() => {
  if (Array.isArray(summaryData.value.settlementOverview) && summaryData.value.settlementOverview.length) {
    return summaryData.value.settlementOverview.map((item) => ({
      ...item,
      amount: roundMoney(item.amount),
      relatedOrderCount: toNumber(item.relatedOrderCount),
      description: item.description || '',
    }))
  }

  const saleRecords = filteredRecords.value.filter((record) => record.type === 'sale')
  const purchaseRecords = filteredRecords.value.filter((record) => record.type === 'purchase')
  const received = saleRecords.reduce((sum, record) => sum + toNumber(record.receivedAmount), 0)
  const customerUnpaid = saleRecords.reduce((sum, record) => sum + toNumber(record.unsettledAmount), 0)
  const paid = purchaseRecords.reduce((sum, record) => sum + toNumber(record.paidAmount), 0)
  const supplierUnpaid = purchaseRecords.reduce((sum, record) => sum + toNumber(record.unsettledAmount), 0)

  return [
    { settlementType: '本月已收款', amount: received, relatedOrderCount: saleRecords.filter((record) => toNumber(record.receivedAmount) > 0).length, description: '出货单已收客户货款' },
    { settlementType: '客户未收款', amount: customerUnpaid, relatedOrderCount: saleRecords.filter((record) => toNumber(record.unsettledAmount) > 0).length, description: '出货单待客户结清金额' },
    { settlementType: '本月已付款', amount: paid, relatedOrderCount: purchaseRecords.filter((record) => toNumber(record.paidAmount) > 0).length, description: '进货单已付供应商货款' },
    { settlementType: '供应商未付款', amount: supplierUnpaid, relatedOrderCount: purchaseRecords.filter((record) => toNumber(record.unsettledAmount) > 0).length, description: '进货单待付款金额' },
  ].map((item) => ({ ...item, amount: roundMoney(item.amount) }))
})

const resetPanelPages = () => {
  customerPage.value = 1
  fabricPage.value = 1
}

const loadStatistics = async (month = selectedMonth.value || CURRENT_MONTH_KEY) => {
  loading.value = true
  try {
    await billRecordStore.init()
    const data = await fetchStatisticsSummaryApi({
      month,
      customer: selectedCustomer.value,
      fabric: selectedFabric.value,
      type: selectedBillType.value,
      settlement: selectedSettlement.value,
    })
    summaryData.value = {
      summary: data.summary || null,
      overview: data.overview || {},
      daily: Array.isArray(data.daily) ? data.daily : [],
      dailyTrend: Array.isArray(data.dailyTrend) ? data.dailyTrend : [],
      customerRanking: Array.isArray(data.customerRanking) ? data.customerRanking : [],
      fabricDistribution: Array.isArray(data.fabricDistribution) ? data.fabricDistribution : [],
      settlementOverview: Array.isArray(data.settlementOverview) ? data.settlementOverview : [],
      purchaseOutboundStats: Array.isArray(data.purchaseOutboundStats) ? data.purchaseOutboundStats : [],
      productAnalysis: Array.isArray(data.productAnalysis) ? data.productAnalysis : [],
    }
  } finally {
    loading.value = false
  }
}

const goPrevMonth = () => {
  if (!loading.value) selectedMonth.value = shiftMonth(selectedMonth.value, -1)
}

const goNextMonth = () => {
  if (!loading.value && canGoNextMonth.value) selectedMonth.value = shiftMonth(selectedMonth.value, 1)
}

const goCustomerPage = (page) => {
  customerPage.value = clampPage(page, customerPageCount.value)
}

const goFabricPage = (page) => {
  fabricPage.value = clampPage(page, fabricPageCount.value)
}

const refreshReport = async () => {
  await billRecordStore.refresh()
  await loadStatistics(selectedMonth.value)
}

const getSelectedOptionLabel = (options, value, fallback) => {
  if (value === 'all') return fallback
  return options.value.find((item) => String(item.value) === String(value))?.label || fallback
}

const getExportFileBase = () => {
  return `月度经营报表_${selectedMonth.value}_${dayjs().format('YYYYMMDD_HHmm')}`.replace(/[\\/:*?"<>|\s]+/g, '_')
}

const getFilterText = () => {
  const billTypeMap = { all: '全部', purchase: '进货', sale: '出货' }
  const settlementMap = { all: '全部', settled: '已结清', unsettled: '未结清' }
  return [
    `月份：${selectedMonthTitle.value}`,
    `客户：${getSelectedOptionLabel(customerOptions, selectedCustomer.value, '全部客户')}`,
    `品种：${getSelectedOptionLabel(fabricOptions, selectedFabric.value, '全部品种')}`,
    `单据：${billTypeMap[selectedBillType.value] || '全部'}`,
    `结算：${settlementMap[selectedSettlement.value] || '全部'}`,
  ].join(' / ')
}

const buildOverviewRows = () => [
  ['本月收入', monthlySummary.value.monthlyIncome],
  ['本月支出', monthlySummary.value.monthlyExpense],
  ['本月净额', monthlySummary.value.monthlyNetAmount],
  ['当月单据数', monthlySummary.value.monthlyOrderCount],
  ['未结清金额', monthlySummary.value.unsettledAmount],
]

const buildPurchaseOutboundRows = () => purchaseOutboundStats.value.map((item) => ({
  typeName: item.typeName,
  orderCount: item.orderCount,
  totalWeight: item.totalWeight,
  totalAmount: item.totalAmount,
  averagePrice: item.averagePrice,
  amountRatio: formatPercent(item.amountRatio),
}))

const buildDailyRows = () => dailyTrend.value.map((item) => ({
  date: item.date,
  dayLabel: item.dayLabel,
  income: item.income,
  expense: item.expense,
  netAmount: item.netAmount,
}))

const buildCustomerRows = () => customerRanking.value.map((item) => ({
  rank: item.rank,
  customerName: item.customerName,
  transactionCount: item.transactionCount,
  totalWeight: item.totalWeight,
  totalAmount: item.totalAmount,
  unpaidAmount: item.unpaidAmount,
  amountRatio: formatPercent(item.amountRatio),
}))

const buildProductRows = () => productAnalysis.value.map((item) => ({
  productName: item.productName,
  outboundWeight: item.outboundWeight,
  outboundAmount: item.outboundAmount,
  purchaseCost: item.purchaseCost == null ? null : item.purchaseCost,
  grossProfit: item.grossProfit == null ? null : item.grossProfit,
  grossProfitRate: item.grossProfitRate == null ? '--' : formatPercent(item.grossProfitRate),
  amountRatio: formatPercent(item.amountRatio),
}))

const buildSettlementRows = () => settlementOverview.value.map((item) => ({
  settlementType: item.settlementType,
  amount: item.amount,
  relatedOrderCount: item.relatedOrderCount,
  description: item.description,
}))

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const styleWorksheet = (worksheet, headerRowNumber = 4) => {
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E0DD' } },
        left: { style: 'thin', color: { argb: 'FFD9E0DD' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E0DD' } },
        right: { style: 'thin', color: { argb: 'FFD9E0DD' } },
      }
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true }
    })

    if (rowNumber === headerRowNumber) {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5F9D92' } }
      row.alignment = { vertical: 'middle', horizontal: 'center' }
    } else if (rowNumber > headerRowNumber && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFAF3' } }
      })
    }
  })
}

const addSheetTitle = (worksheet, title, columnCount) => {
  worksheet.mergeCells(1, 1, 1, columnCount)
  worksheet.getCell(1, 1).value = title
  worksheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: 'FF1F3852' } }
  worksheet.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30

  worksheet.mergeCells(2, 1, 2, columnCount)
  worksheet.getCell(2, 1).value = getFilterText()
  worksheet.getCell(2, 1).font = { size: 11, color: { argb: 'FF6A5D52' } }
  worksheet.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
}

const addDataSheet = (workbook, config) => {
  const worksheet = workbook.addWorksheet(config.name)
  worksheet.columns = config.columns.map((column) => ({ key: column.key, width: column.width }))
  addSheetTitle(worksheet, config.title, config.columns.length)
  worksheet.addRow([])
  worksheet.addRow(config.columns.map((column) => column.label))
  config.rows.forEach((row) => worksheet.addRow(row))

  config.moneyColumns?.forEach((columnKey) => {
    worksheet.getColumn(columnKey).numFmt = '¥#,##0.00'
  })
  config.numberColumns?.forEach((columnKey) => {
    worksheet.getColumn(columnKey).numFmt = '0.00'
  })
  styleWorksheet(worksheet)
  return worksheet
}

const exportExcel = async () => {
  if (!filteredRecords.value.length) {
    showToast('当前筛选条件下暂无可导出的月报数据', 'error')
    return
  }

  try {
    const ExcelJS = await loadExcelJS()
    const workbook = new ExcelJS.Workbook()
    workbook.creator = '皖盛布碎'
    workbook.created = new Date()

    const overviewSheet = workbook.addWorksheet('月度总览')
    overviewSheet.columns = [
      { key: 'metric', width: 22 },
      { key: 'value', width: 20 },
    ]
    addSheetTitle(overviewSheet, '月度经营报表', 2)
    overviewSheet.addRow([])
    overviewSheet.addRow(['指标', '数值'])
    buildOverviewRows().forEach((row) => overviewSheet.addRow(row))
    overviewSheet.getColumn('B').numFmt = '¥#,##0.00'
    overviewSheet.getCell('B8').numFmt = '0'
    styleWorksheet(overviewSheet)

    addDataSheet(workbook, {
      name: '进出货统计',
      title: '进货 / 出货统计',
      columns: [
        { key: 'typeName', label: '类型', width: 12 },
        { key: 'orderCount', label: '单据数', width: 12 },
        { key: 'totalWeight', label: '总重量', width: 14 },
        { key: 'totalAmount', label: '总金额', width: 16 },
        { key: 'averagePrice', label: '平均单价', width: 16 },
        { key: 'amountRatio', label: '占比', width: 12 },
      ],
      rows: buildPurchaseOutboundRows(),
      moneyColumns: ['D', 'E'],
      numberColumns: ['C'],
    })

    addDataSheet(workbook, {
      name: '每日趋势',
      title: '每日收支趋势',
      columns: [
        { key: 'date', label: '日期', width: 14 },
        { key: 'dayLabel', label: '日期标签', width: 12 },
        { key: 'income', label: '收入', width: 16 },
        { key: 'expense', label: '支出', width: 16 },
        { key: 'netAmount', label: '净额', width: 16 },
      ],
      rows: buildDailyRows(),
      moneyColumns: ['C', 'D', 'E'],
    })

    addDataSheet(workbook, {
      name: '客户排名',
      title: '客户交易排名',
      columns: [
        { key: 'rank', label: '排名', width: 10 },
        { key: 'customerName', label: '客户名称', width: 22 },
        { key: 'transactionCount', label: '交易笔数', width: 12 },
        { key: 'totalWeight', label: '总重量', width: 14 },
        { key: 'totalAmount', label: '总金额', width: 16 },
        { key: 'unpaidAmount', label: '未收款', width: 16 },
        { key: 'amountRatio', label: '占比', width: 12 },
      ],
      rows: buildCustomerRows(),
      moneyColumns: ['E', 'F'],
      numberColumns: ['D'],
    })

    addDataSheet(workbook, {
      name: '品种分析',
      title: '品种构成分析',
      columns: [
        { key: 'productName', label: '品种名称', width: 20 },
        { key: 'outboundWeight', label: '出货重量', width: 14 },
        { key: 'outboundAmount', label: '出货金额', width: 16 },
        { key: 'purchaseCost', label: '进货成本', width: 16 },
        { key: 'grossProfit', label: '毛利', width: 16 },
        { key: 'grossProfitRate', label: '毛利率', width: 12 },
        { key: 'amountRatio', label: '占比', width: 12 },
      ],
      rows: buildProductRows(),
      moneyColumns: ['C', 'D', 'E'],
      numberColumns: ['B'],
    })

    addDataSheet(workbook, {
      name: '结算概览',
      title: '结算概览',
      columns: [
        { key: 'settlementType', label: '结算类型', width: 18 },
        { key: 'amount', label: '金额', width: 16 },
        { key: 'relatedOrderCount', label: '关联单据数', width: 14 },
        { key: 'description', label: '说明', width: 32 },
      ],
      rows: buildSettlementRows(),
      moneyColumns: ['B'],
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, `${getExportFileBase()}.xlsx`)
    showToast('月度报表 Excel 已导出', 'success')
  } catch (error) {
    console.error('导出月度报表 Excel 失败:', error)
    showToast('导出失败，请重试', 'error')
  }
}

const drawText = (ctx, text, x, y, options = {}) => {
  const value = String(text ?? '')
  const maxWidth = options.maxWidth || 180
  let output = value
  while (ctx.measureText(output).width > maxWidth && output.length > 1) {
    output = output.slice(0, -2)
  }
  if (output !== value) output = `${output}...`
  ctx.textAlign = options.align || 'left'
  ctx.fillText(output, x, y)
}

const drawImageTable = (ctx, table) => {
  const { x, y, columns, rows, title } = table
  const headerHeight = 40
  const rowHeight = 38
  const width = columns.reduce((sum, column) => sum + column.width, 0)

  ctx.fillStyle = '#3f3933'
  ctx.font = 'bold 24px "Microsoft YaHei", "SimSun", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, x, y)

  const tableTop = y + 22
  ctx.fillStyle = '#5f9d92'
  ctx.fillRect(x, tableTop, width, headerHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 15px "Microsoft YaHei", "SimSun", sans-serif'

  let currentX = x
  columns.forEach((column) => {
    const textX = column.align === 'right' ? currentX + column.width - 12 : currentX + 12
    drawText(ctx, column.label, textX, tableTop + 26, { maxWidth: column.width - 18, align: column.align || 'left' })
    currentX += column.width
  })

  ctx.font = '14px "Microsoft YaHei", "SimSun", sans-serif'
  rows.forEach((row, rowIndex) => {
    const rowTop = tableTop + headerHeight + rowIndex * rowHeight
    ctx.fillStyle = rowIndex % 2 === 0 ? '#fffdf9' : '#fff8ef'
    ctx.fillRect(x, rowTop, width, rowHeight)
    ctx.fillStyle = '#3f3933'
    currentX = x
    columns.forEach((column) => {
      const textX = column.align === 'right' ? currentX + column.width - 12 : currentX + 12
      drawText(ctx, row[column.key], textX, rowTop + 25, { maxWidth: column.width - 18, align: column.align || 'left' })
      currentX += column.width
    })
  })

  ctx.strokeStyle = '#eadbc8'
  ctx.lineWidth = 1
  ctx.strokeRect(x, tableTop, width, headerHeight + rows.length * rowHeight)
  return tableTop + headerHeight + rows.length * rowHeight
}

const exportImage = () => {
  if (!filteredRecords.value.length) {
    showToast('当前筛选条件下暂无可导出的月报数据', 'error')
    return
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    showToast('导出图片失败，请重试', 'error')
    return
  }

  const width = 1500
  const padding = 48
  const metricY = 150
  const metricWidth = 270
  const metricGap = 16
  const tableGap = 44
  const trendRows = buildDailyRows().filter((item) => item.income > 0 || item.expense > 0).slice(0, 12)
  const tables = [
    {
      title: '进货 / 出货统计',
      columns: [
        { key: 'typeName', label: '类型', width: 130 },
        { key: 'orderCount', label: '单据数', width: 120 },
        { key: 'totalWeight', label: '总重量', width: 160, align: 'right' },
        { key: 'totalAmount', label: '总金额', width: 180, align: 'right' },
        { key: 'averagePrice', label: '平均单价', width: 170, align: 'right' },
        { key: 'amountRatio', label: '占比', width: 110, align: 'right' },
      ],
      rows: buildPurchaseOutboundRows().map((item) => ({
        ...item,
        totalWeight: `${formatWeight(item.totalWeight)}斤`,
        totalAmount: formatMoney(item.totalAmount),
        averagePrice: `${formatMoney(item.averagePrice)}/斤`,
      })),
    },
    {
      title: '每日收支趋势',
      columns: [
        { key: 'date', label: '日期', width: 170 },
        { key: 'income', label: '收入', width: 170, align: 'right' },
        { key: 'expense', label: '支出', width: 170, align: 'right' },
        { key: 'netAmount', label: '净额', width: 170, align: 'right' },
      ],
      rows: (trendRows.length ? trendRows : buildDailyRows().slice(0, 6)).map((item) => ({
        date: item.date,
        income: formatMoney(item.income),
        expense: formatMoney(item.expense),
        netAmount: formatMoney(item.netAmount),
      })),
    },
    {
      title: '客户交易排名',
      columns: [
        { key: 'rank', label: '排名', width: 90 },
        { key: 'customerName', label: '客户名称', width: 220 },
        { key: 'transactionCount', label: '笔数', width: 100, align: 'right' },
        { key: 'totalWeight', label: '总重量', width: 150, align: 'right' },
        { key: 'totalAmount', label: '总金额', width: 170, align: 'right' },
        { key: 'unpaidAmount', label: '未收款', width: 170, align: 'right' },
        { key: 'amountRatio', label: '占比', width: 110, align: 'right' },
      ],
      rows: buildCustomerRows().slice(0, 10).map((item) => ({
        ...item,
        totalWeight: `${formatWeight(item.totalWeight)}斤`,
        totalAmount: formatMoney(item.totalAmount),
        unpaidAmount: formatMoney(item.unpaidAmount),
      })),
    },
    {
      title: '品种构成分析',
      columns: [
        { key: 'productName', label: '品种名称', width: 220 },
        { key: 'outboundWeight', label: '出货重量', width: 150, align: 'right' },
        { key: 'outboundAmount', label: '出货金额', width: 170, align: 'right' },
        { key: 'purchaseCost', label: '进货成本', width: 170, align: 'right' },
        { key: 'grossProfit', label: '毛利', width: 160, align: 'right' },
        { key: 'grossProfitRate', label: '毛利率', width: 110, align: 'right' },
        { key: 'amountRatio', label: '占比', width: 110, align: 'right' },
      ],
      rows: buildProductRows().slice(0, 10).map((item) => ({
        ...item,
        outboundWeight: `${formatWeight(item.outboundWeight)}斤`,
        outboundAmount: formatMoney(item.outboundAmount),
        purchaseCost: item.purchaseCost == null ? '--' : formatMoney(item.purchaseCost),
        grossProfit: item.grossProfit == null ? '--' : formatMoney(item.grossProfit),
      })),
    },
    {
      title: '结算概览',
      columns: [
        { key: 'settlementType', label: '结算类型', width: 190 },
        { key: 'amount', label: '金额', width: 190, align: 'right' },
        { key: 'relatedOrderCount', label: '关联单据数', width: 140, align: 'right' },
        { key: 'description', label: '说明', width: 430 },
      ],
      rows: buildSettlementRows().map((item) => ({
        ...item,
        amount: formatMoney(item.amount),
        relatedOrderCount: `${item.relatedOrderCount}笔`,
      })),
    },
  ]

  const height = 320 + tables.reduce((sum, table) => sum + 66 + Math.max(table.rows.length, 1) * 38, 0) + tableGap * tables.length
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = '#fffaf3'
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#6a5d52'
  ctx.font = 'bold 30px "Microsoft YaHei", "SimSun", sans-serif'
  ctx.fillText(getExportImageBrandName(), width / 2, 48)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#3f3933'
  ctx.font = 'bold 36px "Microsoft YaHei", "SimSun", sans-serif'
  ctx.fillText('月度经营报表', padding, 94)

  ctx.fillStyle = '#8b7d70'
  ctx.font = '18px "Microsoft YaHei", "SimSun", sans-serif'
  drawText(ctx, getFilterText(), padding, 126, { maxWidth: width - padding * 2 })

  const metrics = [
    ['本月收入', formatMoney(monthlySummary.value.monthlyIncome), '#16855a'],
    ['本月支出', formatMoney(monthlySummary.value.monthlyExpense), '#c94c4c'],
    ['本月净额', formatMoney(monthlySummary.value.monthlyNetAmount), monthlySummary.value.monthlyNetAmount >= 0 ? '#16855a' : '#c94c4c'],
    ['当月单据数', `${monthlySummary.value.monthlyOrderCount} 笔`, '#247fd6'],
    ['未结清金额', formatMoney(monthlySummary.value.unsettledAmount), '#c47a1c'],
  ]

  metrics.forEach(([label, value, color], index) => {
    const x = padding + index * (metricWidth + metricGap)
    ctx.fillStyle = '#fffdf9'
    ctx.strokeStyle = '#eadbc8'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, metricY, metricWidth, 78, 16)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#8b7d70'
    ctx.font = '16px "Microsoft YaHei", "SimSun", sans-serif'
    ctx.fillText(label, x + 18, metricY + 30)
    ctx.fillStyle = color
    ctx.font = 'bold 22px "Microsoft YaHei", "SimSun", sans-serif'
    drawText(ctx, value, x + 18, metricY + 60, { maxWidth: metricWidth - 36 })
  })

  let currentY = 286
  tables.forEach((table) => {
    const rows = table.rows.length ? table.rows : [{ [table.columns[0].key]: '暂无数据' }]
    currentY = drawImageTable(ctx, { ...table, x: padding, y: currentY, rows }) + tableGap
  })

  const blobCallback = (blob) => {
    if (!blob) {
      showToast('导出图片失败，请重试', 'error')
      return
    }
    downloadBlob(blob, `${getExportFileBase()}.png`)
    showToast('月度报表图片已导出', 'success')
  }

  canvas.toBlob(blobCallback, 'image/png', 0.95)
}

const renderTrendChart = () => {
  if (!trendChartRef.value) return

  if (!trendChartInstance) {
    trendChartInstance = echarts.init(trendChartRef.value)
  }

  const textMuted = getCssVarValue('--text-muted', '#7c8698')
  const panelLine = getCssVarValue('--panel-line', 'rgba(201, 214, 230, 0.7)')
  const primaryDark = getCssVarValue('--primary-dark', '#2a78d1')
  const data = dailyTrend.value

  trendChartInstance.setOption({
    animationDuration: 450,
    animationEasing: 'cubicOut',
    color: ['#169b62', '#d25959', '#2a78d1'],
    grid: { left: 20, right: 20, top: 62, bottom: 24, containLabel: true },
    legend: {
      top: 12,
      left: 12,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: textMuted, fontSize: 12 },
      data: ['收入', '支出', '净额'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(38, 115, 199, 0.06)' } },
      backgroundColor: 'rgba(19, 29, 44, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#ffffff', fontSize: 12 },
      extraCssText: 'border-radius:12px;box-shadow:0 12px 24px rgba(0,0,0,0.16);',
      formatter: (params) => {
        const rows = [`<strong>${params[0]?.axisValueLabel || ''}</strong>`]
        params.forEach((item) => rows.push(`${item.marker}${item.seriesName}：${formatMoney(item.value)}`))
        return rows.join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.dayLabel),
      axisLine: { lineStyle: { color: panelLine } },
      axisTick: { alignWithLabel: true },
      axisLabel: { interval: 0, color: textMuted, fontSize: 12, margin: 14 },
    },
    yAxis: {
      type: 'value',
      name: '元',
      nameTextStyle: { color: textMuted, fontSize: 12, padding: [0, 0, 8, 0] },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: textMuted,
        fontSize: 12,
        formatter: (value) => (Math.abs(value) >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value)),
      },
      splitLine: { lineStyle: { color: 'rgba(201, 214, 230, 0.55)', type: 'dashed' } },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barWidth: 10,
        itemStyle: { color: '#169b62', borderRadius: [6, 6, 0, 0] },
        data: data.map((item) => item.income),
      },
      {
        name: '支出',
        type: 'bar',
        barWidth: 10,
        itemStyle: { color: '#d25959', borderRadius: [6, 6, 0, 0] },
        data: data.map((item) => item.expense),
      },
      {
        name: '净额',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: '#2a78d1' },
        itemStyle: { color: '#2a78d1', borderColor: '#ffffff', borderWidth: 2 },
        data: data.map((item) => item.netAmount),
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
  if (typeof window !== 'undefined') {
    viewportWidth.value = window.innerWidth
  }
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

watch([selectedCustomer, selectedFabric, selectedBillType, selectedSettlement], async () => {
  resetPanelPages()
  await loadStatistics(selectedMonth.value)
})

watch(customerRanking, () => {
  customerPage.value = clampPage(customerPage.value, customerPageCount.value)
})

watch(productAnalysis, () => {
  fabricPage.value = clampPage(fabricPage.value, fabricPageCount.value)
})

watch(
  [dailyTrend, loading, hasTrendData],
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
  await Promise.all([customerStore.init(), fabricStore.init(), loadStatistics(selectedMonth.value)])
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
          <h1>月度报表 <span class="subtitle">Monthly Business Report</span></h1>
          <p class="page-tip">按月份汇总进货、出货、客户欠款与品种毛利，空白日期也会完整保留。</p>
        </div>
        <div class="header-actions">
          <button type="button" class="tool-btn" :disabled="loading" @click="refreshReport">
            <AppIcon name="swap-vertical" />
            刷新
          </button>
          <button type="button" class="tool-btn" @click="exportExcel">
            <AppIcon name="table" />
            表格
          </button>
          <button type="button" class="tool-btn" @click="exportImage">
            <AppIcon name="image" />
            图片
          </button>
        </div>
      </div>
    </header>

    <section class="filter-panel panel">
      <label>
        <span>月份</span>
        <input v-model="selectedMonth" type="month" :max="CURRENT_MONTH_KEY" />
      </label>
      <label>
        <span>客户</span>
        <select v-model="selectedCustomer">
          <option value="all">全部客户</option>
          <option v-for="item in customerOptions" :key="`customer-${item.value}`" :value="item.value">{{ item.label }}</option>
        </select>
      </label>
      <label>
        <span>品种</span>
        <select v-model="selectedFabric">
          <option value="all">全部品种</option>
          <option v-for="item in fabricOptions" :key="`fabric-${item.value}`" :value="item.value">{{ item.label }}</option>
        </select>
      </label>
      <label>
        <span>单据类型</span>
        <select v-model="selectedBillType">
          <option value="all">全部</option>
          <option value="purchase">进货</option>
          <option value="sale">出货</option>
        </select>
      </label>
      <label>
        <span>结算状态</span>
        <select v-model="selectedSettlement">
          <option value="all">全部</option>
          <option value="settled">已结清</option>
          <option value="unsettled">未结清</option>
        </select>
      </label>
    </section>

    <article class="panel overview-panel">
      <div class="stats-cards">
        <div class="mini-card income">
          <span class="l">本月收入</span>
          <span class="v">{{ formatMoney(monthlySummary.monthlyIncome) }}</span>
        </div>
        <div class="mini-card expense">
          <span class="l">本月支出</span>
          <span class="v">{{ formatMoney(monthlySummary.monthlyExpense) }}</span>
        </div>
        <div class="mini-card" :class="monthlySummary.monthlyNetAmount >= 0 ? 'net-positive' : 'net-negative'">
          <span class="l">本月净额</span>
          <span class="v">{{ formatMoney(monthlySummary.monthlyNetAmount) }}</span>
        </div>
        <div class="mini-card">
          <span class="l">当月单据数</span>
          <span class="v">{{ monthlySummary.monthlyOrderCount }} <small>笔</small></span>
        </div>
        <div class="mini-card unsettled">
          <span class="l">未结清金额</span>
          <span class="v">{{ formatMoney(monthlySummary.unsettledAmount) }}</span>
        </div>
      </div>
    </article>

    <div class="report-grid">
      <article class="panel stat-panel">
        <div class="panel-head">
          <div class="panel-title-group">
            <h2>进货 / 出货统计 <span class="badge">Compare</span></h2>
            <span class="panel-count">{{ filteredRecords.length }} 笔单据</span>
          </div>
        </div>
        <div class="table-wrap ranking-wrap">
          <table>
            <thead>
              <tr>
                <th>类型</th>
                <th>单据数</th>
                <th>总重量</th>
                <th>总金额</th>
                <th>平均单价</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in purchaseOutboundStats" :key="item.type">
                <td data-label="类型"><span class="type-pill" :class="item.type">{{ item.typeName }}</span></td>
                <td data-label="单据数">{{ item.orderCount }} 笔</td>
                <td data-label="总重量">{{ formatWeight(item.totalWeight) }} 斤</td>
                <td data-label="总金额"><span class="amount-text">{{ formatMoney(item.totalAmount) }}</span></td>
                <td data-label="平均单价">{{ formatMoney(item.averagePrice) }}/斤</td>
                <td data-label="占比">{{ formatPercent(item.amountRatio) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel stat-panel">
        <div class="panel-head">
          <div class="panel-title-group">
            <h2>结算概览 <span class="badge">Settlement</span></h2>
            <span class="panel-count">收款 / 付款</span>
          </div>
        </div>
        <div class="table-wrap settlement-wrap">
          <table class="settlement-table">
            <thead>
              <tr>
                <th>结算类型</th>
                <th>金额</th>
                <th>关联单据数</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in settlementOverview" :key="item.settlementType">
                <td data-label="结算类型">{{ item.settlementType }}</td>
                <td data-label="金额"><span class="amount-text">{{ formatMoney(item.amount) }}</span></td>
                <td data-label="关联单据数">{{ item.relatedOrderCount }} 笔</td>
                <td data-label="说明" class="muted-cell">{{ item.description }}</td>
              </tr>
              <tr v-if="!loading && filteredRecords.length === 0">
                <td colspan="4" class="empty">暂无结算数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>

    <article class="panel trend-panel">
      <div class="trend-head">
        <div class="trend-title-group">
          <h2>每日收支趋势 <span class="badge">Trend</span></h2>
          <span class="tip">收入为出货金额，支出为进货金额，净额为收入减支出。</span>
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
    </article>

    <div class="detail-grid">
      <article class="panel stat-panel ranking-panel">
        <div class="panel-head">
          <div class="panel-title-group">
            <h2>客户交易排名 <span class="badge">Ranking</span></h2>
            <span v-if="customerRanking.length > 0" class="panel-count">{{ customerRanking.length }} 位客户</span>
          </div>
          <div v-if="customerRanking.length > 0" class="pager-inline">
            <span class="scroll-tip">左右滑动查看</span>
            <button type="button" class="pager-btn" :disabled="customerPage === 1" @click="goCustomerPage(customerPage - 1)">
              <AppIcon name="chevron-left" />
            </button>
            <span class="pager-text">{{ customerPage }} / {{ customerPageCount }}</span>
            <button type="button" class="pager-btn" :disabled="customerPage === customerPageCount" @click="goCustomerPage(customerPage + 1)">
              <AppIcon name="chevron-right" />
            </button>
          </div>
        </div>
        <div class="table-scroll-wrap">
          <div class="table-wrap ranking-wrap">
            <table class="ranking-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>客户名称</th>
                  <th>交易笔数</th>
                  <th>总重量</th>
                  <th>总金额</th>
                  <th>未收款</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in pagedCustomers" :key="item.customerId">
                  <td data-label="排名"><span class="rank-num" :class="{ 'top-3': item.rank <= 3 }">{{ item.rank }}</span></td>
                  <td data-label="客户名称" class="strong-cell">{{ item.customerName }}</td>
                  <td data-label="交易笔数">{{ item.transactionCount }} 笔</td>
                  <td data-label="总重量">{{ formatWeight(item.totalWeight) }} 斤</td>
                  <td data-label="总金额"><span class="amount-text">{{ formatMoney(item.totalAmount) }}</span></td>
                  <td data-label="未收款"><span class="danger-text">{{ formatMoney(item.unpaidAmount) }}</span></td>
                  <td data-label="占比">{{ formatPercent(item.amountRatio) }}</td>
                </tr>
                <tr v-if="!loading && customerRanking.length === 0">
                  <td colspan="7" class="empty">该月份暂无客户交易记录</td>
                </tr>
                <tr v-if="loading">
                  <td colspan="7" class="empty">月报数据加载中...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="panel stat-panel product-panel">
        <div class="panel-head">
          <div class="panel-title-group">
            <h2>品种构成分析 <span class="badge">Profit</span></h2>
            <span v-if="productAnalysis.length > 0" class="panel-count">{{ productAnalysis.length }} 个品种</span>
          </div>
          <div v-if="productAnalysis.length > 0" class="pager-inline">
            <span class="scroll-tip">左右滑动查看</span>
            <button type="button" class="pager-btn" :disabled="fabricPage === 1" @click="goFabricPage(fabricPage - 1)">
              <AppIcon name="chevron-left" />
            </button>
            <span class="pager-text">{{ fabricPage }} / {{ fabricPageCount }}</span>
            <button type="button" class="pager-btn" :disabled="fabricPage === fabricPageCount" @click="goFabricPage(fabricPage + 1)">
              <AppIcon name="chevron-right" />
            </button>
          </div>
        </div>
        <div class="bar-chart-scroll-wrap">
          <div class="bar-chart">
            <div v-for="item in pagedFabrics" :key="item.productId" class="product-row">
              <div class="product-main">
                <span class="label">{{ item.productName }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :class="{ ready: chartMotionReady }" :style="{ width: `${chartMotionReady ? Math.max(5, item.amountRatio * 100) : 0}%` }"></div>
                </div>
              </div>
              <div class="product-metrics">
                <span>出货 {{ formatWeight(item.outboundWeight) }} 斤</span>
                <strong>{{ formatMoney(item.outboundAmount) }}</strong>
                <span>进货成本 {{ item.purchaseCost == null ? '--' : formatMoney(item.purchaseCost) }}</span>
                <span>毛利 {{ item.grossProfit == null ? '--' : formatMoney(item.grossProfit) }}</span>
                <span>毛利率 {{ item.grossProfitRate == null ? '--' : formatPercent(item.grossProfitRate) }}</span>
                <span>占比 {{ formatPercent(item.amountRatio) }}</span>
              </div>
            </div>
            <div v-if="!loading && productAnalysis.length === 0" class="empty">暂无品种分析数据</div>
            <div v-if="loading" class="empty">月报数据加载中...</div>
          </div>
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
  margin-bottom: 4px;
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

.header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.tool-btn,
.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: var(--panel-bg);
  color: var(--text-normal);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s, opacity 0.2s;
}

.tool-btn:hover:not(:disabled),
.primary-action:hover {
  border-color: var(--primary);
  background: rgba(38, 115, 199, 0.06);
  color: var(--primary-dark);
}

.tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.filter-panel {
  display: grid;
  grid-template-columns: repeat(5, minmax(150px, 1fr));
  gap: 16px;
  padding: 20px;
}

.filter-panel label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 700;
}

.filter-panel input,
.filter-panel select {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--text-normal);
  padding: 0 12px;
  font-size: 14px;
}

.overview-panel {
  padding: 0;
  overflow: hidden;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  background: rgba(255, 255, 255, 0.3);
}

.mini-card {
  min-width: 0;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid var(--panel-line);
}

.mini-card:last-child {
  border-right: 0;
}

.mini-card .l {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 600;
}

.mini-card .v {
  font-size: 25px;
  font-weight: 800;
  color: var(--text-normal);
  font-family: 'Outfit', sans-serif;
  word-break: break-all;
}

.mini-card .v small {
  font-size: 15px;
  font-weight: 500;
  margin-left: 4px;
}

.mini-card.income .v,
.net-positive .v {
  color: #16855a;
}

.mini-card.expense .v,
.net-negative .v,
.danger-text {
  color: #c94c4c;
}

.mini-card.unsettled .v {
  color: #c47a1c;
}

.report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 24px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 24px;
}

.stat-panel,
.trend-panel {
  padding: 28px;
}

.panel-head,
.trend-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.panel-title-group,
.trend-title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-normal);
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.tip {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.panel-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(38, 115, 199, 0.08);
  color: var(--primary-dark);
  font-size: 12px;
  font-weight: 700;
}

.scroll-tip {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.badge {
  font-size: 11px;
  background: var(--primary-soft);
  color: var(--primary-dark);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.pager-inline,
.month-pager {
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

.table-wrap {
  max-width: 100%;
  overflow-x: hidden;
}

.ranking-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.table-scroll-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0 -4px;
  padding: 0 4px 8px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.bar-chart-scroll-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0 -4px;
  padding: 0 4px 8px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 14px 10px;
  text-align: left;
  border-bottom: 1px solid var(--panel-line);
  white-space: normal;
  overflow-wrap: anywhere;
}

th {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.01);
}

td {
  color: var(--text-normal);
  font-size: 14px;
}

.ranking-table {
  min-width: 760px;
  table-layout: auto;
}

.ranking-table th,
.ranking-table td {
  white-space: nowrap;
}

.settlement-table th:nth-child(1),
.settlement-table td:nth-child(1) {
  width: 24%;
}

.settlement-table th:nth-child(2),
.settlement-table td:nth-child(2) {
  width: 26%;
}

.settlement-table th:nth-child(3),
.settlement-table td:nth-child(3) {
  width: 18%;
}

.settlement-table th:nth-child(4),
.settlement-table td:nth-child(4) {
  width: 32%;
}

.strong-cell {
  font-weight: 700;
}

.muted-cell {
  color: var(--text-muted);
}

.type-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  height: 26px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.type-pill.purchase {
  background: rgba(210, 89, 89, 0.12);
  color: #bd4545;
}

.type-pill.sale {
  background: rgba(22, 155, 98, 0.12);
  color: #16855a;
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

.amount-text {
  font-family: 'Outfit', monospace;
  font-weight: 800;
  color: var(--accent-blue-deep);
}

.trend-chart-shell {
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

.empty-action {
  min-height: 280px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 18px;
  text-align: center;
  color: var(--text-normal);
}

.empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.primary-action {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.primary-action.sale {
  background: #16855a;
  border-color: #16855a;
}

.primary-action:hover {
  color: #fff;
  filter: brightness(0.98);
}

.bar-chart {
  display: grid;
  gap: 18px;
}

.product-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) 1.4fr;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--panel-line);
}

.product-main {
  display: grid;
  gap: 10px;
  align-content: center;
}

.label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-normal);
}

.bar-track {
  height: 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 99px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38b493, #247fd6);
  transition: none;
}

.bar-fill.ready {
  transition: width 0.6s ease;
}

.product-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  color: var(--text-muted);
  font-size: 13px;
}

.product-metrics strong {
  color: var(--accent-blue-deep);
  font-family: 'Outfit', monospace;
}

.detail-grid .product-panel .bar-chart {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  padding-bottom: 8px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.ranking-panel .table-scroll-wrap .ranking-table {
  min-width: max-content;
}

.ranking-panel .table-scroll-wrap .ranking-table tr {
  scroll-snap-align: start;
}

.detail-grid .product-panel .product-row {
  min-width: min(82vw, 380px);
  scroll-snap-align: start;
  grid-template-columns: 1fr;
  align-content: start;
  padding: 16px;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.58);
}

.detail-grid .product-panel .product-metrics {
  grid-template-columns: 1fr;
}

.detail-grid .product-panel .empty {
  min-width: 100%;
}

.empty {
  text-align: center;
  padding: 36px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 1180px) {
  .stats-cards,
  .filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mini-card {
    border-right: 0;
    border-bottom: 1px solid var(--panel-line);
  }

  .report-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .ranking-table th,
  .ranking-table td {
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .stats-page {
    gap: 18px;
  }

  .title-area {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-content: stretch;
  }

  .tool-btn {
    width: 100%;
  }

  .filter-panel,
  .stats-cards,
  .product-row,
  .product-metrics {
    grid-template-columns: 1fr;
  }

  .filter-panel {
    padding: 16px;
    gap: 12px;
  }

  .mini-card {
    padding: 20px 18px;
  }

  .mini-card .v {
    font-size: 22px;
  }

  .stat-panel,
  .trend-panel {
    padding: 20px 16px;
  }

  .panel-head,
  .trend-head {
    flex-direction: column;
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
    min-width: 760px;
    height: 320px;
  }

  .trend-chart-scroll,
  .table-scroll-wrap,
  .bar-chart-scroll-wrap,
  .detail-grid .product-panel .bar-chart {
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .trend-chart-scroll {
    overflow-x: auto;
    margin: 0 -4px;
    padding: 0 4px 10px;
  }

  .table-scroll-wrap {
    margin: 0 -4px;
    padding: 0 4px 8px;
  }

  .ranking-panel .table-scroll-wrap .ranking-table {
    min-width: max-content;
  }

  .ranking-panel .table-scroll-wrap .ranking-table thead {
    display: table-header-group;
  }

  .ranking-panel .table-scroll-wrap .ranking-table tbody {
    display: table-row-group;
  }

  .ranking-panel .table-scroll-wrap .ranking-table tr {
    display: table-row;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .ranking-panel .table-scroll-wrap .ranking-table th,
  .ranking-panel .table-scroll-wrap .ranking-table td {
    display: table-cell;
    padding: 13px 10px;
    border-bottom: 1px solid var(--panel-line);
    white-space: nowrap;
  }

  .ranking-panel .table-scroll-wrap .ranking-table td::before {
    content: none;
  }

  .table-wrap {
    overflow: visible;
  }

  table,
  thead,
  tbody,
  tr,
  th,
  td {
    display: block;
    width: 100%;
  }

  thead {
    display: none;
  }

  tbody {
    display: grid;
    gap: 12px;
  }

  tr {
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid var(--panel-line);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.58);
  }

  td {
    display: grid;
    grid-template-columns: minmax(84px, 0.42fr) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px dashed rgba(201, 214, 230, 0.65);
    text-align: right;
    white-space: normal;
  }

  td:last-child {
    border-bottom: 0;
  }

  td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
    text-align: left;
  }

  td.empty {
    display: block;
    text-align: center;
    padding: 24px 10px;
  }

  td.empty::before {
    content: '';
  }

  .rank-num {
    margin-left: auto;
  }

  .settlement-table td:nth-child(1),
  .settlement-table td:nth-child(2),
  .settlement-table td:nth-child(3),
  .settlement-table td:nth-child(4) {
    width: 100%;
  }

  .muted-cell {
    line-height: 1.5;
  }

  .ranking-table {
    display: table;
    width: 100%;
    min-width: 760px;
    table-layout: auto;
    border-collapse: collapse;
  }

  .ranking-table thead {
    display: table-header-group;
  }

  .ranking-table tbody {
    display: table-row-group;
  }

  .ranking-table tr {
    display: table-row;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .ranking-table th,
  .ranking-table td {
    display: table-cell;
    width: auto;
    padding: 13px 10px;
    border-bottom: 1px solid var(--panel-line);
    text-align: left;
    white-space: nowrap;
  }

  .ranking-table td::before {
    content: none;
  }

  .ranking-table .rank-num {
    margin-left: 0;
  }

  .detail-grid .product-panel .bar-chart {
    gap: 12px;
    margin: 0 -4px;
    padding: 0 4px 8px;
  }

  .detail-grid .product-panel .product-row {
    min-width: min(82vw, 340px);
    padding: 14px;
  }
}

@media (max-width: 480px) {
  .title-area h1 {
    font-size: 24px;
  }

  .subtitle {
    display: block;
    margin: 6px 0 0;
  }

  .header-actions {
    grid-template-columns: 1fr;
  }

  .month-pager {
    gap: 6px;
  }

  td {
    grid-template-columns: 78px minmax(0, 1fr);
  }
}

</style>
