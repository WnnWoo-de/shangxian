<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useCategoryStore } from '../../stores/category'
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
const categoryStore = useCategoryStore()
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
  categoryId: '',
  categoryName: '',
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

const rows = ref([makeRow()])

const partners = computed(() => customerStore.activeCustomers)
const categories = computed(() => categoryStore.activeCategories)
const fabrics = computed(() => fabricStore.activeFabrics)

const filteredPartners = computed(() => {
  const keyword = partnerKeyword.value.trim()
  if (!keyword) return partners.value
  return partners.value.filter((item) => item.name.includes(keyword) || item.contact.includes(keyword) || item.phone.includes(keyword))
})

const selectCategory = (row) => {
  const selected = categories.value.find((item) => item.id === row.categoryId)
  if (selected) {
    row.categoryName = selected.name
    // 品类变化时，清除布料选择
    row.fabricId = ''
    row.fabricName = ''
    applyCategoryPrice(row)
  } else {
    row.categoryName = ''
    row.fabricId = ''
    row.fabricName = ''
    row.unitPrice = 0
  }
}

const syncRowCategory = (row) => {
  const keyword = row.categoryName.trim()
  const matched = categories.value.find((item) => item.name === keyword)
  row.categoryId = matched?.id || ''
  // 品类变化时，清除布料选择
  row.fabricId = ''
  row.fabricName = ''
  if (matched) applyCategoryPrice(row)
}

const selectFabric = (row) => {
  const selected = getFabricsByCategory(row.categoryId).find((item) => item.id === row.fabricId)
  row.fabricName = selected?.name || ''
}

const syncRowFabric = (row) => {
  const keyword = row.fabricName.trim()
  const matched = getFabricsByCategory(row.categoryId).find((item) => item.name === keyword)
  row.fabricId = matched?.id || ''
}

const getFabricsByCategory = (categoryId) => {
  if (!categoryId) return []
  return fabrics.value.filter((item) => item.categoryId === categoryId)
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
      categoryId: item.categoryId || '',
      categoryName: item.categoryName || '',
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
        categoryId: '',
        categoryName: '',
        fabricId: '',
        fabricName: '',
        quantityInput: '',
        quantity: 0,
        unitPrice: 0,
        note: '',
        category: null,
        fabric: null,
        unit: '斤',
        quantityInput: '',
        amount: 0
      }
    }

    const category = categories.value.find((item) => item.id === row.categoryId)
    const fabric = fabrics.value.find((item) => item.id === row.fabricId)
    const quantity = parseWeightExpression(row.quantityInput ?? row.quantity)
    const unitPrice = Number(row.unitPrice || 0)
    const amount = multiplyMoney(quantity, unitPrice)
    return {
      ...row,
      category,
      fabric,
      categoryName: row.categoryName || category?.name || '',
      fabricName: row.fabricName || fabric?.name || '',
      unit: category?.unit || '斤',
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

const applyCategoryPrice = (row) => {
  const category = categories.value.find((item) => item.id === row.categoryId)
  if (!category) return
  row.categoryName = category.name
  row.unitPrice = isPurchase.value ? Number(category.defaultPurchasePrice || 0) : Number(category.defaultSalePrice || 0)
}

const addRow = () => {
  rows.value.push(makeRow())
}

const removeRow = (id) => {
  if (rows.value.length <= 1) return showToast('至少保留一条明细', 'error')
  rows.value = rows.value.filter((item) => item.id !== id)
}

const buildFilledRows = () => {
  return rowViews.value.filter((item) => item.categoryName.trim() && item.quantity > 0)
}

const buildPayload = (status = 'confirmed') => {
  const partnerName = form.partnerName.trim()
  const filledRows = buildFilledRows()
  const partner = partners.value.find((item) => item.id === form.partnerId)
  const now = Date.now()
  const prefix = isPurchase.value ? 'P' : 'S'

  // 确保最终使用的未结金额是正确的
  const finalUnsettledAmount = form.unsettledAmount > 0
    ? Math.max(form.unsettledAmount, 0)
    : Math.max(addMoney([totalAmount.value, -Number(form.settlementAmount || 0)]), 0)

  // 确保结算金额与未结金额匹配
  const finalSettlementAmount = form.unsettledAmount > 0
    ? Math.max(addMoney([totalAmount.value, -finalUnsettledAmount]), 0)
    : Number(form.settlementAmount || 0)

  return {
    id: isEditing.value ? recordId.value : `${prefix.toLowerCase()}${now}`,
    type: isPurchase.value ? 'purchase' : 'sale',
    billNo: isEditing.value ? (currentRecord.value?.billNo || form.orderNo || `${prefix}${now}`) : `${prefix}${now}`,
    billDate: isEditing.value ? (currentRecord.value?.billDate || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10),
    createdAt: isEditing.value ? (currentRecord.value?.createdAt || new Date().toLocaleString('sv-SE').replace(' ', ' ')) : new Date().toLocaleString('sv-SE').replace(' ', ' '),
    partnerId: partner?.id || '',
    partnerName,
    customerName: partnerName,
    supplier: partnerName,
    note: form.note.trim(),
    saleMode: 'weight',
    status,
    items: filledRows.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName.trim(),
      fabricId: item.fabricId,
      fabricName: item.fabricName.trim(),
      quantity: item.quantity,
      weightInput: item.quantityInput,
      totalWeight: item.quantity,
      packCount: 0,
      packWeight: 0,
      unit: item.unit,
      unitPrice: item.unitPrice,
      amount: item.amount,
      note: item.note || '',
    })),
    totalWeight: totalWeight.value,
    totalAmount: totalAmount.value,
    paidAmount: isPurchase.value ? finalSettlementAmount : 0,
    receivedAmount: isPurchase.value ? 0 : finalSettlementAmount,
    unsettledAmount: finalUnsettledAmount,
    firstWeight: Number(form.firstWeight || 0),
    lastWeight: Number(form.lastWeight || 0),
    netWeight: netWeight.value,
  }
}

