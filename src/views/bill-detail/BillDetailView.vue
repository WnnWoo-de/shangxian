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
})

const rows = ref([])
const saving = ref(false)
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
  form.createdAt = record.createdAt
  form.supplier = record.partnerName
  form.note = record.note
  form.firstWeight = Number(record.firstWeight || 0)
  form.lastWeight = Number(record.lastWeight || 0)
  form.netWeight = Number(record.netWeight || 0)

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

// 导出为 Excel
const exportToExcel = async () => {
  if (!currentRecord.value) return

  try {
    const ExcelJS = await loadExcelJS()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(exportTitle.value)
    const detailRowMeta = []
    const metaRows = [
      ['单据日期', form.createdAt || new Date().toISOString().slice(0, 10)],
      [isSale.value ? '客户' : '供应商', form.supplier.trim() || '-'],
      ['单号', form.orderNo || '-'],
      ['备注', form.note.trim() || '-'],
      [isSale.value ? '出货方式' : '进货方式', '按重量出货'],
    ]

    const detailRows = rows.value
      .filter((item) => item && (item.fabricName?.trim() || Number(item.quantity) > 0 || Number(item.unitPrice) > 0))
      .map((item) => {
        const quantity = Number(item.quantity || 0)
        const unitPrice = Number(item.unitPrice || 0)
        return {
          fabricName: item.fabricName || '-',
          quantityText: item.quantityInput || '-',
          totalWeight: quantity,
          unitPrice,
          amount: quantity * unitPrice,
          note: item.note || '-',
        }
      })

    const normalizedRows = detailRows.length ? detailRows : [{
      fabricName: '-',
      quantityText: '-',
      totalWeight: 0,
      unitPrice: 0,
      amount: 0,
      note: '-',
    }]

    worksheet.columns = [
      { width: 22 },
      { width: 30 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
    ]

    metaRows.forEach((row) => worksheet.addRow(row))
    const headerRow = worksheet.addRow(['布料', '明细重量输入', '总重量(斤)', '单价(元/斤)', '金额(元)', '备注'])

    normalizedRows.forEach((row) => {
      const quantityText = formatExcelWrapText(row.quantityText, { maxCharsPerLine: 16 })
      const noteText = formatExcelWrapText(row.note, { maxCharsPerLine: 14, breakPattern: /([\s,，、;；/]+)/ })
      const detailRow = worksheet.addRow([
        row.fabricName,
        quantityText,
        row.totalWeight,
        row.unitPrice,
        row.amount,
        noteText,
      ])

      detailRowMeta.push({
        rowNumber: detailRow.number,
        lineCount: Math.max(countExcelTextLines(quantityText), countExcelTextLines(noteText)),
      })
    })

    const totalWeightNumber = normalizedRows.reduce((sum, item) => sum + Number(item.totalWeight || 0), 0)
    const totalAmountNumber = normalizedRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const totalWeightRow = worksheet.addRow(['', '总重量', totalWeightNumber, '', '', ''])
    const totalAmountRow = worksheet.addRow(['', '总金额', '', '', totalAmountNumber, ''])
    const totalWeightRowIndex = totalWeightRow.number
    const totalAmountRowIndex = totalAmountRow.number

    for (let i = 1; i <= metaRows.length; i += 1) {
      worksheet.getCell(`A${i}`).font = { bold: true }
    }
    headerRow.font = { bold: true }

    detailRowMeta.forEach(({ rowNumber, lineCount }, index) => {
      const row = worksheet.getRow(rowNumber)
      row.getCell(3).numFmt = '0.00'
      row.getCell(4).numFmt = '¥#,##0.00'
      row.getCell(5).numFmt = '¥#,##0.00'
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
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

    worksheet.getCell(`C${totalWeightRowIndex}`).numFmt = '0.00'
    worksheet.getCell(`E${totalAmountRowIndex}`).numFmt = '¥#,##0.00'

    worksheet.getCell(`B${totalWeightRowIndex}`).font = { bold: true }
    worksheet.getCell(`C${totalWeightRowIndex}`).font = { bold: true }
    worksheet.getCell(`B${totalAmountRowIndex}`).font = { bold: true }
    worksheet.getCell(`E${totalAmountRowIndex}`).font = { bold: true }

    worksheet.mergeCells(`B${totalAmountRowIndex}:D${totalAmountRowIndex}`)
    worksheet.getCell(`B${totalAmountRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' }

    // 导出
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportFilePrefix.value}${currentRecord.value.billDate}_${currentRecord.value.billNo}.xlsx`
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
  return rows.value.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
})

const totalAmount = computed(() => {
  return rows.value.reduce((sum, row) => sum + (Number(row.quantity || 0) * Number(row.unitPrice || 0)), 0)
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
  return rows.value.filter((item) => {
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
    { key: 'fabricName', label: '布料', width: 180 },
    { key: 'quantityText', label: '明细重量输入', width: 360 },
    { key: 'totalWeight', label: '总重量(斤)', width: 170, align: 'center' },
    { key: 'unitPrice', label: '单价(元/斤)', width: 170, align: 'center' },
    { key: 'amount', label: '金额(元)', width: 210, align: 'center' },
  ])
  const tableWidth = getCanvasTableWidth(columns)

  ctx.font = '22px "SimSun", serif'
  const noteLines = wrapCanvasText(ctx, `备注：${form.note.trim() || '-'}`, width - 96)
  const noteLineHeight = 30
  const noteTop = 228
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
      amount: Number(item.quantity || 0) * Number(item.unitPrice || 0),
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

  noteLines.forEach((line, index) => {
    ctx.fillText(line, 48, noteTop + index * noteLineHeight)
  })

  ctx.fillText(`出货方式：按重量出货`, 48, noteTop + noteHeight + 22)

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
          <strong>单据信息</strong>
          <span>重量支持输入 `10+10+10`、`10 10 10`、`10.10.10`、`10×3`，系统会自动计算结果。</span>
        </div>
        <span class="tip-tag">单据编号 {{ form.orderNo || '-' }}</span>
      </div>

      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th>布料</th>
              <th>明细重量输入</th>
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
                        placeholder="输入或选择布料"
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
                          未找到该布料
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <input
                  v-model="item.quantityInput"
                  type="text"
                  placeholder="10+10+10 / 10 10 10 / 10.10.10"
                  class="cell-input"
                />
              </td>
              <td>
                <div class="cell-stack align-with-category">
                  <span class="num">{{ Number(item.quantity || 0).toFixed(2) }}</span>
                </div>
              </td>
              <td>
                <div class="cell-stack align-with-category">
                  <input v-model.number="item.unitPrice" type="number" step="0.01" class="cell-input" />
                </div>
              </td>
              <td>
                <div class="cell-stack align-with-category">
                  <span class="num amount">{{ formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0)) }}</span>
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
</style>
