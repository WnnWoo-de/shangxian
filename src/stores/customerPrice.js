import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { storage, StorageTypes } from '@/utils'

const STORAGE_KEY = StorageTypes.CUSTOMER_PRICES

const makeKey = (customerId, fabricId) => `${customerId || ''}::${fabricId || ''}`

const normalizePrice = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export const useCustomerPriceStore = defineStore('customerPrice', () => {
  const prices = ref([])

  function saveLocal() {
    storage.set(STORAGE_KEY, prices.value)
  }

  function init() {
    const saved = storage.get(STORAGE_KEY, [])
    prices.value = Array.isArray(saved) ? saved : []
  }

  const priceCount = computed(() => prices.value.length)

  function getPrice(customerId, fabricId) {
    if (!customerId || !fabricId) return null
    return prices.value.find((item) => item.customerId === customerId && item.fabricId === fabricId) || null
  }

  function getCustomerPrices(customerId) {
    if (!customerId) return []
    return prices.value.filter((item) => item.customerId === customerId)
  }

  function getUnitPrice(customerId, fabricId, type = 'purchase') {
    const item = getPrice(customerId, fabricId)
    if (!item) return 0
    return type === 'sale' ? normalizePrice(item.salePrice) : normalizePrice(item.purchasePrice)
  }

  function upsertPrice(payload) {
    const customerId = String(payload.customerId || '').trim()
    const fabricId = String(payload.fabricId || '').trim()
    if (!customerId || !fabricId) return null

    const next = {
      id: payload.id || `cp-${Date.now().toString().slice(-8)}-${Math.random().toString(16).slice(2, 6)}`,
      customerId,
      customerName: String(payload.customerName || ''),
      fabricId,
      fabricName: String(payload.fabricName || ''),
      purchasePrice: normalizePrice(payload.purchasePrice),
      salePrice: normalizePrice(payload.salePrice),
      updatedAt: new Date().toISOString(),
    }

    const index = prices.value.findIndex((item) => makeKey(item.customerId, item.fabricId) === makeKey(customerId, fabricId))
    if (index >= 0) prices.value[index] = { ...prices.value[index], ...next, id: prices.value[index].id }
    else prices.value.push(next)

    saveLocal()
    return index >= 0 ? prices.value[index] : next
  }

  function removePrice(customerId, fabricId) {
    const index = prices.value.findIndex((item) => item.customerId === customerId && item.fabricId === fabricId)
    if (index < 0) return false
    prices.value.splice(index, 1)
    saveLocal()
    return true
  }

  function removeCustomerPrices(customerId) {
    const before = prices.value.length
    prices.value = prices.value.filter((item) => item.customerId !== customerId)
    if (prices.value.length !== before) saveLocal()
  }

  return {
    prices,
    priceCount,
    init,
    getPrice,
    getCustomerPrices,
    getUnitPrice,
    upsertPrice,
    removePrice,
    removeCustomerPrices,
  }
})
