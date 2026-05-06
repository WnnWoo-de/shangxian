import { ok } from '../helpers/http.js'
import { countActiveRows, getSqlDialect } from '../../../server/db/db.js'
import { listActiveEntities } from '../../../server/db/entity-repository.js'
import { entityConfigs } from '../../../server/db/entity-configs.js'

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100

const formatPercentValue = (amount, total) => {
  const base = toNumber(total)
  return base > 0 ? amount / base : 0
}

const getItems = (bill = {}) => (Array.isArray(bill.items) ? bill.items : Array.isArray(bill.details) ? bill.details : [])

const getPartnerName = (bill = {}) => bill.partnerName || bill.customerName || bill.supplier || '未命名客户'
const getPartnerId = (bill = {}) => bill.partnerId || bill.customerId || getPartnerName(bill)
const getBillAmount = (bill = {}) => roundMoney(bill.totalAmount)
const getSettledAmount = (bill = {}) => {
  const amount = bill.type === 'sale' ? bill.receivedAmount : bill.paidAmount
  return Math.min(roundMoney(amount), getBillAmount(bill))
}
const getPendingAmount = (bill = {}) => {
  const direct = roundMoney(bill.unsettledAmount)
  if (direct > 0) return direct
  return Math.max(getBillAmount(bill) - getSettledAmount(bill), 0)
}

const getItemWeight = (item = {}) => toNumber(item.totalWeight ?? item.quantity ?? item.weight)
const getItemAmount = (item = {}) => {
  const amount = toNumber(item.amount)
  if (amount > 0) return amount
  return roundMoney(getItemWeight(item) * toNumber(item.unitPrice ?? item.unit_price))
}
const getAdjustedItemAmounts = (bill = {}) => {
  const items = getItems(bill)
  const rawAmounts = items.map((item) => getItemAmount(item))
  if (bill.type !== 'sale') return rawAmounts

  const grossItemTotal = rawAmounts.reduce((sum, amount) => sum + amount, 0)
  const finalBillAmount = Math.round(toNumber(bill.totalAmount))
  if (grossItemTotal <= 0 || finalBillAmount <= 0) return rawAmounts

  let allocated = 0
  return rawAmounts.map((amount, index) => {
    if (index === rawAmounts.length - 1) return Math.max(finalBillAmount - allocated, 0)
    const next = Math.round(amount * (finalBillAmount / grossItemTotal))
    allocated += next
    return next
  })
}

const buildDaysInMonth = (month) => {
  const [yearText, monthText] = String(month || '').split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return 31
  return new Date(year, monthIndex + 1, 0).getDate()
}

const buildAvailableMonths = (bills = []) => {
  const billMonths = Array.from(new Set(
    bills
      .map((bill) => String(bill.billDate || '').slice(0, 7))
      .filter((month) => /^\d{4}-\d{2}$/.test(month))
  )).sort((a, b) => b.localeCompare(a))

  const calendarMonths = []
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    calendarMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return Array.from(new Set([...billMonths, ...calendarMonths]))
}

const matchesFilter = (bill, filters) => {
  if (filters.month && !String(bill.billDate || '').startsWith(filters.month)) return false
  if (filters.type !== 'all' && bill.type !== filters.type) return false

  if (filters.customer !== 'all') {
    const matched = String(getPartnerId(bill)) === filters.customer || String(getPartnerName(bill)) === filters.customer
    if (!matched) return false
  }

  if (filters.fabric !== 'all') {
    const matched = getItems(bill).some((item) => (
      String(item.fabricId || '') === filters.fabric || String(item.fabricName || '') === filters.fabric
    ))
    if (!matched) return false
  }

  if (filters.settlement !== 'all') {
    const unsettledAmount = toNumber(bill.unsettledAmount)
    if (filters.settlement === 'settled' && unsettledAmount > 0) return false
    if (filters.settlement === 'unsettled' && unsettledAmount <= 0) return false
  }

  return true
}

