<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useFabricStore } from '../../stores/fabric'
import { readJson, writeJson, removeItem } from '../../utils/storage'
import { multiplyMoney, addMoney, formatMoney } from '../../utils/money'
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
const fabricStore = useFabricStore()
const saving = ref(false)
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
const draftText = computed(() => (isPurchase.value ? '进货草稿' : '出货草稿'))
const exportTitle = computed(() => (isPurchase.value ? '进货单据明细' : '出货单据明细'))
const partnerLabel = computed(() => (isPurchase.value ? '供货方' : '收货方'))
const quantityLabel = computed(() => '数量 / 重量')
const totalWeightLabel = computed(() => '总重量')
const amountSummaryLabel = computed(() => (isPurchase.value ? '进货总额' : '出货总额'))

const form = reactive({
  partnerId: '',
  partnerName: '',
  note: '',
  settlementAmount: 0,
  unsettledAmount: 0,
  firstWeight: 0,
  lastWeight: 0,
  netWeight: 0,
})

const netWeight = computed(() => Math.max(Number(form.firstWeight) - Number(form.lastWeight), 0))

watch(netWeight, (value) => {
  form.netWeight = Number(value || 0)
}, { immediate: true })

const partnerKeyword = ref('')

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
    // 支持加法和乘法组合
    let value = 0
    const addParts = normalized.split('+')
    for (const part of addParts) {
      const multiplyParts = part.split('*')
      if (multiplyParts.length === 2) {
        const left = Number(multiplyParts[0])
        const right = Number(multiplyParts[1])
        value += left * right
      } else {
        value += Number(part)
      }
    }
    return value
  } catch (error) {
    console.error('解析重量表达式失败:', error)
    return 0
  }
}

const rows = ref([makeRow()])

const partners = computed(() => customerStore.activeCustomers)
const fabrics = computed(() => fabricStore.activeFabrics)

const filteredPartners = computed(() => {
  const keyword = partnerKeyword.value.trim()
  if (!keyword) return partners.value
  return partners.value.filter((item) => item.name.includes(keyword) || item.contact.includes(keyword) || item.phone.includes(keyword))
})

const selectFabric = (row) => {
  const selected = fabrics.value.find((item) => item.id === row.fabricId)
  row.fabricName = selected?.name || ''
  // 自动填充价格
  if (selected) {
    row.unitPrice = isPurchase.value ? selected.defaultPurchasePrice : selected.defaultSalePrice
  }
}

const syncRowFabric = (row) => {
  const keyword = row.fabricName.trim()
  const matched = fabrics.value.find((item) => item.name === keyword)
  row.fabricId = matched?.id || ''
  // 自动填充价格
  if (matched) {
    row.unitPrice = isPurchase.value ? matched.defaultPurchasePrice : matched.defaultSalePrice
  }
}

