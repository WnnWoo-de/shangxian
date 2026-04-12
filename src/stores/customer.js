import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { storage, StorageTypes } from '@/utils'
import { fabrics } from '@/data/initData'

// 本地存储键名
const STORAGE_KEY = StorageTypes.CUSTOMERS

// 模拟客户数据
const MOCK_CUSTOMERS = [
  {
    id: 'cust-001',
    name: '张三',
    phone: '13800138000',
    address: '广东省广州市天河区',
    contactPerson: '张三',
    type: 'supplier',
    creditLimit: 50000,
    balance: 0,
    status: 'active',
    note: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'cust-002',
    name: '李四',
    phone: '13800138001',
    address: '广东省东莞市虎门镇',
    contactPerson: '李四',
    type: 'supplier',
    creditLimit: 30000,
    balance: 1200,
    status: 'active',
    note: '主要供应擦机布',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  },
  {
    id: 'cust-003',
    name: '王五',
    phone: '13800138002',
    address: '广东省佛山市顺德区',
    contactPerson: '王五',
    type: 'customer',
    creditLimit: 20000,
    balance: -500,
    status: 'active',
    note: '长期客户，月均采购10吨',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  },
  {
    id: 'cust-004',
    name: '赵六',
    phone: '13800138003',
    address: '广东省深圳市宝安区',
    contactPerson: '赵六',
    type: 'both',
    creditLimit: 100000,
    balance: 0,
    status: 'inactive',
    note: '已暂停合作',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z'
  }
]

