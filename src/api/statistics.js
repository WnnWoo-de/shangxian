import { storage, StorageTypes } from '../utils'
import { useBillRecordStore } from '../stores/billRecord'
import { fetchStatsOverviewApi } from './cloud'

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
  const billRecordStore = useBillRecordStore()
  await billRecordStore.init()

  const sourceBills = billRecordStore.records
  const bills = params.month
    ? sourceBills.filter((bill) => String(bill.billDate || '').startsWith(params.month))
    : sourceBills

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

  bills.forEach(bill => {
    const amount = Number(bill.totalAmount || 0)
    const weight = Number(bill.totalWeight || 0)
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

    if (bill.customerName) {
      if (!customerMap[bill.customerName]) {
        customerMap[bill.customerName] = { customerName: bill.customerName, billCount: 0, totalAmount: 0, totalWeight: 0 }
      }
      customerMap[bill.customerName].billCount += 1
      customerMap[bill.customerName].totalAmount += amount
      customerMap[bill.customerName].totalWeight += weight
    }

    bill.items?.forEach(item => {
      const fabricName = item.fabricName || '其他'
      if (!fabricMap[fabricName]) {
        fabricMap[fabricName] = { fabricName, totalWeight: 0, totalAmount: 0 }
      }
      fabricMap[fabricName].totalWeight += Number(item.totalWeight ?? item.weight ?? item.quantity ?? 0)
      fabricMap[fabricName].totalAmount += Number(item.amount || 0)
    })
  })

  overview.netAmount = overview.totalIncome - overview.totalExpense

  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return {
    overview,
    daily: Object.values(dailyMap),
    customerRanking: Object.values(customerMap).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10),
    fabricDistribution: Object.values(fabricMap),
    months,
    selectedMonth: params.month || months[0]
  }
}