const buildExportRows = () => {
  return rowViews.value.filter((item) => {
    if (!item) return false
    return item.categoryName?.trim() || item.quantity > 0 || Number(item.unitPrice) > 0
  })
}

const getExportFileBase = () => {
  const date = new Date().toISOString().slice(0, 10)
  const partnerName = (form.partnerName.trim() || '未命名对象').replace(/[\\/:*?"<>|\s]+/g, '_')
  const typeText = isPurchase.value ? '进货单' : '出货单'
  return `${typeText}_${date}_${partnerName}`
}

const saveDraftLocal = () => {
  writeJson(DRAFT_STORAGE_KEY.value, {
    form: { ...form },
    rows: rows.value,
    updatedAt: new Date().toLocaleString(),
  })
}

const loadDraftLocal = () => {
  const draft = readJson(DRAFT_STORAGE_KEY.value, null)
  if (!draft) return false

  if (draft.form) {
    Object.assign(form, draft.form)
  }
  if (Array.isArray(draft.rows) && draft.rows.length) {
    rows.value = draft.rows
  }
  return true
}

const clearDraftLocal = () => {
  try {
    removeItem(DRAFT_STORAGE_KEY.value)
    console.log('草稿已清除')
  } catch (error) {
    console.error('清除草稿失败:', error)
  }
}

const loadExcelJS = async () => {
  const module = await import('exceljs')
  return module.default
}

const handleMasterDataChanged = async () => {
  await Promise.all([
    customerStore.refresh(),
    categoryStore.refresh(),
    fabricStore.refresh(),
  ])
}

const saveDraft = async () => {
  const partnerName = form.partnerName.trim()
  const filledRows = buildFilledRows()
  if (!partnerName && !filledRows.length && !form.note.trim()) {
    showToast('请先填写一些内容再保存草稿', 'error')
    return
  }

  saveDraftLocal()
  showToast(`${draftText.value}已保存到本地`, 'success')
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
    const worksheet = workbook.addWorksheet('单据明细')

    worksheet.columns = [
      { width: 20 },
      { width: 20 },
      { width: 24 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ]

    worksheet.addRow(['单据类型', isPurchase.value ? '进货单' : '出货单'])
    worksheet.addRow(['单据日期', new Date().toISOString().slice(0, 10)])
    worksheet.addRow([partnerLabel.value, form.partnerName.trim() || '-'])
    worksheet.addRow(['备注', form.note.trim() || '-'])
    worksheet.addRow(['出货方式', '按重量出货'])
    worksheet.addRow(['总重量(斤)', Number(totalWeight.value || 0)])
    worksheet.addRow(['总金额(元)', Number(totalAmount.value || 0)])
    worksheet.addRow([])
    worksheet.addRow(['品类', '布料', '数量 / 重量', '总重量(斤)', '单价(元/斤)', '金额(元)'])

    exportRows.forEach((item) => {
      worksheet.addRow([
        item.categoryName || '-',
        item.fabricName || '-',
        item.quantityInput || '-',
        Number(item.quantity || 0),
        Number(item.unitPrice || 0),
        Number(item.amount || 0),
      ])
    })

    ;[1, 2, 3, 4, 5, 6, 7].forEach((rowIndex) => {
      const labelCell = worksheet.getCell(`A${rowIndex}`)
      labelCell.font = { bold: true, color: { argb: 'FF355C7D' } }
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEAF3FB' },
      }
    })

    worksheet.getCell('B6').numFmt = '0.00'
    worksheet.getCell('B7').numFmt = '"¥"#,##0.00'

    const headerRow = worksheet.getRow(9)
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

    const dataStartRow = 10
    const dataEndRow = 9 + exportRows.length
    const summaryRowIndex = dataEndRow + 1

    for (let rowIndex = dataStartRow; rowIndex <= dataEndRow; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex)
      row.height = 38

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
    { key: 'categoryName', label: '品类', left: 48, width: 180 },
    { key: 'fabricName', label: '布料', left: 228, width: 180 },
    { key: 'quantityText', label: '数量 / 重量', left: 408, width: 280 },
    { key: 'totalWeight', label: '总重量(斤)', left: 688, width: 160 },
    { key: 'unitPrice', label: '单价(元/斤)', left: 848, width: 160 },
    { key: 'amount', label: '金额(元)', left: 1008, width: 180 },
  ]

  ctx.font = '22px "SimSun", serif'
  const noteLines = getWrappedLines(`备注：${form.note.trim() || '-'}`, width - 96)
  const noteLineHeight = 30
  const noteTop = 200
  const noteHeight = Math.max(noteLineHeight, noteLines.length * noteLineHeight)
  // 添加出货方式文本并计算高度
  const saleModeText = '出货方式：按重量出货'
  const tableTop = noteTop + noteHeight + 40

  ctx.font = '16px "SimSun", serif'
  const preparedRows = exportRows.map((item) => {
    if (!item) {
      return {
        rowData: {
          categoryName: '-',
          fabricName: '-',
          quantityText: '-',
          totalWeight: '0.00',
          unitPrice: '0.00',
          amount: formatMoney(0)
        },
        wrappedCategoryLines: ['-'],
        wrappedFabricLines: ['-'],
        wrappedQuantityLines: ['-'],
        rowHeight: rowBaseHeight
      }
    }

    const rowData = {
      categoryName: item.categoryName || '-',
      fabricName: item.fabricName || '-',
      quantityText: item.quantityInput || '-',
      totalWeight: Number(item.quantity || 0).toFixed(2),
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      amount: formatMoney(item.amount || 0),
    }

    const wrappedCategoryLines = getWrappedLines(rowData.categoryName, columns[0].width - 20)
    const wrappedFabricLines = getWrappedLines(rowData.fabricName, columns[1].width - 20)
    const wrappedQuantityLines = getWrappedLines(rowData.quantityText, columns[2].width - 20)
    const rowHeight = Math.max(rowBaseHeight, 16 + Math.max(wrappedCategoryLines.length, wrappedFabricLines.length, wrappedQuantityLines.length) * rowLineHeight)

    return {
      rowData,
      wrappedCategoryLines,
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

      if (col.key === 'categoryName') {
        item.wrappedCategoryLines.forEach((line, i) => {
          ctx.fillText(line, col.left + 10, currentY + 27 + i * rowLineHeight)
        })
      } else if (col.key === 'fabricName') {
        item.wrappedFabricLines.forEach((line, i) => {
          ctx.fillText(line, col.left + 10, currentY + 27 + i * rowLineHeight)
        })
      } else if (col.key === 'quantityText') {
        item.wrappedQuantityLines.forEach((line, i) => {
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
  ctx.fillText(`总金额：${formatMoney(totalAmount.value)}`, 620, tableBottom + 52)

  const link = document.createElement('a')
  link.download = `${getExportFileBase()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
  showToast('图片已开始下载', 'success')
}

const submit = async () => {
  const partnerName = form.partnerName.trim()
  if (!partnerName) return showToast(`请填写${partnerLabel.value}`, 'error')

  const filledRows = buildFilledRows()
  if (!filledRows.length) return showToast('请至少填写一条有效明细', 'error')

  saving.value = true
  try {
    const payload = buildPayload('confirmed')
    console.log('准备保存的单据数据:', payload)

    let targetId = payload.id

    if (isEditing.value) {
      await billRecordStore.updateRecord(recordId.value, payload)
      targetId = recordId.value
    } else {
      const created = await billRecordStore.createRecord(payload)
      targetId = created?.id || payload.id
    }

    clearDraftLocal()
    showToast(`${pageTitle.value}已保存`, 'success')
    router.push(isPurchase.value ? `/purchase/view/${targetId}` : `/sale/view/${targetId}`)
  } catch (error) {
    console.error('保存单据失败:', error)
    showToast(`保存失败: ${error.message}`, 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isEditing.value && !currentRecord.value && typeof billRecordStore.fetchRecordDetail === 'function') {
    try {
      await billRecordStore.fetchRecordDetail(recordId.value)
    } catch (error) {
      console.error('加载单据失败:', error)
    }
  }

  if (!isEditing.value) {
    const restored = loadDraftLocal()
    if (restored) {
      showToast(`${draftText.value}已恢复`, 'success')
    }
  }
  window.addEventListener(MASTER_DATA_CHANGED_EVENT, handleMasterDataChanged)
})

onUnmounted(() => {
  window.removeEventListener(MASTER_DATA_CHANGED_EVENT, handleMasterDataChanged)
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
              <span>品类</span>
              <select
                v-model="rows[idx].categoryId"
                @change="selectCategory(rows[idx])"
              >
                <option value="">请先选择品类</option>
                <option v-for="item in categories" :key="item.id" :value="item.id">
                  {{ item.name }} ({{ item.unit }})
                </option>
              </select>
            </label>

            <label class="field">
              <span>布料</span>
              <select
                v-model="rows[idx].fabricId"
                :disabled="!rows[idx].categoryId"
                @change="selectFabric(rows[idx])"
              >
                <option value="">请先选择布料</option>
                <option v-for="item in getFabricsByCategory(rows[idx].categoryId)" :key="item.id" :value="item.id">
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
                <button type="button" class="btn-text danger" @click="removeRow(rowView.id)">删除</button>
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
        <button type="button" class="btn-primary" :disabled="saving" @click="submit">提交单据</button>
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

  .field textarea {
    min-height: 100px;
    font-size: 16px;
  }

  .weight-panel {
    padding: 16px;
    margin: 12px 0;
  }

  .weight-inputs {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .weight-inputs input {
    height: 46px;
    font-size: 16px;
  }

  .detail-item {
    padding: 16px;
  }

  .row-note-box {
    flex-direction: column;
  }

  .row-note-box .btn-text {
    align-self: flex-start;
  }

  .settlement-summary {
    gap: 12px;
  }

  .settlement-summary div {
    padding: 14px;
  }

  .settlement-summary strong {
    font-size: 18px;
  }

  .actions {
    gap: 10px;
  }

  .action-toolbar {
    gap: 8px;
  }

  .btn-primary,
  .btn-ghost,
  .btn-text {
    min-height: 44px;
    font-size: 16px;
  }

  .action-toolbar button {
    flex: 1 1 calc(50% - 4px);
  }

  .detail-list {
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .hero {
    padding: 16px !important;
  }

  .hero h2 {
    font-size: 24px;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .metric-card {
    padding: 14px;
  }

  .metric-card strong {
    font-size: 24px;
  }

  .form-panel,
  .detail-panel,
  .settlement-bar {
    padding: 16px !important;
  }

  .panel-title-row h3 {
    font-size: 18px;
  }

  .field {
    gap: 8px;
  }

  .field span {
    font-size: 14px;
  }

  .field input,
  .field select,
  .field textarea {
    height: 44px;
    font-size: 16px;
  }

  .field-tip {
    font-size: 12px;
  }

  .weight-inputs input {
    height: 44px;
  }

  .detail-item {
    padding: 14px;
  }

  .settlement-summary div {
    padding: 12px;
  }

  .settlement-summary strong {
    font-size: 16px;
  }

  .actions {
    gap: 8px;
  }

  .action-toolbar button {
    flex: 1 1 100%;
  }

  .btn-primary,
  .btn-ghost,
  .btn-text {
    min-height: 44px;
    font-size: 16px;
    padding: 12px;
  }
}

/* 安全区域适配 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .action-toolbar {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  }
}
</style>
