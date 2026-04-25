<script setup>
import { computed, reactive, ref, watch } from 'vue'
import AppIcon from '../../components/icons/AppIcon.vue'
import { useFabricStore } from '../../stores/fabric'
import { showToast } from '../../utils/toast'

const fabricStore = useFabricStore()
fabricStore.init()

const keyword = ref('')
const showModal = ref(false)
const mode = ref('create')
const editingId = ref('')
const currentPage = ref(1)
const itemsPerPage = 6
const showDeleteConfirm = ref(false)
const deletingId = ref('')
const deletingName = ref('')

const form = reactive({ name: '', code: '', status: 'active', defaultPurchasePrice: 0, defaultSalePrice: 0 })
const list = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return fabricStore.fabrics
  return fabricStore.fabrics.filter((item) => item.name.includes(kw) || item.code.includes(kw))
})
const totalPages = computed(() => Math.max(1, Math.ceil(list.value.length / itemsPerPage)))
const paginatedList = computed(() => list.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage))
watch(keyword, () => { currentPage.value = 1 })
const prevPage = () => { if (currentPage.value > 1) currentPage.value-- }
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++ }

const resetForm = () => Object.assign(form, { name: '', code: '', status: 'active', defaultPurchasePrice: 0, defaultSalePrice: 0 })
const openCreate = () => { mode.value = 'create'; editingId.value = ''; resetForm(); showModal.value = true }
const openEdit = (item) => { mode.value = 'edit'; editingId.value = item.id; Object.assign(form, { name: item.name, code: item.code, status: item.status, defaultPurchasePrice: Number(item.defaultPurchasePrice || 0), defaultSalePrice: Number(item.defaultSalePrice || 0) }); showModal.value = true }
const openDelete = (item) => { showDeleteConfirm.value = true; deletingId.value = item.id; deletingName.value = item.name }
const cancelDelete = () => { showDeleteConfirm.value = false; deletingId.value = ''; deletingName.value = '' }

const confirmDelete = async () => {
  if (!deletingId.value) return
  try {
    const success = await fabricStore.deleteFabric(deletingId.value)
    if (success) showToast('品种删除成功')
    else showToast('删除失败', 'error')
  } catch (error) {
    console.error('删除品种异常:', error)
    showToast('删除失败，请重试', 'error')
  }
  cancelDelete()
}

const submit = async () => {
  if (!form.name.trim()) return showToast('请输入品种名称', 'error')
  if (!form.code.trim()) return showToast('请输入品种编号', 'error')
  const payload = { name: form.name.trim(), code: form.code.trim(), status: form.status, defaultPurchasePrice: Number(form.defaultPurchasePrice || 0), defaultSalePrice: Number(form.defaultSalePrice || 0) }
  try {
    if (mode.value === 'create') {
      await fabricStore.addFabric(payload)
      showToast('品种新增成功')
    } else {
      await fabricStore.updateFabric(editingId.value, payload)
      showToast('品种信息已更新')
    }
    showModal.value = false
  } catch (error) {
    console.error('保存品种失败:', error)
    showToast(error.message || '保存失败，请重试', 'error')
  }
}

const canMoveFabric = (item, direction) => {
  const index = fabricStore.fabrics.findIndex((fabric) => fabric.id === item.id)
  return direction === 'up' ? index > 0 : index >= 0 && index < fabricStore.fabrics.length - 1
}

const moveFabric = async (item, direction) => {
  const moved = await fabricStore.moveFabric(item.id, direction)
  if (moved) showToast('品种顺序已调整')
}
</script>

