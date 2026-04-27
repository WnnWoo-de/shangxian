<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/icons/AppIcon.vue'
import { useBillRecordStore } from '@/stores/billRecord'
import { formatMoney } from '@/utils/money'
import { dayjs } from '@/utils/date'
import { showToast } from '@/utils/toast'
import { getExportImageBrandName } from '@/utils/app-config'

const PAGE_SIZE = 12

const router = useRouter()
const billStore = useBillRecordStore()

const loadExcelJS = async () => {
  const module = await import('exceljs')
  return module.default
}

const activeType = ref('purchase')
const selectedMonth = ref('')
const keyword = ref('')
const statusFilter = ref('all')
const page = ref(1)

const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const settlementOf = (record) => (
  record.type === 'sale'
    ? toNumber(record.receivedAmount)
    : toNumber(record.paidAmount)
)

const pendingOf = (record) => Math.max(toNumber(record.totalAmount) - settlementOf(record), 0)

const statusText = (record) => {
  const pending = pendingOf(record)
  const settled = settlementOf(record)

  if (pending <= 0 && settled > 0) return '已结清'
  if (settled > 0) return '部分付'
  return '未付款'
}

const rowTone = (record) => {
  const text = statusText(record)
  if (text === '已结清') return 'settled'
  if (text === '部分付') return 'partial'
  return 'unpaid'
}

const billDateOf = (record) => record.billDate || String(record.createdAt || '').slice(0, 10)
const partnerOf = (record) => record.partnerName || record.customerName || record.supplier || '未填写'

const allRecords = computed(() => (
  billStore.getBillRecords
    .filter((record) => record.status !== 'deleted')
    .sort((a, b) => new Date(billDateOf(b) || b.createdAt || 0) - new Date(billDateOf(a) || a.createdAt || 0))
))

const months = computed(() => {
  const monthSet = new Set(
    allRecords.value
      .map((record) => String(billDateOf(record) || '').slice(0, 7))
      .filter(Boolean)
  )

  return Array.from(monthSet).sort((a, b) => b.localeCompare(a))
})

const typeTabs = computed(() => [
  {
    key: 'purchase',
    label: '进货结算',
    note: '应付供应商',
    icon: 'purchase',
  },
  {
    key: 'sale',
    label: '出货结算',
    note: '应收客户款',
    icon: 'sale',
  },
])

const filteredRecords = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()

  return allRecords.value.filter((record) => {
    if (record.type !== activeType.value) return false
    if (selectedMonth.value && !String(billDateOf(record) || '').startsWith(selectedMonth.value)) return false
    if (statusFilter.value !== 'all' && rowTone(record) !== statusFilter.value) return false

    if (!normalizedKeyword) return true

    const haystack = [
      partnerOf(record),
      record.billNo,
      record.note,
      ...((record.items || []).map((item) => item.fabricName)),
    ].join(' ').toLowerCase()

    return haystack.includes(normalizedKeyword)
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / PAGE_SIZE)))

const pagedRecords = computed(() => {
  if (page.value > pageCount.value) page.value = pageCount.value
  const start = (page.value - 1) * PAGE_SIZE
  return filteredRecords.value.slice(start, start + PAGE_SIZE)
})

const summary = computed(() => {
  const rows = filteredRecords.value

  return rows.reduce((acc, record) => {
    acc.count += 1
    acc.weight += toNumber(record.totalWeight)
    acc.totalAmount += toNumber(record.totalAmount)
    acc.settledAmount += settlementOf(record)
    acc.pendingAmount += pendingOf(record)
    return acc
  }, {
    count: 0,
    weight: 0,
    totalAmount: 0,
    settledAmount: 0,
    pendingAmount: 0,
  })
})

const groupedByDate = computed(() => {
  const groups = new Map()

  pagedRecords.value.forEach((record) => {
    const date = billDateOf(record) || '未填写日期'
    if (!groups.has(date)) {
      groups.set(date, {
        date,
        rows: [],
        totalAmount: 0,
        totalWeight: 0,
      })
    }

    const group = groups.get(date)
    group.rows.push(record)
    group.totalAmount += toNumber(record.totalAmount)
    group.totalWeight += toNumber(record.totalWeight)
  })

  return Array.from(groups.values())
})

const resetPage = () => {
  page.value = 1
}

const viewRecord = (record) => {
  router.push(`/${record.type}/view/${record.id}`)
}

