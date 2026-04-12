<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useCategoryStore } from '../../stores/category'
import { useFabricStore } from '../../stores/fabric'
import { formatMoney } from '../../utils/money'
import { showToast } from '../../utils/toast'
import { MASTER_DATA_CHANGED_EVENT } from '../../utils/master-data-events'

const props = defineProps({
  type: {
    type: String,
    default: 'purchase',
  },
})

const route = useRoute()
const router = useRouter()
const billRecordStore = useBillRecordStore()
const customerStore = useCustomerStore()
const categoryStore = useCategoryStore()
const fabricStore = useFabricStore()

const loadExcelJS = async () => {
  const module = await import('exceljs')
  return module.default
}

const isSale = computed(() => {
  // 优先根据路由路径判断
  if (route.path.startsWith('/sale/')) {
    return true
  }
  // 其次根据记录类型判断
  if (currentRecord.value?.type) {
    return currentRecord.value.type === 'sale'
  }
  // 最后根据 props 判断
  return props.type === 'sale'
})
const pageTitle = computed(() => (isSale.value ? '出货单据' : '进货单据'))
const partnerLabel = computed(() => (isSale.value ? '客户' : '供应商'))
const currentPartnerLabel = computed(() => (isSale.value ? '当前客户' : '当前供应商'))
const returnRoute = computed(() => (isSale.value ? '/sale/list' : '/purchase/list'))
const exportTitle = computed(() => (isSale.value ? '出货单据明细' : '进货单据明细'))
const exportFilePrefix = computed(() => (isSale.value ? '出货单据' : '进货单据'))

const recordId = computed(() => String(route.params.id || ''))
const currentRecord = computed(() => billRecordStore.getById(recordId.value))
const hasRecord = computed(() => Boolean(currentRecord.value))

const form = reactive({
  orderNo: '',
  createdAt: '',
  supplier: '',
  note: '',
  firstWeight: 0,
  lastWeight: 0,
  netWeight: 0,
  categoryId: '', // 新增：品类ID
  fabricId: '', // 新增：布料ID
})

const rows = ref([])
const saving = ref(false)
const deleting = ref(false)

const supplierSearch = ref('')
const categorySearch = ref('')
const fabricSearch = ref('')
const showSupplierOptions = ref(false)
const showCategoryOptions = ref({})
const showFormCategoryOptions = ref(false)
const showFabricOptions = ref(false)
const showFabricOptionsForRow = ref({})
const focusedCategoryRowId = ref('')
const focusedFabricRowId = ref('')

const suppliers = computed(() => customerStore.activeCustomers)
const categories = computed(() => categoryStore.activeCategories)
const fabrics = computed(() => {
  if (!form.categoryId) return []
  return typeof fabricStore.getByCategory === 'function'
    ? fabricStore.getByCategory(form.categoryId)
    : fabricStore.getFabricsByCategoryId(form.categoryId)
})

const filteredSuppliers = computed(() => {
  const keyword = supplierSearch.value.trim().toLowerCase()
  if (!keyword) return suppliers.value
  return suppliers.value.filter((item) => String(item.name || '').toLowerCase().includes(keyword) || String(item.contact || item.contactPerson || '').toLowerCase().includes(keyword) || String(item.phone || '').includes(keyword))
})

const getFilteredCategories = (keyword) => {
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return categories.value
  return categories.value.filter((item) => String(item.name || '').toLowerCase().includes(query))
}

const selectSupplier = (item) => {
  supplierSearch.value = item.name
  form.supplier = item.name
  showSupplierOptions.value = false
}

const selectCategoryForForm = (item) => {
  categorySearch.value = item.name
  form.categoryId = item.id
  showFormCategoryOptions.value = false
  // 当品类改变时，清除已选择的布料
  form.fabricId = ''
  fabricSearch.value = ''
  showFabricOptions.value = false
}

const selectFabricForForm = (item) => {
  fabricSearch.value = item.name
  form.fabricId = item.id
  showFabricOptions.value = false
}

const toggleCategoryOptions = (rowId) => {
  // 先关闭其他所有下拉框
  Object.keys(showCategoryOptions.value).forEach(id => {
    if (id !== rowId) {
      showCategoryOptions.value[id] = false
    }
  })
  Object.keys(showFabricOptionsForRow.value).forEach(id => {
    showFabricOptionsForRow.value[id] = false
  })
  // 切换当前行的下拉框
  showCategoryOptions.value[rowId] = !showCategoryOptions.value[rowId]
}

const selectCategory = (rowId, item) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1) return
  rows.value[idx].categoryId = item.id
  rows.value[idx].categoryName = item.name
  // 当品类改变时，清除已选择的布料
  rows.value[idx].fabricId = ''
  rows.value[idx].fabricName = ''
  if (Number(item.defaultPrice || 0) > 0 && !Number(rows.value[idx].unitPrice || 0)) {
    rows.value[idx].unitPrice = Number(item.defaultPrice)
  }
  showCategoryOptions.value[rowId] = false
  showFabricOptionsForRow.value[rowId] = false
  focusedCategoryRowId.value = ''
}

const getFilteredFabrics = (rowId, keyword) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1) return []
  const categoryId = rows.value[idx].categoryId
  if (!categoryId) return []
  const fabrics = typeof fabricStore.getByCategory === 'function'
    ? fabricStore.getByCategory(categoryId)
    : fabricStore.getFabricsByCategoryId(categoryId)
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return fabrics
  return fabrics.filter((item) => String(item.name || '').toLowerCase().includes(query))
}

const toggleFabricOptions = (rowId) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1 || !rows.value[idx].categoryId) return

  // 先关闭其他所有下拉框
  Object.keys(showFabricOptionsForRow.value).forEach(id => {
    if (id !== rowId) {
      showFabricOptionsForRow.value[id] = false
    }
  })
  Object.keys(showCategoryOptions.value).forEach(id => {
    showCategoryOptions.value[id] = false
  })
  // 切换当前行的下拉框
  showFabricOptionsForRow.value[rowId] = !showFabricOptionsForRow.value[rowId]
}

const selectFabric = (rowId, item) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1) return
  rows.value[idx].fabricId = item.id
  rows.value[idx].fabricName = item.name
  if (Number(item.defaultPrice || 0) > 0 && !Number(rows.value[idx].unitPrice || 0)) {
    rows.value[idx].unitPrice = Number(item.defaultPrice)
  }
  showFabricOptionsForRow.value[rowId] = false
  focusedFabricRowId.value = ''
}

const handleFabricClick = (rowId, idx) => {
  if (rows.value[idx].categoryId) {
    toggleFabricOptions(rowId)
    focusedFabricRowId.value = rowId
  }
}

const handleFabricArrowClick = (rowId, idx) => {
  if (rows.value[idx].categoryId) {
    toggleFabricOptions(rowId)
    focusedFabricRowId.value = rowId
  }
}

const handleOutsideClick = (e) => {
  if (!e.target.closest('.custom-select')) {
    showSupplierOptions.value = false
    showCategoryOptions.value = {}
    showFormCategoryOptions.value = false
    showFabricOptions.value = false
    showFabricOptionsForRow.value = {}
  }
}

const handleMasterDataChanged = async () => {
  await Promise.all([
    customerStore.refresh(),
    categoryStore.refresh(),
    fabricStore.refresh(),
  ])
}