<template>
  <section class="inner-page fabric-page">
    <header class="inner-page__hero">
      <div>
        <p class="inner-page__eyebrow">Fabric Catalog</p>
        <h1 class="inner-page__title">品种管理</h1>
        <p class="inner-page__desc">统一维护品种编号与默认进出货价格，方便后续开单时一键带出。</p>
      </div>
      <div class="inner-page__hero-stats">
        <div class="hero-stat"><span>品种总数</span><strong>{{ list.length }}</strong><small>筛选结果</small></div>
      </div>
    </header>

    <section class="inner-page__toolbar">
      <div class="inner-page__toolbar-group">
        <div class="inner-page__search">
          <AppIcon name="search" />
          <input v-model="keyword" placeholder="搜索品种名称 / 编号" />
        </div>
      </div>
      <button type="button" class="inner-page__btn" @click="openCreate">新增品种</button>
    </section>

    <section class="inner-page__stats-grid">
      <article class="inner-page__stat-card"><span>启用品种</span><strong>{{ list.filter(item => item.status === 'active').length }}</strong></article>
      <article class="inner-page__stat-card"><span>分页页数</span><strong>{{ totalPages }}</strong></article>
      <article class="inner-page__stat-card"><span>含进货价</span><strong>{{ list.filter(item => Number(item.defaultPurchasePrice || 0) > 0).length }}</strong></article>
      <article class="inner-page__stat-card"><span>含出货价</span><strong>{{ list.filter(item => Number(item.defaultSalePrice || 0) > 0).length }}</strong></article>
    </section>

    <section class="inner-page__panel inner-page__desktop-only">
      <div class="inner-page__panel-title"><h3>品种列表</h3><span class="inner-page__panel-tip">第 {{ currentPage }} / {{ totalPages }} 页</span></div>
      <div class="inner-page__table-wrap">
        <table class="inner-page__table">
          <thead><tr><th>品种名称</th><th>品种编号</th><th>进货价</th><th>出货价</th><th>状态</th><th>顺序</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in paginatedList" :key="item.id">
              <td><strong>{{ item.name }}</strong></td>
              <td>{{ item.code }}</td>
              <td>¥ {{ Number(item.defaultPurchasePrice || 0).toFixed(2) }}</td>
              <td>¥ {{ Number(item.defaultSalePrice || 0).toFixed(2) }}</td>
              <td><span :class="['inner-page__status', item.status === 'active' ? 'inner-page__status--active' : 'inner-page__status--disabled']">{{ item.status === 'active' ? '启用' : '停用' }}</span></td>
              <td><div class="inner-page__actions order-actions"><button type="button" class="inner-page__btn-text" :disabled="!canMoveFabric(item, 'up')" @click="moveFabric(item, 'up')">上移</button><button type="button" class="inner-page__btn-text" :disabled="!canMoveFabric(item, 'down')" @click="moveFabric(item, 'down')">下移</button></div></td>
              <td><div class="inner-page__actions"><button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button><button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button></div></td>
            </tr>
            <tr v-if="list.length === 0"><td colspan="7" class="inner-page__empty">暂无相关数据</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination-bar" v-if="list.length > 0">
        <button type="button" class="inner-page__btn-ghost pagination-bar__btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
        <span>共 {{ list.length }} 个品种，第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button type="button" class="inner-page__btn-ghost pagination-bar__btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
      </div>
    </section>

    <section class="inner-page__cards inner-page__mobile-only">
      <article v-if="list.length === 0" class="inner-page__card inner-page__empty">暂无相关数据</article>
      <article v-for="item in paginatedList" :key="item.id" class="inner-page__card">
        <div class="fabric-card__top">
          <div><h3>{{ item.name }}</h3><p>{{ item.code }}</p></div>
          <span :class="['inner-page__status', item.status === 'active' ? 'inner-page__status--active' : 'inner-page__status--disabled']">{{ item.status === 'active' ? '启用' : '停用' }}</span>
        </div>
        <div class="fabric-card__price-grid"><div><span>进货价</span><strong>¥ {{ Number(item.defaultPurchasePrice || 0).toFixed(2) }}</strong></div><div><span>出货价</span><strong>¥ {{ Number(item.defaultSalePrice || 0).toFixed(2) }}</strong></div></div>
        <div class="inner-page__actions fabric-card__actions"><button type="button" class="inner-page__btn-text" :disabled="!canMoveFabric(item, 'up')" @click="moveFabric(item, 'up')">上移</button><button type="button" class="inner-page__btn-text" :disabled="!canMoveFabric(item, 'down')" @click="moveFabric(item, 'down')">下移</button><button type="button" class="inner-page__btn-text" @click="openEdit(item)">编辑</button><button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="openDelete(item)">删除</button></div>
      </article>
      <div class="pagination-bar" v-if="list.length > 0"><button type="button" class="inner-page__btn-ghost pagination-bar__btn" :disabled="currentPage === 1" @click="prevPage">上一页</button><span>{{ currentPage }} / {{ totalPages }}</span><button type="button" class="inner-page__btn-ghost pagination-bar__btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button></div>
    </section>

    <Transition name="fade">
      <div v-if="showModal" class="inner-page__modal-mask" @click.self="showModal = false">
        <div class="inner-page__modal">
          <h3>{{ mode === 'create' ? '新增品种' : '编辑品种' }}</h3>
          <div class="inner-page__form-grid">
            <div class="inner-page__field"><span>品种名称</span><input v-model="form.name" type="text" placeholder="例如：X灰条" /></div>
            <div class="inner-page__field"><span>品种编号</span><input v-model="form.code" type="text" /></div>
            <div class="inner-page__field"><span>进货价 (元/斤)</span><input v-model.number="form.defaultPurchasePrice" type="number" step="0.01" min="0" /></div>
            <div class="inner-page__field"><span>出货价 (元/斤)</span><input v-model.number="form.defaultSalePrice" type="number" step="0.01" min="0" /></div>
            <div class="inner-page__field"><span>状态</span><select v-model="form.status"><option value="active">启用</option><option value="disabled">停用</option></select></div>
          </div>
          <footer class="inner-page__modal-actions"><button type="button" class="inner-page__btn-ghost" @click="showModal = false">取消</button><button type="button" class="inner-page__btn" @click="submit">保存</button></footer>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showDeleteConfirm" class="inner-page__modal-mask" @click.self="cancelDelete">
        <div class="inner-page__modal">
          <h3>确认删除</h3>
          <p>您确定要删除品种“{{ deletingName }}”吗？</p>
          <p class="inner-page__warning">此操作无法撤销，请谨慎操作。</p>
          <footer class="inner-page__modal-actions"><button type="button" class="inner-page__btn-ghost" @click="cancelDelete">取消</button><button type="button" class="inner-page__btn-danger" @click="confirmDelete">确认删除</button></footer>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped lang="scss">
.pagination-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px;color:var(--text-soft)}
.pagination-bar__btn{min-width:110px}
.fabric-card__top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.fabric-card__top h3{margin:0;font-size:18px}.fabric-card__top p{margin:8px 0 0;color:var(--text-soft);line-height:1.6}
.fabric-card__price-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.fabric-card__price-grid div{padding:14px;border-radius:16px;background:rgba(255,255,255,.46)}.fabric-card__price-grid span{display:block;font-size:12px;color:var(--text-soft)}.fabric-card__price-grid strong{display:block;margin-top:8px;font-size:18px;color:var(--text-normal)}
.fabric-card__actions{margin-top:14px}
.order-actions .inner-page__btn-text:disabled,
.fabric-card__actions .inner-page__btn-text:disabled{cursor:not-allowed;opacity:.42}
</style>
