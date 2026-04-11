import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { billRecords as seedBillRecords } from '@/data/billRecords'
import { storage, StorageTypes } from '@/utils'
import { emitBillDataChanged } from '@/utils/bill-events'

const STORAGE_KEY = StorageTypes.BILLS

const clone = (value) => JSON.parse(JSON.stringify(value))

const normalizeItem = (item = {}, index = 0) => {
  const quantity = Number(item.quantity ?? item.totalWeight ?? item.total_weight ?? 0)
  const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0)
  const amount = Number(item.amount ?? quantity * unitPrice)

  return {
    id: item.id || `item-${Date.now()}-${index}`,
    categoryId: item.categoryId || item.category_id || '',
    categoryName: item.categoryName || item.category_name || item.category_name_snapshot || '',
    fabricId: item.fabricId || item.fabric_id || '',
    fabricName: item.fabricName || item.fabric_name || '',
    quantity,
    weightInput: String((item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.quantityInput ?? quantity) || ''),
    totalWeight: Number(item.totalWeight ?? item.total_weight ?? quantity),
    unit: item.unit || '斤',
    unitPrice,
    amount,
    note: item.note || '',
  }
}

const normalizeRecord = (record = {}) => {
  const itemsSource = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.details)
      ? record.details
      : []

  const items = itemsSource.map((item, index) => normalizeItem(item, index))
  const totalWeight = Number(
    record.totalWeight
    ?? record.netWeight
    ?? items.reduce((sum, item) => sum + Number(item.totalWeight || item.quantity || 0), 0)
  )
  const totalAmount = Number(
    record.totalAmount
    ?? record.totalPrice
    ?? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  )
  const paidAmount = Number(record.paidAmount || 0)
  const receivedAmount = Number(record.receivedAmount || 0)
  const unsettledAmount = Number(
    record.unsettledAmount
    ?? Math.max(totalAmount - (record.type === 'sale' ? receivedAmount : paidAmount), 0)
  )
  const partnerName = record.partnerName || record.customerName || record.supplier || ''
  const billDate = record.billDate || record.date?.slice?.(0, 10) || new Date().toISOString().slice(0, 10)

  return {
    id: String(record.id || `bill-${Date.now()}`),
    type: record.type === 'sale' ? 'sale' : 'purchase',
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
    status: record.status || (unsettledAmount <= 0 ? 'settled' : 'confirmed'),
    items,
    details: items,
    totalWeight,
    totalAmount,
    paidAmount,
    receivedAmount,
    unsettledAmount,
    firstWeight: Number(record.firstWeight || 0),
    lastWeight: Number(record.lastWeight || 0),
    netWeight: Number(record.netWeight ?? totalWeight),
  }
}

export const useBillRecordStore = defineStore('billRecord', () => {
  const records = ref([])
  const loading = ref(false)
  const initialized = ref(false)

  const persist = () => {
    storage.set(STORAGE_KEY, records.value)
    emitBillDataChanged()
  }

  const ensureLoaded = async () => {
    if (!initialized.value) {
      await init()
    }
  }

  async function init() {
    if (initialized.value && records.value.length) return

    loading.value = true
    try {
      const saved = storage.get(STORAGE_KEY, [])
      const source = Array.isArray(saved) && saved.length ? saved : seedBillRecords
      records.value = source.map((item) => normalizeRecord(item))

      if (!saved || !saved.length) {
        storage.set(STORAGE_KEY, records.value)
      }

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
    const record = normalizeRecord(payload)
    records.value.unshift(record)
    persist()
    return clone(record)
  }

  async function updateRecord(id, payload) {
    await ensureLoaded()
    const index = records.value.findIndex((item) => String(item.id) === String(id))
    if (index === -1) {
      throw new Error('单据不存在')
    }

    const record = normalizeRecord({
      ...records.value[index],
      ...payload,
      id: String(id),
      updatedAt: new Date().toLocaleString('sv-SE').replace(' ', ' '),
    })

    records.value[index] = record
    persist()
    return clone(record)
  }

  async function deleteRecord(id) {
    await ensureLoaded()
    const index = records.value.findIndex((item) => String(item.id) === String(id))
    if (index === -1) return false
    records.value.splice(index, 1)
    persist()
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