// 提交单据到列表
const submitAndView = async () => {
  const partnerName = form.supplier.trim()
  const filledRows = buildFilledRows()
  if (!partnerName) {
    showToast('请填写客户信息', 'error')
    return
  }
  if (!filledRows.length) {
    showToast('请至少添加一条明细', 'error')
    return
  }

  saving.value = true
  try {
    const payload = buildPayload('confirmed')
    let targetId = recordId.value

    if (recordId.value) {
      await billRecordStore.updateRecord(recordId.value, payload)
    } else {
      const created = await billRecordStore.createRecord(payload)
      targetId = created?.id || payload.id
    }

    showToast(`${isSale.value ? '出货' : '进货'}单据已提交！`, 'success')
    router.push(isSale.value ? `/sale/view/${targetId}` : `/purchase/view/${targetId}`)
  } catch (error) {
    console.error('提交单据失败:', error)
    showToast('提交失败，请重试', 'error')
  } finally {
    saving.value = false
  }
}

const deleteBill = async () => {
  if (!recordId.value) {
    router.push(returnRoute.value)
    return
  }

  if (!confirm('确定要删除这张单据吗？删除后不可恢复。')) {
    return
  }

  deleting.value = true
  try {
    await billRecordStore.deleteRecord(recordId.value)
    showToast('单据已删除', 'success')
    router.push(returnRoute.value)
  } catch (error) {
    console.error('删除单据失败:', error)
    showToast('删除失败，请重试', 'error')
  } finally {
    deleting.value = false
  }
}

// 新增明细 - 根据单据类型跳转到相应的页面
const addNewDetail = () => {
  rows.value.push(makeRow())
}

onMounted(async () => {
  document.addEventListener('click', handleOutsideClick)
  window.addEventListener(MASTER_DATA_CHANGED_EVENT, handleMasterDataChanged)

  // 确保 billRecordStore 数据已经加载
  await billRecordStore.init()

  if (recordId.value && !currentRecord.value) {
    try {
      await billRecordStore.fetchRecordDetail(recordId.value)
    } catch (error) {
      console.error('加载单据详情失败:', error)
    }
  }
  loadRecordData()
})

// 监听记录 ID 变化并加载数据
watch(recordId, async (newId) => {
  if (newId) {
    // 确保数据已经加载
    await billRecordStore.init()
    loadRecordData()
  }
})

// 监听当前记录变化，当记录数据准备好时重新加载
watch(currentRecord, (newRecord) => {
  if (newRecord) {
    console.log('监听到 currentRecord 变化，重新加载数据:', newRecord)
    loadRecordData()
  }
}, { immediate: true })

// 加载记录数据
const loadRecordData = () => {
  console.log('loadRecordData 开始执行，recordId:', recordId.value)
  console.log('hasRecord.value:', hasRecord.value)
  console.log('currentRecord.value:', currentRecord.value)

  if (!hasRecord.value) {
    console.warn('未找到记录数据')
    return
  }

  const record = currentRecord.value
  console.log('找到记录:', record)

  form.orderNo = record.billNo || ''
  form.createdAt = record.createdAt || record.billDate || ''
  form.supplier = record.partnerName || ''
  supplierSearch.value = form.supplier
  form.note = record.note || ''
  form.firstWeight = Number(record.firstWeight || 0)
  form.lastWeight = Number(record.lastWeight || 0)
  form.netWeight = Number(record.netWeight || Math.max(form.firstWeight - form.lastWeight, 0))

  const sourceDetails = Array.isArray(record.details) && record.details.length
    ? record.details
    : Array.isArray(record.items) && record.items.length
      ? record.items
      : []

  console.log('明细数据:', sourceDetails)

  if (sourceDetails.length) {
    rows.value = sourceDetails.map((detail, index) => {
      const rowId = detail.id || `temp_${Date.now()}_${index}`

      return {
        id: rowId,
        categoryId: detail.categoryId || detail.category_id || '',
        categoryName: detail.categoryName || detail.category_name_snapshot || '',
        fabricId: detail.fabricId || detail.fabric_id || '',
        fabricName: detail.fabricName || detail.fabric_name || '',
        weightInput: String(detail.weightInput || detail.weight_input_text || detail.weightInputText || detail.totalWeight || detail.total_weight || ''),
        totalWeight: Number(detail.totalWeight ?? detail.total_weight ?? 0),
        unitPrice: Number(detail.unitPrice ?? detail.unit_price ?? 0),
        amount: Number(detail.amount || 0),
        note: detail.note || '',
      }
    })
  } else {
    rows.value = [makeRow()]
  }

  console.log('最终 rows.value:', rows.value)
}

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  window.removeEventListener(MASTER_DATA_CHANGED_EVENT, handleMasterDataChanged)
})

const makeRow = (payload = {}) => ({
  id: payload.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  categoryId: payload.categoryId || payload.category_id || '',
  categoryName: payload.categoryName || payload.category_name_snapshot || payload.category || '',
  fabricId: payload.fabricId || payload.fabric_id || '',
  fabricName: payload.fabricName || payload.fabric_name || payload.fabric || '',
  weightInput: String(
    payload.weightInput
    ?? payload.weight_input_text
    ?? payload.weightInputText
    ?? payload.quantityInput
    ?? payload.totalWeight
    ?? payload.total_weight
    ?? payload.netWeight
    ?? payload.weight
    ?? 0,
  ),
  unitPrice: Number(payload.unitPrice ?? payload.unit_price ?? 0),
  amount: Number(payload.amount ?? 0),
  note: payload.note || '',
})

const parseWeight = (input) => {
  const raw = String(input || '').trim()
  if (!raw) return 0

  const normalized = raw
    .replace(/[，,、；;]/g, ' ')
    .replace(/[＋]/g, '+')
    .replace(/[×xX]/g, '*')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return 0

  const multiplyMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*\*\s*([0-9]+(?:\.[0-9]+)?)$/)
  if (multiplyMatch) {
    const left = Number(multiplyMatch[1])
    const right = Number(multiplyMatch[2])
    const value = left * right
    return Number.isFinite(value) && value > 0 ? value : 0
  }

  const hasExplicitSeparator = /[+\s]/.test(normalized)
  const dotCount = (normalized.match(/\./g) || []).length

  let parts = []

  if (hasExplicitSeparator) {
    parts = normalized.split(/[+\s]+/)
  } else if (dotCount > 1) {
    parts = normalized.split('.')
  } else {
    const value = Number(normalized)
    return Number.isFinite(value) && value > 0 ? value : 0
  }

  const total = parts.reduce((sum, part) => {
    const value = Number(String(part).trim())
    return Number.isFinite(value) && value > 0 ? sum + value : sum
  }, 0)

  return total > 0 ? total : 0
}

const categoryQuickPicks = computed(() => categories.value.slice(0, 8))

const getFabricQuickPicks = (rowId) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1) return []
  const categoryId = rows.value[idx].categoryId
  if (!categoryId) return []
  return fabricStore.getByCategory(categoryId).slice(0, 8)
}

const getCategoryMeta = (keyword) => {
  const query = String(keyword || '').trim()
  if (!query) {
    return {
      exact: null,
      total: categories.value.length,
      matches: categoryQuickPicks.value,
    }
  }

  const lowerQuery = query.toLowerCase()
  const matches = getFilteredCategories(query)
  const exact = categories.value.find((item) => String(item.name || '').trim().toLowerCase() === lowerQuery) || null

  return {
    exact,
    total: matches.length,
    matches,
  }
}

