import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { billRecords as seedBillRecords } from '@/data/billRecords'
import { createBillApi, deleteBillApi, fetchBillsApi, updateBillApi } from '@/api/cloud'
import { storage, StorageTypes } from '@/utils'
import { emitBillDataChanged } from '@/utils/bill-events'
import { today } from '@/utils/date'
import { enqueueSyncOperation } from '@/utils/sync-queue'

const STORAGE_KEY = StorageTypes.BILLS
const ENABLE_DEMO_SEED = String(import.meta.env.VITE_ENABLE_DEMO_SEED || '').trim() === '1'

const clone = (value) => JSON.parse(JSON.stringify(value))

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const normalizeMoney = (value) => Math.max(toFiniteNumber(value, 0), 0)

const subtractMoney = (amount, settlement) => {
  return Math.max(Math.round((normalizeMoney(amount) - normalizeMoney(settlement)) * 100) / 100, 0)
}

const parseWeightExpression = (input) => {
  const raw = String(input || '').trim()
  if (!raw) return 0

  const normalized = raw
    .replace(/[，,、；;]/g, ' ')
    .replace(/[＋]/g, '+')
    .replace(/[×xX]/g, '*')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return 0

  let value = 0
  normalized.split('+').forEach((part) => {
    const multiplyParts = part.split('*')
    if (multiplyParts.length === 2) {
      const left = Number(multiplyParts[0])
      const right = Number(multiplyParts[1])
      if (Number.isFinite(left) && Number.isFinite(right)) value += left * right
      return
    }

    part.split(' ').forEach((numStr) => {
      const number = Number(numStr)
      if (Number.isFinite(number)) value += number
    })
  })

  return Number.isFinite(value) ? value : 0
}

const normalizeItem = (item = {}, index = 0) => {
  const quantityInput = String((item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.totalWeight ?? '') || '')
  const parsedQuantity = parseWeightExpression(quantityInput)
  const quantityNumber = toFiniteNumber(item.quantity ?? item.totalWeight ?? item.total_weight, NaN)
  const quantity = quantityInput
    ? parsedQuantity
    : Number.isFinite(quantityNumber) && quantityNumber > 0
      ? quantityNumber
      : parsedQuantity
  const unitPrice = toFiniteNumber(item.unitPrice ?? item.unit_price, 0)
  const amount = Math.round(quantity * unitPrice * 100) / 100

  return {
    id: item.id || `item-${Date.now()}-${index}`,
    fabricId: item.fabricId || item.fabric_id || '',
    fabricName: item.fabricName || item.fabric_name || '',
    quantity,
    weightInput: String((item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.quantityInput ?? item.totalWeight ?? '') || ''),
    quantityInput,
    totalWeight: quantity,
    packCount: toFiniteNumber(item.packCount ?? item.pack_count, 0),
    packWeight: toFiniteNumber(item.packWeight ?? item.pack_weight, 0),
    unit: item.unit || '斤',
    unitPrice,
    amount,
    note: item.note || '',
    source: item.source || '',
    weighingId: item.weighingId || item.weighing_id || '',
  }
}

const normalizeWeighingDetail = (item = {}, index = 0) => {
  const firstWeight = toFiniteNumber(item.firstWeight ?? item.first_weight, 0)
  const lastWeight = toFiniteNumber(item.lastWeight ?? item.last_weight, 0)
  const netWeightNumber = toFiniteNumber(item.netWeight ?? item.net_weight, NaN)
  const netWeight = Number.isFinite(netWeightNumber)
    ? netWeightNumber
    : Math.max(firstWeight - lastWeight, 0)

  return {
    id: item.id || `weigh-${Date.now()}-${index}`,
    fabricId: item.fabricId || item.fabric_id || '',
    fabricName: item.fabricName || item.fabric_name || '',
    unitPrice: toFiniteNumber(item.unitPrice ?? item.unit_price, 0),
    firstWeight,
    lastWeight,
    netWeight,
  }
}

const normalizeRecord = (record = {}) => {
  const itemsSource = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.details)
      ? record.details
      : []

  const items = itemsSource.map((item, index) => normalizeItem(item, index))
  const itemTotalWeight = items.reduce((sum, item) => sum + toFiniteNumber(item.totalWeight || item.quantity, 0), 0)
  const itemTotalAmount = items.reduce((sum, item) => sum + toFiniteNumber(item.amount, 0), 0)
  const totalWeightNumber = toFiniteNumber(record.totalWeight ?? record.netWeight, NaN)
  const totalAmountNumber = toFiniteNumber(record.totalAmount ?? record.totalPrice, NaN)
  const totalWeight = items.length ? itemTotalWeight : Number.isFinite(totalWeightNumber) && totalWeightNumber > 0 ? totalWeightNumber : 0
  const totalAmount = items.length ? itemTotalAmount : Number.isFinite(totalAmountNumber) && totalAmountNumber > 0 ? totalAmountNumber : 0
  const type = record.type === 'sale' ? 'sale' : 'purchase'
  const paidAmount = Math.min(normalizeMoney(record.paidAmount), totalAmount)
  const receivedAmount = Math.min(normalizeMoney(record.receivedAmount), totalAmount)
  const settlementAmount = type === 'sale' ? receivedAmount : paidAmount
  const unsettledAmount = subtractMoney(totalAmount, settlementAmount)
  const partnerName = record.partnerName || record.customerName || record.supplier || ''
  const billDate = record.billDate || record.date?.slice?.(0, 10) || today()
  const weighingDetails = Array.isArray(record.weighingDetails)
    ? record.weighingDetails.map((item, index) => normalizeWeighingDetail(item, index))
    : []

  return {
    id: String(record.id || `bill-${Date.now()}`),
    type,
    billNo: record.billNo || `B${Date.now()}`,
    billDate,
    createdAt: record.createdAt || record.date || new Date().toLocaleString('sv-SE').replace(' ', ' '),
    updatedAt: record.updatedAt || record.createdAt || new Date().toLocaleString('sv-SE').replace(' ', ' '),
    partnerId: record.partnerId || record.customerId || '',
    partnerName,
    customerId: record.customerId || record.partnerId || '',
    customerName: partnerName,
    supplier: partnerName,
    note: record.note || '',
    status: record.status === 'deleted' ? 'deleted' : (unsettledAmount <= 0 ? 'settled' : 'confirmed'),
    items,
    details: items,
    totalWeight,
    totalAmount,
    paidAmount,
    receivedAmount,
    unsettledAmount,
    firstWeight: toFiniteNumber(record.firstWeight, 0),
    lastWeight: toFiniteNumber(record.lastWeight, 0),
    netWeight: toFiniteNumber(record.netWeight, 0),
    weighingDetails,
  }
}

