<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '../../components/icons/AppIcon.vue'
import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useCustomerPriceStore } from '../../stores/customerPrice'
import { useFabricStore } from '../../stores/fabric'
import { removeItem } from '../../utils/storage'
import { createCanvasTableColumns, drawCanvasTableGrid, getCanvasBlockStartY, getCanvasCenterTextY, getCanvasTableWidth } from '../../utils/canvas-table'
import { getCanvasWrappedRowHeight, wrapCanvasText } from '../../utils/canvas-text'
import { multiplyMoney, addMoney, formatMoney } from '../../utils/money'
import { showToast } from '../../utils/toast'
import { countExcelTextLines, formatExcelWrapText, getExcelWrappedRowHeight } from '../../utils/excel'
import { MASTER_DATA_CHANGED_EVENT } from '../../utils/master-data-events'
import { getExportImageBrandName } from '../../utils/app-config'

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
const customerPriceStore = useCustomerPriceStore()
const fabricStore = useFabricStore()
const saving = ref(false)
const detailPanelRef = ref(null)
const detailFabricSelectRefs = ref({})
const isPurchase = computed(() => props.type === 'purchase')
const DRAFT_STORAGE_KEY = computed(() => props.type === 'sale' ? 'sale-order-editor-draft' : 'purchase-order-editor-draft')

const recordId = computed(() => String(route.params.id || ''))
const isEditing = computed(() => Boolean(recordId.value))
const currentRecord = computed(() => {
  if (!recordId.value || typeof billRecordStore.getById !== 'function') return null
  return billRecordStore.getById(recordId.value)
})
const pageTitle = computed(() => {
  if (isEditing.value) return isPurchase.value ? '编辑进货单' : '编辑出货单'
  return isPurchase.value ? '进货开单' : '出货开单'
})
const priceLabel = computed(() => (isPurchase.value ? '进货单价' : '出货单价'))
const settlementLabel = computed(() => (isPurchase.value ? '已付款' : '已收款'))
const pageClass = computed(() => (isPurchase.value ? 'purchase-theme' : 'sale-theme'))
const exportTitle = computed(() => (isPurchase.value ? '进货单据明细' : '出货单据明细'))
const partnerLabel = computed(() => (isPurchase.value ? '供货方' : '客户'))
const quantityLabel = computed(() => '数量 / 重量')
const totalWeightLabel = computed(() => '总重量')
const roundAmount = (value) => Math.round(Number(value) || 0)
const hasWeighing = computed(() => {
  return Number(form.firstWeight || 0) > 0 ||
    Number(form.lastWeight || 0) > 0 ||
    weighingRows.value.some((row) => Number(row.firstWeight || 0) > 0 || Number(row.lastWeight || 0) > 0)
})
const formatKg = (value) => `${Number(value || 0).toFixed(2)} 公斤`
const KG_TO_JIN = 2
const formatJinInput = (value) => {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number <= 0) return ''
  return Number(number.toFixed(2)).toString()
}

const form = reactive({
  partnerId: '',
  partnerName: '',
  note: '',
  settlementAmount: 0,
  unsettledAmount: 0,
  fabricId: '',
  fabricName: '',
  unitPrice: 0,
  firstWeight: 0,
  lastWeight: 0,
  netWeight: 0,
})

const weighingRows = ref([])
const getWeighingNet = (row) => Math.max(Number(row?.firstWeight || 0) - Number(row?.lastWeight || 0), 0)
const getWeighingJin = (row) => Number((getWeighingNet(row) * KG_TO_JIN).toFixed(2))
const getWeighingAmount = (row) => multiplyMoney(getWeighingJin(row), Number(row?.unitPrice || 0))
const primaryNetWeight = computed(() => getWeighingNet(form))
const primaryNetWeightJin = computed(() => Number((primaryNetWeight.value * KG_TO_JIN).toFixed(2)))
const totalFirstWeight = computed(() => Number((Number(form.firstWeight || 0) + weighingRows.value.reduce((sum, row) => sum + Number(row.firstWeight || 0), 0)).toFixed(2)))
const totalLastWeight = computed(() => Number((Number(form.lastWeight || 0) + weighingRows.value.reduce((sum, row) => sum + Number(row.lastWeight || 0), 0)).toFixed(2)))
const extraNetWeight = computed(() => weighingRows.value.reduce((sum, row) => sum + getWeighingNet(row), 0))
const netWeight = computed(() => Number((primaryNetWeight.value + extraNetWeight.value).toFixed(2)))
const netWeightJin = computed(() => Number((netWeight.value * KG_TO_JIN).toFixed(2)))

watch(netWeight, (value) => {
  form.netWeight = Number(value || 0)
}, { immediate: true })

const syncPartnerSelection = () => {
  const keyword = form.partnerName.trim()
  const matched = partners.value.find((item) => item.name === keyword)
  form.partnerId = matched?.id || ''
}

const makeRow = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  fabricId: '',
  fabricName: '',
  quantityInput: '',
  quantity: 0,
  unitPrice: 0,
  note: '',
})

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

  try {
    // 简单的表达式解析
    // 支持加法、乘法和空格分隔的数值组合
    let value = 0
    const addParts = normalized.split('+')
    for (const part of addParts) {
      const multiplyParts = part.split('*')
      if (multiplyParts.length === 2) {
        const left = Number(multiplyParts[0])
        const right = Number(multiplyParts[1])
        if (!isNaN(left) && !isNaN(right)) {
          value += left * right
        }
      } else {
        // 检查是否包含空格分隔的多个数值
        if (part.includes(' ')) {
          const spaceParts = part.split(' ')
          for (const numStr of spaceParts) {
            const num = Number(numStr)
            if (!isNaN(num)) {
              value += num
            }
          }
        } else {
          const num = Number(part)
          if (!isNaN(num)) {
            value += num
          }
        }
      }
    }
    return isNaN(value) ? 0 : value
  } catch (error) {
    console.error('解析重量表达式失败:', error)
    return 0
  }
}

const rows = ref([makeRow()])

const partners = computed(() => customerStore.activeCustomers)
const fabrics = computed(() => fabricStore.activeFabrics)
const primaryRow = computed(() => form)
const currentPartner = computed(() => {
  const partnerName = form.partnerName.trim()
  return customerStore.customers.find((item) => {
    return (form.partnerId && item.id === form.partnerId) || (partnerName && String(item.name || '').trim() === partnerName)
  }) || null
})
customerPriceStore.init()

