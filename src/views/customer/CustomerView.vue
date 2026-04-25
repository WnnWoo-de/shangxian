<script setup>
import { computed, reactive, ref, watch } from 'vue'
import AppIcon from '../../components/icons/AppIcon.vue'
import { useCustomerStore } from '../../stores/customer'
import { useCustomerPriceStore } from '../../stores/customerPrice'
import { useFabricStore } from '../../stores/fabric'
import { showToast } from '../../utils/toast'

const customerStore = useCustomerStore()
const customerPriceStore = useCustomerPriceStore()
const fabricStore = useFabricStore()
customerPriceStore.init()
fabricStore.init()
const keyword = ref('')

const showModal = ref(false)
const mode = ref('create')
const editingId = ref('')

const showDeleteConfirm = ref(false)
const deletingId = ref('')
const deletingName = ref('')
const showPriceModal = ref(false)
const priceCustomer = ref(null)
const priceRows = ref([])

const form = reactive({
  name: '',
  contact: '',
  phone: '',
  status: 'active',
})

const list = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return customerStore.customers
  return customerStore.customers.filter((item) => {
    const name = String(item.name || '')
    const contact = String(item.contact || item.contactPerson || '')
    const phone = String(item.phone || '')
    return name.includes(kw) || contact.includes(kw) || phone.includes(kw)
  })
})

const activeCount = computed(() => list.value.filter((item) => item.status === 'active').length)
const disabledCount = computed(() => list.value.filter((item) => item.status !== 'active').length)