const getCategoryBadgeText = (row) => {
  const meta = getCategoryMeta(row.categoryName)
  if (meta.exact?.defaultPrice) return `默认 ¥${Number(meta.exact.defaultPrice).toFixed(2)}/斤`
  if (!String(row.categoryName || '').trim()) return `可选 ${categories.value.length} 种布料`
  if (meta.total > 0) return `匹配 ${meta.total} 种布料`
  return '未匹配现有布料'
}

const getFabricMeta = (rowId, keyword) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1) {
    return {
      exact: null,
      total: 0,
      matches: [],
    }
  }

  const categoryId = rows.value[idx].categoryId
  const fabrics = categoryId ? fabricStore.getByCategory(categoryId) : []

  const query = String(keyword || '').trim()
  if (!query) {
    return {
      exact: null,
      total: fabrics.length,
      matches: fabrics.slice(0, 8),
    }
  }

  const lowerQuery = query.toLowerCase()
  const matches = fabrics.filter((item) => String(item.name || '').toLowerCase().includes(lowerQuery))
  const exact = fabrics.find((item) => String(item.name || '').trim().toLowerCase() === lowerQuery) || null

  return {
    exact,
    total: matches.length,
    matches,
  }
}

const getFabricBadgeText = (row) => {
  const idx = rows.value.findIndex((r) => r.id === row.id)
  if (idx === -1) return '请选择布料'

  const meta = getFabricMeta(row.id, rows[idx].fabricName)
  if (meta.exact?.defaultPrice) return `默认 ¥${Number(meta.exact.defaultPrice).toFixed(2)}/斤`
  if (!String(rows[idx].fabricName || '').trim()) {
    const categoryId = rows[idx].categoryId
    const fabricsCount = categoryId ? fabricStore.getByCategory(categoryId).length : 0
    return `可选 ${fabricsCount} 种布料`
  }
  if (meta.total > 0) return `匹配 ${meta.total} 种布料`
  return '未匹配现有布料'
}

const getFabricHintText = (row) => {
  const idx = rows.value.findIndex((r) => r.id === row.id)
  if (idx === -1) return '请先选择品类'

  const meta = getFabricMeta(row.id, rows[idx].fabricName)
  if (meta.exact) return '已匹配布料档案，点击下方卡片可快速替换。'
  if (!String(rows[idx].fabricName || '').trim()) return '可直接输入，也可从下方布料卡片中选择。'
  if (meta.total > 0) return '继续输入可缩小范围，或直接点击候选卡片。'
  return '当前名称不在布料档案中，将按自定义布料保存。'
}

const getCategoryHintText = (row) => {
  const meta = getCategoryMeta(row.categoryName)
  if (meta.exact) return '已匹配布料档案，点击下方卡片可快速替换。'
  if (!String(row.categoryName || '').trim()) return '可直接输入，也可从下方布料卡片中选择。'
  if (meta.total > 0) return '继续输入可缩小范围，或直接点击候选卡片。'
  return '当前名称不在布料档案中，将按自定义品类保存。'
}

// 监听品类名称变化，自动匹配并设置 categoryId
const updateCategoryId = (rowId, categoryName) => {
  const idx = rows.value.findIndex((row) => row.id === rowId)
  if (idx === -1) return

  const matchedCategory = categories.value.find(
    (category) => category.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
  )

  if (matchedCategory) {
    rows.value[idx].categoryId = matchedCategory.id
  } else {
    rows.value[idx].categoryId = ''
  }
}

const rowView = computed(() => {
  return rows.value.map((item) => {
    if (!item) {
      const emptyRow = makeRow()
      return {
        ...emptyRow,
        totalWeight: 0,
        amount: 0
      }
    }

    const totalWeight = parseWeight(item.weightInput)
    const amount = totalWeight * Number(item.unitPrice || 0)
    return {
      ...item,
      totalWeight,
      amount,
    }
  })
})

const totalWeight = computed(() => rowView.value.reduce((sum, item) => sum + item.totalWeight, 0))
const totalAmount = computed(() => rowView.value.reduce((sum, item) => sum + item.amount, 0))
const filledRowCount = computed(() => rowView.value.filter((item) => {
  return item.categoryName || item.weightInput || Number(item.unitPrice) > 0 || Number(item.totalWeight) > 0
}).length)
const avgUnitPrice = computed(() => {
  if (!totalWeight.value) return 0
  return totalAmount.value / totalWeight.value
})

const fillForm = (record) => {
  if (!record) return

  form.orderNo = record.billNo || record.id || recordId.value
  form.createdAt = record.createdAt || `${record.billDate || ''} 14:15:12`
  form.supplier = record.partnerName || record.supplier || record.customerName || ''
  supplierSearch.value = form.supplier
  form.note = record.note || ''
  form.firstWeight = Number(record.firstWeight || 0)
  form.lastWeight = Number(record.lastWeight || 0)
  form.netWeight = Number(record.netWeight || Math.max(form.firstWeight - form.lastWeight, 0))
  focusedCategoryRowId.value = ''

  if (Array.isArray(record.details) && record.details.length) {
    rows.value = record.details.map((item) => makeRow(item))
  } else if (Array.isArray(record.items) && record.items.length) {
    rows.value = record.items.map((item) => makeRow(item))
  } else {
    rows.value = [
      makeRow({
        categoryName: record.category || '',
        totalWeight: Number(record.totalWeight ?? record.netWeight ?? 0),
        unitPrice: Number(record.unitPrice ?? 0),
      }),
    ]
  }

  // 自动为每一行匹配并设置 categoryId
  rows.value.forEach((row) => {
    if (row.categoryName && !row.categoryId) {
      const matchedCategory = categories.value.find(
        (category) => category.name.trim().toLowerCase() === row.categoryName.trim().toLowerCase()
      )
      if (matchedCategory) {
        row.categoryId = matchedCategory.id
      }
    }
  })
}

watch(
  currentRecord,
  (record) => {
    if (!record) {
      form.orderNo = recordId.value
      form.createdAt = new Date().toISOString().slice(0, 10)
      form.supplier = ''
      supplierSearch.value = ''
      form.note = ''
      showSupplierOptions.value = false
      showCategoryOptions.value = {}
      focusedCategoryRowId.value = ''

      if (!recordId.value) {
        rows.value = [makeRow()]
        return
      }

      return
    }
    fillForm(record)
  },
  { immediate: true },
)

const buildFilledRows = () => {
  return rowView.value.filter((item) => item.categoryName.trim() && item.totalWeight > 0)
}

