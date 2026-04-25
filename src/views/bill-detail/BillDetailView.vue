<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '../../components/icons/AppIcon.vue'
import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
import { useFabricStore } from '../../stores/fabric'
import { createCanvasTableColumns, drawCanvasTableGrid, getCanvasBlockStartY, getCanvasCenterTextY, getCanvasTableWidth } from '../../utils/canvas-table'
import { getCanvasWrappedRowHeight, wrapCanvasText } from '../../utils/canvas-text'
import { countExcelTextLines, formatExcelWrapText, getExcelWrappedRowHeight } from '../../utils/excel'
import { formatMoney } from '../../utils/money'
import { showToast } from '../../utils/toast'
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
const currentPartnerLabel = computed(() => (isSale.value ? '当前客户' : '当前供应商'))
const returnRoute = computed(() => (isSale.value ? '/sale/list' : '/purchase/list'))
const exportTitle = computed(() => (isSale.value ? '出货单据明细' : '进货单据明细'))

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
})
const hasWeighing = computed(() => Number(form.firstWeight || 0) > 0 || Number(form.lastWeight || 0) > 0)
const formatKg = (value) => `${Number(value || 0).toFixed(2)} 公斤`

const rows = ref([])
const deleting = ref(false)
const isEditing = computed(() => Boolean(recordId.value))

const showFabricOptionsForRow = ref({})

const fabrics = computed(() => fabricStore.activeFabrics)

const getFilteredFabrics = (keyword) => {
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return fabrics.value
  return fabrics.value.filter((item) => String(item.name || '').toLowerCase().includes(query))
}

const fillForm = (record) => {
  if (!record) return

  form.orderNo = record.billNo
  form.createdAt = record.billDate || String(record.createdAt || '').slice(0, 10)
  form.supplier = record.partnerName
  form.note = record.note
  form.firstWeight = Number(record.firstWeight || 0)
  form.lastWeight = Number(record.lastWeight || 0)
  form.netWeight = Number(record.netWeight || Math.max(form.firstWeight - form.lastWeight, 0))

  if (Array.isArray(record.items) && record.items.length) {
    rows.value = record.items.map((item) => ({
      id: item.id,
      fabricId: item.fabricId,
      fabricName: item.fabricName,
      quantityInput: String(item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.totalWeight ?? ''),
      quantity: Number(item.quantity ?? item.totalWeight ?? 0),
      unitPrice: Number(item.unitPrice || 0),
      note: item.note,
    }))
  } else if (Array.isArray(record.details) && record.details.length) {
    rows.value = record.details.map((item) => ({
      id: item.id,
      fabricId: item.fabricId,
      fabricName: item.fabricName,
      quantityInput: String(item.quantityInput ?? item.weightInput ?? item.weight_input_text ?? item.weightInputText ?? item.totalWeight ?? ''),
      quantity: Number(item.quantity ?? item.totalWeight ?? 0),
      unitPrice: Number(item.unitPrice || 0),
      note: item.note,
    }))
  } else {
    rows.value = []
  }
}

watch(currentRecord, (record) => {
  if (!record) return
  fillForm(record)
}, { immediate: true })

// 初始化数据存储
const initStores = async () => {
  await Promise.all([
    billRecordStore.init(),
    customerStore.init(),
    fabricStore.init(),
  ])
}

onMounted(async () => {
  // 监听主数据变化
  window.addEventListener(MASTER_DATA_CHANGED_EVENT, handleMasterDataChange)
  await initStores()
})

onUnmounted(() => {
  window.removeEventListener(MASTER_DATA_CHANGED_EVENT, handleMasterDataChange)
})

// 处理数据更新事件
const handleMasterDataChange = () => {
  console.log('数据已更新，重新加载')
}

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
        continue
      }

      if (part.includes(' ')) {
        const spaceParts = part.split(' ')
        for (const numStr of spaceParts) {
          const num = Number(numStr)
          if (!isNaN(num)) value += num
        }
        continue
      }

      const num = Number(part)
      if (!isNaN(num)) value += num
    }
    return isNaN(value) ? 0 : value
  } catch (error) {
    console.error('解析重量表达式失败:', error)
    return 0
  }
}