const pageSizeOptions = [10, 20, 50]
const currentPage = ref(1)
const pageSize = ref(10)
const totalPages = computed(() => Math.max(1, Math.ceil(list.value.length / pageSize.value)))
const paginationStart = computed(() => list.value.length ? (currentPage.value - 1) * pageSize.value + 1 : 0)
const paginationEnd = computed(() => Math.min(currentPage.value * pageSize.value, list.value.length))
const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})
const visiblePages = computed(() => {
  const count = Math.min(5, totalPages.value)
  let start = Math.max(1, currentPage.value - Math.floor(count / 2))
  let end = Math.min(totalPages.value, start + count - 1)
  start = Math.max(1, end - count + 1)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const goToPage = (page) => {
  currentPage.value = Math.min(Math.max(Number(page) || 1, 1), totalPages.value)
}

watch(keyword, () => {
  currentPage.value = 1
})

watch([() => list.value.length, pageSize], () => {
  goToPage(currentPage.value)
})

const resetForm = () => {
  form.name = ''
  form.contact = ''
  form.phone = ''
  form.status = 'active'
}

const openCreate = () => {
  mode.value = 'create'
  editingId.value = ''
  resetForm()
  showModal.value = true
}

const openEdit = (item) => {
  mode.value = 'edit'
  editingId.value = item.id
  form.name = item.name
  form.contact = item.contact || item.contactPerson || ''
  form.phone = item.phone || ''
  form.status = item.status
  showModal.value = true
}

const openDelete = (item) => {
  showDeleteConfirm.value = true
  deletingId.value = item.id
  deletingName.value = item.name
}

const confirmDelete = async () => {
  if (!deletingId.value) return
  try {
    const success = await customerStore.deleteCustomer(deletingId.value)
    if (success) {
      customerPriceStore.removeCustomerPrices(deletingId.value)
      showToast('客户删除成功')
    }
    else showToast('删除失败', 'error')
  } catch (error) {
    console.error('删除客户异常:', error)
    showToast(error.message, 'error')
  }
  showDeleteConfirm.value = false
  deletingId.value = ''
  deletingName.value = ''
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  deletingId.value = ''
  deletingName.value = ''
}

const openPriceSettings = (item) => {
  priceCustomer.value = item
  priceRows.value = fabricStore.activeFabrics.map((fabric) => {
    const saved = customerPriceStore.getPrice(item.id, fabric.id)
    return {
      fabricId: fabric.id,
      fabricName: fabric.name,
      defaultPurchasePrice: Number(fabric.defaultPurchasePrice || 0),
      defaultSalePrice: Number(fabric.defaultSalePrice || 0),
      purchasePrice: Number(saved?.purchasePrice || 0),
      salePrice: Number(saved?.salePrice || 0),
    }
  })
  showPriceModal.value = true
}

const savePriceSettings = () => {
  if (!priceCustomer.value) return

  priceRows.value.forEach((row) => {
    const purchasePrice = Number(row.purchasePrice || 0)
    const salePrice = Number(row.salePrice || 0)

    if (purchasePrice > 0 || salePrice > 0) {
      customerPriceStore.upsertPrice({
        customerId: priceCustomer.value.id,
        customerName: priceCustomer.value.name,
        fabricId: row.fabricId,
        fabricName: row.fabricName,
        purchasePrice,
        salePrice,
      })
      return
    }

    customerPriceStore.removePrice(priceCustomer.value.id, row.fabricId)
  })

  showPriceModal.value = false
  showToast('客户品种价格已保存')
}

const submit = async () => {
  if (!form.name.trim()) return showToast('请输入客户名称', 'error')
  if (!form.contact.trim()) return showToast('请输入联系人', 'error')
  if (!form.phone.trim()) return showToast('请输入联系电话', 'error')

  const payload = {
    name: form.name.trim(),
    contact: form.contact.trim(),
    phone: form.phone.trim(),
    status: form.status,
  }

  try {
    if (mode.value === 'create') {
      await customerStore.addCustomer(payload)
      showToast('客户新建成功')
    } else {
      await customerStore.updateCustomer(editingId.value, payload)
      showToast('客户信息已更新')
    }

    showModal.value = false
  } catch (error) {
    console.error('保存客户失败:', error)
    showToast(error.message || '保存失败，请重试', 'error')
  }
}

const canMoveCustomer = (item, direction) => {
  const index = customerStore.customers.findIndex((customer) => customer.id === item.id)
  return direction === 'up' ? index > 0 : index >= 0 && index < customerStore.customers.length - 1
}

const moveCustomer = async (item, direction) => {
  const moved = await customerStore.moveCustomer(item.id, direction)
  if (moved) showToast('客户顺序已调整')
}
</script>

<template>
  <section class="inner-page customer-page">
    <header class="inner-page__hero">
      <div>
        <p class="inner-page__eyebrow">Customer Ledger</p>
        <h1 class="inner-page__title">客户管理</h1>
        <p class="inner-page__desc">集中维护往来客户、联系人与电话，让采购和出货开单时能直接选择，减少重复录入。</p>
      </div>
      <div class="inner-page__hero-stats">
        <div class="hero-stat">
          <span>客户总数</span>
          <strong>{{ list.length }}</strong>
          <small>当前筛选结果</small>
        </div>
        <div class="hero-stat">
          <span>启用客户</span>
          <strong>{{ activeCount }}</strong>
          <small>可用于业务录单</small>
        </div>
      </div>
    </header>

    <section class="inner-page__toolbar">
      <div class="inner-page__toolbar-group">
        <div class="inner-page__search">
          <AppIcon name="search" />
          <input v-model="keyword" placeholder="搜索客户名 / 联系人 / 电话" />
        </div>
      </div>
      <button type="button" class="inner-page__btn" @click="openCreate">新增客户</button>
    </section>

    <section class="inner-page__stats-grid">
      <article class="inner-page__stat-card">
        <span>启用</span>
        <strong>{{ activeCount }}</strong>
      </article>
      <article class="inner-page__stat-card">
        <span>停用</span>
        <strong>{{ disabledCount }}</strong>
      </article>
      <article class="inner-page__stat-card">
        <span>联系人覆盖</span>
        <strong>{{ list.filter(item => item.contact).length }}</strong>
      </article>
      <article class="inner-page__stat-card">
        <span>电话覆盖</span>
        <strong>{{ list.filter(item => item.phone).length }}</strong>
      </article>
    </section>

    <section class="inner-page__panel inner-page__desktop-only">
      <div class="inner-page__panel-title">
        <h3>客户列表</h3>
        <span class="inner-page__panel-tip">共 {{ list.length }} 条，当前显示 {{ paginationStart }}-{{ paginationEnd }} 条</span>
      </div>
      <div class="inner-page__table-wrap">
        <table class="inner-page__table">
          <thead>
            <tr>
              <th>客户名称</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>状态</th>
              <th>顺序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedList" :key="item.id">
              <td><strong>{{ item.name }}</strong></td>
              <td>{{ item.contact || item.contactPerson || '-' }}</td>
              <td>{{ item.phone || '-' }}</td>
              <td>
                <span :class="['inner-page__status', item.status === 'active' ? 'inner-page__status--active' : 'inner-page__status--disabled']">
                  {{ item.status === 'active' ? '启用' : '停用' }}
                </span>
              </td>
              <td>
                <div class="inner-page__actions order-actions">
                  <button type="button" class="inner-page__btn-text" :disabled="!canMoveCustomer(item, 'up')" @click="moveCustomer(item, 'up')">上移</button>
                  <button type="button" class="inner-page__btn-text" :disabled="!canMoveCustomer(item, 'down')" @click="moveCustomer(item, 'down')">下移</button>
                </div>
              </td>
              <td>
                <div class="inner-page__actions">
                  <button type="button" class="inner-page__btn-text" @click="openPriceSettings(item)">价格</button>
                  <button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button>
                  <button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="6" class="inner-page__empty">暂无相关数据</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="list.length > 0" class="customer-pagination">
        <div class="customer-pagination__size">
          <span>每页</span>
          <select v-model.number="pageSize">
            <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
          </select>
          <span>条</span>
        </div>
        <div class="customer-pagination__actions">
          <button type="button" :disabled="currentPage <= 1" @click="goToPage(1)">首页</button>
          <button type="button" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">上一页</button>
          <button
            v-for="page in visiblePages"
            :key="page"
            type="button"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <button type="button" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">下一页</button>
          <button type="button" :disabled="currentPage >= totalPages" @click="goToPage(totalPages)">末页</button>
        </div>
        <div class="customer-pagination__summary">第 {{ currentPage }} / {{ totalPages }} 页</div>
      </div>
    </section>

    <section class="inner-page__cards inner-page__mobile-only">
      <article v-if="list.length === 0" class="inner-page__card inner-page__empty">暂无相关数据</article>
      <article v-for="item in paginatedList" :key="item.id" class="inner-page__card">
        <div class="customer-card__top">
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.contact || item.contactPerson || '-' }} · {{ item.phone || '-' }}</p>
          </div>
          <span :class="['inner-page__status', item.status === 'active' ? 'inner-page__status--active' : 'inner-page__status--disabled']">
            {{ item.status === 'active' ? '启用' : '停用' }}
          </span>
        </div>
        <div class="inner-page__actions customer-card__actions">
          <button type="button" class="inner-page__btn-text" :disabled="!canMoveCustomer(item, 'up')" @click="moveCustomer(item, 'up')">上移</button>
          <button type="button" class="inner-page__btn-text" :disabled="!canMoveCustomer(item, 'down')" @click="moveCustomer(item, 'down')">下移</button>
          <button type="button" class="inner-page__btn-text" @click="openPriceSettings(item)">价格</button>
          <button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button>
          <button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button>
        </div>
      </article>
      <div v-if="list.length > 0" class="customer-pagination customer-pagination--mobile">
        <div class="customer-pagination__size">
          <span>每页</span>
          <select v-model.number="pageSize">
            <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
          </select>
          <span>条</span>
        </div>
        <div class="customer-pagination__actions">
          <button type="button" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">上一页</button>
          <button type="button" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">下一页</button>
        </div>
        <div class="customer-pagination__summary">第 {{ currentPage }} / {{ totalPages }} 页，共 {{ list.length }} 条</div>
      </div>
    </section>

    <Transition name="fade">
      <div v-if="showModal" class="inner-page__modal-mask" @click.self="showModal = false">
        <div class="inner-page__modal">
          <h3>{{ mode === 'create' ? '新增客户' : '编辑客户' }}</h3>
          <div class="inner-page__form-grid">
            <div class="inner-page__field">
              <span>客户名称</span>
              <input v-model="form.name" type="text" />
            </div>
            <div class="inner-page__field">
              <span>联系人</span>
              <input v-model="form.contact" type="text" />
            </div>
            <div class="inner-page__field">
              <span>联系电话</span>
              <input v-model="form.phone" type="text" />
            </div>
            <div class="inner-page__field">
              <span>状态</span>
              <select v-model="form.status">
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </div>
          </div>
          <footer class="inner-page__modal-actions">
            <button type="button" class="inner-page__btn-ghost" @click="showModal = false">取消</button>
            <button type="button" class="inner-page__btn" @click="submit">保存</button>
          </footer>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="inner-page__modal-mask" @click.self="cancelDelete">
        <div class="inner-page__modal">
          <h3>确认删除</h3>
          <p>您确定要删除客户“{{ deletingName }}”吗？</p>
          <p class="inner-page__warning">此操作无法撤销，请谨慎操作。</p>
          <footer class="inner-page__modal-actions">
            <button type="button" class="inner-page__btn-ghost" @click="cancelDelete">取消</button>
            <button type="button" class="inner-page__btn-danger" @click="confirmDelete">确认删除</button>
          </footer>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showPriceModal" class="inner-page__modal-mask" @click.self="showPriceModal = false">
        <div class="inner-page__modal customer-price-modal">
          <h3>{{ priceCustomer?.name || '' }} - 品种价格</h3>
          <p class="price-modal-tip">为空时开单会使用品种默认价；填写后，该客户选择对应品种会自动带出此价格。</p>
          <div class="price-table-wrap">
            <table class="price-table">
              <thead>
                <tr>
                  <th>品种</th>
                  <th>默认进价</th>
                  <th>客户进价</th>
                  <th>默认出价</th>
                  <th>客户出价</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in priceRows" :key="row.fabricId">
                  <td><strong>{{ row.fabricName }}</strong></td>
                  <td>¥ {{ row.defaultPurchasePrice.toFixed(2) }}</td>
                  <td><input v-model.number="row.purchasePrice" type="number" min="0" step="0.01" placeholder="默认" /></td>
                  <td>¥ {{ row.defaultSalePrice.toFixed(2) }}</td>
                  <td><input v-model.number="row.salePrice" type="number" min="0" step="0.01" placeholder="默认" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <footer class="inner-page__modal-actions">
            <button type="button" class="inner-page__btn-ghost" @click="showPriceModal = false">取消</button>
            <button type="button" class="inner-page__btn" @click="savePriceSettings">保存价格</button>
          </footer>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped lang="scss">
