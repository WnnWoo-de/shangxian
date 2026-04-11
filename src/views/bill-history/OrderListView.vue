<script setup>
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBillRecordStore } from '../../stores/billRecord'
import { formatMoney } from '../../utils/money'
import { showToast } from '../../utils/toast'

const props = defineProps({ type: { type: String, default: 'purchase' } })
const router = useRouter()
const route = useRoute()
const billRecordStore = useBillRecordStore()
billRecordStore.init()

const isPurchase = computed(() => props.type !== 'sale')
const quickDate = computed(() => String(route.query.quickDate || '').trim())
const selectedDate = computed(() => quickDate.value || '')
const pageTitle = computed(() => isPurchase.value ? (selectedDate.value ? `${selectedDate.value} 进货列表` : '进货列表') : (selectedDate.value ? `${selectedDate.value} 出货列表` : '出货列表'))
const amountLabel = computed(() => isPurchase.value ? '进货金额' : '出货金额')
const settlementLabel = computed(() => isPurchase.value ? '已付款' : '已收款')
const eyebrow = computed(() => isPurchase.value ? 'Purchase Bills' : 'Sale Bills')

const filters = reactive({ partnerName: '', dateStart: selectedDate.value, dateEnd: selectedDate.value })
watch(selectedDate, (value) => { filters.dateStart = value; filters.dateEnd = value }, { immediate: true })

const list = computed(() => billRecordStore.getRecordsByType(isPurchase.value ? 'purchase' : 'sale').filter((record) => {
  if (filters.partnerName && !String(record.partnerName || '').includes(filters.partnerName.trim())) return false
  if (filters.dateStart && record.billDate < filters.dateStart) return false
  if (filters.dateEnd && record.billDate > filters.dateEnd) return false
  return true
}))

const totals = computed(() => list.value.reduce((acc, cur) => {
  acc.weight += Number(cur.totalWeight || 0)
  acc.amount += Number(cur.totalAmount || 0)
  acc.settlement += Number(isPurchase.value ? cur.paidAmount || 0 : cur.receivedAmount || 0)
  return acc
}, { weight: 0, amount: 0, settlement: 0 }))

const openCreate = () => router.push(isPurchase.value ? '/purchase/create' : '/sale/create')
const viewDetail = (id) => router.push(isPurchase.value ? `/purchase/view/${id}` : `/sale/view/${id}`)
const editBill = (id) => router.push(isPurchase.value ? `/purchase/edit/${id}` : `/sale/edit/${id}`)

const deleteBill = async (id) => {
  if (!confirm('确定要删除此单据吗？删除后不可恢复')) return
  try {
    const deleted = await billRecordStore.deleteRecord(id)
    if (!deleted) return showToast('删除失败：未找到单据', 'error')
    showToast('单据已删除', 'success')
  } catch (error) {
    console.error('删除失败:', error)
    showToast('删除失败，请重试', 'error')
  }
}

const clearQuickFilter = () => {
  router.replace({ path: route.path, query: { ...route.query, quickDate: undefined } })
}
</script>

