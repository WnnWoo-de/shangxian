<script setup>
import { computed, reactive, ref } from 'vue'
import { useCustomerStore } from '../../stores/customer'
import { showToast } from '../../utils/toast'

const customerStore = useCustomerStore()
const keyword = ref('')

const showModal = ref(false)
const mode = ref('create')
const editingId = ref('')

const showDeleteConfirm = ref(false)
const deletingId = ref('')
const deletingName = ref('')

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
    if (success) showToast('客户删除成功')
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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
        <span class="inner-page__panel-tip">共 {{ list.length }} 条记录</span>
      </div>
      <div class="inner-page__table-wrap">
        <table class="inner-page__table">
          <thead>
            <tr>
              <th>客户名称</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td><strong>{{ item.name }}</strong></td>
              <td>{{ item.contact || item.contactPerson || '-' }}</td>
              <td>{{ item.phone || '-' }}</td>
              <td>
                <span :class="['inner-page__status', item.status === 'active' ? 'inner-page__status--active' : 'inner-page__status--disabled']">
                  {{ item.status === 'active' ? '启用' : '停用' }}
                </span>
              </td>
              <td>
                <div class="inner-page__actions">
                  <button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button>
                  <button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="list.length === 0">
              <td colspan="5" class="inner-page__empty">暂无相关数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="inner-page__cards inner-page__mobile-only">
      <article v-if="list.length === 0" class="inner-page__card inner-page__empty">暂无相关数据</article>
      <article v-for="item in list" :key="item.id" class="inner-page__card">
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
          <button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button>
          <button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button>
        </div>
      </article>
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
</style>
