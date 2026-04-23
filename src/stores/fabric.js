import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, StorageTypes } from '@/utils'
import { fabrics as initFabrics } from '@/data/initData'
import { fetchFabricsApi, createFabricApi, updateFabricApi, deleteFabricApi } from '@/api/cloud'
import { enqueueSyncOperation } from '@/utils/sync-queue'

const STORAGE_KEY = StorageTypes.FABRICS
const ENABLE_DEMO_SEED = String(import.meta.env.VITE_ENABLE_DEMO_SEED || '').trim() === '1'

const saveLocal = (list) => storage.set(STORAGE_KEY, list)

export const useFabricStore = defineStore('fabric', () => {
  const fabrics = ref([])
  const loading = ref(false)
  const searchKeyword = ref('')
  const filterStatus = ref('all')

  async function seedCloudIfEmpty() {
    const seeds = [...initFabrics]
    await Promise.all(seeds.map(item => createFabricApi(item)))
    return seeds
  }

  async function init() {
    loading.value = true

    try {
      const cloudFabrics = await fetchFabricsApi()
      if (Array.isArray(cloudFabrics) && cloudFabrics.length > 0) {
        fabrics.value = cloudFabrics
      } else if (ENABLE_DEMO_SEED) {
        fabrics.value = await seedCloudIfEmpty()
      } else {
        fabrics.value = []
      }
      saveLocal(fabrics.value)
    } catch (error) {
      console.error('Load fabrics from cloud failed:', error)
      const saved = storage.get(STORAGE_KEY)
      if (saved && saved.length > 0) {
        fabrics.value = saved
      } else if (ENABLE_DEMO_SEED) {
        fabrics.value = [...initFabrics]
        saveLocal(fabrics.value)
      } else {
        fabrics.value = []
      }
    } finally {
      loading.value = false
    }
  }

  const filteredFabrics = computed(() => {
    return fabrics.value.filter(fabric => {
      const matchKeyword = !searchKeyword.value ||
        fabric.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
        fabric.code.toLowerCase().includes(searchKeyword.value.toLowerCase())

      const matchStatus = filterStatus.value === 'all' || fabric.status === filterStatus.value

      return matchKeyword && matchStatus
    })
  })

  const activeFabrics = computed(() => fabrics.value.filter(f => f.status === 'active'))
  const fabricCount = computed(() => fabrics.value.length)
  const activeCount = computed(() => activeFabrics.value.length)

  function getFabricById(id) {
    return fabrics.value.find(fabric => fabric.id === id)
  }

  function getFabricName(id) {
    const fabric = getFabricById(id)
    return fabric ? fabric.name : ''
  }

  function getFabricCode(id) {
    const fabric = getFabricById(id)
    return fabric ? fabric.code : ''
  }

  function getFabricUnit(id) {
    const fabric = getFabricById(id)
    return fabric ? fabric.unit : '斤'
  }

  function getDefaultPurchasePrice(fabricId) {
    const fabric = getFabricById(fabricId)
    return fabric ? fabric.defaultPurchasePrice : 0
  }

  function getDefaultSalePrice(fabricId) {
    const fabric = getFabricById(fabricId)
    return fabric ? fabric.defaultSalePrice : 0
  }

  async function addFabric(data) {
    loading.value = true

    try {
      const draft = {
        id: `fab-${Date.now().toString().slice(-6)}`,
        code: `FAB${Date.now().toString().slice(-4)}`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      }

      let created = draft
      try {
        created = await createFabricApi(draft)
      } catch (error) {
        console.warn('云端新增布料失败，已回退本地:', error)
        enqueueSyncOperation('fabrics', 'upsert', draft.id, draft, draft.updatedAt)
      }

      fabrics.value.push(created)
      saveLocal(fabrics.value)

      return created
    } catch (error) {
      console.error('Add fabric error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateFabric(id, data) {
    loading.value = true

    try {
      const index = fabrics.value.findIndex(f => f.id === id)
      if (index === -1) {
        throw new Error('布料不存在')
      }

      const next = {
        ...fabrics.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }

      try {
        fabrics.value[index] = await updateFabricApi(id, next)
      } catch (error) {
        console.warn('云端更新布料失败，已回退本地:', error)
        fabrics.value[index] = next
        enqueueSyncOperation('fabrics', 'upsert', next.id, next, next.updatedAt)
      }

      saveLocal(fabrics.value)
      return fabrics.value[index]
    } catch (error) {
      console.error('Update fabric error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteFabric(id) {
    const fabric = getFabricById(id)
    if (!fabric) {
      throw new Error('布料不存在')
    }
    const index = fabrics.value.findIndex(f => f.id === id)
    if (index === -1) {
      throw new Error('布料不存在')
    }

    try {
      await deleteFabricApi(id)
    } catch (error) {
      console.warn('云端删除布料失败，已加入待同步队列:', error)
      enqueueSyncOperation('fabrics', 'delete', id, null, new Date().toISOString())
    }

    fabrics.value.splice(index, 1)
    saveLocal(fabrics.value)
    return true
  }

  async function toggleFabricStatus(id) {
    const fabric = getFabricById(id)
    if (!fabric) {
      throw new Error('布料不存在')
    }

    const newStatus = fabric.status === 'active' ? 'inactive' : 'active'
    return await updateFabric(id, { status: newStatus })
  }

  function searchFabrics(keyword) {
    searchKeyword.value = keyword
  }

  function filterByStatus(status) {
    filterStatus.value = status
  }

  function resetFilters() {
    searchKeyword.value = ''
    filterStatus.value = 'all'
  }

  async function updatePrice(id, purchasePrice, salePrice) {
    const updates = {}
    if (purchasePrice !== undefined) {
      updates.defaultPurchasePrice = parseFloat(purchasePrice) || 0
    }
    if (salePrice !== undefined) {
      updates.defaultSalePrice = parseFloat(salePrice) || 0
    }

    return await updateFabric(id, updates)
  }

  async function refresh() {
    await init()
  }

  return {
    fabrics,
    loading,
    searchKeyword,
    filterStatus,
    filteredFabrics,
    activeFabrics,
    fabricCount,
    activeCount,
    init,
    refresh,
    getFabricById,
    getFabricName,
    getFabricCode,
    getFabricUnit,
    getDefaultPurchasePrice,
    getDefaultSalePrice,
    addFabric,
    updateFabric,
    deleteFabric,
    toggleFabricStatus,
    searchFabrics,
    filterByStatus,
    resetFilters,
    updatePrice
  }
})
