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
  const bills = sourceBills.filter((bill) => {
    if (params.month && !String(bill.billDate || '').startsWith(params.month)) return false
    if (params.type && params.type !== 'all' && bill.type !== params.type) return false
    if (params.customer && params.customer !== 'all') {
      const matched = String(bill.partnerId || bill.customerId || '') === String(params.customer)
        || String(bill.partnerName || bill.customerName || bill.supplier || '') === String(params.customer)
      if (!matched) return false
    }
    if (params.fabric && params.fabric !== 'all') {
      const matched = (bill.items || []).some((item) => (
        String(item.fabricId || '') === String(params.fabric) || String(item.fabricName || '') === String(params.fabric)
      ))
      if (!matched) return false
    }
    if (params.settlement && params.settlement !== 'all') {
      const unsettledAmount = Number(bill.unsettledAmount || 0)
      if (params.settlement === 'settled' && unsettledAmount > 0) return false
      if (params.settlement === 'unsettled' && unsettledAmount <= 0) return false
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

  bills.forEach(bill => {
    const amount = Math.round(Number(bill.totalAmount || 0))
    const weight = Math.round(Number(bill.totalWeight || 0) * 100) / 100
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
      dailyMap[day] = { day, income: 0, expense: 0, net: 0, totalAmount: 0, totalWeight: 0 }
    }
    dailyMap[day].totalAmount += amount
    dailyMap[day].totalWeight += weight
    if (bill.type === 'sale') {
      dailyMap[day].income += amount
    } else {
      dailyMap[day].expense += amount
    }
    dailyMap[day].net = dailyMap[day].income - dailyMap[day].expense

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

    bill.items?.forEach(item => {
      const fabricName = item.fabricName || '其他'
      if (!fabricMap[fabricName]) {
        fabricMap[fabricName] = { fabricName, totalWeight: 0, totalAmount: 0 }
      }
      const itemWeight = Math.round(Number(item.totalWeight ?? item.weight ?? item.quantity ?? 0) * 100) / 100
      const itemAmount = Math.round(Number(item.amount || 0))
      fabricMap[fabricName].totalWeight += itemWeight
      fabricMap[fabricName].totalAmount += itemAmount

      const productId = item.fabricId || fabricName
      if (!productMap[productId]) {
        productMap[productId] = { productId, productName: fabricName, outboundWeight: 0, outboundAmount: 0, purchaseCost: 0 }
      }
      if (bill.type === 'sale') {
        productMap[productId].outboundWeight += itemWeight
        productMap[productId].outboundAmount += itemAmount
      } else {
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

  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return {
    summary: {
      monthlyIncome: overview.totalIncome,
      monthlyExpense: overview.totalExpense,
      monthlyNetAmount: overview.netAmount,
      monthlyOrderCount: overview.billCount,
      unsettledAmount: overview.unsettledAmount,
    },
    overview,
    daily: Object.values(dailyMap),
    dailyTrend: Object.values(dailyMap),
    purchaseOutboundStats,
    customerRanking,
    productAnalysis,
    fabricDistribution: Object.values(fabricMap),
    settlementOverview,
    months,
    selectedMonth: params.month || months[0]
  }
}