const selectFabric = (row) => {
  const selected = fabrics.value.find((item) => item.id === row.fabricId)
  row.fabricName = selected?.name || ''
  if (selected) row.unitPrice = getPreferredUnitPrice(selected)
}

const selectPrimaryFabric = () => {
  selectFabric(form)
}

const selectWeighingFabric = (row) => {
  selectFabric(row)
}

const syncRowFabric = (row) => {
  const keyword = row.fabricName.trim()
  const matched = fabrics.value.find((item) => item.name === keyword)
  row.fabricId = matched?.id || ''
  if (matched) row.unitPrice = getPreferredUnitPrice(matched)
}

const refreshRowPricesForPartner = () => {
  if (isEditing.value) return
  rows.value.forEach((row) => {
    if (!row.fabricId) return
    const selected = fabrics.value.find((item) => item.id === row.fabricId)
    if (selected) row.unitPrice = getPreferredUnitPrice(selected)
  })
  weighingRows.value.forEach((row) => {
    if (!row.fabricId) return
    const selected = fabrics.value.find((item) => item.id === row.fabricId)
    if (selected) row.unitPrice = getPreferredUnitPrice(selected)
  })
}

const fillForm = (record) => {
  if (!record) return

  form.partnerId = record.partnerId || ''
  form.partnerName = record.partnerName || record.supplier || record.customerName || ''
  form.note = record.note || ''
  form.settlementAmount = Number(isPurchase.value ? record.paidAmount || 0 : record.receivedAmount || 0)
  form.unsettledAmount = Number(record.unsettledAmount ?? 0)
  const savedWeighingDetails = Array.isArray(record.weighingDetails) ? record.weighingDetails : []
  const primaryWeighing = savedWeighingDetails[0] || null
  form.fabricId = primaryWeighing?.fabricId || ''
  form.fabricName = primaryWeighing?.fabricName || ''
  form.unitPrice = Number(primaryWeighing?.unitPrice || 0)
  form.firstWeight = Number(primaryWeighing?.firstWeight ?? record.firstWeight ?? 0)
  form.lastWeight = Number(primaryWeighing?.lastWeight ?? record.lastWeight ?? 0)
  form.netWeight = Number(record.netWeight || Math.max(form.firstWeight - form.lastWeight, 0))
  weighingRows.value = Array.isArray(record.weighingDetails)
    ? record.weighingDetails.slice(primaryWeighing ? 1 : 0).map((item) => ({
        id: item.id || `weigh-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        fabricId: item.fabricId || '',
        fabricName: item.fabricName || '',
        unitPrice: Number(item.unitPrice || 0),
        firstWeight: Number(item.firstWeight || 0),
        lastWeight: Number(item.lastWeight || 0),
        note: item.note || '',
      }))
    : []

  if (Array.isArray(record.items) && record.items.length) {
    rows.value = record.items.filter((item) => item.source !== 'weighing' && !item.weighingId).map((item) => ({
      ...makeRow(),
      id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      fabricId: item.fabricId || '',
      fabricName: item.fabricName || '',
      quantityInput: String(item.weightInput ?? item.quantityInput ?? item.quantity ?? item.totalWeight ?? ''),
      quantity: Number(item.quantity || item.totalWeight || 0),
      unitPrice: Number(item.unitPrice || 0),
      note: item.note || '',
    }))
    return
  }

  rows.value = [makeRow()]
}

const resetEditor = () => {
  form.partnerId = ''
  form.partnerName = ''
  form.note = ''
  form.settlementAmount = 0
  form.unsettledAmount = 0
  form.fabricId = ''
  form.fabricName = ''
  form.unitPrice = 0
  form.firstWeight = 0
  form.lastWeight = 0
  form.netWeight = 0
  weighingRows.value = []
  rows.value = [makeRow()]
}

const clearDraft = () => {
  removeItem(DRAFT_STORAGE_KEY.value)
  removeItem('draft_bill')
}

const prepareBlankEditor = () => {
  resetEditor()
  clearDraft()
}

const handleClearEditor = () => {
  prepareBlankEditor()
  showToast('开单页面已清空')
}

watch([isEditing, currentRecord], ([editing, record]) => {
  if (editing) {
    if (record) fillForm(record)
    return
  }

  resetEditor()
  clearDraft()
}, { immediate: true })

// 深度监听 rows 数组变化，确保计算属性能正确响应
watch(rows, () => {
  // 触发 rowViews 计算属性重新计算
  rowViews.value.forEach(() => {})
}, { deep: true })

watch(() => form.partnerName, syncPartnerSelection)
watch(() => form.partnerId, refreshRowPricesForPartner)

const rowViews = computed(() => {
  return rows.value.map((row) => {
    if (!row) {
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        fabricId: '',
        fabricName: '',
        quantityInput: '',
        quantity: 0,
        unitPrice: 0,
        note: '',
        fabric: null,
        unit: '斤',
        amount: 0
      }
    }

    const fabric = fabrics.value.find((item) => item.id === row.fabricId)
    const quantity = parseWeightExpression(row.quantityInput ?? row.quantity)
    const unitPrice = Number(row.unitPrice || 0)
    const amount = multiplyMoney(quantity, unitPrice)

    return {
      ...row,
      fabric,
      fabricName: row.fabricName || fabric?.name || '',
      unit: '斤',
      quantity,
      quantityInput: String(row.quantityInput ?? row.quantity ?? ''),
      unitPrice,
      amount,
    }
  })
})

const manualItemRows = computed(() => {
  return rowViews.value.filter((item) => item.fabricName?.trim() || item.quantity > 0 || Number(item.unitPrice) > 0)
})

const weighingItemViews = computed(() => {
  const primary = {
    id: 'primary-weighing',
    fabricId: form.fabricId,
    fabricName: form.fabricName,
    unitPrice: Number(form.unitPrice || 0),
    firstWeight: Number(form.firstWeight || 0),
    lastWeight: Number(form.lastWeight || 0),
  }
  return [primary, ...weighingRows.value].map((row) => {
    const fabric = fabrics.value.find((item) => item.id === row.fabricId)
    const quantity = getWeighingJin(row)
    const unitPrice = Number(row.unitPrice || 0)
    return {
      ...row,
      fabric,
      fabricName: row.fabricName || fabric?.name || '',
      quantity,
      quantityInput: formatJinInput(quantity),
      unit: '斤',
      amount: multiplyMoney(quantity, unitPrice),
    }
  })
})

const effectiveWeighingRows = computed(() => {
  return weighingItemViews.value.filter((item) => item.fabricName?.trim() || item.quantity > 0 || Number(item.unitPrice) > 0)
})

const totalWeight = computed(() => {
  return [...manualItemRows.value, ...effectiveWeighingRows.value].reduce((sum, row) => {
    const safeQuantity = isNaN(row.quantity) ? 0 : row.quantity
    return sum + safeQuantity
  }, 0)
})

const totalAmount = computed(() => {
  const safeAmounts = [...manualItemRows.value, ...effectiveWeighingRows.value].map(row => {
    return isNaN(row.amount) ? 0 : row.amount
  })
  return roundAmount(addMoney(safeAmounts))
})

const primaryAmount = computed(() => {
  return multiplyMoney(primaryNetWeightJin.value, Number(form.unitPrice || 0))
})
const weighingTotalAmount = computed(() => {
  return addMoney([
    primaryAmount.value,
    ...weighingRows.value.map((row) => getWeighingAmount(row)),
  ])
})
// 未结金额计算 - 支持手动输入
const unsettledAmount = computed({
  get() {
    // 如果用户手动输入了未结金额，直接返回输入值
    if (form.unsettledAmount > 0) {
      return Math.max(form.unsettledAmount, 0)
    }
    // 否则自动计算
    return Math.max(addMoney([totalAmount.value, -Number(form.settlementAmount || 0)]), 0)
  },
  set(value) {
    form.unsettledAmount = Math.max(Number(value || 0), 0)
    // 根据未结金额自动计算已付款/已收款金额
    if (totalAmount.value > 0) {
      form.settlementAmount = Math.max(addMoney([totalAmount.value, -form.unsettledAmount]), 0)
    }
  }
})

const setDetailFabricSelectRef = (rowId, element) => {
  if (element) {
    detailFabricSelectRefs.value[rowId] = element
    return
  }
  delete detailFabricSelectRefs.value[rowId]
}

const focusDetailFabricField = async (rowId) => {
  await nextTick()
  const target = detailFabricSelectRefs.value[rowId]
  if (!target) {
    detailPanelRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    return
  }
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest',
  })
  // 这里控制“添加明细”后是否自动聚焦到新品种下拉框。
  // 如果后续不想自动弹出下拉，直接把下一行 target.focus() 注释掉即可。
  // target.focus()
}

const addRow = () => {
  const row = makeRow()
  rows.value.push(row)
  return row.id
}

const handleAddDetail = async () => {
  const rowId = addRow()
  await focusDetailFabricField(rowId)
}

const removeWeighingDetail = (index) => {
  weighingRows.value.splice(index, 1)
}

const removeRow = (index) => {
  if (rows.value.length <= 1) {
    showToast('至少保留一行')
    return
  }
  rows.value.splice(index, 1)
}

const saveBill = async () => {
  // 验证必填项
  if (!form.partnerName.trim()) {
    showToast(`请输入${partnerLabel.value}名称`)
    return
  }

  if (!manualItemRows.value.length && !effectiveWeighingRows.value.length) {
    showToast('请至少录入一条过磅货物或单独计重货物')
    return
  }

  for (let i = 0; i < effectiveWeighingRows.value.length; i++) {
    const row = effectiveWeighingRows.value[i]

    if (!row.fabricId) {
      showToast(`过磅货物第${i + 1}行：请选择品种`)
      return
    }

    if (!row.quantity) {
      showToast(`过磅货物第${i + 1}行：请输入过磅总重量和车皮重量`)
      return
    }

    if (!row.unitPrice) {
      showToast(`过磅货物第${i + 1}行：请输入单价`)
      return
    }
  }

  for (let i = 0; i < manualItemRows.value.length; i++) {
    const row = manualItemRows.value[i]
    const quantity = Number(row.quantity || 0)

    if (!row.fabricId) {
      showToast(`单独计重第${i + 1}行：请选择品种`)
      return
    }

    if (!quantity) {
      showToast(`单独计重第${i + 1}行：请输入重量`)
      return
    }

    if (!row.unitPrice) {
      showToast(`单独计重第${i + 1}行：请输入单价`)
      return
    }
  }

  saving.value = true
  try {
    const partnerName = form.partnerName.trim()
    if (!form.partnerId && partnerName) {
      const matched = customerStore.customers.find((item) => String(item.name || '').trim() === partnerName)
      if (matched?.id) {
        form.partnerId = matched.id
      } else {
        const createdCustomer = await customerStore.addCustomer({
          name: partnerName,
          contact: '',
          phone: '',
          status: 'active',
        })
        form.partnerId = createdCustomer?.id || ''
      }
    }

    const itemRows = [
      ...manualItemRows.value,
      ...effectiveWeighingRows.value.map((row) => ({
        ...row,
        id: `item-${row.id}`,
        source: 'weighing',
        weighingId: row.id,
      })),
    ]
    const payload = {
      type: props.type,
      billNo: isEditing.value ? currentRecord.value.billNo : `B${Date.now()}`,
      billDate: new Date().toISOString().slice(0, 10),
      partnerId: form.partnerId,
      partnerName: form.partnerName,
      note: '',
      status: unsettledAmount.value <= 0 ? 'settled' : 'confirmed',
      items: itemRows.map(row => ({
        id: row.id,
        fabricId: row.fabricId,
        fabricName: row.fabricName,
        quantityInput: row.quantityInput,
        quantity: parseWeightExpression(row.quantityInput ?? row.quantity),
        unitPrice: Number(row.unitPrice || 0),
        source: row.source || '',
        weighingId: row.weighingId || '',
        note: '',
      })),
      details: itemRows.map(row => ({
        id: row.id,
        fabricId: row.fabricId,
        fabricName: row.fabricName,
        quantityInput: row.quantityInput,
        quantity: parseWeightExpression(row.quantityInput ?? row.quantity),
        unitPrice: Number(row.unitPrice || 0),
        source: row.source || '',
        weighingId: row.weighingId || '',
        note: '',
      })),
      totalWeight: totalWeight.value,
      totalAmount: totalAmount.value,
      paidAmount: props.type === 'purchase' ? form.settlementAmount : 0,
      receivedAmount: props.type === 'sale' ? form.settlementAmount : 0,
      unsettledAmount: unsettledAmount.value,
      firstWeight: form.firstWeight,
      lastWeight: form.lastWeight,
      netWeight: form.netWeight,
      weighingDetails: effectiveWeighingRows.value.map((row) => ({
        id: row.id,
        fabricId: row.fabricId,
        fabricName: row.fabricName,
        unitPrice: Number(row.unitPrice || 0),
        firstWeight: Number(row.firstWeight || 0),
        lastWeight: Number(row.lastWeight || 0),
        netWeight: getWeighingNet(row),
      })),
    }

    if (isEditing.value) {
      await billRecordStore.updateRecord(currentRecord.value.id, payload)
    } else {
      await billRecordStore.addRecord(payload)
    }

    clearDraft()
    showToast(`保存${props.type === 'purchase' ? '进货' : '出货'}单成功`)

    // 导航到单据列表页面
    if (props.type === 'purchase') {
      router.push('/purchase/list')
    } else {
      router.push('/sale/list')
    }
  } catch (error) {
    console.error('保存单据失败:', error)
    showToast(error.message || '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!isEditing.value) return
  try {
    await billRecordStore.deleteRecord(currentRecord.value.id)
    clearDraft()
    showToast('删除成功')
    router.push(props.type === 'purchase' ? '/purchase/list' : '/sale/list')
  } catch (error) {
    console.error('删除失败:', error)
    showToast(error.message || '删除失败，请重试')
  }
}

const handleFormKeyDown = (event) => {
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    // 可以在这里添加自动聚焦到下一个字段的逻辑
  }
}

watch(() => [route.fullPath, props.type], () => {
  if (!isEditing.value) prepareBlankEditor()
})

const onDataChanged = () => {
  console.log('主数据变化，重新加载')
}

onMounted(async () => {
  // 注册主数据变化事件
  window.addEventListener(MASTER_DATA_CHANGED_EVENT, onDataChanged)

  await Promise.all([
    billRecordStore.init(),
    customerStore.init(),
    fabricStore.init(),
    customerPriceStore.init(),
  ])

  if (!isEditing.value) prepareBlankEditor()
})

const getPreferredUnitPrice = (fabric) => {
  if (!fabric) return 0
  const customerPrice = customerPriceStore.getUnitPrice(form.partnerId, fabric.id, props.type)
  if (customerPrice > 0) return customerPrice
  return Number(isPurchase.value ? fabric.defaultPurchasePrice : fabric.defaultSalePrice) || 0
}

const getPriceSourceText = (row) => {
  if (!row?.fabricId) return '选择品种后自动带价'
  if (customerPriceStore.getUnitPrice(form.partnerId, row.fabricId, props.type) > 0) return '客户专属价'
  return '品种默认价'
}

onUnmounted(() => {
  window.removeEventListener(MASTER_DATA_CHANGED_EVENT, onDataChanged)
})

const buildExportRows = () => {
  return [...effectiveWeighingRows.value, ...manualItemRows.value].filter((item) => {
    if (!item) return false
    return item.fabricName?.trim() || item.quantity > 0 || Number(item.unitPrice) > 0
  })
}

const getExportFileBase = () => {
  const date = new Date().toISOString().slice(0, 10)
  const partnerName = (form.partnerName.trim() || '未命名对象').replace(/[\\/:*?"<>|\s]+/g, '_')
  const typeText = isPurchase.value ? '进货单' : '出货单'
  return `${typeText}_${date}_${partnerName}`
}

const getPartnerContactText = () => {
  const partner = currentPartner.value
  return String(partner?.contact || partner?.contactPerson || '').trim()
}

const buildExportMetaRows = () => {
  const rows = [
    ['单据日期', new Date().toISOString().slice(0, 10)],
  ]
  const partnerName = form.partnerName.trim()
  const contactText = getPartnerContactText()

  if (partnerName) rows.push([`${partnerLabel.value}名称`, partnerName])
  if (contactText) rows.push(['联系人', contactText])

  rows.push(['出货方式', '按重量出货'])

  if (hasWeighing.value) {
    rows.push(
      ['过磅总重量', formatKg(totalFirstWeight.value)],
      ['车皮重量', formatKg(totalLastWeight.value)],
      ['净重量', formatKg(form.netWeight)]
    )
  }

  return rows
}

const loadExcelJS = async () => {
  const module = await import('exceljs')
  return module.default
}

const exportTable = async () => {
  const exportRows = buildExportRows()
  if (!exportRows.length) {
    showToast('暂无可导出的明细数据', 'error')
    return
  }

  try {
    const ExcelJS = await loadExcelJS()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(exportTitle.value)
    const detailRowMeta = []
    const metaRows = buildExportMetaRows()

    worksheet.columns = [
      { key: 'fabric', width: 22 },
      { key: 'quantity', width: 24 },
      { key: 'totalWeight', width: 14 },
      { key: 'unitPrice', width: 14 },
      { key: 'amount', width: 16 },
    ]

    metaRows.forEach((row) => worksheet.addRow(row))
    const headerRow = worksheet.addRow(['品种', '数量 / 重量', '总重量(斤)', '单价(元/斤)', '金额(元)'])

    // 填充数据
    exportRows.forEach((item) => {
      const quantityText = formatExcelWrapText(item.quantityInput || '-', { maxCharsPerLine: 16 })
      const row = worksheet.addRow({
        fabric: item.fabricName || '-',
        quantity: quantityText,
        totalWeight: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        amount: Number(item.amount || 0),
      })

      detailRowMeta.push({
        rowNumber: row.number,
        lineCount: countExcelTextLines(quantityText),
      })
    })

    const totalWeightRow = worksheet.addRow(['总重量', '', Number(totalWeight.value || 0), '', ''])
    const totalAmountRow = worksheet.addRow(['总金额', '', '', '', Number(totalAmount.value || 0)])

    // 格式化列
    worksheet.getColumn('C').numFmt = '0.00'
    worksheet.getColumn('D').numFmt = '¥#,##0.00'
    worksheet.getColumn('E').numFmt = '¥#,##0.00'

    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF409EFF' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // 设置基本信息加粗
    for (let i = 1; i <= metaRows.length; i++) {
      const cell = worksheet.getCell(`A${i}`)
      cell.font = { bold: true }
    }

    // 设置数据行样式
    detailRowMeta.forEach(({ rowNumber, lineCount }, index) => {
      const row = worksheet.getRow(rowNumber)
      row.alignment = { vertical: 'middle', horizontal: 'left' }
      row.getCell('B').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      row.height = getExcelWrappedRowHeight(lineCount)
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FBFF' }
          }
        })
      }
    })

    // 合并总重量行的单元格并设置样式
    worksheet.mergeCells(`A${totalWeightRow.number}:B${totalWeightRow.number}`)
    totalWeightRow.getCell('A').value = '总重量'
    totalWeightRow.getCell('A').font = { bold: true, size: 12 }
    totalWeightRow.getCell('A').alignment = { vertical: 'middle', horizontal: 'center' }
    totalWeightRow.getCell('A').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    }
    totalWeightRow.getCell('C').font = { bold: true, size: 12 }
    totalWeightRow.getCell('C').alignment = { vertical: 'middle', horizontal: 'right' }
    totalWeightRow.getCell('C').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    }

    // 合并总金额行的单元格并设置样式
    worksheet.mergeCells(`A${totalAmountRow.number}:D${totalAmountRow.number}`)
    totalAmountRow.getCell('A').value = '总金额'
    totalAmountRow.getCell('A').font = { bold: true, size: 12 }
    totalAmountRow.getCell('A').alignment = { vertical: 'middle', horizontal: 'center' }
    totalAmountRow.getCell('A').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    }
    totalAmountRow.getCell('E').font = { bold: true, size: 12 }
    totalAmountRow.getCell('E').alignment = { vertical: 'middle', horizontal: 'right' }
    totalAmountRow.getCell('E').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F7FF' }
    }

    // 设置边框
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        }
      })
    })

    // 导出
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${getExportFileBase()}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)

    showToast('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    showToast('导出失败，请重试')
  }
}

const exportImage = () => {
  const exportRows = buildExportRows()
  if (!exportRows.length) {
    showToast('暂无可导出的明细数据', 'error')
    return
  }

  const canvas = document.createElement('canvas')
  const width = 1400
  const rowBaseHeight = 42
  const rowLineHeight = 22
  const footerHeight = 150

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    showToast('导出图片失败，请重试', 'error')
    return
  }

  const tableLeft = 48
  const columns = createCanvasTableColumns(tableLeft, [
    { key: 'fabricName', label: '品种', width: 180 },
    { key: 'quantityText', label: '数量 / 重量', width: 360 },
    { key: 'totalWeight', label: '总重量(斤)', width: 170, align: 'center' },
    { key: 'unitPrice', label: '单价(元/斤)', width: 170, align: 'center' },
    { key: 'amount', label: '金额(元)', width: 210, align: 'center' },
  ])
  const tableWidth = getCanvasTableWidth(columns)
  const metaRows = buildExportMetaRows()
  const metaStartY = 148
  const metaLineHeight = 32
  const tableTop = metaStartY + metaRows.length * metaLineHeight + 28

  ctx.font = '16px "SimSun", serif'
  const preparedRows = exportRows.map((item) => {
    if (!item) {
      return {
        rowData: {
          fabricName: '-',
          quantityText: '-',
          totalWeight: '0.00',
          unitPrice: '0.00',
          amount: 0
        },
        wrappedFabricLines: ['-'],
        wrappedQuantityLines: ['-'],
        rowHeight: rowBaseHeight
      }
    }

    const rowData = {
      fabricName: item.fabricName || '-',
      quantityText: item.quantityInput || '-',
      totalWeight: Number(item.quantity || 0).toFixed(2),
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      amount: item.amount || 0,
    }

    const wrappedFabricLines = wrapCanvasText(ctx, rowData.fabricName, columns[0].width - 20)
    const wrappedQuantityLines = wrapCanvasText(ctx, rowData.quantityText, columns[1].width - 20)
    const rowHeight = getCanvasWrappedRowHeight(
      Math.max(wrappedFabricLines.length, wrappedQuantityLines.length),
      { minHeight: rowBaseHeight, lineHeight: rowLineHeight }
    )

    return {
      rowData,
      wrappedFabricLines,
      wrappedQuantityLines,
      rowHeight,
    }
  })

  const totalTableHeight = preparedRows.reduce((sum, item) => sum + item.rowHeight, 0) + rowBaseHeight
  const canvasHeight = tableTop + totalTableHeight + footerHeight

  canvas.width = width
  canvas.height = canvasHeight

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, canvasHeight)

  const exportBrandName = getExportImageBrandName()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#1f3852'
  ctx.font = 'bold 32px "SimSun", serif'
  ctx.fillText(exportBrandName, width / 2, 48)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#1f3852'
  ctx.font = 'bold 34px "SimSun", serif'
  ctx.fillText(exportTitle.value, 48, 92)
  ctx.font = '22px "SimSun", serif'
  ctx.fillStyle = '#4e6b86'
  metaRows.forEach(([label, value], index) => {
    ctx.fillText(`${label}：${value}`, 48, metaStartY + index * metaLineHeight)
  })

  ctx.fillStyle = '#f2f7fc'
  ctx.fillRect(tableLeft, tableTop, tableWidth, rowBaseHeight)

  let currentY = tableTop + rowBaseHeight
  preparedRows.forEach((item, index) => {
    if (index % 2 === 0) {
      ctx.fillStyle = '#f8fbff'
      ctx.fillRect(tableLeft, currentY, tableWidth, item.rowHeight)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(tableLeft, currentY, tableWidth, item.rowHeight)
    }

    currentY += item.rowHeight
  })

  drawCanvasTableGrid(ctx, {
    columns,
    tableTop,
    headerHeight: rowBaseHeight,
    rowHeights: preparedRows.map((item) => item.rowHeight),
  })

  ctx.font = 'bold 18px "SimSun", serif'
  ctx.fillStyle = '#2f506d'
  columns.forEach((col) => {
    if (col.align === 'center') {
      ctx.textAlign = 'center'
      ctx.fillText(col.label, col.left + col.width / 2, tableTop + 27)
      ctx.textAlign = 'left'
      return
    }

    ctx.fillText(col.label, col.left + col.paddingX, tableTop + 27)
  })

  ctx.font = '16px "SimSun", serif'
  currentY = tableTop + rowBaseHeight
  preparedRows.forEach((item) => {
    const fabricTextY = getCanvasBlockStartY(currentY, item.rowHeight, item.wrappedFabricLines.length, rowLineHeight)
    const quantityTextY = getCanvasBlockStartY(currentY, item.rowHeight, item.wrappedQuantityLines.length, rowLineHeight)
    const numericTextY = getCanvasCenterTextY(currentY, item.rowHeight)

    ctx.fillStyle = '#234462'
    columns.forEach((col) => {
      let textToDraw = String(item.rowData[col.key] || '-')

      if (col.key === 'totalWeight' || col.key === 'unitPrice') {
        textToDraw = Number(textToDraw || 0).toFixed(2)
      } else if (col.key === 'amount') {
        textToDraw = formatMoney(Number(textToDraw || 0))
      }

      if (col.key === 'fabricName') {
        item.wrappedFabricLines.forEach((line, lineIndex) => {
          ctx.fillText(line, col.left + col.paddingX, fabricTextY + lineIndex * rowLineHeight)
        })
      } else if (col.key === 'quantityText') {
        item.wrappedQuantityLines.forEach((line, lineIndex) => {
          ctx.fillText(line, col.left + col.paddingX, quantityTextY + lineIndex * rowLineHeight)
        })
      } else {
        ctx.textAlign = 'center'
        ctx.fillText(textToDraw, col.left + col.width / 2, numericTextY)
        ctx.textAlign = 'left'
      }
    })

    currentY += item.rowHeight
  })

  // 表格底部添加总重量和总金额
  currentY += rowBaseHeight

  // 绘制总重量和总金额在表格底部，整体靠左
  currentY += rowBaseHeight

  ctx.font = 'bold 18px "SimSun", serif'
  ctx.textAlign = 'left'

  // 先计算总重量文本宽度
  ctx.fillStyle = '#000000'
  const weightText = `总重量：${totalWeight.value.toFixed(2)} 斤`
  const weightWidth = ctx.measureText(weightText).width

  // 绘制总重量
  ctx.fillText(weightText, tableLeft + 40, currentY + 30)

  // 绘制总金额，在总重量右侧有适当间距
  ctx.fillStyle = '#000000'
  ctx.fillText(`总金额：${formatMoney(totalAmount.value)}`, tableLeft + 40 + weightWidth + 80, currentY + 30)

  ctx.textAlign = 'left'

  const link = document.createElement('a')
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('导出图片失败，请重试', 'error')
      return
    }
    link.href = URL.createObjectURL(blob)
    link.download = `${getExportFileBase()}.png`
    link.click()
    URL.revokeObjectURL(link.href)
    showToast('图片已开始下载', 'success')
  }, 'image/png')
}

</script>

<template>
  <section class="order-editor" :class="pageClass" :key="`${props.type}-${recordId || 'create'}`">
    <header class="hero panel">
      <div>
        <p class="eyebrow">{{ isPurchase ? '采购录单' : '销售录单' }}</p>
        <h2>{{ pageTitle }}</h2>
        <span class="desc">{{ isPurchase ? '用于记录我方向往来对象进货的单据' : '用于记录我方向往来对象出货的单据' }}</span>
      </div>
    </header>

    <section class="panel form-panel">
      <div class="panel-title-row">
        <h3 class="title-with-icon">
          <AppIcon name="receipt" size="18" />
          <span>单据信息</span>
        </h3>
      </div>
      <div class="base-grid">
        <label class="field full-span">
          <span>{{ partnerLabel }}</span>
          <input
            v-model.trim="form.partnerName"
            list="partner-options"
            type="text"
            autocomplete="off"
            placeholder="可直接填写，也可从已有对象中选择"
            @change="syncPartnerSelection"
            @blur="syncPartnerSelection"
          />
          <datalist id="partner-options">
            <option v-for="item in partners" :key="item.id" :value="item.name">
              {{ item.contact || item.contactPerson || '' }} {{ item.phone || '' }}
            </option>
          </datalist>
        </label>

      </div>
    </section>

    <section ref="detailPanelRef" class="panel detail-panel">
      <div class="panel-title-row">
        <h3 class="title-with-icon">
          <AppIcon name="layers" size="18" />
          <span>单独计重货物</span>
        </h3>
        <button type="button" class="btn-ghost" @click="handleAddDetail">
          <span class="btn-content">
            <AppIcon name="plus" size="16" />
            <span>添加明细</span>
          </span>
        </button>
      </div>

      <div class="detail-list">
        <article v-for="(rowView, idx) in rowViews" :key="rowView.id" class="detail-item">
          <div class="detail-grid">
            <label class="field">
              <span>品种</span>
              <select
                v-model="rows[idx].fabricId"
                :ref="(element) => setDetailFabricSelectRef(rowView.id, element)"
                @change="selectFabric(rows[idx])"
              >
                <option value="">请选择品种</option>
                <option v-for="item in fabrics" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>{{ quantityLabel }}</span>
              <textarea
                v-model="rows[idx].quantityInput"
                rows="3"
                class="weight-detail-input"
                autocomplete="off"
                placeholder="示例：10+10+10 / 10 10 10 / 10×3"
              ></textarea>
              <small class="field-tip">
                不走过磅的货物填这里，支持多次重量相加和 10×3 自动计算
              </small>
            </label>

            <label class="field">
              <span>{{ priceLabel }}</span>
              <input v-model.number="rows[idx].unitPrice" type="number" min="0" step="0.01" autocomplete="off" />
              <small class="field-tip">{{ getPriceSourceText(rows[idx]) }}</small>
            </label>

            <label class="field readonly-field">
              <span>小计金额</span>
              <input :value="formatMoney(rowView.amount)" type="text" readonly />
            </label>

            <div class="detail-actions full-span">
              <button type="button" class="btn-text danger" @click="removeRow(idx)">
                <span class="btn-content">
                  <AppIcon name="trash" size="16" />
                  <span>删除</span>
                </span>
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="panel weighing-panel weighing-card">
      <div class="panel-title-row">
        <h3 class="title-with-icon">
          <AppIcon name="scale" size="18" />
          <span>过磅信息</span>
        </h3>
      </div>
      <div class="weighing-grid">
        <label class="field">
          <span>过磅品种</span>
          <select
            v-if="primaryRow"
            v-model="primaryRow.fabricId"
            @change="selectPrimaryFabric"
          >
            <option value="">请选择品种</option>
            <option v-for="item in fabrics" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>{{ priceLabel }}（元/斤）</span>
          <input
            v-if="primaryRow"
            v-model.number="primaryRow.unitPrice"
            type="number"
            min="0"
            step="0.01"
            autocomplete="off"
          />
          <small v-if="primaryRow" class="field-tip">{{ getPriceSourceText(primaryRow) }}</small>
        </label>
        <label class="field">
          <span>过磅总重量（公斤）</span>
          <input
            v-model.number="form.firstWeight"
            type="number"
            min="0"
            step="0.01"
            autocomplete="off"
          />
        </label>
        <label class="field">
          <span>车皮重量（公斤）</span>
          <input
            v-model.number="form.lastWeight"
            type="number"
            min="0"
            step="0.01"
            autocomplete="off"
          />
        </label>
        <label class="field readonly-field">
          <span>主磅净重（公斤）</span>
          <input :value="formatKg(primaryNetWeight)" type="text" readonly />
        </label>
        <label class="field readonly-field">
          <span>结算总重量（斤）</span>
          <input :value="`${netWeightJin.toFixed(2)} 斤`" type="text" readonly />
        </label>
        <label class="field readonly-field amount-field">
          <span>过磅总金额</span>
          <input :value="formatMoney(weighingTotalAmount)" type="text" readonly />
        </label>
      </div>
      <div v-if="weighingRows.length" class="weighing-detail-list">
        <article v-for="(row, index) in weighingRows" :key="row.id" class="weighing-detail-row">
          <div class="weighing-detail-index">过磅明细 #{{ index + 1 }}</div>
          <label class="field">
            <span>品种</span>
            <select v-model="row.fabricId" @change="selectWeighingFabric(row)">
              <option value="">请选择品种</option>
              <option v-for="item in fabrics" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>{{ priceLabel }}（元/斤）</span>
            <input v-model.number="row.unitPrice" type="number" min="0" step="0.01" autocomplete="off" />
          </label>
          <label class="field">
            <span>过磅总重量（公斤）</span>
            <input v-model.number="row.firstWeight" type="number" min="0" step="0.01" autocomplete="off" />
          </label>
          <label class="field">
            <span>车皮重量（公斤）</span>
            <input v-model.number="row.lastWeight" type="number" min="0" step="0.01" autocomplete="off" />
          </label>
          <label class="field readonly-field">
            <span>净重量（公斤）</span>
            <input :value="formatKg(getWeighingNet(row))" type="text" readonly />
          </label>
          <label class="field readonly-field amount-field">
            <span>金额</span>
            <input :value="formatMoney(getWeighingAmount(row))" type="text" readonly />
          </label>
          <button type="button" class="btn-text danger weighing-remove-btn" @click="removeWeighingDetail(index)">删除</button>
        </article>
      </div>
      <div class="single-weight-tip">
        <strong>一车货统一开单</strong>
        <span>过磅货物在这里按品种、单价和净重计算；不走过磅的货物请在“单独计重货物”里录入，系统统一汇总重量和金额。</span>
      </div>
    </section>

    <footer class="settlement-bar panel">
      <div class="settlement-summary">
        <div>
          <span>{{ totalWeightLabel }}</span>
          <strong>{{ totalWeight.toFixed(2) }} 斤</strong>
        </div>
        <div>
          <span>合计金额</span>
          <strong>{{ formatMoney(totalAmount) }}</strong>
        </div>
        <div>
          <span>{{ settlementLabel }}（元）</span>
          <input
            v-model.number="form.settlementAmount"
            class="settlement-input"
            type="number"
            min="0"
            step="0.01"
            autocomplete="off"
          />
        </div>
        <div>
          <span>未付金额（元）</span>
          <input
            v-model.number="unsettledAmount"
            class="settlement-input"
            type="number"
            min="0"
            step="0.01"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="actions action-toolbar">
        <button type="button" class="btn-tag add-detail-tag" @click="handleAddDetail">
          <span class="btn-content">
            <AppIcon name="plus" size="16" />
            <span>添加明细</span>
          </span>
        </button>
        <button type="button" class="btn-ghost" @click="handleClearEditor">
          <span class="btn-content">
            <AppIcon name="trash" size="16" />
            <span>清空页面</span>
          </span>
        </button>
        <button type="button" class="btn-ghost" @click="exportTable">
          <span class="btn-content">
            <AppIcon name="table" size="16" />
            <span>导出表格</span>
          </span>
        </button>
        <button type="button" class="btn-ghost" @click="exportImage">
          <span class="btn-content">
            <AppIcon name="image" size="16" />
            <span>导出图片</span>
          </span>
        </button>
        <button type="button" class="btn-primary" :disabled="saving" @click="saveBill">
          <span class="btn-content">
            <AppIcon name="check" size="16" />
            <span>提交单据</span>
          </span>
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.order-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: stretch;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.hero h2 {
  margin: 0;
  font-size: 32px;
}
.desc {
  display: inline-block;
  margin-top: 8px;
  color: var(--text-muted);
}
.form-panel,
.detail-panel,
.weighing-panel,
.settlement-bar {
  padding: 24px;
}
.purchase-theme {
  --weighing-accent: #167c63;
  --weighing-accent-strong: #0f654f;
  --weighing-accent-soft: rgba(35, 180, 140, 0.12);
  --weighing-accent-line: rgba(35, 120, 98, 0.2);
  --weighing-card-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(235, 248, 244, 0.92));
  --weighing-shadow: rgba(35, 120, 98, 0.1);
}
.sale-theme {
  --weighing-accent: #c65a19;
  --weighing-accent-strong: #a94710;
  --weighing-accent-soft: rgba(240, 143, 45, 0.13);
  --weighing-accent-line: rgba(198, 90, 25, 0.22);
  --weighing-card-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 244, 232, 0.92));
  --weighing-shadow: rgba(198, 90, 25, 0.11);
}
.weighing-card {
  border: 1px solid var(--weighing-accent-line);
  background: var(--weighing-card-bg);
  box-shadow: 0 18px 42px var(--weighing-shadow);
}
.weighing-card .panel-title-row {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--weighing-accent-line);
}
.weighing-card .title-with-icon {
  color: var(--weighing-accent-strong);
}
.weighing-card .field input:focus,
.weighing-card .field select:focus,
.weighing-card .field textarea:focus {
  border-color: var(--weighing-accent);
  box-shadow: 0 0 0 4px var(--weighing-accent-soft);
}
.panel-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.panel-title-row h3 {
  margin: 0;
  font-size: 20px;
}
.title-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.base-grid,
.detail-grid,
.weighing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.weighing-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field span {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
}
.field-tip {
  font-size: 12px;
  color: var(--text-muted);
}
.field input,
.field select,
.field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.field textarea.weight-detail-input {
  min-height: 96px;
  line-height: 1.55;
  resize: vertical;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: rgba(35, 120, 98, 0.55);
  box-shadow: 0 0 0 4px rgba(35, 120, 98, 0.08);
}
.full-span {
  grid-column: 1 / -1;
}

.amount-field input {
  color: var(--weighing-accent-strong);
}
.weighing-detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
.weighing-detail-row {
  display: grid;
  grid-template-columns: 130px repeat(4, minmax(0, 1fr)) auto;
  gap: 12px;
  align-items: end;
  padding: 14px;
  border: 1px solid var(--weighing-accent-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.52);
}
.weighing-detail-index {
  align-self: center;
  color: var(--weighing-accent-strong);
  font-weight: 700;
}
.weighing-remove-btn {
  align-self: end;
  min-height: 44px;
  padding-inline: 14px;
}
.single-weight-tip {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--weighing-accent-line);
  border-radius: 14px;
  background: var(--weighing-accent-soft);
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}
.single-weight-tip strong {
  flex: 0 0 auto;
  color: var(--weighing-accent-strong);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.detail-item {
  border: 1px solid var(--panel-line);
  border-radius: 18px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.55);
}
.detail-actions {
  display: flex;
  justify-content: flex-end;
}
.settlement-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.settlement-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 16px;
  flex: 1;
}
.settlement-summary div {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.settlement-summary span {
  color: var(--text-muted);
  font-size: 12px;
}
.settlement-summary strong {
  font-size: 20px;
}
.settlement-input {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 0 10px;
  color: var(--text-normal);
  font-size: 18px;
  font-weight: 700;
  outline: none;
}
.settlement-input:focus {
  border-color: rgba(35, 120, 98, 0.55);
  box-shadow: 0 0 0 4px rgba(35, 120, 98, 0.08);
}
.actions {
  display: flex;
  gap: 12px;
}
.action-toolbar {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn-primary,
.btn-ghost,
.btn-tag,
.btn-text {
  border: none;
  border-radius: 14px;
  padding: 12px 20px;
  font-weight: 700;
  cursor: pointer;
}
.btn-primary {
  color: #fff;
}
.purchase-theme .btn-primary {
  background: linear-gradient(135deg, #167c63, #23b48c);
}
.sale-theme .btn-primary {
  background: linear-gradient(135deg, #c65a19, #f08f2d);
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--panel-line);
  color: var(--text-normal);
}
.btn-tag {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-normal);
}
.btn-text {
  background: transparent;
  color: var(--text-normal);
}
.btn-text.danger {
  color: #d24d57;
}
.add-detail-tag {
  margin-right: auto;
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(20, 31, 58, 0.08);
}
.purchase-theme .add-detail-tag {
  border-color: rgba(35, 120, 98, 0.2);
  background: rgba(35, 180, 140, 0.1);
  color: #167c63;
}
.sale-theme .add-detail-tag {
  border-color: rgba(198, 90, 25, 0.2);
  background: rgba(240, 143, 45, 0.12);
  color: #a94710;
}
.add-detail-tag:hover {
  transform: translateY(-1px);
}
.btn-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.purchase-theme .hero {
  background: linear-gradient(135deg, rgba(22, 124, 99, 0.12), rgba(35, 180, 140, 0.08));
}
.sale-theme .hero {
  background: linear-gradient(135deg, rgba(198, 90, 25, 0.12), rgba(240, 143, 45, 0.08));
}
.readonly-field input {
  color: var(--text-normal);
  font-weight: 700;
}
@media (max-width: 1100px) {
  .hero,
  .settlement-bar {
    flex-direction: column;
  }
  .settlement-summary,
  .base-grid,
  .detail-grid,
  .weighing-grid {
    grid-template-columns: 1fr;
  }
  .weighing-detail-row {
    grid-template-columns: 1fr;
  }
  .weighing-remove-btn {
    width: 100%;
  }
  .single-weight-tip {
    align-items: flex-start;
    flex-direction: column;
  }
  .action-toolbar {
    width: 100%;
    justify-content: stretch;
  }
  .add-detail-tag {
    margin-right: 0;
  }
  .action-toolbar button {
    flex: 1 1 calc(50% - 6px);
  }
}

@media (max-width: 768px) {
  .order-editor {
    gap: 16px;
  }

  .hero {
    padding: 20px !important;
    flex-direction: column;
    text-align: center;
  }

  .hero h2 {
    font-size: 26px;
  }

  .form-panel,
  .detail-panel,
  .weighing-panel,
  .settlement-bar {
    padding: 18px !important;
  }

  .panel-title-row {
    margin-bottom: 16px;
  }

  .panel-title-row h3 {
    font-size: 20px;
  }

  .field input,
  .field select,
  .field textarea {
    min-height: 46px;
    height: 46px;
    font-size: 16px;
    padding: 12px 14px;
  }

  .field textarea,
  .field textarea.weight-detail-input {
    height: auto;
    min-height: 112px;
  }

  .detail-item {
    padding: 14px;
  }

  .detail-actions .btn-text {
    width: 100%;
    min-height: 42px;
  }

  .settlement-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }

  .settlement-summary div {
    padding: 12px;
  }

  .settlement-summary strong {
    font-size: 18px;
    word-break: break-word;
  }

  .actions,
  .action-toolbar {
    width: 100%;
    gap: 10px;
  }

  .action-toolbar button,
  .actions button {
    flex: 1 1 calc(50% - 5px);
    min-height: 44px;
    padding: 10px 12px;
  }
}

@media (max-width: 480px) {
  .order-editor {
    gap: 12px;
  }

  .hero {
    padding: 16px !important;
    text-align: left;
  }

  .hero h2 {
    font-size: 23px;
  }

  .desc {
    line-height: 1.55;
  }

  .settlement-summary {
    grid-template-columns: 1fr;
  }

  .panel-title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .form-panel,
  .detail-panel,
  .weighing-panel,
  .settlement-bar {
    padding: 14px !important;
  }

  .action-toolbar button,
  .actions button {
    flex-basis: 100%;
  }

  .btn-content {
    justify-content: center;
    width: 100%;
  }
}
</style>