const fillForm = (record) => {
  if (!record) return

  form.partnerId = record.partnerId || ''
  form.partnerName = record.partnerName || record.supplier || record.customerName || ''
  form.note = record.note || ''
  form.settlementAmount = Number(isPurchase.value ? record.paidAmount || 0 : record.receivedAmount || 0)
  form.unsettledAmount = Number(record.unsettledAmount ?? 0)
  form.firstWeight = Number(record.firstWeight || 0)
  form.lastWeight = Number(record.lastWeight || 0)
  form.netWeight = Number(record.netWeight || Math.max(form.firstWeight - form.lastWeight, 0))

  if (Array.isArray(record.items) && record.items.length) {
    rows.value = record.items.map((item) => ({
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

watch(currentRecord, (record) => {
  if (!record) return
  fillForm(record)
}, { immediate: true })

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
        quantityInput: '',
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

const totalWeight = computed(() => rowViews.value.reduce((sum, row) => sum + row.quantity, 0))
const totalAmount = computed(() => addMoney(rowViews.value.map((row) => row.amount)))
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

const addRow = () => {
  rows.value.push(makeRow())
}

const removeRow = (index) => {
  if (rows.value.length <= 1) {
    showToast('至少保留一行')
    return
  }
  rows.value.splice(index, 1)
}

const clearDraft = () => {
  removeItem(DRAFT_STORAGE_KEY.value)
}

const getDraftKey = (prefix) => {
  return `draft-${prefix}-${props.type}`
}

const saveDraft = () => {
  const draft = {
    form: {
      partnerId: form.partnerId,
      partnerName: form.partnerName,
      note: form.note,
      settlementAmount: form.settlementAmount,
      unsettledAmount: form.unsettledAmount,
      firstWeight: form.firstWeight,
      lastWeight: form.lastWeight,
      netWeight: form.netWeight,
    },
    rows: rows.value,
  }
  writeJson(DRAFT_STORAGE_KEY.value, draft)
}

const loadDraft = () => {
  const draft = readJson(DRAFT_STORAGE_KEY.value, null)
  if (!draft) return

  if (draft.form) {
    form.partnerId = draft.form.partnerId || ''
    form.partnerName = draft.form.partnerName || ''
    form.note = draft.form.note || ''
    form.settlementAmount = Number(draft.form.settlementAmount || 0)
    form.unsettledAmount = Number(draft.form.unsettledAmount || 0)
    form.firstWeight = Number(draft.form.firstWeight || 0)
    form.lastWeight = Number(draft.form.lastWeight || 0)
    form.netWeight = Number(draft.form.netWeight || 0)
  }

  if (Array.isArray(draft.rows) && draft.rows.length > 0) {
    rows.value = draft.rows
  }
}

const saveBill = async () => {
  // 验证必填项
  if (!form.partnerId) {
    showToast('请选择客户')
    return
  }

  // 验证至少有一行
  if (rows.value.length === 0) {
    showToast('至少添加一行货物')
    return
  }

  // 验证每行必填项
  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i]
    const quantity = parseWeightExpression(row.quantityInput ?? row.quantity)

    if (!row.fabricId) {
      showToast(`第${i + 1}行：请选择布料`)
      return
    }

    if (!quantity) {
      showToast(`第${i + 1}行：请输入数量`)
      return
    }

    if (!row.unitPrice) {
      showToast(`第${i + 1}行：请输入单价`)
      return
    }
  }

  saving.value = true
  try {
    const payload = {
      type: props.type,
      billNo: isEditing.value ? currentRecord.value.billNo : `B${Date.now()}`,
      billDate: new Date().toISOString().slice(0, 10),
      partnerId: form.partnerId,
      partnerName: form.partnerName,
      note: form.note,
      status: unsettledAmount.value <= 0 ? 'settled' : 'confirmed',
      items: rows.value.map(row => ({
        id: row.id,
        fabricId: row.fabricId,
        fabricName: row.fabricName,
        quantityInput: row.quantityInput,
        quantity: parseWeightExpression(row.quantityInput ?? row.quantity),
        unitPrice: Number(row.unitPrice || 0),
        note: row.note,
      })),
      details: rows.value.map(row => ({
        id: row.id,
        fabricId: row.fabricId,
        fabricName: row.fabricName,
        quantityInput: row.quantityInput,
        quantity: parseWeightExpression(row.quantityInput ?? row.quantity),
        unitPrice: Number(row.unitPrice || 0),
        note: row.note,
      })),
      totalWeight,
      totalAmount,
      paidAmount: props.type === 'purchase' ? form.settlementAmount : 0,
      receivedAmount: props.type === 'sale' ? form.settlementAmount : 0,
      unsettledAmount: unsettledAmount.value,
      firstWeight: form.firstWeight,
      lastWeight: form.lastWeight,
      netWeight: form.netWeight,
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
    router.push('/purchase/list')
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

const onDataChanged = () => {
  console.log('主数据变化，重新加载')
}

onMounted(() => {
  // 注册主数据变化事件
  window.addEventListener(MASTER_DATA_CHANGED_EVENT, onDataChanged)

  // 加载草稿
  if (!isEditing.value) {
    loadDraft()
  } else {
    clearDraft()
  }
})

onUnmounted(() => {
  window.removeEventListener(MASTER_DATA_CHANGED_EVENT, onDataChanged)
})

// 自动保存草稿
const draftTimer = setInterval(() => {
  saveDraft()
}, 30000)

onUnmounted(() => {
  clearInterval(draftTimer)
})
</script>