const persistLocal = (records) => {
  storage.set(STORAGE_KEY, records)
  emitBillDataChanged()
}

export const useBillRecordStore = defineStore('billRecord', () => {
  const records = ref([])
  const loading = ref(false)
  const initialized = ref(false)

  const ensureLoaded = async () => {
    if (!initialized.value) {
      await init()
    }
  }

  async function seedCloudIfEmpty() {
    const seeds = seedBillRecords.map((item) => normalizeRecord(item))
    const created = await Promise.all(
      seeds.map(async (item) => {
        try {
          return normalizeRecord(await createBillApi(item))
        } catch {
          return item
        }
      })
    )
    return created
  }

  async function init() {
    if (initialized.value && records.value.length) return

    loading.value = true
    try {
      const cloudRecords = await fetchBillsApi()
      if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
        records.value = cloudRecords.map((item) => normalizeRecord(item))
      } else if (ENABLE_DEMO_SEED) {
        records.value = await seedCloudIfEmpty()
      } else {
        records.value = []
      }

      persistLocal(records.value)
      initialized.value = true
    } catch (error) {
      console.error('Load bills from cloud failed:', error)
      const saved = storage.get(STORAGE_KEY, [])
      if (Array.isArray(saved) && saved.length) {
        records.value = saved.map((item) => normalizeRecord(item))
      } else if (ENABLE_DEMO_SEED) {
        records.value = seedBillRecords.map((item) => normalizeRecord(item))
      } else {
        records.value = []
      }
      persistLocal(records.value)
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    initialized.value = false
    await init()
  }

  const getBillRecords = computed(() => records.value)

  function getById(id) {
    return records.value.find((item) => String(item.id) === String(id)) || null
  }

  function getRecordsByType(type) {
    return records.value
      .filter((item) => item.type === type)
      .sort((a, b) => new Date(b.billDate || b.createdAt || 0) - new Date(a.billDate || a.createdAt || 0))
  }

  async function fetchRecordDetail(id) {
    await ensureLoaded()
    return getById(id)
  }

  async function createRecord(payload) {
    await ensureLoaded()
    const normalized = normalizeRecord(payload)

    let next = normalized
    try {
      next = normalizeRecord(await createBillApi(normalized))
    } catch (error) {
      console.warn('云端创建单据失败，已回退本地:', error)
      enqueueSyncOperation('bills', 'upsert', normalized.id, normalized, normalized.updatedAt || new Date().toISOString())
    }

    records.value.unshift(next)
    persistLocal(records.value)
    return clone(next)
  }

  async function updateRecord(id, payload) {
    await ensureLoaded()
    const index = records.value.findIndex((item) => String(item.id) === String(id))
    if (index === -1) {
      throw new Error('单据不存在')
    }

    const normalized = normalizeRecord({
      ...records.value[index],
      ...payload,
      id: String(id),
      updatedAt: new Date().toLocaleString('sv-SE').replace(' ', ' '),
    })

    try {
      records.value[index] = normalizeRecord(await updateBillApi(String(id), normalized))
    } catch (error) {
      console.warn('云端更新单据失败，已回退本地:', error)
      records.value[index] = normalized
      enqueueSyncOperation('bills', 'upsert', normalized.id, normalized, normalized.updatedAt || new Date().toISOString())
    }

    persistLocal(records.value)
    return clone(records.value[index])
  }

  async function deleteRecord(id) {
    await ensureLoaded()
    const index = records.value.findIndex((item) => String(item.id) === String(id))
    if (index === -1) return false

    try {
      await deleteBillApi(String(id))
    } catch (error) {
      console.warn('云端删除单据失败，已回退本地:', error)
      enqueueSyncOperation('bills', 'delete', String(id), null, new Date().toISOString())
    }

    records.value.splice(index, 1)
    persistLocal(records.value)
    return true
  }

  async function addRecord(payload) {
    return createRecord(payload)
  }

  return {
    records,
    loading,
    getBillRecords,
    init,
    refresh,
    getById,
    getRecordsByType,
    fetchRecordDetail,
    createRecord,
    updateRecord,
    deleteRecord,
    addRecord,
  }
})