const getExportTitle = () => activeType.value === 'purchase' ? '进货结算详情' : '出货结算详情'

const getExportFileBase = () => {
  const typeText = activeType.value === 'purchase' ? '进货结算详情' : '出货结算详情'
  const monthText = selectedMonth.value || '全部月份'
  return `${typeText}_${monthText}_${dayjs().format('YYYYMMDD_HHmm')}`.replace(/[\\/:*?"<>|\s]+/g, '_')
}

const getFilterText = () => {
  const statusLabel = statusOptions.find((item) => item.value === statusFilter.value)?.label || '全部状态'
  return [
    `类型：${activeType.value === 'purchase' ? '进货' : '出货'}`,
    `月份：${selectedMonth.value || '全部月份'}`,
    `状态：${statusLabel}`,
    `搜索：${keyword.value.trim() || '无'}`,
  ].join(' / ')
}

const buildExportRows = () => filteredRecords.value.map((record, index) => ({
  index: index + 1,
  date: billDateOf(record) || '-',
  partner: partnerOf(record),
  billNo: record.billNo || '-',
  weight: toNumber(record.totalWeight),
  settlement: settlementOf(record),
  pending: pendingOf(record),
  advanceNote: record.note?.includes('旧账') ? record.note : '-',
  totalAmount: toNumber(record.totalAmount),
  creator: '皖盛收货',
  status: statusText(record),
  note: record.note || '-',
}))

const exportToExcel = async () => {
  const rows = buildExportRows()
  if (!rows.length) {
    showToast('暂无可导出的结算数据', 'error')
    return
  }

  try {
    const ExcelJS = await loadExcelJS()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(getExportTitle())

    worksheet.columns = [
      { key: 'index', width: 8 },
      { key: 'date', width: 14 },
      { key: 'partner', width: 20 },
      { key: 'billNo', width: 22 },
      { key: 'weight', width: 12 },
      { key: 'settlement', width: 14 },
      { key: 'pending', width: 14 },
      { key: 'advanceNote', width: 22 },
      { key: 'totalAmount', width: 14 },
      { key: 'creator', width: 14 },
      { key: 'status', width: 12 },
      { key: 'note', width: 24 },
    ]

    worksheet.mergeCells('A1:L1')
    worksheet.getCell('A1').value = getExportTitle()
    worksheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FF1F3852' } }
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(1).height = 30

    worksheet.mergeCells('A2:L2')
    worksheet.getCell('A2').value = getFilterText()
    worksheet.getCell('A2').font = { size: 11, color: { argb: 'FF6A5D52' } }
    worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.addRow([])
    worksheet.addRow(['总金额', summary.value.totalAmount, activeType.value === 'purchase' ? '已付金额' : '已收金额', summary.value.settledAmount, activeType.value === 'purchase' ? '待付金额' : '待收金额', summary.value.pendingAmount, '总重量', summary.value.weight, '单据数', summary.value.count])
    const summaryRow = worksheet.getRow(4)
    summaryRow.font = { bold: true, color: { argb: 'FF1F3852' } }
    summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E9DC' } }
    summaryRow.alignment = { vertical: 'middle' }

    const headerRow = worksheet.addRow([
      '#',
      '日期',
      activeType.value === 'purchase' ? '供应商' : '客户',
      '单号',
      '总重',
      activeType.value === 'purchase' ? '实付金额' : '实收金额',
      '上单金额',
      activeType.value === 'purchase' ? '预付（旧账）' : '预收（旧账）',
      '最终金额',
      '创建人',
      '付款状态',
      '备注',
    ])

    rows.forEach((row) => worksheet.addRow(row))

    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5F9D92' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.getColumn('E').numFmt = '0.00'
    worksheet.getColumn('F').numFmt = '¥#,##0.00'
    worksheet.getColumn('G').numFmt = '¥#,##0.00'
    worksheet.getColumn('I').numFmt = '¥#,##0.00'
    worksheet.getColumn('B').alignment = { horizontal: 'center' }
    worksheet.getColumn('E').alignment = { horizontal: 'right' }
    worksheet.getColumn('F').alignment = { horizontal: 'right' }
    worksheet.getColumn('G').alignment = { horizontal: 'right' }
    worksheet.getColumn('I').alignment = { horizontal: 'right' }

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9E0DD' } },
          left: { style: 'thin', color: { argb: 'FFD9E0DD' } },
          bottom: { style: 'thin', color: { argb: 'FFD9E0DD' } },
          right: { style: 'thin', color: { argb: 'FFD9E0DD' } },
        }
        cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true }
      })

      if (rowNumber > headerRow.number && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFAF3' } }
        })
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${getExportFileBase()}.xlsx`
    a.click()
    URL.revokeObjectURL(url)

    showToast('结算表格已导出', 'success')
  } catch (error) {
    console.error('导出结算表格失败:', error)
    showToast('导出失败，请重试', 'error')
  }
}

const exportImage = () => {
  const rows = buildExportRows()
  if (!rows.length) {
    showToast('暂无可导出的结算数据', 'error')
    return
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    showToast('导出图片失败，请重试', 'error')
    return
  }

  const width = 1500
  const padding = 48
  const rowHeight = 44
  const headerHeight = 44
  const visibleRows = rows.slice(0, 80)
  const height = 250 + headerHeight + visibleRows.length * rowHeight + 92

  canvas.width = width
  canvas.height = height

  ctx.fillStyle = '#fffaf3'
  ctx.fillRect(0, 0, width, height)

  const brand = getExportImageBrandName()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6a5d52'
  ctx.font = 'bold 30px "Microsoft YaHei", "SimSun", sans-serif'
  ctx.fillText(brand, width / 2, 48)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#3f3933'
  ctx.font = 'bold 34px "Microsoft YaHei", "SimSun", sans-serif'
  ctx.fillText(getExportTitle(), padding, 92)

  ctx.fillStyle = '#8b7d70'
  ctx.font = '18px "Microsoft YaHei", "SimSun", sans-serif'
  ctx.fillText(getFilterText(), padding, 126)

  const metricY = 154
  const metricWidth = 330
  const metrics = [
    ['总金额', formatMoney(summary.value.totalAmount)],
    [activeType.value === 'purchase' ? '已付金额' : '已收金额', formatMoney(summary.value.settledAmount)],
    [activeType.value === 'purchase' ? '待付金额' : '待收金额', formatMoney(summary.value.pendingAmount)],
    ['总重量 / 单据', `${summary.value.weight.toFixed(0)} 斤 / ${summary.value.count} 笔`],
  ]

  metrics.forEach(([label, value], index) => {
    const x = padding + index * (metricWidth + 16)
    ctx.fillStyle = '#fffdf9'
    ctx.strokeStyle = '#eadbc8'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, metricY, metricWidth, 72, 16)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#8b7d70'
    ctx.font = '16px "Microsoft YaHei", "SimSun", sans-serif'
    ctx.fillText(label, x + 18, metricY + 28)
    ctx.fillStyle = '#5f9d92'
    ctx.font = 'bold 22px "Microsoft YaHei", "SimSun", sans-serif'
    ctx.fillText(value, x + 18, metricY + 56)
  })

  const tableTop = 254
  const columns = [
    { label: '#', key: 'index', x: padding, width: 54, align: 'center' },
    { label: '日期', key: 'date', x: padding + 54, width: 126 },
    { label: activeType.value === 'purchase' ? '供应商' : '客户', key: 'partner', x: padding + 180, width: 190 },
    { label: '总重', key: 'weight', x: padding + 370, width: 110, align: 'right' },
    { label: activeType.value === 'purchase' ? '实付金额' : '实收金额', key: 'settlement', x: padding + 480, width: 160, align: 'right' },
    { label: '上单金额', key: 'pending', x: padding + 640, width: 150, align: 'right' },
    { label: '最终金额', key: 'totalAmount', x: padding + 790, width: 160, align: 'right' },
    { label: '创建人', key: 'creator', x: padding + 950, width: 140 },
    { label: '付款状态', key: 'status', x: padding + 1090, width: 120 },
    { label: '备注', key: 'note', x: padding + 1210, width: 230 },
  ]
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0)

  ctx.fillStyle = '#5f9d92'
  ctx.fillRect(padding, tableTop, tableWidth, headerHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 16px "Microsoft YaHei", "SimSun", sans-serif'
  columns.forEach((col) => {
    ctx.textAlign = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'
    const textX = col.align === 'right' ? col.x + col.width - 12 : col.align === 'center' ? col.x + col.width / 2 : col.x + 12
    ctx.fillText(col.label, textX, tableTop + 28)
  })

  ctx.font = '15px "Microsoft YaHei", "SimSun", sans-serif'
  visibleRows.forEach((row, index) => {
    const y = tableTop + headerHeight + index * rowHeight
    ctx.fillStyle = index % 2 === 0 ? '#fffdf9' : '#f8efe3'
    ctx.fillRect(padding, y, tableWidth, rowHeight)
    ctx.strokeStyle = '#eadbc8'
    ctx.beginPath()
    ctx.moveTo(padding, y + rowHeight)
    ctx.lineTo(padding + tableWidth, y + rowHeight)
    ctx.stroke()

    columns.forEach((col) => {
      let value = row[col.key]
      if (['settlement', 'pending', 'totalAmount'].includes(col.key)) value = formatMoney(value)
      if (col.key === 'weight') value = Number(value || 0).toFixed(0)
      value = String(value ?? '-')
      if (value.length > 16 && col.key === 'note') value = `${value.slice(0, 16)}...`
      if (value.length > 10 && col.key === 'partner') value = `${value.slice(0, 10)}...`

      ctx.fillStyle = col.key === 'status' ? '#5f9d92' : '#3f3933'
      ctx.textAlign = col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'
      const textX = col.align === 'right' ? col.x + col.width - 12 : col.align === 'center' ? col.x + col.width / 2 : col.x + 12
      ctx.fillText(value, textX, y + 28)
    })
  })

  ctx.textAlign = 'left'
  ctx.fillStyle = '#8b7d70'
  ctx.font = '16px "Microsoft YaHei", "SimSun", sans-serif'
  const footerText = rows.length > visibleRows.length
    ? `共 ${rows.length} 笔，图片展示前 ${visibleRows.length} 笔；完整数据请查看导出的表格。`
    : `共 ${rows.length} 笔结算明细。`
  ctx.fillText(footerText, padding, height - 38)

  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('导出图片失败，请重试', 'error')
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${getExportFileBase()}.png`
    link.click()
    URL.revokeObjectURL(url)
    showToast('结算图片已导出', 'success')
  }, 'image/png')
}

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'unpaid', label: '未付款' },
  { value: 'partial', label: '部分付' },
  { value: 'settled', label: '已结清' },
]

