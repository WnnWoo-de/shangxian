<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useCategoryStore } from '@/stores/category'
import { useFabricStore } from '@/stores/fabric'
import { useBillRecordStore } from '@/stores/billRecord'
import logoUrl from '@/assets/logo.svg'

const router = useRouter()
const authStore = useAuthStore()
const customerStore = useCustomerStore()
const categoryStore = useCategoryStore()
const fabricStore = useFabricStore()
const billRecordStore = useBillRecordStore()
const loading = ref(true)

const shortcuts = [
  { label: '进货开单', route: '/purchase/create', tag: 'Procurement', accent: 'teal' },
  { label: '进货列表', route: '/purchase/list', tag: 'Archive', accent: 'gold' },
  { label: '出货开单', route: '/sale/create', tag: 'Sales', accent: 'ink' },
  { label: '出货列表', route: '/sale/list', tag: 'Tracking', accent: 'mint' },
  { label: '品类报价', route: '/category', tag: 'Pricing', accent: 'sand' },
  { label: '月度报表', route: '/statistics/monthly', tag: 'Review', accent: 'sun' }
]

const today = new Date().toISOString().slice(0, 10)
const todayBills = computed(() => billRecordStore.records.filter((item) => item.billDate === today))
const todayBillCount = computed(() => todayBills.value.length)
const todayTotalAmount = computed(() => todayBills.value.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0))

const stats = computed(() => [
  { label: '今日开单', value: todayBillCount.value, suffix: '单', accent: 'teal' },
  { label: '今日金额', value: Number(todayTotalAmount.value || 0).toFixed(2), prefix: '¥ ', accent: 'gold' },
  { label: '活跃客户', value: customerStore.activeCount, suffix: '位', accent: 'mint' },
  { label: '布料种类', value: fabricStore.activeCount, suffix: '类', accent: 'ink' }
])

const insightCards = computed(() => [
  {
    title: '基础数据',
    desc: `客户 ${customerStore.activeCount} · 品类 ${categoryStore.activeCount} · 布料 ${fabricStore.activeCount}`,
    route: '/customer'
  },
  {
    title: '经营节奏',
    desc: todayBillCount.value > 0 ? '今天已有业务流转，继续保持录入完整度。' : '今天尚未开单，可以从进货或出货开始。',
    route: '/dashboard'
  }
])

const navigateTo = (route) => router.push(route)
const logout = async () => { await authStore.logout() }

onMounted(() => {
  loading.value = false
})
</script>