const buildMonthlyReport = (bills, filters) => {
  const months = buildAvailableMonths(bills)
  const selectedMonth = filters.month || months[0] || ''
  const resolvedFilters = {
    ...filters,
    month: selectedMonth,
  }
  const filteredBills = bills.filter((bill) => matchesFilter(bill, resolvedFilters))
  const saleBills = filteredBills.filter((bill) => bill.type === 'sale')
  const purchaseBills = filteredBills.filter((bill) => bill.type !== 'sale')
  const monthlyIncome = roundMoney(saleBills.reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0))
  const monthlyExpense = roundMoney(purchaseBills.reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0))
  const unsettledAmount = roundMoney(filteredBills.reduce((sum, bill) => sum + toNumber(bill.unsettledAmount), 0))
  const totalTransactionAmount = roundMoney(filteredBills.reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0))

  const purchaseOutboundStats = [
    { type: 'purchase', typeName: '进货', rows: purchaseBills },
    { type: 'sale', typeName: '出货', rows: saleBills },
  ].map((item) => {
    const totalWeight = roundMoney(item.rows.reduce((sum, bill) => sum + toNumber(bill.totalWeight), 0))
    const totalAmount = roundMoney(item.rows.reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0))
    return {
      type: item.type,
      typeName: item.typeName,
      orderCount: item.rows.length,
      totalWeight,
      totalAmount,
      averagePrice: totalWeight > 0 ? roundMoney(totalAmount / totalWeight) : 0,
      amountRatio: formatPercentValue(totalAmount, totalTransactionAmount),
    }
  })

  const dailyMap = new Map()
  filteredBills.forEach((bill) => {
    const day = Number(String(bill.billDate || '').slice(8, 10)) || 1
    const current = dailyMap.get(day) || {
      income: 0,
      expense: 0,
      actualIncome: 0,
      actualExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
      totalAmount: 0,
      totalWeight: 0,
      billCount: 0,
      saleCount: 0,
      purchaseCount: 0,
    }
    const amount = getBillAmount(bill)
    const settledAmount = getSettledAmount(bill)
    const pendingAmount = getPendingAmount(bill)

    current.totalAmount += amount
    current.totalWeight += toNumber(bill.totalWeight)
    current.billCount += 1
    if (bill.type === 'sale') {
      current.income += amount
      current.actualIncome += settledAmount
      current.pendingIncome += pendingAmount
      current.saleCount += 1
    } else {
      current.expense += amount
      current.actualExpense += settledAmount
      current.pendingExpense += pendingAmount
      current.purchaseCount += 1
    }
    dailyMap.set(day, current)
  })

  const dailyTrend = Array.from({ length: buildDaysInMonth(resolvedFilters.month) }, (_, index) => {
    const day = index + 1
    const current = dailyMap.get(day) || {
      income: 0,
      expense: 0,
      actualIncome: 0,
      actualExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
      totalAmount: 0,
      totalWeight: 0,
      billCount: 0,
      saleCount: 0,
      purchaseCount: 0,
    }
    const income = roundMoney(current.income)
    const expense = roundMoney(current.expense)
    const actualIncome = roundMoney(current.actualIncome)
    const actualExpense = roundMoney(current.actualExpense)
    const cashNet = roundMoney(actualIncome - actualExpense)
    return {
      date: `${resolvedFilters.month}-${String(day).padStart(2, '0')}`,
      day,
      dayLabel: `${day}日`,
      income,
      expense,
      actualIncome,
      actualExpense,
      pendingIncome: roundMoney(current.pendingIncome),
      pendingExpense: roundMoney(current.pendingExpense),
      cashNet,
      totalAmount: roundMoney(current.totalAmount),
      totalWeight: roundMoney(current.totalWeight),
      billCount: current.billCount,
      saleCount: current.saleCount,
      purchaseCount: current.purchaseCount,
      net: cashNet,
      netAmount: roundMoney(income - expense),
    }
  })

  const customerMap = new Map()
  saleBills.forEach((bill) => {
    const customerId = getPartnerId(bill)
    const current = customerMap.get(customerId) || {
      customerId,
      customerName: getPartnerName(bill),
      transactionCount: 0,
      totalWeight: 0,
      totalAmount: 0,
      unpaidAmount: 0,
    }
    current.transactionCount += 1
    current.totalWeight += toNumber(bill.totalWeight)
    current.totalAmount += toNumber(bill.totalAmount)
    current.unpaidAmount += toNumber(bill.unsettledAmount)
    customerMap.set(customerId, current)
  })
  const customerTotalAmount = Array.from(customerMap.values()).reduce((sum, item) => sum + item.totalAmount, 0)
  const customerRanking = Array.from(customerMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount || b.transactionCount - a.transactionCount)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      totalWeight: roundMoney(item.totalWeight),
      totalAmount: roundMoney(item.totalAmount),
      unpaidAmount: roundMoney(item.unpaidAmount),
      amountRatio: formatPercentValue(item.totalAmount, customerTotalAmount),
    }))

  const productMap = new Map()
  filteredBills.forEach((bill) => {
    const adjustedItemAmounts = getAdjustedItemAmounts(bill)
    getItems(bill).forEach((item, index) => {
      if (resolvedFilters.fabric !== 'all'
        && String(item.fabricId || '') !== resolvedFilters.fabric
        && String(item.fabricName || '') !== resolvedFilters.fabric) {
        return
      }

      const productName = item.fabricName || '其他品种'
      const productId = item.fabricId || productName
      const current = productMap.get(productId) || {
        productId,
        productName,
        outboundWeight: 0,
        outboundAmount: 0,
        purchaseWeight: 0,
        purchaseAmount: 0,
        purchaseCost: 0,
      }
      if (bill.type === 'sale') {
        current.outboundWeight += getItemWeight(item)
        current.outboundAmount += adjustedItemAmounts[index] ?? getItemAmount(item)
      } else {
        current.purchaseWeight += getItemWeight(item)
        current.purchaseAmount += getItemAmount(item)
        current.purchaseCost += getItemAmount(item)
      }
      productMap.set(productId, current)
    })
  })
  const productTotalAmount = Array.from(productMap.values()).reduce((sum, item) => sum + item.outboundAmount, 0)
  const productAnalysis = Array.from(productMap.values())
    .sort((a, b) => b.outboundAmount - a.outboundAmount || b.outboundWeight - a.outboundWeight)
    .map((item) => {
      const grossProfit = item.purchaseCost > 0 ? roundMoney(item.outboundAmount - item.purchaseCost) : null
      return {
        ...item,
        outboundWeight: roundMoney(item.outboundWeight),
        outboundAmount: roundMoney(item.outboundAmount),
        purchaseWeight: roundMoney(item.purchaseWeight),
        purchaseAmount: roundMoney(item.purchaseAmount),
        totalWeight: roundMoney(item.outboundWeight + item.purchaseWeight),
        totalAmount: roundMoney(item.outboundAmount + item.purchaseAmount),
        purchaseCost: item.purchaseCost > 0 ? roundMoney(item.purchaseCost) : null,
        grossProfit,
        grossProfitRate: grossProfit != null && item.outboundAmount > 0 ? grossProfit / item.outboundAmount : null,
        amountRatio: formatPercentValue(item.outboundAmount, productTotalAmount),
      }
    })

  const settlementOverview = [
    {
      settlementType: '本月已收款',
      amount: roundMoney(saleBills.reduce((sum, bill) => sum + toNumber(bill.receivedAmount), 0)),
      relatedOrderCount: saleBills.filter((bill) => toNumber(bill.receivedAmount) > 0).length,
      description: '出货单已收客户货款',
    },
    {
      settlementType: '客户未收款',
      amount: roundMoney(saleBills.reduce((sum, bill) => sum + toNumber(bill.unsettledAmount), 0)),
      relatedOrderCount: saleBills.filter((bill) => toNumber(bill.unsettledAmount) > 0).length,
      description: '出货单待客户结清金额',
    },
    {
      settlementType: '本月已付款',
      amount: roundMoney(purchaseBills.reduce((sum, bill) => sum + toNumber(bill.paidAmount), 0)),
      relatedOrderCount: purchaseBills.filter((bill) => toNumber(bill.paidAmount) > 0).length,
      description: '进货单已付供应商货款',
    },
    {
      settlementType: '供应商未付款',
      amount: roundMoney(purchaseBills.reduce((sum, bill) => sum + toNumber(bill.unsettledAmount), 0)),
      relatedOrderCount: purchaseBills.filter((bill) => toNumber(bill.unsettledAmount) > 0).length,
      description: '进货单待付款金额',
    },
  ]

  return {
    month: resolvedFilters.month,
    summary: {
      monthlyIncome,
      monthlyExpense,
      monthlyNetAmount: roundMoney(monthlyIncome - monthlyExpense),
      monthlyOrderCount: filteredBills.length,
      unsettledAmount,
    },
    overview: {
      totalIncome: monthlyIncome,
      totalExpense: monthlyExpense,
      totalWeight: roundMoney(filteredBills.reduce((sum, bill) => sum + toNumber(bill.totalWeight), 0)),
      billCount: filteredBills.length,
      netAmount: roundMoney(monthlyIncome - monthlyExpense),
      totalTransactionAmount,
      unsettledAmount,
    },
    dailyTrend,
    daily: dailyTrend,
    purchaseOutboundStats,
    customerRanking,
    productAnalysis,
    fabricDistribution: productAnalysis.map((item) => ({
      fabricName: item.productName,
      totalWeight: item.totalWeight,
      totalAmount: item.totalAmount,
      saleAmount: item.outboundAmount,
      purchaseAmount: item.purchaseAmount,
      outboundWeight: item.outboundWeight,
      purchaseWeight: item.purchaseWeight,
    })),
    settlementOverview,
    months,
    selectedMonth,
  }
}

export const registerStatsRoutes = (app) => {
  app.get('/api/stats/overview', async (c) => {
    const [billCount, customerCount, fabricCount] = await Promise.all([
      countActiveRows(c.env, 'bills'),
      countActiveRows(c.env, 'customers'),
      countActiveRows(c.env, 'fabrics'),
    ])

    return ok(c, {
      data: {
        billCount,
        customerCount,
        fabricCount,
      },
    })
  })

  app.get('/api/stats/monthly', async (c) => {
    const filters = {
      month: String(c.req.query('month') || ''),
      customer: String(c.req.query('customer') || 'all'),
      fabric: String(c.req.query('fabric') || 'all'),
      type: String(c.req.query('type') || 'all'),
      settlement: String(c.req.query('settlement') || 'all'),
    }

    const dialect = getSqlDialect(c.env)
    const bills = await listActiveEntities(
      c.env,
      entityConfigs.bills.table,
      `${dialect.date('bill_date')} ASC, ${dialect.dateTime('updated_at')} ASC`
    )
    return ok(c, { data: buildMonthlyReport(bills, filters) })
  })
}