onMounted(async () => {
  await billStore.init()
  selectedMonth.value = months.value[0] || dayjs().format('YYYY-MM')
})
</script>

<template>
  <section class="settlement-page">
    <header class="settlement-hero">
      <div>
        <p class="eyebrow">Settlement Ledger</p>
        <h1>结算详情</h1>
        <p class="hero-desc">按进货和出货分别汇总每笔单据的实收、实付、未结和最终金额，便于对账、追款和查看详情。</p>
        <div class="export-actions">
          <button type="button" @click="exportToExcel">
            <AppIcon name="table" />
            <span>导出表格</span>
          </button>
          <button type="button" @click="exportImage">
            <AppIcon name="image" />
            <span>导出图片</span>
          </button>
        </div>
      </div>

      <div class="hero-total">
        <span>{{ activeType === 'purchase' ? '进货应付总额' : '出货应收总额' }}</span>
        <strong>{{ formatMoney(summary.totalAmount) }}</strong>
        <small>{{ summary.count }} 笔 · {{ summary.weight.toFixed(0) }} 斤</small>
      </div>
    </header>

    <div class="mode-tabs" role="tablist" aria-label="结算类型">
      <button
        v-for="tab in typeTabs"
        :key="tab.key"
        type="button"
        :class="['mode-tab', { active: activeType === tab.key }]"
        @click="activeType = tab.key; resetPage()"
      >
        <AppIcon :name="tab.icon" />
        <span>{{ tab.label }}</span>
        <small>{{ tab.note }}</small>
      </button>
    </div>

    <div class="summary-grid">
      <article class="summary-card">
        <span>总金额</span>
        <strong>{{ formatMoney(summary.totalAmount) }}</strong>
      </article>
      <article class="summary-card">
        <span>{{ activeType === 'purchase' ? '已付金额' : '已收金额' }}</span>
        <strong>{{ formatMoney(summary.settledAmount) }}</strong>
      </article>
      <article class="summary-card warning">
        <span>{{ activeType === 'purchase' ? '待付金额' : '待收金额' }}</span>
        <strong>{{ formatMoney(summary.pendingAmount) }}</strong>
      </article>
      <article class="summary-card">
        <span>总重量</span>
        <strong>{{ summary.weight.toFixed(0) }} 斤</strong>
      </article>
    </div>

    <section class="toolbar">
      <label class="field">
        <span>月份</span>
        <select v-model="selectedMonth" @change="resetPage">
          <option value="">全部月份</option>
          <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
        </select>
      </label>

      <label class="field">
        <span>付款状态</span>
        <select v-model="statusFilter" @change="resetPage">
          <option v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </label>

      <label class="field search-field">
        <span>搜索</span>
        <input
          v-model="keyword"
          type="search"
          placeholder="供应商、客户、单号、品种"
          @input="resetPage"
        />
      </label>
    </section>

    <section class="ledger-panel">
      <div class="panel-title">
        <div>
          <h2>{{ activeType === 'purchase' ? '进货结算明细' : '出货结算明细' }}</h2>
          <p>当前筛选共 {{ filteredRecords.length }} 笔，按日期分组展示。</p>
        </div>
        <div class="pager" v-if="filteredRecords.length > PAGE_SIZE">
          <button type="button" :disabled="page === 1" @click="page -= 1">
            <AppIcon name="chevron-left" />
          </button>
          <span>{{ page }} / {{ pageCount }}</span>
          <button type="button" :disabled="page === pageCount" @click="page += 1">
            <AppIcon name="chevron-right" />
          </button>
        </div>
      </div>

      <div v-if="billStore.loading" class="empty">结算数据加载中...</div>
      <div v-else-if="filteredRecords.length === 0" class="empty">暂无符合条件的结算单据</div>

      <div v-else class="date-groups">
        <article v-for="group in groupedByDate" :key="group.date" class="date-group">
          <div class="date-summary">
            <strong>{{ group.date }}</strong>
            <span>{{ group.rows.length }} 笔</span>
            <span>重量 {{ group.totalWeight.toFixed(0) }} 斤</span>
            <span>金额 {{ formatMoney(group.totalAmount) }}</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>日期</th>
                  <th>{{ activeType === 'purchase' ? '供应商' : '客户' }}</th>
                  <th>总重</th>
                  <th>{{ activeType === 'purchase' ? '实付金额' : '实收金额' }}</th>
                  <th>上单金额</th>
                  <th>{{ activeType === 'purchase' ? '预付（旧账）' : '预收（旧账）' }}</th>
                  <th>最终金额</th>
                  <th>创建人</th>
                  <th>付款状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(record, index) in group.rows" :key="record.id">
                  <td>{{ (page - 1) * PAGE_SIZE + index + 1 }}</td>
                  <td>{{ billDateOf(record) }}</td>
                  <td class="partner-cell">{{ partnerOf(record) }}</td>
                  <td class="accent-cell">{{ toNumber(record.totalWeight).toFixed(0) }}</td>
                  <td>{{ formatMoney(settlementOf(record)) }}</td>
                  <td>{{ formatMoney(pendingOf(record), { showSymbol: false }) }}</td>
                  <td>{{ record.note?.includes('旧账') ? record.note : '-' }}</td>
                  <td>{{ formatMoney(toNumber(record.totalAmount), { showSymbol: false }) }}</td>
                  <td>皖盛收货</td>
                  <td>
                    <span :class="['status-pill', rowTone(record)]">{{ statusText(record) }}</span>
                  </td>
                  <td>
                    <div class="actions">
                      <button type="button" @click="viewRecord(record)">详情</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped lang="scss">
