import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, StorageTypes } from '@/utils'
import { fetchCustomersApi, createCustomerApi, updateCustomerApi, deleteCustomerApi } from '@/api/cloud'
import { enqueueSyncOperation } from '@/utils/sync-queue'

const STORAGE_KEY = StorageTypes.CUSTOMERS
const ENABLE_DEMO_SEED = String(import.meta.env.VITE_ENABLE_DEMO_SEED || '').trim() === '1'

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

const saveLocal = (list) => storage.set(STORAGE_KEY, list)
const orderList = (list) => [...list].sort((a, b) => Number(a.sortOrder ?? 999999) - Number(b.sortOrder ?? 999999))
const withSortOrder = (list) => list.map((item, index) => ({ ...item, sortOrder: Number(item.sortOrder ?? index) }))

export const useCustomerStore = defineStore('customer', () => {
  const customers = ref([])
  const loading = ref(false)
  const searchKeyword = ref('')
  const filterType = ref('all')
  const filterStatus = ref('all')

  async function seedCloudIfEmpty() {
    const seeds = [...MOCK_CUSTOMERS]
    await Promise.all(seeds.map(item => createCustomerApi(item)))
    return seeds
  }

  async function init() {
    loading.value = true

    try {
      const cloudCustomers = await fetchCustomersApi()
      if (Array.isArray(cloudCustomers) && cloudCustomers.length > 0) {
        customers.value = orderList(withSortOrder(cloudCustomers))
      } else if (ENABLE_DEMO_SEED) {
        customers.value = orderList(withSortOrder(await seedCloudIfEmpty()))
      } else {
        customers.value = []
      }
      saveLocal(customers.value)
    } catch (error) {
      console.error('Load customers from cloud failed:', error)
      const saved = storage.get(STORAGE_KEY)
      if (saved && saved.length > 0) {
        customers.value = orderList(withSortOrder(saved))
      } else if (ENABLE_DEMO_SEED) {
        customers.value = orderList(withSortOrder(MOCK_CUSTOMERS))
        saveLocal(customers.value)
      } else {
        customers.value = []
      }
    } finally {
      loading.value = false
    }
  }

  const filteredCustomers = computed(() => {
    return customers.value.filter(customer => {
      const matchKeyword = !searchKeyword.value ||
        customer.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
        customer.phone.includes(searchKeyword.value) ||
        customer.address.toLowerCase().includes(searchKeyword.value.toLowerCase())

      const matchType = filterType.value === 'all' || customer.type === filterType.value
      const matchStatus = filterStatus.value === 'all' || customer.status === filterStatus.value

      return matchKeyword && matchType && matchStatus
    })
  })

  const activeCustomers = computed(() => customers.value.filter(c => c.status === 'active'))
  const supplierCustomers = computed(() => customers.value.filter(c => c.type === 'supplier' && c.status === 'active'))
  const customerCustomers = computed(() => customers.value.filter(c => c.type === 'customer' && c.status === 'active'))
  const bothCustomers = computed(() => customers.value.filter(c => c.type === 'both' && c.status === 'active'))
  const customerCount = computed(() => customers.value.length)
  const activeCount = computed(() => activeCustomers.value.length)

  function getCustomerById(id) {
    return customers.value.find(customer => customer.id === id)
  }

  function getCustomerName(id) {
    const customer = getCustomerById(id)
    return customer ? customer.name : ''
  }

  async function addCustomer(data) {
    loading.value = true

    try {
      const draft = {
        id: `cust-${Date.now().toString().slice(-6)}`,
        status: 'active',
        sortOrder: customers.value.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      }

      let created = draft
      try {
        created = await createCustomerApi(draft)
      } catch (error) {
        console.warn('云端新增客户失败，已回退本地:', error)
        enqueueSyncOperation('customers', 'upsert', draft.id, draft, draft.updatedAt)
      }

      customers.value.push(created)
      saveLocal(customers.value)
      return created
    } catch (error) {
      console.error('Add customer error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateCustomer(id, data) {
    loading.value = true

    try {
      const index = customers.value.findIndex(c => c.id === id)
      if (index === -1) {
        throw new Error('客户不存在')
      }

      const next = {
        ...customers.value[index],
        ...data,
        updatedAt: new Date().toISOString()
      }

      try {
        customers.value[index] = await updateCustomerApi(id, next)
      } catch (error) {
        console.warn('云端更新客户失败，已回退本地:', error)
        customers.value[index] = next
        enqueueSyncOperation('customers', 'upsert', next.id, next, next.updatedAt)
      }

      saveLocal(customers.value)
      return customers.value[index]
    } catch (error) {
      console.error('Update customer error:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteCustomer(id) {
    const customer = getCustomerById(id)
    if (!customer) {
      throw new Error('客户不存在')
    }
    const index = customers.value.findIndex(c => c.id === id)
    if (index === -1) {
      throw new Error('客户不存在')
    }

    try {
      await deleteCustomerApi(id)
    } catch (error) {
      console.warn('云端删除客户失败，已加入待同步队列:', error)
      enqueueSyncOperation('customers', 'delete', id, null, new Date().toISOString())
    }

    customers.value.splice(index, 1)
    saveLocal(customers.value)
    return true
  }

  async function toggleCustomerStatus(id) {
    const customer = getCustomerById(id)
    if (!customer) {
      throw new Error('客户不存在')
    }

    const newStatus = customer.status === 'active' ? 'inactive' : 'active'
    return await updateCustomer(id, { status: newStatus })
  }

  async function moveCustomer(id, direction) {
    const index = customers.value.findIndex(c => c.id === id)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= customers.value.length) return false

    const next = [...customers.value]
    const [item] = next.splice(index, 1)
    next.splice(targetIndex, 0, item)
    const now = new Date().toISOString()
    customers.value = next.map((customer, sortOrder) => ({ ...customer, sortOrder, updatedAt: now }))
    saveLocal(customers.value)

    const changed = [customers.value[index], customers.value[targetIndex]].filter(Boolean)
    await Promise.all(changed.map(async (customer) => {
      try {
        await updateCustomerApi(customer.id, customer)
      } catch (error) {
        enqueueSyncOperation('customers', 'upsert', customer.id, customer, customer.updatedAt)
      }
    }))
    return true
  }

  function searchCustomers(keyword) {
    searchKeyword.value = keyword
  }

  function filterByType(type) {
    filterType.value = type
  }

  function filterByStatus(status) {
    filterStatus.value = status
  }

  function resetFilters() {
    searchKeyword.value = ''
    filterType.value = 'all'
    filterStatus.value = 'all'
  }

  async function refresh() {
    await init()
  }

  function exportData() {
    return filteredCustomers.value.map(customer => ({
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
  }

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

      await Promise.all(newCustomers.map(async (item) => {
        try {
          await createCustomerApi(item)
        } catch (error) {
          console.warn('导入客户时云端写入失败，已加入待同步队列:', error)
          enqueueSyncOperation('customers', 'upsert', item.id, item, item.updatedAt)
        }
      }))
      customers.value.push(...newCustomers)
      saveLocal(customers.value)

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

  function convertTypeToEnum(typeStr) {
    const typeMap = {
      '供应商': 'supplier',
      '客户': 'customer',
      '既是供应商又是客户': 'both'
    }
    return typeMap[typeStr] || 'both'
  }

  return {
    customers,
    loading,
    searchKeyword,
    filterType,
    filterStatus,
    filteredCustomers,
    activeCustomers,
    supplierCustomers,
    customerCustomers,
    bothCustomers,
    customerCount,
    activeCount,
    init,
    refresh,
    getCustomerById,
    getCustomerName,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus,
    moveCustomer,
    searchCustomers,
    filterByType,
    filterByStatus,
    resetFilters,
    exportData,
    importData
  }
})