export const useCustomerStore = defineStore('customer', () => {
  // 状态
  const customers = ref([])
  const loading = ref(false)
  const searchKeyword = ref('')
  const filterType = ref('all') // all, supplier, customer, both
  const filterStatus = ref('all') // all, active, inactive

  // 初始化
  async function init() {
    loading.value = true

    try {
      // 从本地存储获取数据，或使用默认数据
      const saved = storage.get(STORAGE_KEY)
      if (saved && saved.length > 0) {
        customers.value = saved
      } else {
        customers.value = [...MOCK_CUSTOMERS]
        storage.set(STORAGE_KEY, customers.value)
      }
    } catch (error) {
      console.error('Load customers error:', error)
      customers.value = [...MOCK_CUSTOMERS]
    } finally {
      loading.value = false
    }
  }

  // 计算属性
  const filteredCustomers = computed(() => {
    return customers.value.filter(customer => {
      // 搜索过滤
      const matchKeyword = !searchKeyword.value ||
        customer.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
        customer.phone.includes(searchKeyword.value) ||
        customer.address.toLowerCase().includes(searchKeyword.value.toLowerCase())

      // 类型过滤
      const matchType = filterType.value === 'all' || customer.type === filterType.value

      // 状态过滤
      const matchStatus = filterStatus.value === 'all' || customer.status === filterStatus.value

      return matchKeyword && matchType && matchStatus
    })
  })

  const activeCustomers = computed(() => {
    return customers.value.filter(c => c.status === 'active')
  })

  const supplierCustomers = computed(() => {
    return customers.value.filter(c => c.type === 'supplier' && c.status === 'active')
  })

  const customerCustomers = computed(() => {
    return customers.value.filter(c => c.type === 'customer' && c.status === 'active')
  })

  const bothCustomers = computed(() => {
    return customers.value.filter(c => c.type === 'both' && c.status === 'active')
  })

  const customerCount = computed(() => customers.value.length)
  const activeCount = computed(() => activeCustomers.value.length)

  // 获取客户详细信息
  function getCustomerById(id) {
    return customers.value.find(customer => customer.id === id)
  }

  // 获取客户名称
  function getCustomerName(id) {
    const customer = getCustomerById(id)
    return customer ? customer.name : ''
  }

  // 添加客户
  async function addCustomer(data) {
    loading.value = true

    try {
      const newCustomer = {
        id: `cust-${Date.now().toString().slice(-6)}`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      }

      customers.value.push(newCustomer)
      storage.set(STORAGE_KEY, customers.value)

      return newCustomer
    } catch (error) {
      console.error('Add customer error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 更新客户
  async function updateCustomer(id, data) {
    loading.value = true

    try {
      const index = customers.value.findIndex(c => c.id === id)
      if (index === -1) {
        throw new Error('客户不存在')
      }

      customers.value[index] = {
        ...customers.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }

      storage.set(STORAGE_KEY, customers.value)
      return customers.value[index]
    } catch (error) {
      console.error('Update customer error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 删除客户（标记为停用）
  async function deleteCustomer(id) {
    const customer = getCustomerById(id)
    if (!customer) {
      throw new Error('客户不存在')
    }

    // 停用客户而不是真正删除
    return await updateCustomer(id, { status: 'inactive' })
  }

  // 启用/停用客户
  async function toggleCustomerStatus(id) {
    const customer = getCustomerById(id)
    if (!customer) {
      throw new Error('客户不存在')
    }

    const newStatus = customer.status === 'active' ? 'inactive' : 'active'
    return await updateCustomer(id, { status: newStatus })
  }

  // 搜索客户
  function searchCustomers(keyword) {
    searchKeyword.value = keyword
  }

  // 过滤客户类型
  function filterByType(type) {
    filterType.value = type
  }

  // 过滤客户状态
  function filterByStatus(status) {
    filterStatus.value = status
  }

  // 重置筛选条件
  function resetFilters() {
    searchKeyword.value = ''
    filterType.value = 'all'
    filterStatus.value = 'all'
  }

  async function refresh() {
    await init()
  }

  // 导出客户数据
  function exportData() {
    const data = filteredCustomers.value.map(customer => ({
      '客户名称': customer.name,
      '联系方式': customer.phone,
      '联系地址': customer.address,
      '类型': {
        supplier: '供应商',
        customer: '客户',
        both: '既是供应商又是客户'
      }[customer.type] || customer.type,
      '状态': customer.status === 'active' ? '正常' : '暂停',
      '备注': customer.note
    }))

    return data
  }

  // 导入客户数据
  async function importData(data) {
    loading.value = true

    try {
      const validData = data.filter(item => item['客户名称'] && item['联系方式'])
      const newCustomers = validData.map(item => ({
        id: `cust-${Date.now().toString().slice(-6)}-${Math.random().toString().slice(-4)}`,
        name: item['客户名称'],
        phone: item['联系方式'],
        address: item['联系地址'] || '',
        contactPerson: item['联系人'] || '',
        type: convertTypeToEnum(item['类型']),
        creditLimit: parseFloat(item['信用额度']) || 0,
        balance: parseFloat(item['账户余额']) || 0,
        status: item['状态'] === '暂停' ? 'inactive' : 'active',
        note: item['备注'] || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))

      customers.value.push(...newCustomers)
      storage.set(STORAGE_KEY, customers.value)

      return {
        total: validData.length,
        added: newCustomers.length
      }
    } catch (error) {
      console.error('Import customers error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 辅助函数：将导入的类型转换为枚举值
  function convertTypeToEnum(typeStr) {
    const typeMap = {
      '供应商': 'supplier',
      '客户': 'customer',
      '既是供应商又是客户': 'both'
    }
    return typeMap[typeStr] || 'both'
  }

  return {
    // 状态
    customers,
    loading,
    searchKeyword,
    filterType,
    filterStatus,

    // 计算属性
    filteredCustomers,
    activeCustomers,
    supplierCustomers,
    customerCustomers,
    bothCustomers,
    customerCount,
    activeCount,

    // 方法
    init,
    refresh,
    getCustomerById,
    getCustomerName,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus,
    searchCustomers,
    filterByType,
    filterByStatus,
    resetFilters,
    exportData,
    importData
  }
})