.settlement-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-normal);
  padding-bottom: 20px;
}

.settlement-hero,
.toolbar,
.ledger-panel {
  background: var(--panel-bg);
  border: 1px solid var(--panel-line);
  border-radius: 24px;
  box-shadow: var(--shadow-card, 0 16px 34px rgba(21, 35, 42, 0.06));
  backdrop-filter: blur(14px);
}

.settlement-hero {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 18px;
  padding: 24px;
  background:
    linear-gradient(135deg, rgba(255, 250, 241, 0.88), rgba(255, 245, 232, 0.74)),
    var(--panel-bg);
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--secondary);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: var(--text-normal);
}

h1 {
  font-size: 30px;
  line-height: 1.08;
}

h2 {
  font-size: 20px;
}

.hero-desc,
.panel-title p,
.hero-total span,
.hero-total small,
.summary-card span,
.field span {
  color: var(--text-soft);
}

.hero-desc {
  max-width: 720px;
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.8;
}

.export-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.export-actions button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  background: var(--input-bg);
  color: var(--text-normal);
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.24s ease, background 0.24s ease;
}

.export-actions button:hover {
  transform: translateY(-1px);
  border-color: rgba(125, 183, 173, 0.42);
  background: var(--primary-soft);
}

.export-actions svg {
  width: 16px;
  height: 16px;
  color: var(--primary);
}

