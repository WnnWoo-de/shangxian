import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { billRecords as seedBillRecords } from '@/data/billRecords'
import { createBillApi, deleteBillApi, fetchBillsApi, updateBillApi } from '@/api/cloud'
import { storage, StorageTypes } from '@/utils'
import { emitBillDataChanged } from '@/utils/bill-events'

const STORAGE_KEY = StorageTypes.BILLS
const ENABLE_DEMO_SEED = import.meta.env.DEV

const clone = (value) => JSON.parse(JSON.stringify(value))

const normalizeItem = (item = {}, index = 0) => {
  const quantity = Number(item.quantity ?? item.totalWeight ?? item.total_weight ?? 0)
  const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0)
  const amount = Number(item.amount ?? quantity * unitPrice)

  return {
    id: item.id || `item-${Date.now()}-${index}`,
    fabricId: item.fabricId || item.fabric_id || '',
    fabricName: item.fabricName || item.fabric_name || '',
    quantity,
    weightInput: String((item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.quantityInput ?? item.totalWeight ?? '') || ''),
    quantityInput: String((item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.totalWeight ?? '') || ''),
    totalWeight: Number(item.totalWeight ?? item.total_weight ?? quantity),
    packCount: Number(item.packCount ?? item.pack_count ?? 0),
    packWeight: Number(item.packWeight ?? item.pack_weight ?? 0),
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
