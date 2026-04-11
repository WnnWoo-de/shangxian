import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, StorageTypes } from '@/utils'
import { categories as initCategories } from '@/data/initData'

// 本地存储键名
const STORAGE_KEY = StorageTypes.CATEGORIES

export const useCategoryStore = defineStore('category', () => {
  // 状态
  const categories = ref([])
  const loading = ref(false)
  const searchKeyword = ref('')

  // 初始化
  async function init() {
    loading.value = true

    try {
      // 从本地存储获取数据，或使用默认数据
      const saved = storage.get(STORAGE_KEY)
      if (saved && saved.length > 0) {
        categories.value = saved
      } else {
        categories.value = [...initCategories]
        storage.set(STORAGE_KEY, categories.value)
      }
    } catch (error) {
      console.error('Load categories error:', error)
      categories.value = [...initCategories]
    } finally {
      loading.value = false
    }
  }

  // 计算属性
  const filteredCategories = computed(() => {
    return categories.value.filter(category => {
      if (!searchKeyword.value) return true
      return category.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
    })
  })

  const activeCategories = computed(() => {
    return categories.value.filter(c => c.status === 'active')
  })

  const categoryCount = computed(() => categories.value.length)
  const activeCount = computed(() => activeCategories.value.length)

  // 获取品类详情
  function getCategoryById(id) {
    return categories.value.find(category => category.id === id)
  }

  // 获取品类名称
  function getCategoryName(id) {
    const category = getCategoryById(id)
    return category ? category.name : ''
  }

  // 添加品类
  async function addCategory(data) {
    loading.value = true

    try {
      const newCategory = {
        id: `cat-${Date.now().toString().slice(-6)}`,
        status: 'active',
        sortOrder: categories.value.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      }

      categories.value.push(newCategory)
      storage.set(STORAGE_KEY, categories.value)

      return newCategory
    } catch (error) {
      console.error('Add category error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新品类
  async function updateCategory(id, data) {
    loading.value = true

    try {
      const index = categories.value.findIndex(c => c.id === id)
      if (index === -1) {
        throw new Error('品类不存在')
      }

      categories.value[index] = {
        ...categories.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }

      storage.set(STORAGE_KEY, categories.value)
      return categories.value[index]
    } catch (error) {
      console.error('Update category error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 删除品类
  async function deleteCategory(id) {
    const category = getCategoryById(id)
    if (!category) {
      throw new Error('品类不存在')
    }

    // 标记为停用而不是真正删除
    return await updateCategory(id, { status: 'inactive' })
  }

  // 启用/停用品类
  async function toggleCategoryStatus(id) {
    const category = getCategoryById(id)
    if (!category) {
      throw new Error('品类不存在')
    }

    const newStatus = category.status === 'active' ? 'inactive' : 'active'
    return await updateCategory(id, { status: newStatus })
  }

  // 搜索品类
  function searchCategories(keyword) {
    searchKeyword.value = keyword
  }

  // 重置筛选条件
  function resetFilters() {
    searchKeyword.value = ''
  }

  async function refresh() {
    await init()
  }

  return {
    // 状态
    categories,
    loading,
    searchKeyword,

    // 计算属性
    filteredCategories,
    activeCategories,
    categoryCount,
    activeCount,

    // 方法
    init,
    refresh,
    getCategoryById,
    getCategoryName,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    searchCategories,
    resetFilters
  }
})