.hero-total {
  min-width: 260px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.48);
}

.hero-total strong {
  color: var(--text-normal);
  font-size: 28px;
  line-height: 1.1;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mode-tab {
  min-height: 72px;
  padding: 14px 18px;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  align-items: center;
  text-align: left;
  border: 1px solid var(--panel-line);
  border-radius: 18px;
  color: var(--text-normal);
  background: var(--card-bg);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.24s ease, background 0.24s ease;
}

.mode-tab svg {
  grid-row: span 2;
  width: 22px;
  height: 22px;
  color: var(--primary);
}

.mode-tab span {
  font-weight: 800;
}

.mode-tab small {
  color: var(--text-soft);
}

.mode-tab:hover,
.mode-tab.active {
  transform: translateY(-1px);
  border-color: rgba(125, 183, 173, 0.42);
  background: linear-gradient(135deg, rgba(125, 183, 173, 0.14), rgba(227, 187, 122, 0.12)), var(--card-bg);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  padding: 18px;
  border-radius: 20px;
  background: var(--card-bg);
  border: 1px solid var(--panel-line);
}

.summary-card strong {
  display: block;
  margin-top: 10px;
  color: var(--text-normal);
  font-size: 24px;
  line-height: 1.1;
}

.summary-card.warning strong {
  color: var(--danger);
}

.toolbar {
  display: grid;
  grid-template-columns: 180px 180px minmax(240px, 1fr);
  gap: 12px;
  padding: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 13px;
  font-weight: 700;
}

.field input,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-normal);
  outline: none;
}