.customer-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.customer-card__top h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-normal);
}

.customer-card__top p {
  margin: 8px 0 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.customer-card__actions {
  margin-top: 14px;
}

.customer-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding-top: 16px;
  margin-top: 14px;
  border-top: 1px solid rgba(139, 125, 112, 0.12);
}

.customer-pagination__size,
.customer-pagination__summary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.customer-pagination__size select {
  height: 34px;
  padding: 0 28px 0 10px;
  border: 1px solid rgba(139, 125, 112, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-normal);
  font-weight: 700;
  outline: none;
}

.customer-pagination__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.customer-pagination__actions button {
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(139, 125, 112, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--text-normal);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.customer-pagination__actions button:hover:not(:disabled) {
  background: rgba(35, 120, 98, 0.1);
  border-color: rgba(35, 120, 98, 0.28);
  color: #167c63;
}

.customer-pagination__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.customer-pagination__actions button.active {
  background: #167c63;
  border-color: #167c63;
  color: #fff;
}

.customer-pagination--mobile {
  justify-content: center;
  padding: 14px;
}

.order-actions .inner-page__btn-text:disabled,
.customer-card__actions .inner-page__btn-text:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.customer-price-modal {
  width: min(920px, 100%);
}

.price-modal-tip {
  margin: -6px 0 16px;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.7;
}

.price-table-wrap {
  max-height: min(58vh, 520px);
  overflow: auto;
  border: 1px solid rgba(139, 125, 112, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
}

.price-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}

.price-table th,
.price-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(139, 125, 112, 0.1);
  text-align: left;
  font-size: 13px;
}

.price-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(255, 250, 241, 0.96);
  color: var(--text-soft);
}

.price-table input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid rgba(139, 125, 112, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-normal);
  outline: none;
}

@media (max-width: 768px) {
  .customer-card__top h3 {
    font-size: 17px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .customer-card__top p {
    font-size: 13px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .customer-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .customer-card__actions .inner-page__btn-text {
    min-height: 40px;
    border-radius: 12px;
    background: rgba(255, 250, 241, 0.9);
    border: 1px solid rgba(139, 125, 112, 0.12);
  }

  .customer-pagination {
    justify-content: center;
  }

  .customer-pagination__size,
  .customer-pagination__summary {
    width: 100%;
    justify-content: center;
  }

  .customer-pagination__actions {
    width: 100%;
  }

  .customer-pagination__actions button {
    min-width: 40px;
    height: 40px;
  }

  .customer-price-modal {
    width: 100%;
  }

  .price-table-wrap {
    max-height: calc(100dvh - 220px);
  }
}

@media (max-width: 480px) {
  .customer-card__actions {
    grid-template-columns: 1fr;
  }
}
</style>
