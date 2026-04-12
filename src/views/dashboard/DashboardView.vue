<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useFabricStore } from '@/stores/fabric'
import { useBillRecordStore } from '@/stores/billRecord'
import logoUrl from '@/assets/logo.svg'

const router = useRouter()
const authStore = useAuthStore()
const customerStore = useCustomerStore()
const fabricStore = useFabricStore()
const billRecordStore = useBillRecordStore()
const loading = ref(true)

const shortcuts = [
  { label: '进货开单', route: '/purchase/create', tag: 'Procurement', accent: 'teal' },
  { label: '进货列表', route: '/purchase/list', tag: 'Archive', accent: 'gold' },
  { label: '出货开单', route: '/sale/create', tag: 'Sales', accent: 'ink' },
  { label: '出货列表', route: '/sale/list', tag: 'Tracking', accent: 'mint' },
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
    desc: `客户 ${customerStore.activeCount} · 布料 ${fabricStore.activeCount}`,
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
      <h2>快速访问</h2>
      <div class="quick-grid">
        <button
          v-for="item in shortcuts"
          :key="item.label"
          class="quick-card"
          @click="navigateTo(item.route)"
        >
          <span class="quick-label">{{ item.label }}</span>
          <span class="quick-tag">{{ item.tag }}</span>
        </button>
      </div>
    </section>

    <section class="insights-section" v-if="!loading">
      <h2>经营洞察</h2>
      <div class="insights-grid">
        <article
          v-for="item in insightCards"
          :key="item.title"
          class="insight-card"
          @click="navigateTo(item.route)"
        >
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
          <span class="insight-arrow">→</span>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 原有的样式保留 */
</style>
