import { storage, StorageTypes } from '../utils'
import { useBillRecordStore } from '../stores/billRecord'
import { fetchStatsMonthlyApi, fetchStatsOverviewApi } from './cloud'

export const fetchStatisticsOverviewApi = async () => {
  try {
    return await fetchStatsOverviewApi()
  } catch (error) {
    const bills = storage.get(StorageTypes.BILLS, [])
    const customers = storage.get(StorageTypes.CUSTOMERS, [])
    const fabrics = storage.get(StorageTypes.FABRICS, [])

    return {
      billCount: bills.length,
      customerCount: customers.length,
      fabricCount: fabrics.length
    }
  }
}

const buildDaysInMonth = (month) => {
  const [yearText, monthText] = String(month || '').split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return 31
  return new Date(year, monthIndex + 1, 0).getDate()
}

const buildMonthsFromBills = (bills = []) => {
  const billMonths = Array.from(new Set(
    bills
      .map((bill) => String(bill.billDate || '').slice(0, 7))
      .filter((month) => /^\d{4}-\d{2}$/.test(month))
  )).sort((a, b) => b.localeCompare(a))

  const calendarMonths = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    calendarMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return Array.from(new Set([...billMonths, ...calendarMonths]))
}

export const fetchStatisticsSummaryApi = async (params = {}) => {
  try {
    const remoteData = await fetchStatsMonthlyApi(params)
    if (remoteData && typeof remoteData === 'object') {
      return remoteData
    }
  } catch (error) {
    console.warn('Load monthly stats from backend failed, fallback to local bills:', error)
  }

  const billRecordStore = useBillRecordStore()
  await billRecordStore.init()

  const sourceBills = billRecordStore.records
  const months = buildMonthsFromBills(sourceBills)
  const selectedMonth = params.month || months[0] || ''
  const filters = {
    ...params,
    month: selectedMonth,
  }
  const bills = sourceBills.filter((bill) => {
    if (filters.month && !String(bill.billDate || '').startsWith(filters.month)) return false
    if (filters.type && filters.type !== 'all' && bill.type !== filters.type) return false
    if (filters.customer && filters.customer !== 'all') {
      const matched = String(bill.partnerId || bill.customerId || '') === String(filters.customer)
        || String(bill.partnerName || bill.customerName || bill.supplier || '') === String(filters.customer)
      if (!matched) return false
    }
    if (filters.fabric && filters.fabric !== 'all') {
      const matched = (bill.items || []).some((item) => (
        String(item.fabricId || '') === String(filters.fabric) || String(item.fabricName || '') === String(filters.fabric)
      ))
      if (!matched) return false
    }
    if (filters.settlement && filters.settlement !== 'all') {
      const unsettledAmount = Number(bill.unsettledAmount || 0)
      if (filters.settlement === 'settled' && unsettledAmount > 0) return false
      if (filters.settlement === 'unsettled' && unsettledAmount <= 0) return false
    }
    return true
  })

  const overview = {
    totalIncome: 0,
    totalExpense: 0,
    totalWeight: 0,
    billCount: bills.length,
    netAmount: 0,
    totalTransactionAmount: 0
  }

  const dailyMap = {}
  const customerMap = {}
  const fabricMap = {}
  const productMap = {}
  const roundMoneyValue = (value) => Math.round(Number(value || 0))
  const getSettledAmount = (bill = {}) => {
    const amount = bill.type === 'sale' ? bill.receivedAmount : bill.paidAmount
    return Math.min(roundMoneyValue(amount), roundMoneyValue(bill.totalAmount))
  }
  const getPendingAmount = (bill = {}) => {
    const direct = roundMoneyValue(bill.unsettledAmount)
    if (direct > 0) return direct
    return Math.max(roundMoneyValue(bill.totalAmount) - getSettledAmount(bill), 0)
  }
  const getItemAmount = (item = {}) => {
    const amount = Number(item.amount || 0)
    if (Number.isFinite(amount) && amount > 0) return amount
    const weight = Number(item.totalWeight ?? item.weight ?? item.quantity ?? 0)
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0)
    return Number.isFinite(weight) && Number.isFinite(unitPrice) ? weight * unitPrice : 0
  }
  const getAdjustedItemAmounts = (bill = {}) => {
    const items = Array.isArray(bill.items) ? bill.items : []
    const rawAmounts = items.map((item) => getItemAmount(item))
    if (bill.type !== 'sale') return rawAmounts.map((amount) => Math.round(amount))

    const grossItemTotal = rawAmounts.reduce((sum, amount) => sum + amount, 0)
    const finalBillAmount = Math.round(Number(bill.totalAmount || 0))
    if (grossItemTotal <= 0 || finalBillAmount <= 0) return rawAmounts.map((amount) => Math.round(amount))

    let allocated = 0
    return rawAmounts.map((amount, index) => {
      if (index === rawAmounts.length - 1) return Math.max(finalBillAmount - allocated, 0)
      const next = Math.round(amount * (finalBillAmount / grossItemTotal))
      allocated += next
      return next
    })
  }

  bills.forEach(bill => {
    const amount = Math.round(Number(bill.totalAmount || 0))
    const weight = Math.round(Number(bill.totalWeight || 0) * 100) / 100
    const settledAmount = getSettledAmount(bill)
    const pendingAmount = getPendingAmount(bill)
    const billDate = String(bill.billDate || '')
    const day = billDate.substring(8, 10) || '01'

    if (bill.type === 'sale') {
      overview.totalIncome += amount
    } else {
      overview.totalExpense += amount
    }
    overview.totalWeight += weight
    overview.totalTransactionAmount += amount

    if (!dailyMap[day]) {
      dailyMap[day] = {
        day,
        income: 0,
        expense: 0,
        actualIncome: 0,
        actualExpense: 0,
        pendingIncome: 0,
        pendingExpense: 0,
        net: 0,
        cashNet: 0,
        totalAmount: 0,
        totalWeight: 0,
        billCount: 0,
        saleCount: 0,
        purchaseCount: 0,
      }
    }
    dailyMap[day].totalAmount += amount
    dailyMap[day].totalWeight += weight
    dailyMap[day].billCount += 1
    if (bill.type === 'sale') {
      dailyMap[day].income += amount
      dailyMap[day].actualIncome += settledAmount
      dailyMap[day].pendingIncome += pendingAmount
      dailyMap[day].saleCount += 1
    } else {
      dailyMap[day].expense += amount
      dailyMap[day].actualExpense += settledAmount
      dailyMap[day].pendingExpense += pendingAmount
      dailyMap[day].purchaseCount += 1
    }
    dailyMap[day].net = dailyMap[day].income - dailyMap[day].expense
    dailyMap[day].cashNet = dailyMap[day].actualIncome - dailyMap[day].actualExpense

    if (bill.type === 'sale' && (bill.customerName || bill.partnerName)) {
      const customerName = bill.partnerName || bill.customerName
      const customerId = bill.partnerId || bill.customerId || customerName
      if (!customerMap[customerId]) {
        customerMap[customerId] = { customerId, customerName, transactionCount: 0, billCount: 0, totalAmount: 0, totalWeight: 0, unpaidAmount: 0 }
      }
      customerMap[customerId].billCount += 1
      customerMap[customerId].transactionCount += 1
      customerMap[customerId].totalAmount += amount
      customerMap[customerId].totalWeight += weight
      customerMap[customerId].unpaidAmount += Math.round(Number(bill.unsettledAmount || 0))
    }

    const adjustedItemAmounts = getAdjustedItemAmounts(bill)
    bill.items?.forEach((item, index) => {
      const fabricName = item.fabricName || '其他'
      if (!fabricMap[fabricName]) {
        fabricMap[fabricName] = { fabricName, totalWeight: 0, totalAmount: 0 }
      }
      const itemWeight = Math.round(Number(item.totalWeight ?? item.weight ?? item.quantity ?? 0) * 100) / 100
      const itemAmount = adjustedItemAmounts[index] ?? Math.round(getItemAmount(item))
      fabricMap[fabricName].totalWeight += itemWeight
      fabricMap[fabricName].totalAmount += itemAmount

      const productId = item.fabricId || fabricName
      if (!productMap[productId]) {
        productMap[productId] = {
          productId,
          productName: fabricName,
          outboundWeight: 0,
          outboundAmount: 0,
          purchaseWeight: 0,
          purchaseAmount: 0,
          purchaseCost: 0,
        }
      }
      if (bill.type === 'sale') {
        productMap[productId].outboundWeight += itemWeight
        productMap[productId].outboundAmount += itemAmount
      } else {
        productMap[productId].purchaseWeight += itemWeight
        productMap[productId].purchaseAmount += itemAmount
        productMap[productId].purchaseCost += itemAmount
      }
    })
  })

  overview.netAmount = overview.totalIncome - overview.totalExpense
  overview.unsettledAmount = bills.reduce((sum, bill) => sum + Number(bill.unsettledAmount || 0), 0)

  const purchaseOutboundStats = ['purchase', 'sale'].map((type) => {
    const rows = bills.filter((bill) => bill.type === type)
    const totalWeight = rows.reduce((sum, bill) => sum + Number(bill.totalWeight || 0), 0)
    const totalAmount = rows.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0)
    return {
      type,
      typeName: type === 'purchase' ? '进货' : '出货',
      orderCount: rows.length,
      totalWeight,
      totalAmount,
      averagePrice: totalWeight > 0 ? totalAmount / totalWeight : 0,
      amountRatio: overview.totalTransactionAmount > 0 ? totalAmount / overview.totalTransactionAmount : 0,
    }
  })

  const customerTotalAmount = Object.values(customerMap).reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const customerRanking = Object.values(customerMap)
    .sort((a, b) => b.totalAmount - a.totalAmount || b.transactionCount - a.transactionCount)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      amountRatio: customerTotalAmount > 0 ? item.totalAmount / customerTotalAmount : 0,
    }))

  const productTotalAmount = Object.values(productMap).reduce((sum, item) => sum + Number(item.outboundAmount || 0), 0)
  const productAnalysis = Object.values(productMap)
    .sort((a, b) => b.outboundAmount - a.outboundAmount || b.outboundWeight - a.outboundWeight)
    .map((item) => {
      const grossProfit = item.purchaseCost > 0 ? item.outboundAmount - item.purchaseCost : null
      return {
        ...item,
        purchaseWeight: Math.round(Number(item.purchaseWeight || 0) * 100) / 100,
        purchaseAmount: Math.round(Number(item.purchaseAmount || 0)),
        totalWeight: Math.round(Number(item.outboundWeight + item.purchaseWeight || 0) * 100) / 100,
        totalAmount: Math.round(Number(item.outboundAmount + item.purchaseAmount || 0)),
        purchaseCost: item.purchaseCost > 0 ? item.purchaseCost : null,
        grossProfit,
        grossProfitRate: grossProfit != null && item.outboundAmount > 0 ? grossProfit / item.outboundAmount : null,
        amountRatio: productTotalAmount > 0 ? item.outboundAmount / productTotalAmount : 0,
      }
    })

  const saleBills = bills.filter((bill) => bill.type === 'sale')
  const purchaseBills = bills.filter((bill) => bill.type === 'purchase')
  const settlementOverview = [
    { settlementType: '本月已收款', amount: Math.round(saleBills.reduce((sum, bill) => sum + Number(bill.receivedAmount || 0), 0)), relatedOrderCount: saleBills.filter((bill) => Number(bill.receivedAmount || 0) > 0).length, description: '出货单已收客户货款' },
    { settlementType: '客户未收款', amount: Math.round(saleBills.reduce((sum, bill) => sum + Number(bill.unsettledAmount || 0), 0)), relatedOrderCount: saleBills.filter((bill) => Number(bill.unsettledAmount || 0) > 0).length, description: '出货单待客户结清金额' },
    { settlementType: '本月已付款', amount: Math.round(purchaseBills.reduce((sum, bill) => sum + Number(bill.paidAmount || 0), 0)), relatedOrderCount: purchaseBills.filter((bill) => Number(bill.paidAmount || 0) > 0).length, description: '进货单已付供应商货款' },
    { settlementType: '供应商未付款', amount: Math.round(purchaseBills.reduce((sum, bill) => sum + Number(bill.unsettledAmount || 0), 0)), relatedOrderCount: purchaseBills.filter((bill) => Number(bill.unsettledAmount || 0) > 0).length, description: '进货单待付款金额' },
  ]

  const emptyDailyRow = (day) => ({
    day: String(day).padStart(2, '0'),
    income: 0,
    expense: 0,
    actualIncome: 0,
    actualExpense: 0,
    pendingIncome: 0,
    pendingExpense: 0,
    net: 0,
    cashNet: 0,
    totalAmount: 0,
    totalWeight: 0,
    billCount: 0,
    saleCount: 0,
    purchaseCount: 0,
  })
  const fullDailyRows = Array.from({ length: buildDaysInMonth(selectedMonth) }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return dailyMap[day] || emptyDailyRow(day)
  })

  return {
    summary: {
      monthlyIncome: overview.totalIncome,
      monthlyExpense: overview.totalExpense,
      monthlyNetAmount: overview.netAmount,
      monthlyOrderCount: overview.billCount,
      unsettledAmount: overview.unsettledAmount,
    },
    overview,
    daily: fullDailyRows,
    dailyTrend: fullDailyRows,
    purchaseOutboundStats,
    customerRanking,
    productAnalysis,
    fabricDistribution: Object.values(fabricMap)
      .map((item) => ({
        ...item,
        totalWeight: Math.round(Number(item.totalWeight || 0) * 100) / 100,
        totalAmount: Math.round(Number(item.totalAmount || 0)),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount || b.totalWeight - a.totalWeight),
    settlementOverview,
    months,
    selectedMonth
  }
}
