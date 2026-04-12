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

// 深度监听 rows 数组变化，确保计算属性能正确响应
watch(rows, () => {
  // 触发 rowViews 计算属性重新计算
  rowViews.value.forEach(() => {})
}, { deep: true })

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

const totalWeight = computed(() => {
  return rowViews.value.reduce((sum, row) => {
    const safeQuantity = isNaN(row.quantity) ? 0 : row.quantity
    return sum + safeQuantity
  }, 0)
})

const totalAmount = computed(() => {
  const safeAmounts = rowViews.value.map(row => {
    return isNaN(row.amount) ? 0 : row.amount
  })
  return addMoney(safeAmounts)
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

const buildExportRows = () => {
  return rowViews.value.filter((item) => {
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

    // 添加单据基本信息
    worksheet.addRow(['单据类型', isPurchase.value ? '进货单' : '出货单'])
    worksheet.addRow(['单据日期', new Date().toISOString().slice(0, 10)])
    worksheet.addRow([partnerLabel.value, form.partnerName.trim() || '-'])
    worksheet.addRow(['备注', form.note.trim() || '-'])
    worksheet.addRow(['出货方式', '按重量出货'])
    worksheet.addRow([])

    // 添加表头
    worksheet.columns = [
      { header: '布料', key: 'fabric', width: 20 },
      { header: '数量 / 重量', key: 'quantity', width: 24 },
      { header: '总重量(斤)', key: 'totalWeight', width: 14 },
      { header: '单价(元/斤)', key: 'unitPrice', width: 14 },
      { header: '金额(元)', key: 'amount', width: 16 },
      { header: '备注', key: 'note', width: 20 },
    ]

    // 填充数据
    exportRows.forEach((item) => {
      worksheet.addRow({
        fabric: item.fabricName || '-',
        quantity: item.quantityInput || '-',
        totalWeight: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        amount: Number(item.amount || 0),
        note: item.note || '-',
      })
    })

    // 添加总重量行
    worksheet.addRow(['总重量', '', Number(totalWeight.value || 0), '', '', ''])
    // 添加总金额行
    worksheet.addRow(['总金额', '', '', '', Number(totalAmount.value || 0), ''])

    // 格式化列
    worksheet.getColumn('C').numFmt = '0.00'
    worksheet.getColumn('D').numFmt = '¥#,##0.00'
    worksheet.getColumn('E').numFmt = '¥#,##0.00'

    // 设置表头样式
    const headerRow = worksheet.getRow(7)
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF409EFF' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // 设置基本信息加粗
    for (let i = 1; i <= 5; i++) {
      const cell = worksheet.getCell(`A${i}`)
      cell.font = { bold: true }
    }

    // 设置数据行样式
    for (let i = 8; i <= worksheet.rowCount - 2; i++) {
      const row = worksheet.getRow(i)
      row.alignment = { vertical: 'middle', horizontal: 'left' }
      // 交替行颜色
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAFAFA' }
          }
        })
      }
    }

    // 设置总重量和总金额行样式
    const totalWeightRow = worksheet.getRow(worksheet.rowCount - 1)
    const totalAmountRow = worksheet.getRow(worksheet.rowCount)

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
  const tableLeft = 40
  const tableWidth = 1120
  const rowBaseHeight = 42
  const rowLineHeight = 22
  const footerHeight = 150

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
    { key: 'fabricName', label: '布料', left: 48, width: 180 },
    { key: 'quantityText', label: '数量 / 重量', left: 228, width: 280 },
    { key: 'totalWeight', label: '总重量(斤)', left: 688, width: 160 },
    { key: 'unitPrice', label: '单价(元/斤)', left: 848, width: 160 },
    { key: 'amount', label: '金额(元)', left: 1008, width: 180 },
  ]

  ctx.font = '22px "SimSun", serif'
  const noteLines = getWrappedLines(`备注：${form.note.trim() || '-'}`, width - 96)
  const noteLineHeight = 30
  const noteTop = 200
  const noteHeight = Math.max(noteLineHeight, noteLines.length * noteLineHeight)
  const saleModeText = '出货方式：按重量出货'
  const tableTop = noteTop + noteHeight + 40

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

    const wrappedFabricLines = getWrappedLines(rowData.fabricName, columns[0].width - 20)
    const wrappedQuantityLines = getWrappedLines(rowData.quantityText, columns[1].width - 20)
    const rowHeight = Math.max(rowBaseHeight, 16 + Math.max(wrappedFabricLines.length, wrappedQuantityLines.length) * rowLineHeight)

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

  ctx.fillStyle = '#1f3852'
  ctx.font = 'bold 34px "SimSun", serif'
  ctx.fillText(exportTitle.value, 48, 62)

  ctx.font = '22px "SimSun", serif'
  ctx.fillStyle = '#4e6b86'
  ctx.fillText(`日期：${new Date().toISOString().slice(0, 10)}`, 48, 104)
  ctx.fillText(`${partnerLabel.value}：${form.partnerName.trim() || '-'}`, 48, 136)

  noteLines.forEach((line, index) => {
    ctx.fillText(line, 48, noteTop + index * noteLineHeight)
  })

  ctx.fillText(`出货方式：按重量出货`, 48, noteTop + noteHeight + 22)

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

      if (col.key === 'totalWeight' || col.key === 'unitPrice') {
        textToDraw = Number(textToDraw || 0).toFixed(2)
      } else if (col.key === 'amount') {
        textToDraw = formatMoney(Number(textToDraw || 0))
      }

      if (col.key === 'fabricName') {
        item.wrappedFabricLines.forEach((line, lineIndex) => {
          ctx.fillText(line, col.left + 10, currentY + 14 + lineIndex * rowLineHeight)
        })
      } else if (col.key === 'quantityText') {
        item.wrappedQuantityLines.forEach((line, lineIndex) => {
          ctx.fillText(line, col.left + 10, currentY + 14 + lineIndex * rowLineHeight)
        })
      } else {
        // 数值列居中显示
        ctx.textAlign = 'center'
        const centerX = col.left + col.width / 2
        ctx.fillText(textToDraw, centerX, currentY + 27)
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
  ctx.fillStyle = '#2f506d'
  const weightText = `总重量：${totalWeight.value.toFixed(2)} 斤`
  const weightWidth = ctx.measureText(weightText).width

  // 绘制总重量
  ctx.fillText(weightText, tableLeft + 40, currentY + 30)

  // 绘制总金额，在总重量右侧有适当间距
  ctx.fillStyle = '#c9485b'
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

onUnmounted(() => {
  clearInterval(draftTimer)
})
</script>

<template>
  <section class="order-editor" :class="pageClass">
    <header class="hero panel">
      <div>
        <p class="eyebrow">{{ isPurchase ? '采购录单' : '销售录单' }}</p>
        <h2>{{ pageTitle }}</h2>
        <span class="desc">{{ isPurchase ? '用于记录我方向往来对象进货的单据' : '用于记录我方向往来对象出货的单据' }}</span>
      </div>
      <div class="hero-metrics">
        <div class="metric-card">
          <span>{{ totalWeightLabel }}</span>
          <strong>{{ totalWeight.toFixed(2) }}</strong>
          <small>斤</small>
        </div>
        <div class="metric-card accent">
          <span>{{ amountSummaryLabel }}</span>
          <strong>{{ formatMoney(totalAmount) }}</strong>
          <small>{{ isPurchase ? '应付' : '应收' }}</small>
        </div>
      </div>
    </header>

    <section class="panel form-panel">
      <div class="panel-title-row">
        <h3>单据信息</h3>
      </div>
      <div class="base-grid">
        <label class="field full-span">
          <span>{{ isPurchase ? '供货方' : '收货方' }}</span>
          <input
            v-model.trim="form.partnerName"
            list="partner-options"
            type="text"
            placeholder="可直接填写，也可从已有对象中选择"
            @change="syncPartnerSelection"
            @blur="syncPartnerSelection"
          />
          <datalist id="partner-options">
            <option v-for="item in filteredPartners" :key="item.id" :value="item.name">
              {{ item.contact }} {{ item.phone }}
            </option>
          </datalist>
          <input v-model="partnerKeyword" type="text" placeholder="按名称 / 联系人筛选已有对象" />
        </label>

        <label class="field">
          <span>{{ settlementLabel }}（元）</span>
          <input v-model.number="form.settlementAmount" type="number" min="0" step="0.01" />
        </label>

        <label class="field">
          <span>未结金额（元）</span>
          <input v-model.number="unsettledAmount" type="number" min="0" step="0.01" />
        </label>

        <label class="field full-span">
          <span>备注</span>
          <textarea v-model="form.note" rows="3" placeholder="可填写本次业务说明"></textarea>
        </label>

        <div class="weight-panel">
          <div class="weight-inputs">
            <label class="field">
              <span>初磅 (斤)</span>
              <input v-model.number="form.firstWeight" type="number" step="0.01" placeholder="输入地磅初重" />
            </label>
            <label class="field">
              <span>次磅 (斤)</span>
              <input v-model.number="form.lastWeight" type="number" step="0.01" placeholder="输入地磅次重" />
            </label>
            <label class="field">
              <span>净重 (斤)</span>
              <input :value="netWeight.toFixed(2)" type="text" readonly placeholder="自动计算净重" />
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="panel detail-panel">
      <div class="panel-title-row">
        <h3>货品明细</h3>
        <button type="button" class="btn-ghost" @click="addRow">新增明细</button>
      </div>

      <div class="detail-list">
        <article v-for="(rowView, idx) in rowViews" :key="rowView.id" class="detail-item">
          <div class="detail-grid">
            <label class="field">
              <span>布料</span>
              <select
                v-model="rows[idx].fabricId"
                @change="selectFabric(rows[idx])"
              >
                <option value="">请选择布料</option>
                <option v-for="item in fabrics" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>{{ quantityLabel }}</span>
              <input
                v-model="rows[idx].quantityInput"
                type="text"
                placeholder="示例：10+10+10 / 10 10 10 / 10.10.10 / 10×3"
              />
              <small class="field-tip">
                支持 `10+10+10`、`10 10 10`、`10.10.10`、`10×3` 自动计算
              </small>
            </label>

            <label class="field">
              <span>{{ priceLabel }}</span>
              <input v-model.number="rows[idx].unitPrice" type="number" min="0" step="0.01" />
            </label>

            <label class="field readonly-field">
              <span>小计金额</span>
              <input :value="formatMoney(rowView.amount)" type="text" readonly />
            </label>

            <label class="field full-span">
              <span>明细备注</span>
              <div class="row-note-box">
                <input v-model="rows[idx].note" type="text" placeholder="选填" />
                <button type="button" class="btn-text danger" @click="removeRow(idx)">删除</button>
              </div>
            </label>
          </div>
        </article>
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
          <span>{{ settlementLabel }}</span>
          <strong>{{ formatMoney(form.settlementAmount) }}</strong>
        </div>
        <div>
          <span>未结金额</span>
          <strong>{{ formatMoney(unsettledAmount) }}</strong>
        </div>
      </div>
      <div class="actions action-toolbar">
        <button type="button" class="btn-ghost" @click="addRow">新增明细</button>
        <button type="button" class="btn-ghost" @click="saveDraft">保存草稿</button>
        <button type="button" class="btn-ghost" @click="exportTable">导出表格</button>
        <button type="button" class="btn-ghost" @click="exportImage">导出图片</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="saveBill">提交单据</button>
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
.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(140px, 1fr));
  gap: 14px;
  min-width: 320px;
}
.metric-card {
  border-radius: 18px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.metric-card span,
.metric-card small {
  color: var(--text-muted);
}
.metric-card strong {
  font-size: 28px;
}
.metric-card.accent strong {
  font-size: 24px;
}
.form-panel,
.detail-panel,
.settlement-bar {
  padding: 24px;
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
.base-grid,
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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
  border: 1px solid var(--panel-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
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

.weight-panel {
  background: linear-gradient(135deg, rgba(240, 248, 255, 0.9), rgba(255, 255, 255, 0.9));
  border: 1px solid rgba(144, 202, 249, 0.3);
  border-radius: 16px;
  padding: 18px;
  margin: 14px 0;
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
.row-note-box {
  display: flex;
  gap: 12px;
}
.row-note-box input {
  flex: 1;
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
.btn-text {
  background: transparent;
  color: var(--text-normal);
}
.btn-text.danger {
  color: #d24d57;
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
  .hero-metrics,
  .settlement-summary,
  .base-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .action-toolbar {
    width: 100%;
    justify-content: stretch;
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

  .hero-metrics {
    grid-template-columns: repeat(2, 1fr);
    min-width: 100%;
    gap: 12px;
    margin-top: 16px;
  }

  .metric-card {
    padding: 16px;
  }

  .metric-card strong {
    font-size: 26px;
  }

  .metric-card.accent strong {
    font-size: 22px;
  }

  .form-panel,
  .detail-panel,
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
    height: 46px;
    font-size: 16px;
    padding: 12px 14px;
  }
}
</style>
