import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, StorageTypes } from '@/utils'
import { fabrics as initFabrics } from '@/data/initData'

// 本地存储键名
const STORAGE_KEY = StorageTypes.FABRICS

export const useFabricStore = defineStore('fabric', () => {
  // 状态
  const fabrics = ref([])
  const loading = ref(false)
  const searchKeyword = ref('')
  const filterStatus = ref('all') // all, active, inactive

  // 初始化
  async function init() {
    loading.value = true

    try {
      // 从本地存储获取数据，或使用默认数据
      const saved = storage.get(STORAGE_KEY)
      if (saved && saved.length > 0) {
        fabrics.value = saved
      } else {
        fabrics.value = [...initFabrics]
        storage.set(STORAGE_KEY, fabrics.value)
      }
    } catch (error) {
      console.error('Load fabrics error:', error)
      fabrics.value = [...initFabrics]
    } finally {
      loading.value = false
    }
  }

  // 计算属性
  const filteredFabrics = computed(() => {
    return fabrics.value.filter(fabric => {
      // 搜索过滤
      const matchKeyword = !searchKeyword.value ||
        fabric.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
        fabric.code.toLowerCase().includes(searchKeyword.value.toLowerCase())

      // 状态过滤
      const matchStatus = filterStatus.value === 'all' || fabric.status === filterStatus.value

      return matchKeyword && matchStatus
    })
  })

  const activeFabrics = computed(() => {
    return fabrics.value.filter(f => f.status === 'active')
  })

  const fabricCount = computed(() => fabrics.value.length)
  const activeCount = computed(() => activeFabrics.value.length)

  // 获取布料详情
  function getFabricById(id) {
    return fabrics.value.find(fabric => fabric.id === id)
  }

  // 获取布料名称
  function getFabricName(id) {
    const fabric = getFabricById(id)
    return fabric ? fabric.name : ''
  }

  // 获取布料编码
  function getFabricCode(id) {
    const fabric = getFabricById(id)
    return fabric ? fabric.code : ''
  }

  // 获取布料单位
  function getFabricUnit(id) {
    const fabric = getFabricById(id)
    return fabric ? fabric.unit : '斤'
  }

  // 获取默认采购价格
  function getDefaultPurchasePrice(fabricId) {
    const fabric = getFabricById(fabricId)
    return fabric ? fabric.defaultPurchasePrice : 0
  }

  // 获取默认销售价格
  function getDefaultSalePrice(fabricId) {
    const fabric = getFabricById(fabricId)
    return fabric ? fabric.defaultSalePrice : 0
  }


  // 添加布料
  async function addFabric(data) {
    loading.value = true

    try {
      const newFabric = {
        id: `fab-${Date.now().toString().slice(-6)}`,
        code: `FAB${Date.now().toString().slice(-4)}`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      }

      fabrics.value.push(newFabric)
      storage.set(STORAGE_KEY, fabrics.value)

      return newFabric
    } catch (error) {
      console.error('Add fabric error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新布料
  async function updateFabric(id, data) {
    loading.value = true

    try {
      const index = fabrics.value.findIndex(f => f.id === id)
      if (index === -1) {
        throw new Error('布料不存在')
      }

      fabrics.value[index] = {
        ...fabrics.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }

      storage.set(STORAGE_KEY, fabrics.value)
      return fabrics.value[index]
    } catch (error) {
      console.error('Update fabric error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 删除布料
  async function deleteFabric(id) {
    const fabric = getFabricById(id)
    if (!fabric) {
      throw new Error('布料不存在')
    }

    // 标记为停用而不是真正删除
    return await updateFabric(id, { status: 'inactive' })
  }

  // 启用/停用布料
  async function toggleFabricStatus(id) {
    const fabric = getFabricById(id)
    if (!fabric) {
      throw new Error('布料不存在')
    }

    const newStatus = fabric.status === 'active' ? 'inactive' : 'active'
    return await updateFabric(id, { status: newStatus })
  }

  // 搜索布料
  function searchFabrics(keyword) {
    searchKeyword.value = keyword
  }

  // 按状态筛选
  function filterByStatus(status) {
    filterStatus.value = status
  }

  // 重置筛选条件
  function resetFilters() {
    searchKeyword.value = ''
    filterStatus.value = 'all'
  }

  // 更新价格
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
    // 状态
    fabrics,
    loading,
    searchKeyword,
    filterStatus,

    // 计算属性
    filteredFabrics,
    activeFabrics,
    fabricCount,
    activeCount,

    // 方法
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
