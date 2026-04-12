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
.dashboard-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 10%, rgba(227, 187, 122, 0.12), transparent 26%),
    radial-gradient(circle at 80% 20%, rgba(181, 158, 122, 0.12), transparent 28%),
    linear-gradient(180deg, #fffaf3 0%, #f5ebde 100%);
  padding: 18px 16px 24px;
}

.hero-panel {
  display: grid;
  grid-template-columns: 1fr minmax(0, 480px);
  gap: 28px;
  align-items: center;
  padding: 28px;
  background: rgba(255, 250, 241, 0.92);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 24px 60px rgba(187, 161, 130, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(22px);

  @include respond-to(md) {
    grid-template-columns: 1fr;
    padding: 22px;
    gap: 20px;
  }

  @include respond-to(sm) {
    padding: 18px;
  }
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .hero-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(227, 187, 122, 0.16);
    border-radius: 999px;
    width: fit-content;
    border: 1px solid rgba(227, 187, 122, 0.35);

    .hero-logo {
      width: 28px;
      height: 28px;
      object-fit: contain;
    }

    span {
      font-size: 13px;
      font-weight: 600;
      color: #9b7e5c;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  }

  h1 {
    font-size: 32px;
    font-weight: 700;
    color: #231f1c;
    line-height: 1.1;
    letter-spacing: -0.02em;

    @include respond-to(md) {
      font-size: 28px;
    }
  }

  p {
    font-size: 16px;
    color: #645a4e;
    line-height: 1.6;
    max-width: 560px;
  }

  .hero-actions {
    display: flex;
    gap: 14px;
    margin-top: 8px;

    @include respond-to(sm) {
      flex-direction: column;
    }
  }
}

.primary-action {
  padding: 14px 26px;
  background: linear-gradient(135deg, #e3bb7a 0%, #d6a85e 100%);
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 18px 40px rgba(227, 187, 122, 0.36);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 22px 50px rgba(227, 187, 122, 0.4);
    background: linear-gradient(135deg, #e7c797 0%, #dbae6c 100%);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 12px 30px rgba(227, 187, 122, 0.32);
  }
}

.ghost-action {
  padding: 14px 22px;
  background: rgba(255, 250, 241, 0.7);
  border: 1px solid rgba(28, 43, 51, 0.1);
  border-radius: 999px;
  color: #4a4137;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease, border-color 0.2s ease;

  &:hover {
    background: rgba(255, 248, 235, 0.9);
    border-color: rgba(28, 43, 51, 0.16);
    transform: translateY(-1px);
  }
}

.hero-metrics {
  display: flex;
  gap: 18px;
  align-items: stretch;

  @include respond-to(md) {
    flex-direction: column;
  }
}

.metric-orb {
  flex: 1;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.95), transparent 60%),
    linear-gradient(135deg, #fffaf3 0%, #f3e9dc 100%);
  border-radius: 28px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 18px 42px rgba(187, 161, 130, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);

  .metric-label {
    font-size: 13px;
    color: #6a5d52;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
  }

  strong {
    font-size: 32px;
    font-weight: 700;
    color: #231f1c;
    line-height: 1.1;
  }

  small {
    font-size: 13px;
    color: #8b7d70;
    margin-top: 6px;
  }
}

.metric-mini-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 140px;
  padding: 18px;
  background: rgba(250, 242, 232, 0.92);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 14px 36px rgba(187, 161, 130, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);

  span {
    font-size: 13px;
    color: #6a5d52;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  strong {
    font-size: 28px;
    font-weight: 700;
    color: #231f1c;
    margin-top: 6px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-top: 24px;

  @include respond-to(md) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @include respond-to(sm) {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

.stat-card {
  padding: 20px;
  background: rgba(255, 250, 241, 0.85);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 16px 40px rgba(187, 161, 130, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 50px rgba(187, 161, 130, 0.12);
    border-color: rgba(227, 187, 122, 0.4);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent-gradient);
  }

  &[data-accent="teal"] {
    --accent-gradient: linear-gradient(90deg, #1a915c, #23ac6f);
  }

  &[data-accent="gold"] {
    --accent-gradient: linear-gradient(90deg, #d4a76a, #e3bb7a);
  }

  &[data-accent="mint"] {
    --accent-gradient: linear-gradient(90deg, #62c29a, #7ec9a3);
  }

  &[data-accent="ink"] {
    --accent-gradient: linear-gradient(90deg, #2c3e50, #34495e);
  }

  &[data-accent="sun"] {
    --accent-gradient: linear-gradient(90deg, #e67e22, #f39c12);
  }
}

.stat-label {
  font-size: 13px;
  color: #6a5d52;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #231f1c;
  margin-top: 10px;
  line-height: 1.1;
}

.quick-section {
  margin-top: 28px;

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: #231f1c;
    margin-bottom: 18px;
    letter-spacing: 0.02em;
  }
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;

  @include respond-to(md) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @include respond-to(sm) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.quick-card {
  padding: 20px;
  background: rgba(255, 250, 241, 0.88);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 12px 30px rgba(187, 161, 130, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 40px rgba(187, 161, 130, 0.12);
    background: rgba(255, 248, 235, 0.96);
    border-color: rgba(227, 187, 122, 0.35);
  }

  &:active {
    transform: translateY(0);
  }
}

.quick-label {
  font-size: 16px;
  font-weight: 600;
  color: #231f1c;
  line-height: 1.3;
}

.quick-tag {
  font-size: 12px;
  color: #8b7d70;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.insights-section {
  margin-top: 28px;

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: #231f1c;
    margin-bottom: 18px;
    letter-spacing: 0.02em;
  }
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;

  @include respond-to(md) {
    grid-template-columns: 1fr;
  }
}

.insight-card {
  padding: 24px;
  background: rgba(250, 242, 232, 0.9);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 16px 40px rgba(187, 161, 130, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #d4a76a, #e3bb7a);
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 50px rgba(187, 161, 130, 0.12);
    border-color: rgba(227, 187, 122, 0.35);
  }

  h3 {
    font-size: 18px;
    font-weight: 700;
    color: #231f1c;
    margin-bottom: 10px;
    letter-spacing: 0.01em;
  }

  p {
    font-size: 14px;
    color: #6a5d52;
    line-height: 1.6;
    margin-bottom: 12px;
  }

  .insight-arrow {
    position: absolute;
    right: 24px;
    bottom: 24px;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 50%;
    border: 1px solid rgba(28, 43, 51, 0.08);
    font-size: 16px;
    font-weight: 700;
    color: #231f1c;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