const buildPayload = (status = 'confirmed') => {
  const partnerName = form.supplier.trim()
  const filledRows = buildFilledRows()
  const partner = suppliers.value.find((item) => item.name === partnerName)
  const now = Date.now()
  const prefix = isSale.value ? 'S' : 'P'

  return {
    id: recordId.value || `${prefix.toLowerCase()}${now}`,
    type: isSale.value ? 'sale' : 'purchase',
    billNo: form.orderNo || `${prefix}${now}`,
    billDate: new Date().toISOString().slice(0, 10),
    createdAt: form.createdAt || new Date().toLocaleString('sv-SE').replace(' ', ' '),
    partnerId: partner?.id || '',
    partnerName,
    customerName: partnerName,
    supplier: partnerName,
    note: form.note.trim(),
    saleMode: 'weight',
    status,
    items: filledRows.map((item) => ({
      categoryId: item.categoryId || '',
      categoryName: item.categoryName.trim(),
      fabricId: item.fabricId || '',
      fabricName: item.fabricName || '',
      quantity: item.totalWeight,
      weightInput: item.weightInput,
      totalWeight: item.totalWeight,
      packCount: 0,
      packWeight: 0,
      unit: item.unit || '斤',
      unitPrice: item.unitPrice,
      amount: item.amount,
      note: item.note || '',
    })),
    totalWeight: totalWeight.value,
    totalAmount: totalAmount.value,
    paidAmount: Number(currentRecord.value?.paidAmount || 0),
    receivedAmount: Number(currentRecord.value?.receivedAmount || 0),
    unsettledAmount: Number(currentRecord.value?.unsettledAmount ?? totalAmount.value),
    firstWeight: Number(form.firstWeight || 0),
    lastWeight: Number(form.lastWeight || 0),
    netWeight: Number(form.netWeight || Math.max(Number(form.firstWeight || 0) - Number(form.lastWeight || 0), 0)),
  }
}

const saveDraft = async () => {
  const partnerName = form.supplier.trim()
  const filledRows = buildFilledRows()
  if (!partnerName && !filledRows.length && !form.note.trim()) {
    showToast('请先填写一些内容再保存草稿', 'error')
    return
  }

  try {
    const payload = buildPayload('draft')
    if (recordId.value) {
      await billRecordStore.updateRecord(recordId.value, payload)
    } else {
      await billRecordStore.createRecord(payload)
    }
    showToast(`${isSale.value ? '出货' : '进货'}草稿已保存`, 'success')
  } catch (error) {
    showToast('保存草稿失败，请重试', 'error')
    console.error('保存草稿失败:', error)
  }
}

const exportTable = async () => {
  const exportRows = rowView.value.filter((item) => {
    if (!item) return false
    return item.categoryName || item.weightInput || Number(item.unitPrice) > 0 || Number(item.totalWeight) > 0
  })

  if (!exportRows.length) {
    showToast('暂无可导出的明细数据', 'error')
    return
  }

  try {
    const ExcelJS = await loadExcelJS()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('单据明细')

    worksheet.columns = [
      { width: 18 },
      { width: 24 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ]

    worksheet.addRow(['单据编号', form.orderNo || '-'])
    worksheet.addRow(['开单时间', form.createdAt || '-'])
    worksheet.addRow([partnerLabel.value, form.supplier || '-'])
    worksheet.addRow(['备注', form.note || '-'])
    worksheet.addRow(['总重量(斤)', Number(totalWeight.value || 0)])
    worksheet.addRow(['总金额(元)', Number(totalAmount.value || 0)])
    worksheet.addRow([])
    worksheet.addRow(['品类', '布料', '称重输入', '总重量(斤)', '单价(元/斤)', '金额(元)'])

    exportRows.forEach((item) => {
      worksheet.addRow([
        item.categoryName || '-',
        item.fabricName || '-',
        item.weightInput || '-',
        Number(item.totalWeight || 0),
        Number(item.unitPrice || 0),
        Number(item.amount || 0),
      ])
    })

    const topLabelRows = [1, 2, 3, 4, 5, 6]
    topLabelRows.forEach((rowIndex) => {
      const labelCell = worksheet.getCell(`A${rowIndex}`)
      labelCell.font = { bold: true, color: { argb: 'FF355C7D' } }
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAF3FB' },
      }
    })

    const headerRow = worksheet.getRow(8)
    headerRow.height = 24
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F75B5' },
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        left: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        bottom: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        right: { style: 'thin', color: { argb: 'FFBDD7EE' } },
      }
    })

    const dataStartRow = 9
    const dataEndRow = 8 + exportRows.length
    const summaryRowIndex = dataEndRow + 1

    for (let rowIndex = dataStartRow; rowIndex <= dataEndRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex)
      row.height = 38

      if (rowIndex % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7FBFF' },
          }
        })
      }

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE3EEF8' } },
          left: { style: 'thin', color: { argb: 'FFE3EEF8' } },
          bottom: { style: 'thin', color: { argb: 'FFE3EEF8' } },
          right: { style: 'thin', color: { argb: 'FFE3EEF8' } },
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber >= 4 ? 'right' : 'left',
          wrapText: true,
        }
      })

      worksheet.getCell(`D${rowIndex}`).numFmt = '0.00'
      worksheet.getCell(`E${rowIndex}`).numFmt = '"¥ "#,##0.00'
      worksheet.getCell(`F${rowIndex}`).numFmt = '"¥ "#,##0.00'
    }

    worksheet.addRow(['合计', '', '', Number(totalWeight.value || 0), '', Number(totalAmount.value || 0)])
    const summaryRow = worksheet.getRow(summaryRowIndex)
    summaryRow.height = 26
    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FF1F3852' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        left: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        bottom: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        right: { style: 'thin', color: { argb: 'FFBDD7EE' } },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAF3FB' },
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 4 ? 'right' : 'left',
        wrapText: true,
      }
    })
    worksheet.getCell(`D${summaryRowIndex}`).numFmt = '0.00'
    worksheet.getCell(`F${summaryRowIndex}`).numFmt = '"¥ "#,##0.00'

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${getExportFileBase()}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
    showToast('表格已开始下载', 'success')
  } catch {
    showToast('导出表格失败，请重试', 'error')
  }
}