<template>
  <section class="inner-page order-list-page">
    <header class="inner-page__hero" :class="{ 'inner-page__hero--dark': true }">
      <div>
        <p class="inner-page__eyebrow">{{ eyebrow }}</p>
        <h1 class="inner-page__title">{{ pageTitle }}</h1>
        <p class="inner-page__desc">按日期、往来对象查看已生成单据，适合做每日复盘和业务核对。</p>
      </div>
      <div class="inner-page__hero-stats">
        <div class="hero-stat"><span>单据数量</span><strong>{{ list.length }}</strong><small>当前结果</small></div>
        <div class="hero-stat"><span>{{ amountLabel }}</span><strong>{{ formatMoney(totals.amount) }}</strong><small>{{ settlementLabel }} {{ formatMoney(totals.settlement) }}</small></div>
      </div>
    </header>

    <section class="inner-page__stats-grid">
      <article class="inner-page__stat-card"><span>总重量</span><strong>{{ totals.weight.toFixed(2) }}</strong></article>
      <article class="inner-page__stat-card"><span>{{ amountLabel }}</span><strong>{{ formatMoney(totals.amount) }}</strong></article>
      <article class="inner-page__stat-card"><span>{{ settlementLabel }}</span><strong>{{ formatMoney(totals.settlement) }}</strong></article>
      <article class="inner-page__stat-card"><span>未结单据</span><strong>{{ list.filter(item => Number(item.unsettledAmount || 0) > 0).length }}</strong></article>
    </section>

    <section class="inner-page__toolbar">
      <div class="inner-page__toolbar-group filters-grid">
        <input v-model="filters.partnerName" type="text" placeholder="按往来对象搜索" />
        <input v-model="filters.dateStart" type="date" />
        <input v-model="filters.dateEnd" type="date" />
        <button v-if="selectedDate" type="button" class="inner-page__btn-ghost" @click="clearQuickFilter">查看全部</button>
      </div>
      <button type="button" class="inner-page__btn" @click="openCreate">{{ isPurchase ? '新增进货单' : '新增出货单' }}</button>
    </section>

    <section class="inner-page__panel inner-page__desktop-only">
      <div class="inner-page__panel-title"><h3>单据列表</h3><span class="inner-page__panel-tip">支持查看、编辑、删除</span></div>
      <div class="inner-page__table-wrap">
        <table class="inner-page__table">
          <thead><tr><th>单号</th><th>日期</th><th>往来对象</th><th>重量</th><th>{{ amountLabel }}</th><th>{{ settlementLabel }}</th><th>未结金额</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td>{{ item.billNo }}</td>
              <td>{{ item.billDate }}</td>
              <td>{{ item.partnerName }}</td>
              <td>{{ Number(item.totalWeight || 0).toFixed(2) }} 斤</td>
              <td>{{ formatMoney(item.totalAmount) }}</td>
              <td>{{ formatMoney(isPurchase ? item.paidAmount : item.receivedAmount) }}</td>
              <td>{{ formatMoney(item.unsettledAmount) }}</td>
              <td><span :class="['inner-page__status', item.status === 'settled' ? 'inner-page__status--settled' : 'inner-page__status--confirmed']">{{ item.status === 'settled' ? '已结算' : '已确认' }}</span></td>
              <td><div class="inner-page__actions"><button type="button" class="inner-page__btn-text" @click="viewDetail(item.id)">查看</button><button type="button" class="inner-page__btn-text" @click="editBill(item.id)">编辑</button><button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="deleteBill(item.id)">删除</button></div></td>
            </tr>
            <tr v-if="list.length === 0"><td colspan="9" class="inner-page__empty">暂无单据</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="inner-page__cards inner-page__mobile-only">
      <article v-if="list.length === 0" class="inner-page__card inner-page__empty">暂无单据</article>
      <article v-for="item in list" :key="item.id" class="inner-page__card">
        <div class="bill-card__head"><div><h3>{{ item.billNo }}</h3><p>{{ item.billDate }} · {{ item.partnerName }}</p></div><span :class="['inner-page__status', item.status === 'settled' ? 'inner-page__status--settled' : 'inner-page__status--confirmed']">{{ item.status === 'settled' ? '已结算' : '已确认' }}</span></div>
        <div class="bill-card__grid"><div><span>总重量</span><strong>{{ Number(item.totalWeight || 0).toFixed(2) }} 斤</strong></div><div><span>{{ amountLabel }}</span><strong>{{ formatMoney(item.totalAmount) }}</strong></div><div><span>{{ settlementLabel }}</span><strong>{{ formatMoney(isPurchase ? item.paidAmount : item.receivedAmount) }}</strong></div><div><span>未结金额</span><strong>{{ formatMoney(item.unsettledAmount) }}</strong></div></div>
        <div class="inner-page__actions bill-card__actions"><button type="button" class="inner-page__btn-text" @click="viewDetail(item.id)">查看</button><button type="button" class="inner-page__btn-text" @click="editBill(item.id)">编辑</button><button type="button" class="inner-page__btn-text inner-page__btn-text--danger" @click="deleteBill(item.id)">删除</button></div>
      </article>
    </section>
  </section>
</template>

<style scoped lang="scss">
.filters-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
.bill-card__head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.bill-card__head h3{margin:0;font-size:18px}.bill-card__head p{margin:8px 0 0;color:var(--text-soft)}
.bill-card__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.bill-card__grid div{padding:14px;border-radius:16px;background:rgba(255,255,255,.46)}.bill-card__grid span{display:block;font-size:12px;color:var(--text-soft)}.bill-card__grid strong{display:block;margin-top:8px;font-size:16px;color:var(--text-normal)}
.bill-card__actions{margin-top:14px}
@media (max-width:768px){.filters-grid{grid-template-columns:1fr}}
</style>
