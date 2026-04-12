<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBillRecordStore } from '../../stores/billRecord'
import { useCustomerStore } from '../../stores/customer'
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
  fabricId: '', // 新增：布料ID
})

const rows = ref([])
const saving = ref(false)
const deleting = ref(false)

const supplierSearch = ref('')
const fabricSearch = ref('')
const showSupplierOptions = ref(false)
const showFabricOptions = ref(false)
const showFabricOptionsForRow = ref({})
const focusedFabricRowId = ref('')

const suppliers = computed(() => customerStore.activeCustomers)
const fabrics = computed(() => fabricStore.activeFabrics)

const filteredSuppliers = computed(() => {
  const keyword = supplierSearch.value.trim().toLowerCase()
  if (!keyword) return suppliers.value
  return suppliers.value.filter((item) => String(item.name || '').toLowerCase().includes(keyword) || String(item.contact || item.contactPerson || '').toLowerCase().includes(keyword) || String(item.phone || '').includes(keyword))
})

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
      quantityInput: item.quantityInput,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      note: item.note,
    }))
  } else if (Array.isArray(record.details) && record.details.length) {
    rows.value = record.details.map((item) => ({
      id: item.id,
      fabricId: item.fabricId,
      fabricName: item.fabricName,
      quantityInput: item.quantityInput,
      quantity: Number(item.quantity || 0),
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

    // 标题栏
    worksheet.columns = [
      { header: '布料', key: 'fabric', width: 20 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '单价', key: 'unitPrice', width: 10 },
      { header: '金额', key: 'amount', width: 10 },
      { header: '备注', key: 'note', width: 30 },
    ]

    // 填充数据
    rows.value.forEach((row) => {
      const total = Number(row.quantity) * Number(row.unitPrice)
      worksheet.addRow({
        fabric: row.fabricName,
        quantity: Number(row.quantity),
        unitPrice: formatMoney(row.unitPrice),
        amount: formatMoney(total),
        note: row.note,
      })
    })

    // 添加总金额行
    const totalAmount = rows.value.reduce((sum, row) => sum + (Number(row.quantity) * Number(row.unitPrice)), 0)
    worksheet.addRow({ fabric: '合计', amount: formatMoney(totalAmount) })

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
  if (!isEditing.value) return
  try {
    await billRecordStore.deleteRecord(currentRecord.value.id)
    showToast('删除成功')
    router.push('/purchase/list')
  } catch (error) {
    console.error('删除失败:', error)
    showToast(error.message || '删除失败，请重试')
  }
}
</script>