const getExportFileBase = () => {
  const date = String(form.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  const supplier = (form.supplier || '未命名对象').replace(/[\\/:*?"<>|\s]+/g, '_')
  return `${exportFilePrefix.value}_${date}_${supplier}`
}

const removeRow = (id) => {
  if (rows.value.length <= 1) {
    showToast('至少保留一条明细', 'error')
    return
  }
  rows.value = rows.value.filter((item) => item.id !== id)
  if (focusedCategoryRowId.value === id) {
    focusedCategoryRowId.value = ''
  }
}

const exportImage = async () => {
  try {
    const exportRows = rowView.value.filter((item) => {
      return item.categoryName || item.weightInput || Number(item.unitPrice) > 0 || Number(item.totalWeight) > 0
    })

    if (!exportRows.length) {
      showToast('暂无可导出的明细数据', 'error')
      return
    }

  const canvas = document.createElement('canvas')
  const width = 1400
  const tableLeft = 40
  const tableWidth = 1120
  const rowBaseHeight = 42
  const rowLineHeight = 22
  const footerHeight = 90

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    showToast('导出图片失败，请重试', 'error')
    return
  }

  const getWrappedLines = (text, maxWidth) => {
    const source = String(text || '-').trim() || '-'
    const segments = source.split(/\r?\n/)
    const lines = []

    segments.forEach((segment) => {
      let currentLine = ''
      for (const char of segment) {
        const testLine = currentLine + char
        if (currentLine && ctx.measureText(testLine).width > maxWidth) {
          lines.push(currentLine)
          currentLine = char
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)
    })

    return lines.length ? lines : ['-']
  }

  const columns = [
    { key: 'categoryName', label: '品类', left: 40, width: 180 },
    { key: 'fabricName', label: '布料', left: 220, width: 180 },
    { key: 'weightInput', label: '重量明细', left: 400, width: 280 },
    { key: 'totalWeight', label: '重量(斤)', left: 680, width: 150 },
    { key: 'unitPrice', label: '单价(元/斤)', left: 830, width: 150 },
    { key: 'amount', label: '金额(元)', left: 980, width: 180 },
  ]

  ctx.font = '22px "SimSun", serif'
  const noteLines = getWrappedLines(`备注：${form.note || '-'}`, width - 96)
  const noteLineHeight = 30
  const noteTop = 200
  const noteHeight = Math.max(noteLineHeight, noteLines.length * noteLineHeight)
  const tableTop = noteTop + noteHeight + 22

  ctx.font = '16px "SimSun", serif'
  const preparedRows = exportRows.map((item) => {
    if (!item) {
      return {
        rowData: {
          categoryName: '-',
          fabricName: '-',
          weightInput: '-',
          totalWeight: '0.00',
          unitPrice: '0.00',
          amount: formatMoney(0)
        },
        wrappedWeightLines: ['-'],
        rowHeight: rowBaseHeight
      }
    }

    const rowData = {
      categoryName: item.categoryName || '-',
      fabricName: item.fabricName || '-',
      weightInput: item.weightInput || '-',
      totalWeight: (item.totalWeight || 0).toFixed(2),
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      amount: formatMoney(item.amount || 0),
    }

    const wrappedWeightLines = getWrappedLines(rowData.weightInput, columns[2].width - 20)
    const rowHeight = Math.max(rowBaseHeight, 16 + wrappedWeightLines.length * rowLineHeight)

    return {
      rowData,
      wrappedWeightLines,
      rowHeight,
    }
  })

  const totalTableHeight = preparedRows.reduce((sum, item) => sum + item.rowHeight, 0) + rowBaseHeight
  const canvasHeight = tableTop + totalTableHeight + footerHeight

  canvas.width = width
  canvas.height = canvasHeight

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, canvasHeight)

  ctx.fillStyle = '#1f3852'
  ctx.font = 'bold 34px "SimSun", serif'
  ctx.fillText(exportTitle.value, 48, 62)

  ctx.font = '22px "SimSun", serif'
  ctx.fillStyle = '#4e6b86'
  ctx.fillText(`日期：${String(form.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10)}`, 48, 104)
  ctx.fillText(`${partnerLabel.value}：${form.supplier || '-'}`, 48, 136)

  noteLines.forEach((line, index) => {
    ctx.fillText(line, 48, noteTop + index * noteLineHeight)
  })

  ctx.fillStyle = '#f2f7fc'
  ctx.fillRect(tableLeft, tableTop, tableWidth, rowBaseHeight)

  ctx.font = 'bold 18px "SimSun", serif'
  ctx.fillStyle = '#2f506d'
  columns.forEach((col) => {
    ctx.fillText(col.label, col.left + 10, tableTop + 27)
  })

  ctx.font = '16px "SimSun", serif'
  let currentY = tableTop + rowBaseHeight
  preparedRows.forEach((item, index) => {
    if (index % 2 === 0) {
      ctx.fillStyle = '#f8fbff'
      ctx.fillRect(tableLeft, currentY, tableWidth, item.rowHeight)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(tableLeft, currentY, tableWidth, item.rowHeight)
    }

    ctx.fillStyle = '#234462'
    columns.forEach((col) => {
      let textToDraw = String(item.rowData[col.key] || '-')

      if (col.key === 'categoryName') {
        const wrappedCategoryLines = getWrappedLines(item.rowData.categoryName, columns[0].width - 20)
        wrappedCategoryLines.forEach((line, i) => {
          ctx.fillText(line, col.left + 10, currentY + 27 + i * rowLineHeight)
        })
      } else if (col.key === 'fabricName') {
        const wrappedFabricLines = getWrappedLines(item.rowData.fabricName, columns[1].width - 20)
        wrappedFabricLines.forEach((line, i) => {
          ctx.fillText(line, col.left + 10, currentY + 27 + i * rowLineHeight)
        })
      } else if (col.key === 'weightInput') {
        item.wrappedWeightLines.forEach((line, i) => {
          ctx.fillText(line, col.left + 10, currentY + 27 + i * rowLineHeight)
        })
      } else {
        ctx.fillText(textToDraw, col.left + 10, currentY + 27)
      }
    })

    currentY += item.rowHeight
  })

  const tableBottom = currentY
  ctx.strokeStyle = '#d5e2ee'
  ctx.lineWidth = 1
  ctx.strokeRect(tableLeft, tableTop, tableWidth, tableBottom - tableTop)

  ctx.fillStyle = '#1f3852'
  ctx.font = 'bold 22px "SimSun", serif'
  ctx.fillText(`总重量：${totalWeight.value.toFixed(2)} 斤`, 48, tableBottom + 52)
  ctx.fillText(`总金额：${formatMoney(totalAmount.value)}`, 420, tableBottom + 52)

  const link = document.createElement('a')
  link.download = `${getExportFileBase()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
  showToast('图片已开始下载', 'success')
  } catch (error) {
    showToast('导出图片失败，请重试', 'error')
    console.error('导出图片失败:', error)
  }
}

const removeBill = async () => {
  if (!hasRecord.value || deleting.value || saving.value) return
  const ok = window.confirm(`确认删除单据 ${form.orderNo} 吗？删除后不可恢复。`)
  if (!ok) return

  deleting.value = true
  try {
    const deleted = await billRecordStore.deleteRecord(recordId.value)
    if (!deleted) {
      showToast('删除失败：未找到单据', 'error')
      return
    }
    showToast(`单据 ${form.orderNo} 已删除`, 'success')
    router.push(returnRoute.value)
  } catch (error) {
    console.error('删除失败:', error)
    showToast('删除失败，请重试', 'error')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="weight-page slide-up-enter-active">
    <header class="topbar panel">
      <div class="title-wrap">
        <h2>{{ pageTitle }}</h2>
        <p>单号：{{ form.orderNo || '-' }}</p>
      </div>

      <div class="top-actions">
        <button type="button" class="btn-ghost" @click="router.push(returnRoute)">返回列表</button>
        <button v-if="hasRecord" type="button" class="btn-danger" @click="removeBill">删除</button>
      </div>
    </header>

    <div v-if="!hasRecord" class="panel empty-state">没有找到该单据的详细信息。</div>

    <div v-else class="panel workbench">
      <div class="meta-grid">
        <label>
          <span>客户</span>
          <div class="custom-select" :class="{ active: showSupplierOptions }">
            <input
              v-model="supplierSearch"
              type="text"
              placeholder="输入或选择客户"
              @mousedown.stop="showSupplierOptions = !showSupplierOptions"
              @input="form.supplier = supplierSearch"
            />
            <div class="arrow" @mousedown.stop="showSupplierOptions = !showSupplierOptions">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <Transition name="fade-pop">
              <ul v-if="showSupplierOptions && filteredSuppliers.length" class="dropdown-list">
                <li v-for="item in filteredSuppliers" :key="item.id" @mousedown.stop="selectSupplier(item)">
                  {{ item.name }}
                </li>
              </ul>
              <div v-else-if="showSupplierOptions && supplierSearch" class="dropdown-list no-res">
                未找到该客户
              </div>
            </Transition>
          </div>
        </label>
        <label>
          <span>品类</span>
          <div class="custom-select" :class="{ active: showFormCategoryOptions }">
            <input
              v-model="categorySearch"
              type="text"
              placeholder="输入或选择品类"
              @mousedown.stop="showFormCategoryOptions = !showFormCategoryOptions"
            />
            <div class="arrow" @mousedown.stop="showFormCategoryOptions = !showFormCategoryOptions">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <Transition name="fade-pop">
              <ul v-if="showFormCategoryOptions && categories.length" class="dropdown-list">
                <li v-for="item in categories" :key="item.id" @mousedown.stop="selectCategoryForForm(item)">
                  {{ item.name }}
                </li>
              </ul>
              <div v-else-if="showFormCategoryOptions && categorySearch" class="dropdown-list no-res">
                未找到该品类
              </div>
            </Transition>
          </div>
        </label>
        <label>
          <span>布料</span>
          <div class="custom-select" :class="{ active: showFabricOptions }">
            <input
              v-model="fabricSearch"
              type="text"
              :placeholder="form.categoryId ? '输入或选择布料' : '请先选择品类'"
              :disabled="!form.categoryId"
              @mousedown.stop="form.categoryId && (showFabricOptions = !showFabricOptions)"
            />
            <div class="arrow" @mousedown.stop="form.categoryId && (showFabricOptions = !showFabricOptions)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <Transition name="fade-pop">
              <ul v-if="showFabricOptions && fabrics.length" class="dropdown-list">
                <li v-for="item in fabrics" :key="item.id" @mousedown.stop="selectFabricForForm(item)">
                  {{ item.name }}
                </li>
              </ul>
              <div v-else-if="showFabricOptions && fabricSearch" class="dropdown-list no-res">
                未找到该布料
              </div>
            </Transition>
          </div>
        </label>
        <label>
          <span>开单时间</span>
          <input v-model="form.createdAt" type="text" placeholder="YYYY-MM-DD HH:mm:ss" />
        </label>
        <label class="note-col">
          <span>备注</span>
          <input v-model="form.note" type="text" placeholder="可选备注信息" />
        </label>
      </div>

      <section class="overview-grid">
        <article class="overview-card accent-teal">
          <span class="overview-label">当前客户</span>
          <strong>{{ form.supplier || '待填写客户' }}</strong>
          <small>已录入 {{ filledRowCount }} 条有效明细</small>
        </article>
        <article class="overview-card accent-blue">
          <span class="overview-label">累计重量</span>
          <strong>{{ totalWeight.toFixed(2) }} 斤</strong>
          <small>支持 `10+10+10`、`10 10 10`、`10.10.10`、`10×3` 快速计算</small>
        </article>
        <article class="overview-card accent-gold">
          <span class="overview-label">平均单价</span>
          <strong>{{ formatMoney(avgUnitPrice) }}</strong>
          <small>累计金额 {{ formatMoney(totalAmount) }}</small>
        </article>
      </section>

      <div v-if="form.firstWeight > 0 || form.lastWeight > 0" class="weight-panel">
        <div class="weight-inputs">
          <label class="field">
            <span>初磅 (斤)</span>
            <input :value="form.firstWeight.toFixed(2)" type="text" readonly />
          </label>
          <label class="field">
            <span>次磅 (斤)</span>
            <input :value="form.lastWeight.toFixed(2)" type="text" readonly />
          </label>
          <label class="field">
            <span>净重 (斤)</span>
            <input :value="form.netWeight.toFixed(2)" type="text" readonly />
          </label>
        </div>
      </div>

      <div class="page-tipbar">
        <div>
          <strong>录入提示</strong>
          <span>重量支持输入 `10+10+10`、`10 10 10`、`10.10.10`、`10×3`，系统会自动计算结果。</span>
        </div>
        <span class="tip-tag">单据编号 {{ form.orderNo || '-' }}</span>
      </div>

      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th>品类</th>
              <th>布料</th>
              <th>称重输入</th>
              <th>总重量(斤)</th>
              <th>单价(元/斤)</th>
              <th>金额(元)</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in rowView" :key="item.id">
              <td>
                <div class="cell-stack">
                  <div class="category-heading">
                    <span class="row-index">#{{ idx + 1 }}</span>
                    <span
                      class="category-badge"
                      :class="{
                        matched: !!getCategoryMeta(rows[idx].categoryName).exact,
                        active: focusedCategoryRowId === item.id,
                      }"
                    >
                      {{ getCategoryBadgeText(rows[idx]) }}
                    </span>
                  </div>

                  <div
                    class="category-picker"
                    :class="{
                      active: showCategoryOptions[item.id],
                      matched: !!getCategoryMeta(rows[idx].categoryName).exact,
                    }"
                  >
                    <div class="custom-select category-select" :class="{ active: showCategoryOptions[item.id] }">
                      <input
                        v-model="rows[idx].categoryName"
                        type="text"
                        placeholder="输入品类名称"
                        class="cell-input"
                        @mousedown.stop="toggleCategoryOptions(item.id); focusedCategoryRowId = item.id"
                        @input="updateCategoryId(item.id, rows[idx].categoryName)"
                      />
                      <div class="arrow" @mousedown.stop="toggleCategoryOptions(item.id); focusedCategoryRowId = item.id">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <Transition name="fade-pop">
                        <ul v-if="showCategoryOptions[item.id] && getFilteredCategories(rows[idx].categoryName).length" class="dropdown-list">
                          <li
                            v-for="option in getFilteredCategories(rows[idx].categoryName)"
                            :key="option.id"
                            @mousedown.stop="selectCategory(item.id, option)"
                          >
                            <div class="dropdown-main">{{ option.name }}</div>
                            <small v-if="Number(option.defaultPrice || 0) > 0">默认 ¥{{ Number(option.defaultPrice).toFixed(2) }}/斤</small>
                          </li>
                        </ul>
                        <div v-else-if="showCategoryOptions[item.id] && rows[idx].categoryName" class="dropdown-list no-res">
                          未找到该品类
                        </div>
                      </Transition>
                    </div>
                  </div>

                  <div v-if="showCategoryOptions[item.id]" class="suggestions">
                    <div class="suggestion-item" @mousedown.stop="selectCategory(item.id, { id: '', name: '', defaultPrice: 0 })">
                      <div class="suggestion-name">手动录入</div>
                      <span class="suggestion-badge">新建</span>
                    </div>
                    <div v-for="option in categoryQuickPicks" :key="option.id" class="suggestion-item" @mousedown.stop="selectCategory(item.id, option)">
                      <div class="suggestion-name">{{ option.name }}</div>
                      <small v-if="Number(option.defaultPrice || 0) > 0">¥{{ Number(option.defaultPrice).toFixed(2) }}</small>
                    </div>
                  </div>

                  <small class="category-hint" v-if="rows[idx].categoryName || showCategoryOptions[item.id]">{{ getCategoryHintText(rows[idx]) }}</small>
                </div>
              </td>

              <td>
                <div class="cell-stack">
                  <div v-if="rows[idx].categoryId" class="category-heading">
                    <span
                      class="category-badge"
                      :class="{
                        matched: !!getFabricMeta(item.id, rows[idx].fabricName).exact,
                        active: focusedFabricRowId === item.id,
                      }"
                    >
                      {{ getFabricBadgeText(item) }}
                    </span>
                  </div>

                  <div
                    class="category-picker"
                    :class="{
                      active: showFabricOptionsForRow[item.id],
                      matched: !!getFabricMeta(item.id, rows[idx].fabricName).exact,
                    }"
                  >
                    <div class="custom-select category-select" :class="{ active: showFabricOptionsForRow[item.id] }">
                      <input
                        v-model="rows[idx].fabricName"
                        type="text"
                        :placeholder="rows[idx].categoryId ? '输入或选择布料' : '请先选择品类'"
                        :disabled="!rows[idx].categoryId"
                        class="cell-input"
                        @mousedown.stop="handleFabricClick(item.id, idx)"
                      />
                      <div class="arrow" @mousedown.stop="handleFabricArrowClick(item.id, idx)">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                      <Transition name="fade-pop">
                        <ul v-if="showFabricOptionsForRow[item.id] && getFilteredFabrics(item.id, rows[idx].fabricName).length" class="dropdown-list">
                          <li
                            v-for="option in getFilteredFabrics(item.id, rows[idx].fabricName)"
                            :key="option.id"
                            @mousedown.stop="selectFabric(item.id, option)"
                          >
                            <div class="dropdown-main">{{ option.name }}</div>
                            <small v-if="Number(option.defaultPrice || 0) > 0">默认 ¥{{ Number(option.defaultPrice).toFixed(2) }}/斤</small>
                          </li>
                        </ul>
                        <div v-else-if="showFabricOptionsForRow[item.id] && rows[idx].fabricName" class="dropdown-list no-res">
                          未找到该布料
                        </div>
                      </Transition>
                    </div>
                  </div>

                  <div v-if="rows[idx].categoryId && showFabricOptionsForRow[item.id]" class="suggestions">
                    <div class="suggestion-item" @mousedown.stop="selectFabric(item.id, { id: '', name: '', defaultPrice: 0 })">
                      <div class="suggestion-name">手动录入</div>
                      <span class="suggestion-badge">新建</span>
                    </div>
                    <div v-for="option in getFabricQuickPicks(item.id)" :key="option.id" class="suggestion-item" @mousedown.stop="selectFabric(item.id, option)">
                      <div class="suggestion-name">{{ option.name }}</div>
                      <small v-if="Number(option.defaultPrice || 0) > 0">¥{{ Number(option.defaultPrice).toFixed(2) }}</small>
                    </div>
                  </div>

                  <small class="category-hint" v-if="(rows[idx].categoryId && rows[idx].fabricName) || showFabricOptionsForRow[item.id]">{{ getFabricHintText(item) }}</small>
                  <small class="category-hint" v-else-if="rows[idx].categoryId && !rows[idx].fabricName">请选择布料（可选），支持快速搜索</small>
                </div>
              </td>

              <td>
                <input
                  v-model="rows[idx].weightInput"
                  type="text"
                  placeholder="10+10+10 / 10 10 10 / 10.10.10"
                  class="cell-input"
                />
              </td>

              <td>
                <div class="cell-stack align-with-category">
                  <span class="num">{{ item.totalWeight.toFixed(2) }}</span>
                </div>
              </td>

              <td>
                <div class="cell-stack align-with-category">
                  <input v-model.number="rows[idx].unitPrice" type="number" step="0.01" class="cell-input" />
                </div>
              </td>

              <td>
                <div class="cell-stack align-with-category">
                  <span class="num amount">{{ formatMoney(item.amount) }}</span>
                </div>
              </td>

              <td>
                <div class="cell-stack align-with-category">
                  <button type="button" class="btn-delete" @click="removeRow(item.id)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="summary">
        <div class="summary-metrics">
          <div class="sum-block emphasis framed-metric">
            <span>总重量</span>
            <strong>{{ totalWeight.toFixed(2) }} 斤</strong>
          </div>
          <div class="sum-block">
            <span>总金额</span>
            <strong>{{ formatMoney(totalAmount) }}</strong>
          </div>
        </div>
        <div class="summary-actions">
          <button type="button" class="btn-ghost" @click.stop="saveDraft">保存草稿</button>
          <button type="button" class="btn-ghost" @click.stop="exportTable">导出表格</button>
          <button type="button" class="btn-ghost" @click.stop="exportImage">导出图片</button>
          <button v-if="recordId" type="button" class="btn-danger" :disabled="deleting" @click.stop="deleteBill">{{ deleting ? '删除中...' : '删除单据' }}</button>
          <button type="button" class="btn-primary" :disabled="saving" @click.stop="submitAndView">{{ saving ? '提交中...' : '提交单据并查看' }}</button>
          <button type="button" class="btn-ghost" @click.stop="addNewDetail">新增明细</button>
        </div>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.weight-page {
  background: var(--bg-gradient);
  min-height: calc(100vh - 20px);
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 16px;
}

.topbar {
  background: #fff;
  padding: 14px 20px;
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-wrap h2 {
  margin: 0;
  font-size: 26px;
  color: #223951;
}

.title-wrap p {
  margin-top: 6px;
  color: var(--text-muted);
  font-weight: 600;
}

.top-actions {
  display: flex;
  gap: 10px;
}

.btn-danger {
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #c9485b, #e06b78);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.workbench {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 12px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.overview-card {
  position: relative;
  overflow: hidden;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid rgba(140, 184, 218, 0.22);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(241, 247, 252, 0.92));
  box-shadow: 0 16px 36px rgba(44, 83, 120, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overview-card::after {
  content: '';
  position: absolute;
  inset: auto -36px -36px auto;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  opacity: 0.16;
}

.overview-label {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #6d89a4;
}

.overview-card strong {
  font-size: 28px;
  line-height: 1.2;
  color: #234462;
}

.overview-card small {
  font-size: 13px;
  color: #62809e;
}

.accent-teal::after {
  background: #26b3a3;
}

.accent-blue::after {
  background: #4d8fe8;
}

.accent-gold::after {
  background: #e5ab38;
}

.page-tipbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px dashed rgba(77, 143, 232, 0.26);
  background: linear-gradient(90deg, rgba(236, 245, 255, 0.9), rgba(255, 250, 240, 0.78));
}

.page-tipbar strong {
  display: block;
  margin-bottom: 4px;
  color: #2f5477;
}

.page-tipbar span {
  color: #5f7892;
  font-size: 14px;
}

.tip-tag {
  white-space: nowrap;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(77, 143, 232, 0.2);
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label span {
  color: #355877;
  font-size: 14px;
  font-weight: 600;
}

input {
  width: 100%;
  height: 44px;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: #fff;
  padding: 0 12px;
  color: var(--text-normal);
  outline: none;
  transition: all 0.2s;
}

input:focus {
  border-color: var(--accent-blue-deep);
  box-shadow: 0 0 0 3px rgba(36, 127, 214, 0.1);
}

.custom-select {
  position: relative;
  width: 100%;
}

.custom-select input {
  padding-right: 40px;
}

.arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--text-muted);
  display: grid;
  place-items: center;
  transition: transform 0.25s ease, color 0.2s ease;
}

.custom-select.active .arrow {
  transform: translateY(-50%) rotate(180deg);
  color: var(--accent-blue-deep);
}

.dropdown-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--panel-line);
  border-radius: 12px;
  max-height: 220px;
  overflow-y: auto;
  z-index: 50;
  padding: 6px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  list-style: none;
}

.dropdown-list li {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-normal);
  transition: background 0.2s, color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-main {
  font-weight: 700;
  color: #274767;
}

.dropdown-list li small {
  color: #6e88a3;
  font-size: 12px;
}

.dropdown-list li:hover {
  background: var(--bg-soft);
  color: var(--primary-dark);
}

.no-res {
  padding: 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.fade-pop-enter-active,
.fade-pop-leave-active {
  transition: all 0.18s ease;
}

.fade-pop-enter-from,
.fade-pop-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.table-box {
  border: 1px solid var(--panel-line);
  border-radius: 18px;
  overflow: visible;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(247, 251, 255, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  border-bottom: 1px solid var(--panel-line);
  padding: 12px 10px;
  text-align: left;
  vertical-align: middle;
}

th {
  background: rgba(169, 200, 231, 0.13);
  font-size: 16px;
  color: #55779b;
}

th:nth-child(1),
td:nth-child(1) {
  width: 16%;
}

th:nth-child(2),
td:nth-child(2) {
  width: 16%;
}

th:nth-child(3),
td:nth-child(3) {
  width: 18%;
}

th:nth-child(4),
td:nth-child(4),
th:nth-child(5),
td:nth-child(5),
th:nth-child(6),
td:nth-child(6) {
  width: 12%;
}

th:nth-child(7),
td:nth-child(7) {
  width: 8%;
}

tbody tr {
  transition: background 0.2s ease;
}

tbody tr:hover {
  background: rgba(237, 246, 255, 0.72);
}

.cell-input {
  height: 40px;
  min-width: 130px;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--text-muted);
  font-size: 12px;
}

.row-index {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-weight: 600;
  color: #8aa1b8;
}

.category-badge {
  padding: 4px 8px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
}

.category-badge.matched {
  background: rgba(102, 187, 106, 0.1);
  color: #43a047;
}

.category-badge.active {
  background: rgba(36, 127, 214, 0.1);
  color: #247fd6;
}

.category-picker {
  margin-top: 6px;
  transition: all 0.2s;
}

.category-select {
  border: 1px solid rgba(173, 204, 226, 0.3);
  border-radius: 10px;
  background: rgba(241, 247, 252, 0.7);
  overflow: hidden;
}

.category-picker.matched .category-select {
  border-color: rgba(102, 187, 106, 0.3);
  background: rgba(102, 187, 106, 0.06);
}

.suggestions {
  margin-top: 6px;
  border-top: 1px solid var(--panel-line);
  padding-top: 8px;
  max-height: 180px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-item:hover {
  background: var(--bg-soft);
}

.suggestion-name {
  font-weight: 600;
  color: #234361;
}

.suggestion-badge {
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(230, 126, 34, 0.1);
  color: #e67e22;
  font-size: 12px;
  font-weight: 600;
}

.suggestion-item small {
  color: #64839e;
  font-size: 12px;
}

.align-with-category {
  justify-content: center;
  align-items: center;
}

.num {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-weight: 600;
  font-size: 16px;
  color: var(--text-normal);
}

.num.amount {
  color: var(--primary);
}

.btn-primary,
.btn-ghost,
.btn-delete,
.btn-danger {
  height: 42px;
  border-radius: 12px;
  padding: 0 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  border: 1px solid rgba(28, 167, 146, 0.3);
  background: linear-gradient(135deg, var(--primary-dark), var(--primary));
  color: #fff;
  box-shadow: 0 6px 16px rgba(28, 167, 146, 0.24);
}

.btn-primary:hover,
.btn-delete:hover,
.btn-danger:hover {
  transform: translateY(-1px);
}

.btn-primary:disabled,
.btn-ghost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  border: 1px solid rgba(28, 167, 146, 0.3);
  background: linear-gradient(135deg, var(--primary-dark), var(--primary));
  color: #fff;
  box-shadow: 0 6px 16px rgba(28, 167, 146, 0.24);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(28, 167, 146, 0.3);
}

.btn-ghost {
  border: 1px solid rgba(133, 163, 186, 0.4);
  background: rgba(241, 247, 252, 0.8);
  color: #596f87;
}

.btn-ghost:hover {
  border-color: rgba(36, 127, 214, 0.4);
  background: rgba(36, 127, 214, 0.06);
  color: #247fd6;
}

.btn-delete {
  border: 1px solid rgba(229, 92, 92, 0.25);
  color: var(--danger);
  background: rgba(229, 92, 92, 0.08);
}

.btn-delete:hover {
  border-color: rgba(229, 92, 92, 0.4);
  background: rgba(229, 92, 92, 0.12);
}

.btn-secondary {
  border: 1px solid rgba(77, 143, 232, 0.3);
  background: linear-gradient(135deg, rgba(77, 143, 232, 0.1), rgba(77, 143, 232, 0.05));
  color: #4d8fe8;
}

.btn-secondary:hover {
  border-color: rgba(77, 143, 232, 0.4);
  background: rgba(77, 143, 232, 0.15);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(77, 143, 232, 0.2);
}

.btn-danger {
  border: 1px solid rgba(229, 92, 92, 0.25);
  color: var(--danger);
  background: rgba(229, 92, 92, 0.08);
}

.summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  margin-top: 6px;
}

/* 响应式设计 - 平板设备 */
@media (max-width: 1100px) {
  .summary {
    grid-template-columns: 1fr;
  }

  .summary-actions {
    width: 100%;
    justify-content: stretch;
  }

  .summary-actions button {
    flex: 1 1 calc(50% - 6px);
  }
}

/* 响应式设计 - 移动设备 */
@media (max-width: 768px) {
  .summary-actions {
    gap: 8px;
  }

  .btn-primary,
  .btn-ghost,
  .btn-delete,
  .btn-danger,
  .btn-secondary {
    min-height: 44px;
    font-size: 16px;
  }

  .summary-actions button {
    flex: 1 1 calc(50% - 4px);
  }
}

/* 响应式设计 - 小屏手机 */
@media (max-width: 480px) {
  .summary-actions button {
    flex: 1 1 100%;
  }

  .btn-primary,
  .btn-ghost,
  .btn-delete,
  .btn-danger,
  .btn-secondary {
    min-height: 44px;
    font-size: 16px;
    padding: 12px;
  }
}

/* 安全区域适配 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .summary {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  }
}

.summary-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sum-block {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(241, 247, 252, 0.8);
  border: 1px solid rgba(169, 200, 231, 0.3);
}

.sum-block span {
  font-size: 14px;
  color: #64839e;
  white-space: nowrap;
}

.sum-block strong {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-normal);
}

.sum-block.framed-metric {
  border-color: rgba(28, 167, 146, 0.3);
  background: rgba(28, 167, 146, 0.06);
}

.sum-block.emphasis {
  border-width: 2px;
}

.summary-actions {
  display: flex;
  gap: 10px;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 80px 20px;
}

.weight-panel {
  background: linear-gradient(135deg, rgba(240, 248, 255, 0.9), rgba(255, 255, 255, 0.9));
  border: 1px solid rgba(144, 202, 249, 0.3);
  border-radius: 16px;
  padding: 18px;
  margin-top: 14px;
}

.weight-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: end;
}

.weight-inputs .field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.weight-inputs label {
  font-size: 14px;
  font-weight: 600;
  color: #4a6fa5;
}

.weight-inputs input {
  height: 48px;
  border-radius: 12px;
  border: 1px solid #9ec1e6;
  background: #fff;
  padding: 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.weight-inputs input:read-only {
  background: linear-gradient(135deg, rgba(102, 187, 106, 0.1), rgba(144, 238, 144, 0.1));
  border-color: #81c784;
  color: #2e7d32;
}
</style>
