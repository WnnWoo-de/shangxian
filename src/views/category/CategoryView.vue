<script setup>
import { computed, reactive, ref } from 'vue'
import { useCategoryStore } from '../../stores/category'
import { showToast } from '../../utils/toast'

const categoryStore = useCategoryStore()
categoryStore.init()
const keyword = ref('')

const showModal = ref(false)
const mode = ref('create')
const editingId = ref('')

const showDeleteConfirm = ref(false)
const deletingId = ref('')
const deletingName = ref('')

const form = reactive({
  name: '',
  unit: '斤',
  status: 'active',
  note: '',
})

const list = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return categoryStore.categories
  return categoryStore.categories.filter((item) => item.name.includes(kw))
})

const activeCount = computed(() => list.value.filter((item) => item.status === 'active').length)
const unitKinds = computed(() => new Set(list.value.map((item) => item.unit || '斤')).size)

const resetForm = () => {
  form.name = ''
  form.unit = '斤'
  form.status = 'active'
  form.note = ''
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
  form.unit = item.unit || '斤'
  form.status = item.status
  form.note = item.note || ''
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
    const success = await categoryStore.deleteCategory(deletingId.value)
    if (success) showToast('品类删除成功')
    else showToast('删除失败', 'error')
  } catch (error) {
    console.error('删除品类异常:', error)
    showToast('删除失败，请重试', 'error')
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
  if (!form.name.trim()) return showToast('请输入品类名称', 'error')

  const payload = {
    name: form.name.trim(),
    unit: form.unit,
    status: form.status,
    note: form.note.trim(),
  }

  try {
    if (mode.value === 'create') {
      await categoryStore.addCategory(payload)
      showToast('品类新建成功')
    } else {
      await categoryStore.updateCategory(editingId.value, payload)
      showToast('品类信息已更新')
    }

    showModal.value = false
  } catch (error) {
    console.error('保存品类失败:', error)
    showToast(error.message || '保存失败，请重试', 'error')
  }
}
</script>

<template>
  <section class="inner-page category-page">
    <header class="inner-page__hero">
      <div>
        <p class="inner-page__eyebrow">Category Matrix</p>
        <h1 class="inner-page__title">品类管理</h1>
        <p class="inner-page__desc">维护布料业务的基础品类、单位和备注说明，后续布料价格与开单都会引用这里的数据。</p>
      </div>
      <div class="inner-page__hero-stats">
        <div class="hero-stat">
          <span>品类总数</span>
          <strong>{{ list.length }}</strong>
          <small>筛选后结果</small>
        </div>
        <div class="hero-stat">
          <span>单位种类</span>
          <strong>{{ unitKinds }}</strong>
          <small>计重与计量方式</small>
        </div>
      </div>
    </header>

    <section class="inner-page__toolbar">
      <div class="inner-page__toolbar-group">
        <div class="inner-page__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input v-model="keyword" placeholder="搜索品类名称" />
        </div>
      </div>
      <button type="button" class="inner-page__btn" @click="openCreate">新增品类</button>
    </section>

    <section class="inner-page__stats-grid">
      <article class="inner-page__stat-card">
        <span>启用品类</span>
        <strong>{{ activeCount }}</strong>
      </article>
      <article class="inner-page__stat-card">
        <span>停用品类</span>
        <strong>{{ list.length - activeCount }}</strong>
      </article>
      <article class="inner-page__stat-card">
        <span>备注数量</span>
        <strong>{{ list.filter(item => item.note).length }}</strong>
      </article>
      <article class="inner-page__stat-card">
        <span>常用单位</span>
        <strong>{{ list[0]?.unit || '斤' }}</strong>
      </article>
    </section>

    <section class="inner-page__panel inner-page__desktop-only">
      <div class="inner-page__panel-title">
        <h3>品类列表</h3>
        <span class="inner-page__panel-tip">为布料与单据提供统一口径</span>
      </div>
      <div class="inner-page__table-wrap">
        <table class="inner-page__table">
          <thead>
            <tr>
              <th>品类名称</th>
              <th>单位</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td>
                <div class="category-line">
                  <strong>{{ item.name }}</strong>
                  <small v-if="item.note">{{ item.note }}</small>
                </div>
              </td>
              <td>{{ item.unit || '斤' }}</td>
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
              <td colspan="4" class="inner-page__empty">暂无相关数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="inner-page__cards inner-page__mobile-only">
      <article v-if="list.length === 0" class="inner-page__card inner-page__empty">暂无相关数据</article>
      <article v-for="item in list" :key="item.id" class="inner-page__card">
        <div class="category-card__top">
          <div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.unit || '斤' }}<span v-if="item.note"> · {{ item.note }}</span></p>
          </div>
          <span :class="['inner-page__status', item.status === 'active' ? 'inner-page__status--active' : 'inner-page__status--disabled']">
            {{ item.status === 'active' ? '启用' : '停用' }}
          </span>
        </div>
        <div class="inner-page__actions category-card__actions">
          <button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button>
          <button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button>
        </div>
      </article>
    </section>

    <Transition name="fade">
      <div v-if="showModal" class="inner-page__modal-mask" @click.self="showModal = false">
        <div class="inner-page__modal">
          <h3>{{ mode === 'create' ? '新增品类' : '编辑品类' }}</h3>
          <div class="inner-page__form-grid">
            <div class="inner-page__field">
              <span>品类名称</span>
              <input v-model="form.name" type="text" placeholder="例如：布条类" />
            </div>
            <div class="inner-page__field">
              <span>单位</span>
              <select v-model="form.unit">
                <option value="斤">斤</option>
                <option value="吨">吨</option>
                <option value="包">包</option>
              </select>
            </div>
            <div class="inner-page__field">
              <span>状态</span>
              <select v-model="form.status">
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </div>
            <div class="inner-page__field inner-page__field--full">
              <span>备注</span>
              <textarea v-model="form.note" rows="3"></textarea>
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
          <p>您确定要删除品类“{{ deletingName }}”吗？</p>
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
.category-line {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-line small,
.category-card__top p {
  color: var(--text-soft);
}

.category-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.category-card__top h3 {
  margin: 0;
  font-size: 18px;
}

.category-card__top p {
  margin: 8px 0 0;
  line-height: 1.6;
}

.category-card__actions {
  margin-top: 14px;
}
</style>