const rowViews = computed(() => {
  return rows.value.map((row) => {
    const quantity = parseWeightExpression(row.quantityInput ?? row.quantity)
    const unitPrice = Number(row.unitPrice || 0)
    return {
      ...row,
      quantity,
      quantityInput: String(row.quantityInput ?? row.quantity ?? ''),
      unitPrice,
      amount: quantity * unitPrice,
    }
  })
})

// 导出为 Excel
const exportToExcel = async () => {
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
    const metaRows = [
      ['单据日期', form.createdAt || new Date().toISOString().slice(0, 10)],
      [isSale.value ? '客户' : '供应商', form.supplier.trim() || '-'],
      ['备注', form.note.trim() || '-'],
      ['出货方式', '按重量出货'],
    ]
    if (hasWeighing.value) {
      metaRows.push(
        ['过磅总重量', formatKg(form.firstWeight)],
        ['车皮重量', formatKg(form.lastWeight)],
        ['净重量', formatKg(form.netWeight)]
      )
    }

    worksheet.columns = [
      { key: 'fabric', width: 22 },
      { key: 'quantity', width: 24 },
      { key: 'totalWeight', width: 14 },
      { key: 'unitPrice', width: 14 },
      { key: 'amount', width: 16 },
      { key: 'note', width: 18 },
    ]

    metaRows.forEach((row) => worksheet.addRow(row))
    const headerRow = worksheet.addRow(['品种', '数量 / 重量', '总重量(斤)', '单价(元/斤)', '金额(元)', '备注'])

    exportRows.forEach((item) => {
      const quantityText = formatExcelWrapText(item.quantityInput || '-', { maxCharsPerLine: 16 })
      const noteText = formatExcelWrapText(item.note || '-', { maxCharsPerLine: 18, breakPattern: /([\s,，、;；/]+)/ })
      const detailRow = worksheet.addRow({
        fabric: item.fabricName || '-',
        quantity: quantityText,
        totalWeight: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        amount: Number(item.amount || 0),
        note: noteText,
      })

      detailRowMeta.push({
        rowNumber: detailRow.number,
        lineCount: Math.max(countExcelTextLines(quantityText), countExcelTextLines(noteText)),
      })
    })

    const totalWeightRow = worksheet.addRow(['总重量', '', Number(totalWeight.value || 0), '', '', ''])
    const totalAmountRow = worksheet.addRow(['总金额', '', '', '', Number(totalAmount.value || 0), ''])

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

    for (let i = 1; i <= metaRows.length; i++) {
      worksheet.getCell(`A${i}`).font = { bold: true }
    }

    detailRowMeta.forEach(({ rowNumber, lineCount }, index) => {
      const row = worksheet.getRow(rowNumber)
      row.alignment = { vertical: 'middle', horizontal: 'left' }
      row.getCell('B').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      row.getCell('F').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
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

const handleDelete = async () => {
  if (!hasRecord.value) return
  try {
    await billRecordStore.deleteRecord(currentRecord.value.id)
    showToast('删除成功')
    router.push(returnRoute.value)
  } catch (error) {
    console.error('删除失败:', error)
    showToast(error.message || '删除失败，请重试')
  }
}
const totalWeight = computed(() => {
  return rowViews.value.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
})

const totalAmount = computed(() => {
  return rowViews.value.reduce((sum, row) => sum + Number(row.amount || 0), 0)
})

const toggleFabricOptions = (rowId) => {
  showFabricOptionsForRow.value[rowId] = !showFabricOptionsForRow.value[rowId]
}

const selectFabric = (rowId, option) => {
  const row = rows.value.find(r => r.id === rowId)
  if (row) {
    row.fabricId = option.id
    row.fabricName = option.name
    row.unitPrice = isSale.value ? option.defaultSalePrice : option.defaultPurchasePrice
  }
  showFabricOptionsForRow.value[rowId] = false
}

const removeRow = (rowId) => {
  const index = rows.value.findIndex(r => r.id === rowId)
  if (index > -1) {
    rows.value.splice(index, 1)
  }
}

const addNewDetail = () => {
  rows.value.push({
    id: `${Date.now()}-${Math.random()}`,
    fabricId: '',
    fabricName: '',
    quantityInput: '',
    quantity: 0,
    unitPrice: 0,
    note: '',
  })
}

const makeRow = () => ({
  id: `${Date.now()}-${Math.random()}`,
  fabricId: '',
  fabricName: '',
  quantityInput: '',
  quantity: 0,
  unitPrice: 0,
  note: '',
})

const buildExportRows = () => {
  return rowViews.value.filter((item) => {
    if (!item) return false
    return item.fabricName?.trim() || item.quantity > 0 || Number(item.unitPrice) > 0
  })
}

const getExportFileBase = () => {
  const date = new Date().toISOString().slice(0, 10)
  const partnerName = (form.supplier.trim() || '未命名对象').replace(/[\\/:*?"<>|\s]+/g, '_')
  const typeText = isSale.value ? '出货单' : '进货单'
  return `${typeText}_${date}_${partnerName}`
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

  const weighingLines = hasWeighing.value
    ? [
        `过磅总重量：${formatKg(form.firstWeight)}`,
        `车皮重量：${formatKg(form.lastWeight)}`,
        `净重量：${formatKg(form.netWeight)}`,
      ]
    : []
  const tableTop = hasWeighing.value ? 276 : 228

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
  ctx.fillText(`日期：${form.createdAt || new Date().toISOString().slice(0, 10)}`, 48, 148)
  ctx.fillText(`${isSale.value ? '客户' : '供应商'}：${form.supplier.trim() || '-'}`, 48, 180)

  weighingLines.forEach((line, index) => {
    ctx.fillText(line, 48 + index * 360, 222)
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
  <section class="weight-page slide-up-enter-active">
    <header class="topbar panel">
      <div class="title-wrap">
        <h2>{{ pageTitle }}</h2>
        <p>单号：{{ form.orderNo || '-' }}</p>
      </div>

      <div class="top-actions">
        <button type="button" class="btn-ghost" @click="router.push(returnRoute)">返回列表</button>
        <button v-if="hasRecord" type="button" class="btn-danger" @click="handleDelete">删除</button>
      </div>
    </header>

    <div v-if="!hasRecord" class="panel empty-state">没有找到该单据的详细信息。</div>

    <div v-else class="panel workbench">
      <div class="meta-grid">
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
          <span class="overview-label">{{ currentPartnerLabel }}</span>
          <strong>{{ form.supplier || '待填写客户' }}</strong>
          <small>已录入 {{ rows.length }} 条有效明细</small>
        </article>
        <article class="overview-card accent-blue">
          <span class="overview-label">总重量</span>
          <strong>{{ totalWeight.toFixed(2) }} 斤</strong>
          <small>支持 `10+10+10`、`10 10 10`、`10.10.10`、`10×3` 快速计算</small>
        </article>
        <article class="overview-card accent-gold">
          <span class="overview-label">总金额</span>
          <strong>{{ formatMoney(totalAmount) }}</strong>
          <small>累计金额 {{ formatMoney(totalAmount) }}</small>
        </article>
      </section>

      <div v-if="hasWeighing" class="weight-panel">
        <div class="weight-inputs">
          <label class="field">
            <span>过磅总重量（公斤）</span>
            <input :value="formatKg(form.firstWeight)" type="text" readonly />
          </label>
          <label class="field">
            <span>车皮重量（公斤）</span>
            <input :value="formatKg(form.lastWeight)" type="text" readonly />
          </label>
          <label class="field">
            <span>净重量（公斤）</span>
            <input :value="formatKg(form.netWeight)" type="text" readonly />
          </label>
        </div>
      </div>

      <div class="page-tipbar">
        <div>
          <strong>单据信息</strong>
          <span>重量支持输入 `10+10+10`、`10 10 10`、`10.10.10`、`10×3`，系统会自动计算结果。</span>
        </div>
        <span class="tip-tag">单据编号 {{ form.orderNo || '-' }}</span>
      </div>

      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th>品种</th>
              <th>数量 / 重量</th>
              <th>总重量(斤)</th>
              <th>单价(元/斤)</th>
              <th>金额(元)</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in rows" :key="item.id">
              <td>
                <div class="cell-stack">
                  <div class="category-heading">
                    <span class="row-index">#{{ idx + 1 }}</span>
                  </div>
                  <div
                    class="category-picker"
                  >
                    <div class="custom-select category-select">
                      <input
                        v-model="item.fabricName"
                        type="text"
                        placeholder="输入或选择品种"
                        class="cell-input"
                      />
                      <div class="arrow" @mousedown.stop="toggleFabricOptions(item.id)">
                        <AppIcon name="chevron-down" size="18" />
                      </div>
                      <Transition name="fade-pop">
                        <ul v-if="showFabricOptionsForRow[item.id] && getFilteredFabrics(item.fabricName).length" class="dropdown-list">
                          <li
                            v-for="option in getFilteredFabrics(item.fabricName)"
                            :key="option.id"
                            @mousedown.stop="selectFabric(item.id, option)"
                          >
                            <div class="dropdown-main">{{ option.name }}</div>
                          </li>
                        </ul>
                        <div v-else-if="showFabricOptionsForRow[item.id] && item.fabricName" class="dropdown-list no-res">
                          未找到该品种
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <textarea
                  v-model="item.quantityInput"
                  rows="3"
                  placeholder="10+10+10 / 10 10 10 / 10.10.10"
                  class="cell-input weight-detail-input"
                ></textarea>
              </td>
              <td>
                <div class="cell-stack align-with-category">
                  <span class="num">{{ parseWeightExpression(item.quantityInput ?? item.quantity).toFixed(2) }}</span>
                </div>
              </td>
              <td>
                <div class="cell-stack align-with-category">
                  <input v-model.number="item.unitPrice" type="number" step="0.01" class="cell-input" />
                </div>
              </td>
              <td>
                <div class="cell-stack align-with-category">
                  <span class="num amount">{{ formatMoney(parseWeightExpression(item.quantityInput ?? item.quantity) * Number(item.unitPrice || 0)) }}</span>
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

      <div class="mobile-detail-list">
        <article v-for="(item, idx) in rows" :key="`mobile-${item.id}`" class="mobile-detail-card">
          <div class="mobile-detail-head">
            <span class="mobile-row-index">#{{ idx + 1 }}</span>
            <button type="button" class="mobile-delete" @click="removeRow(item.id)">删除</button>
          </div>

          <label class="mobile-field">
            <span>品种</span>
            <div class="category-picker">
              <div class="custom-select category-select">
                <input
                  v-model="item.fabricName"
                  type="text"
                  placeholder="输入或选择品种"
                  class="cell-input"
                />
                <div class="arrow" @mousedown.stop="toggleFabricOptions(item.id)">
                  <AppIcon name="chevron-down" size="18" />
                </div>
                <Transition name="fade-pop">
                  <ul v-if="showFabricOptionsForRow[item.id] && getFilteredFabrics(item.fabricName).length" class="dropdown-list">
                    <li
                      v-for="option in getFilteredFabrics(item.fabricName)"
                      :key="option.id"
                      @mousedown.stop="selectFabric(item.id, option)"
                    >
                      <div class="dropdown-main">{{ option.name }}</div>
                    </li>
                  </ul>
                  <div v-else-if="showFabricOptionsForRow[item.id] && item.fabricName" class="dropdown-list no-res">
                    未找到该品种
                  </div>
                </Transition>
              </div>
            </div>
          </label>

          <label class="mobile-field">
            <span>数量 / 重量</span>
            <textarea
              v-model="item.quantityInput"
              rows="4"
              placeholder="10+10+10 / 10 10 10 / 10.10.10"
              class="cell-input weight-detail-input"
            ></textarea>
          </label>

          <div class="mobile-metric-grid">
            <div class="mobile-metric">
              <span>总重量</span>
              <strong>{{ parseWeightExpression(item.quantityInput ?? item.quantity).toFixed(2) }} 斤</strong>
            </div>
            <label class="mobile-metric mobile-price">
              <span>单价</span>
              <input v-model.number="item.unitPrice" type="number" step="0.01" class="cell-input" />
            </label>
            <div class="mobile-metric mobile-amount">
              <span>金额</span>
              <strong>{{ formatMoney(parseWeightExpression(item.quantityInput ?? item.quantity) * Number(item.unitPrice || 0)) }}</strong>
            </div>
          </div>
        </article>
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
          <button type="button" class="btn-ghost" @click.stop="exportToExcel">导出表格</button>
          <button type="button" class="btn-ghost" @click.stop="exportImage">导出图片</button>
          <button v-if="recordId" type="button" class="btn-danger" :disabled="deleting" @click.stop="handleDelete">{{ deleting ? '删除中...' : '删除单据' }}</button>
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
}

.table-box {
  overflow-x: auto;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(44, 83, 120, 0.08);
}

.mobile-detail-list {
  display: none;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #f2f6fa;
  color: #2c3e50;
  font-weight: 700;
  font-size: 13px;
  text-align: left;
  padding: 14px 16px;
  border-bottom: 1px solid #e1ebf4;
  position: sticky;
  top: 0;
  z-index: 1;
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f4f8;
}

tbody tr:hover {
  background: #f8fafc;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-heading {
  display: flex;
  gap: 8px;
  align-items: center;
}

.row-index {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.category-picker {
  position: relative;
}

.custom-select {
  position: relative;
}

.custom-select input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #1e293b;
}

.custom-select input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.custom-select .arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-list li {
  padding: 10px 14px;
  cursor: pointer;
}

.dropdown-list li:hover {
  background: #f8fafc;
}

.dropdown-list.no-res {
  padding: 10px 14px;
  color: #64748b;
  font-style: italic;
}

.cell-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
}

.weight-detail-input {
  min-height: 88px;
  line-height: 1.55;
  resize: vertical;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.btn-delete {
  padding: 6px 12px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.btn-delete:hover {
  background: #dc2626;
}

.summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-radius: 18px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.summary-metrics {
  display: flex;
  gap: 24px;
}

.sum-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sum-block span {
  font-size: 13px;
  color: #64748b;
}

.sum-block strong {
  font-size: 20px;
  color: #1e293b;
  font-weight: 700;
}

.sum-block.emphasis {
  background: #fff;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.summary-actions {
  display: flex;
  gap: 10px;
}

.btn-ghost {
  padding: 10px 18px;
  background: transparent;
  color: #3b82f6;
  border: 1px solid #3b82f6;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.btn-ghost:hover {
  background: #eff6ff;
}

.btn-primary {
  padding: 10px 18px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
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

@media (max-width: 1024px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .summary {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-actions {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .weight-page {
    padding: 0;
    gap: 12px;
  }

  .topbar,
  .form-card {
    border-radius: 18px;
  }

  .form-card {
    padding: 16px;
  }

  .meta-grid,
  .overview-grid,
  .weight-inputs {
    gap: 10px;
  }

  .page-tipbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px;
  }

  .page-tipbar span {
    font-size: 13px;
    line-height: 1.65;
  }

  .tip-tag {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .table-box {
    display: none;
  }

  .mobile-detail-list {
    display: grid;
    gap: 12px;
  }

  .mobile-detail-card {
    position: relative;
    display: grid;
    gap: 14px;
    padding: 14px;
    border-radius: 18px;
    background: #fff;
    border: 1px solid rgba(226, 232, 240, 0.9);
    box-shadow: 0 12px 28px rgba(44, 83, 120, 0.08);
  }

  .mobile-detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-row-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    background: #eef6ff;
    color: #2f5477;
    font-weight: 800;
  }

  .mobile-delete {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid rgba(239, 68, 68, 0.18);
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.08);
    color: #dc2626;
    font-weight: 800;
  }

  .mobile-field {
    display: grid;
    gap: 8px;
  }

  .mobile-field > span,
  .mobile-metric span {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
  }

  .mobile-detail-card .cell-input,
  .mobile-detail-card .custom-select input {
    min-height: 46px;
    border-radius: 12px;
    font-size: 16px;
  }

  .mobile-detail-card .weight-detail-input {
    min-height: 116px;
    line-height: 1.6;
  }

  .mobile-detail-card .dropdown-list {
    z-index: 30;
  }

  .mobile-metric-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .mobile-metric {
    min-width: 0;
    padding: 12px;
    border-radius: 14px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
    display: grid;
    gap: 8px;
  }

  .mobile-metric strong {
    color: #1e293b;
    font-size: 18px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .mobile-price input {
    padding: 0 10px;
  }

  .mobile-amount {
    grid-column: 1 / -1;
    background: linear-gradient(135deg, #fff8ec, #f8fafc);
  }

  .mobile-amount strong {
    color: #0f172a;
    font-size: 22px;
  }

  .summary {
    gap: 14px;
    padding: 14px;
  }

  .summary-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .sum-block {
    min-width: 0;
  }

  .sum-block strong {
    font-size: 20px;
    overflow-wrap: anywhere;
  }

  .summary-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .summary-actions button {
    min-height: 52px;
    padding: 8px 10px;
    white-space: normal;
    line-height: 1.35;
  }
}

@media (max-width: 480px) {
  .form-card {
    padding: 14px;
  }

  .mobile-metric-grid,
  .summary-metrics {
    grid-template-columns: 1fr;
  }

  .summary-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