<template>
  <div class="dashboard-page">
    <section class="hero-panel">
      <div class="hero-copy">
        <div class="hero-badge">
          <img :src="logoUrl" alt="logo" class="hero-logo" />
          <span>皖盛布碎 · 移动端经营中枢</span>
        </div>
        <h1>欢迎回来，{{ authStore.user?.name || '用户' }}</h1>
        <p>
          让进货、出货、客户与结算像翻一页账本一样顺手，
          在同一块面板里完成今天的经营动作。
        </p>
        <div class="hero-actions">
          <button class="primary-action" @click="navigateTo('/purchase/create')">开始开单</button>
          <button class="ghost-action" @click="logout">退出登录</button>
        </div>
      </div>

      <div class="hero-metrics">
        <div class="metric-orb">
          <span class="metric-label">今日金额</span>
          <strong>¥ {{ Number(todayTotalAmount || 0).toFixed(2) }}</strong>
          <small>实时同步业务流转</small>
        </div>
        <div class="metric-mini-card">
          <span>今日开单</span>
          <strong>{{ todayBillCount }}</strong>
        </div>
      </div>
    </section>

    <section class="stats-grid" v-if="!loading">
      <article v-for="item in stats" :key="item.label" class="stat-card" :data-accent="item.accent">
        <span class="stat-label">{{ item.label }}</span>
        <div class="stat-value">{{ item.prefix || '' }}{{ item.value }}{{ item.suffix || '' }}</div>
      </article>
    </section>

    <section class="quick-section">
      <div class="section-heading">
        <h2>快捷入口</h2>
        <p>把高频动作放在首页，一指直达。</p>
      </div>
      <div class="shortcut-grid">
        <article v-for="item in shortcuts" :key="item.label" class="shortcut-card" :data-accent="item.accent" @click="navigateTo(item.route)">
          <span class="shortcut-tag">{{ item.tag }}</span>
          <h3>{{ item.label }}</h3>
          <span class="shortcut-arrow">进入 ↗</span>
        </article>
      </div>
    </section>

    <section class="insight-grid">
      <article v-for="item in insightCards" :key="item.title" class="insight-card" @click="navigateTo(item.route)">
        <p class="insight-kicker">运营提示</p>
        <h3>{{ item.title }}</h3>
        <p class="insight-desc">{{ item.desc }}</p>
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
.dashboard-page{display:flex;flex-direction:column;gap:18px;padding-bottom:20px}.hero-panel{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:18px;padding:24px;border-radius:30px;background:linear-gradient(135deg,rgba(255,251,246,.98) 0%,rgba(249,241,231,.96) 52%,rgba(245,234,220,.95) 100%);box-shadow:0 30px 60px rgba(187,161,130,.16);color:$text-primary;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.75)}.hero-panel::after{content:'';position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(240,210,157,.24),transparent 65%)}
.hero-copy,.hero-metrics{position:relative;z-index:1}.hero-badge{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.56);font-size:12px;letter-spacing:.05em;color:$text-primary;border:1px solid rgba(255,255,255,.72)}.hero-logo{width:22px;height:22px;object-fit:contain}.hero-copy h1{margin:18px 0 12px;font-size:34px;line-height:1.08;color:#8f755b}.hero-copy p{margin:0;max-width:620px;color:$text-secondary;font-size:15px;line-height:1.8}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.primary-action,.ghost-action{height:46px;padding:0 20px;border:none;border-radius:999px;font-weight:700;cursor:pointer;transition:transform $transition-fast,background $transition-normal,box-shadow $transition-normal}.primary-action{background:linear-gradient(135deg,#fff8ef,#f3e1c7);color:#7f6248;box-shadow:0 10px 24px rgba(227,187,122,.2)}.ghost-action{background:rgba(255,255,255,.52);color:$text-primary;border:1px solid rgba(106,93,82,.1)}.primary-action:hover,.ghost-action:hover{transform:translateY(-1px)}
.hero-metrics{display:grid;gap:14px;align-content:end}.metric-orb{padding:22px;border-radius:28px;background:rgba(255,255,255,.34);border:1px solid rgba(255,255,255,.56);backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.68)}.metric-label{display:block;font-size:12px;color:$text-secondary;margin-bottom:10px}.metric-orb strong{display:block;font-size:32px;line-height:1.1;color:#8f755b}.metric-orb small{display:block;margin-top:8px;color:$text-secondary}.metric-mini-card{padding:16px 18px;border-radius:22px;background:rgba(255,250,243,.52);border:1px solid rgba(255,255,255,.56)}.metric-mini-card span{display:block;font-size:12px;color:$text-secondary}.metric-mini-card strong{display:block;margin-top:8px;font-size:24px;color:$text-primary}
.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat-card{padding:20px;border-radius:24px;background:rgba(255,251,246,.84);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.72);box-shadow:0 14px 30px rgba(187,161,130,.08)}.stat-card[data-accent='teal']{background:linear-gradient(180deg,rgba(255,251,246,.92),rgba(247,242,232,.96))}.stat-card[data-accent='gold']{background:linear-gradient(180deg,rgba(255,251,246,.92),rgba(249,239,221,.96))}.stat-card[data-accent='mint']{background:linear-gradient(180deg,rgba(255,251,246,.92),rgba(246,240,230,.96))}.stat-card[data-accent='ink']{background:linear-gradient(180deg,rgba(255,251,246,.92),rgba(242,236,228,.96))}.stat-label{font-size:13px;color:$text-secondary}.stat-value{margin-top:14px;font-size:30px;font-weight:700;color:$text-primary;line-height:1.1}
.quick-section,.insight-card{padding:22px;border-radius:28px;background:rgba(255,251,246,.84);border:1px solid rgba(255,255,255,.72);backdrop-filter:blur(14px);box-shadow:0 14px 30px rgba(187,161,130,.08)}.section-heading{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:16px}.section-heading h2{margin:0;font-size:24px}.section-heading p{margin:0;color:$text-secondary;font-size:14px}.shortcut-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.shortcut-card{padding:18px;border-radius:22px;cursor:pointer;transition:transform $transition-fast,box-shadow $transition-normal;position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,252,248,.98),rgba(250,243,235,.92));border:1px solid rgba(106,93,82,.06)}.shortcut-card::after{content:'';position:absolute;inset:auto -30px -46px auto;width:120px;height:120px;border-radius:50%;opacity:.2}.shortcut-card[data-accent='teal']::after{background:#eadfcd}.shortcut-card[data-accent='gold']::after,.shortcut-card[data-accent='sand']::after,.shortcut-card[data-accent='sun']::after{background:#f0d29d}.shortcut-card[data-accent='ink']::after{background:#ddd1c4}.shortcut-card[data-accent='mint']::after{background:#efe3d5}.shortcut-card:hover{transform:translateY(-3px);box-shadow:0 18px 34px rgba(187,161,130,.12)}.shortcut-tag{display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.62);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:$text-secondary;border:1px solid rgba(106,93,82,.06)}.shortcut-card h3{margin:22px 0 18px;font-size:20px;color:$text-primary}.shortcut-arrow{font-weight:600;color:#b9925d}
.insight-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.insight-card{cursor:pointer;transition:transform $transition-fast,box-shadow $transition-normal}.insight-card:hover{transform:translateY(-2px);box-shadow:0 18px 36px rgba(187,161,130,.12)}.insight-kicker{margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:$secondary-dark}.insight-card h3{margin:0 0 10px;font-size:22px}.insight-desc{margin:0;color:$text-secondary;line-height:1.7}
@include respond-to(md){.hero-panel{grid-template-columns:1fr;padding:20px;border-radius:24px}.hero-copy h1{font-size:28px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.shortcut-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.insight-grid{grid-template-columns:1fr}}
@include respond-to(sm){.dashboard-page{gap:14px}.hero-panel{padding:18px}.hero-badge{font-size:11px}.hero-copy h1{font-size:24px}.hero-actions{flex-direction:column}.primary-action,.ghost-action{width:100%}.stats-grid,.shortcut-grid{grid-template-columns:1fr}.section-heading{flex-direction:column;align-items:flex-start}.stat-value{font-size:26px}}
</style>