.field input:focus,
.field select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(125, 183, 173, 0.16);
}

.ledger-panel {
  padding: 20px;
}

.panel-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-title p {
  margin: 6px 0 0;
  font-size: 13px;
}

.pager {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-soft);
}

.pager button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  background: var(--card-bg);
  color: var(--text-normal);
  cursor: pointer;
}

.pager button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.date-groups,
.date-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.date-group + .date-group {
  margin-top: 6px;
}

.date-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--text-soft);
  font-size: 13px;
}

.date-summary strong {
  color: var(--text-normal);
  font-size: 16px;
}

.date-summary span {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(125, 183, 173, 0.1);
}

.table-wrap {
  overflow-x: auto;
  border-radius: 16px;
  border: 1px solid var(--panel-line);
  background: var(--surface-strong);
}

table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
}

th,
td {
  padding: 13px 12px;
  text-align: left;
  border-bottom: 1px solid var(--panel-line);
  white-space: nowrap;
}

th {
  color: var(--text-soft);
  background: rgba(255, 250, 241, 0.74);
  font-size: 12px;
  font-weight: 800;
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover td {
  background: rgba(125, 183, 173, 0.06);
}

.partner-cell {
  font-weight: 700;
  color: var(--text-normal);
}

.accent-cell {
  color: var(--primary);
  font-weight: 800;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.status-pill.unpaid {
  color: #9a5840;
  background: rgba(217, 124, 112, 0.14);
}

.status-pill.partial {
  color: #8e652d;
  background: rgba(213, 168, 94, 0.18);
}

.status-pill.settled {
  color: #1d7a59;
  background: rgba(36, 147, 110, 0.14);
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: rgba(125, 183, 173, 0.12);
  color: var(--primary);
  font-weight: 800;
  cursor: pointer;
}

.actions button:hover {
  background: rgba(125, 183, 173, 0.2);
}

.empty {
  padding: 38px 20px;
  text-align: center;
  color: var(--text-soft);
}

@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .settlement-hero {
    flex-direction: column;
    padding: 20px;
  }

  .hero-total {
    min-width: 0;
  }

  .mode-tabs,
  .summary-grid,
  .toolbar {
    grid-template-columns: 1fr;
  }

  .search-field {
    grid-column: auto;
  }

  .panel-title {
    flex-direction: column;
  }
}

:global(html[data-theme='dark']) {
  .settlement-hero {
    background:
      linear-gradient(135deg, rgba(40, 44, 42, 0.92), rgba(31, 33, 31, 0.84)),
      var(--panel-bg);
  }

  .hero-total {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
  }

  th {
    background: rgba(255, 255, 255, 0.04);
  }
}
</style>
