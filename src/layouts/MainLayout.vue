<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'
import logoUrl from '@/assets/logo.png'
import { ElMessage } from 'element-plus'
import IconDashboard from '@/components/icons/IconDashboard.vue'
import IconPurchase from '@/components/icons/IconPurchase.vue'
import IconSale from '@/components/icons/IconSale.vue'
import IconList from '@/components/icons/IconList.vue'
import IconCustomer from '@/components/icons/IconCustomer.vue'
import IconFabric from '@/components/icons/IconFabric.vue'
import IconReport from '@/components/icons/IconReport.vue'
import IconStatistics from '@/components/icons/IconStatistics.vue'
import IconSettings from '@/components/icons/IconSettings.vue'
import IconLogout from '@/components/icons/IconLogout.vue'

const route = useRoute()
const authStore = useAuthStore()
const mobileMenuOpen = ref(false)
const currentTime = ref('')
const pressedRoute = ref('')
const logoutConfirm = ref(false)

const menuItems = [
  {
    label: '总览',
    route: '/dashboard',
    note: '今日经营速览',
    icon: IconDashboard,
    showBadge: true
  },
  {
    label: '采购',
    children: [
      { label: '进货开单', route: '/purchase/create', note: '快速录入单据', icon: IconPurchase },
      { label: '进货列表', route: '/purchase/list', note: '查看采购明细', icon: IconList }
    ]
  },
  {
    label: '销售',
    children: [
      { label: '出货开单', route: '/sale/create', note: '生成销售单据', icon: IconSale },
      { label: '出货列表', route: '/sale/list', note: '追踪发货进度', icon: IconReport }
    ]
  },
  {
    label: '资料',
    children: [
      { label: '客户管理', route: '/customer', note: '客户档案', icon: IconCustomer },
      { label: '品种管理', route: '/fabric', note: '库存基础信息', icon: IconFabric }
    ]
  },
  {
    label: '报表',
    children: [
      { label: '数据统计', route: '/statistics', note: '经营趋势', icon: IconStatistics },
      { label: '月度报表', route: '/statistics/monthly', note: '月度复盘', icon: IconReport },
      { label: '结算详情', route: '/statistics/settlement', note: '进货出货对账', icon: IconReport }
    ]
  },
  { label: '设置', route: '/settings', note: '系统配置', icon: IconSettings }
]

const pageTitle = computed(() => route.meta.title?.split(' - ')[0] || '经营工作台')
const pageSubtitle = computed(() => {
  const lookup = new Map()
  menuItems.forEach((item) => {
    if (item.route) lookup.set(item.route, item.note)
    item.children?.forEach((child) => lookup.set(child.route, child.note))
  })
  return lookup.get(route.path) || '把采购、销售与结算放在一个顺手的界面里。'
})

const isRouteActive = (routePath) => route.path === routePath
const isRoutePressed = (routePath) => pressedRoute.value === routePath
const handlePressStart = (routePath) => { pressedRoute.value = routePath }
const handlePressEnd = () => { pressedRoute.value = '' }
const closeMobileMenu = () => { mobileMenuOpen.value = false }
const toggleMobileMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value }
const updateTime = () => {
  currentTime.value = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long'
  }).format(new Date())
}

let timer = null
const handleResize = () => { if (window.innerWidth > 1024) mobileMenuOpen.value = false }
const handleLogout = async () => {
  try {
    await authStore.logout()
    ElMessage.success('已退出登录')
  } catch (error) {
    ElMessage.error('退出失败')
  }
}
const clearPressedRoute = () => { pressedRoute.value = '' }

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 60000)
  window.addEventListener('resize', handleResize)
  window.addEventListener('pointerup', clearPressedRoute)
  window.addEventListener('pointercancel', clearPressedRoute)
  window.addEventListener('blur', clearPressedRoute)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('pointerup', clearPressedRoute)
  window.removeEventListener('pointercancel', clearPressedRoute)
  window.removeEventListener('blur', clearPressedRoute)
})
</script>

<template>
  <div class="main-layout">
    <div v-if="mobileMenuOpen" class="mobile-overlay" @click="closeMobileMenu"></div>

    <aside :class="['sidebar', { 'mobile-open': mobileMenuOpen }]">
      <div class="sidebar-shell">
        <div class="sidebar-header">
          <div class="brand-mark">
            <img :src="logoUrl" alt="Logo" class="sidebar-logo" />
          </div>
          <div class="brand-copy">
            <p class="brand-kicker">Wansheng Textile</p>
            <h1 class="sidebar-title">皖盛布碎</h1>
            <p class="brand-desc">经营结算中心</p>
          </div>
        </div>

        <div class="sidebar-panel">
          <div class="panel-caption">
            <span class="panel-caption-dot"></span><span>业务导航</span>
          </div>
          <nav class="sidebar-nav">
            <template v-for="item in menuItems" :key="item.label">
              <div v-if="item.children" class="menu-group">
                <div class="menu-group-label">{{ item.label }}</div>
                <div class="menu-group-items">
                  <router-link
                    v-for="child in item.children"
                    :key="child.route"
                    :to="child.route"
                    :class="['menu-item', { active: isRouteActive(child.route), pressed: isRoutePressed(child.route) }]"
                    @click="closeMobileMenu"
                    @pointerdown="handlePressStart(child.route)"
                    @pointerup="handlePressEnd"
                    @pointerleave="handlePressEnd"
                    @keydown.enter="handlePressStart(child.route)"
                    @keyup.enter="handlePressEnd"
                    @keydown.space.prevent="handlePressStart(child.route)"
                    @keyup.space="handlePressEnd"
                  >
                    <span class="menu-icon">
                      <component :is="child.icon" style="width: 16px; height: 16px;" />
                    </span>
                    <div class="menu-copy">
                      <span class="menu-name">{{ child.label }}</span>
                      <span class="menu-note">{{ child.note }}</span>
                    </div>
                    <span class="menu-arrow">→</span>
                  </router-link>
                </div>
              </div>

              <router-link
                v-else
                :to="item.route"
                :class="['menu-item single', { active: isRouteActive(item.route), pressed: isRoutePressed(item.route) }]"
                @click="closeMobileMenu"
                @pointerdown="handlePressStart(item.route)"
                @pointerup="handlePressEnd"
                @pointerleave="handlePressEnd"
                @keydown.enter="handlePressStart(item.route)"
                @keyup.enter="handlePressEnd"
                @keydown.space.prevent="handlePressStart(item.route)"
                @keyup.space="handlePressEnd"
              >
                <span class="menu-icon">
                  <component :is="item.icon" style="width: 16px; height: 16px;" />
                </span>
                <div class="menu-copy">
                  <span class="menu-name">{{ item.label }}</span>
                  <span class="menu-note">{{ item.note }}</span>
                </div>
                <span class="menu-arrow">→</span>
              </router-link>
            </template>
          </nav>
        </div>

        <div class="sidebar-footer">
          <div class="user-card">
            <div class="user-avatar">{{ authStore.user?.name?.charAt(0) || 'U' }}</div>
            <div class="user-details">
              <div class="user-name">{{ authStore.user?.name || '未登录用户' }}</div>
              <div class="user-role">{{ authStore.user?.role || '业务人员' }}</div>
            </div>
          </div>
          <button class="logout-btn" @click="handleLogout">
            <span class="logout-icon">
              <IconLogout style="width: 16px; height: 16px;" />
            </span>
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </aside>

    <div class="main-content">
      <header class="top-bar">
        <button class="menu-toggle" @click="toggleMobileMenu" aria-label="打开菜单">
          <span></span><span></span><span></span>
        </button>

        <div class="top-copy">
          <p class="top-date">{{ currentTime }}</p>
          <div class="page-title-row">
            <h2 class="page-title">{{ pageTitle }}</h2>
            <span v-if="route.path === '/dashboard'" class="title-badge">今日数据</span>
          </div>
          <p class="page-subtitle">{{ pageSubtitle }}</p>
        </div>

        <div class="top-actions">
          <div class="top-chip">
            <span class="chip-dot"></span>
            <span>在线工作中</span>
          </div>
        </div>
      </header>

      <main class="page-content"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-layout{
  min-height:100vh;
  min-height:100dvh;
  display:flex;
  align-items:stretch;
  background:radial-gradient(circle at left top,rgba(158,207,194,.16),transparent 24%),radial-gradient(circle at right top,rgba(227,187,122,.18),transparent 28%),linear-gradient(180deg,#fffaf4 0%,#f8efe3 100%)
}
.mobile-overlay{
  position:fixed;
  inset:0;
  background:rgba(255,250,243,.66);
  backdrop-filter:blur(4px);
  z-index:40;
  @media (min-width: 1025px){display:none}
}
.sidebar{
  width:320px;
  min-height:100vh;
  min-height:100dvh;
  flex:0 0 320px;
  position:relative;
  z-index:50;
  @include respond-to(lg){
    position:fixed;
    inset:0 auto 0 0;
    width:min(86vw,320px);
    min-height:100dvh;
    flex:none;
    transform:translateX(-110%);
    transition:transform $transition-normal
  }
}
.sidebar.mobile-open{
  @include respond-to(lg){transform:translateX(0)}
}
.sidebar-shell{
  position:relative;
  min-height:100vh;
  min-height:100dvh;
  display:flex;
  flex-direction:column;
  gap:16px;
  padding:20px 18px 18px;
  border-radius:0 30px 30px 0;
  background:linear-gradient(180deg,rgba(255,251,246,.98) 0%,rgba(250,242,232,.97) 56%,rgba(246,237,225,.96) 100%);
  box-shadow:0 32px 60px rgba(179,153,123,.18);
  border:1px solid rgba(255,255,255,.72);
  border-left:none;
  overflow:hidden;
  @include respond-to(md){
    min-height:100vh;
    min-height:100dvh;
    height:100dvh;
    border-radius:0 28px 28px 0;
    padding-top:calc(18px + var(--safe-area-inset-top));
    padding-bottom:calc(18px + var(--safe-area-inset-bottom))
  }
}
.sidebar-shell::before{
  content:'';
  position:absolute;
  top:32px;
  left:32px;
  width:180px;
  height:180px;
  background:radial-gradient(circle,rgba(227,187,122,.22),transparent 68%);
  pointer-events:none
}
.sidebar-header,.sidebar-panel,.sidebar-footer{position:relative;z-index:1}
.sidebar-header{
  display:flex;
  gap:14px;
  align-items:center;
  padding:8px 6px 4px
}
.brand-mark{
  width:62px;
  height:62px;
  border-radius:20px;
  background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(227,187,122,.52));
  display:grid;
  place-items:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 10px 25px rgba(179,153,123,.16)
}
.sidebar-logo{
  width:38px;
  height:38px;
  object-fit:contain
}
.brand-kicker{
  margin:0 0 4px;
  font-size:11px;
  letter-spacing:.18em;
  text-transform:uppercase;
  color:rgba(136,112,86,.62)
}
.sidebar-title{
  margin:0;
  color:$text-primary;
  font-size:28px;
  line-height:1.05
}
.brand-desc{
  margin:6px 0 0;
  font-size:13px;
  color:$text-secondary
}
.sidebar-panel{
  flex:1;
  min-height:0;
  padding:18px 12px;
  border-radius:24px;
  background:rgba(255,255,255,.42);
  border:1px solid rgba(255,255,255,.72);
  backdrop-filter:blur(10px)
}
.panel-caption{
  display:inline-flex;
  align-items:center;
  gap:8px;
  margin:0 6px 16px;
  color:$text-primary;
  font-size:12px;
  letter-spacing:.08em
}
.panel-caption-dot{
  width:8px;
  height:8px;
  border-radius:999px;
  background:linear-gradient(135deg,#e3bb7a,#f2dfb3);
  box-shadow:0 0 0 6px rgba(227,187,122,.12)
}
.sidebar-nav{
  height:calc(100% - 30px);
  overflow-y:auto;
  padding-right:4px;
  @include scrollbar-beautiful
}
.menu-group{
  margin-bottom:18px
}
.menu-group-label{
  margin:0 8px 10px;
  font-size:12px;
  letter-spacing:.08em;
  color:rgba(139,125,112,.7)
}
.menu-group-items{
  display:flex;
  flex-direction:column;
  gap:8px
}
.menu-item{
  display:flex;
  align-items:center;
  gap:12px;
  padding:13px 14px;
  border-radius:18px;
  color:$text-primary;
  text-decoration:none;
  border:1px solid transparent;
  transition:transform $transition-fast,background $transition-normal,border-color $transition-normal,box-shadow $transition-normal;
  position:relative;
  outline:none
}
.menu-item:hover{
  transform:translateX(2px);
  background:rgba(255,255,255,.58);
  border-color:rgba(227,187,122,.26);
  text-decoration:none
}
.menu-item:focus-visible{
  border-color:rgba(227,187,122,.42);
  box-shadow:0 0 0 4px rgba(227,187,122,.14)
}
.menu-item.pressed{
  transform:scale(.985);
  background:rgba(255,248,239,.9);
  border-color:rgba(227,187,122,.36);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 6px 16px rgba(179,153,123,.12)
}
.menu-item.active{
  background:linear-gradient(135deg,rgba(227,187,122,.22),rgba(158,207,194,.18));
  border-color:rgba(227,187,122,.3);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.65)
}
.menu-item.active .menu-name,.menu-item.active .menu-arrow,.menu-item.active .menu-icon{color:$text-primary}
.menu-item.active .menu-note{color:$text-secondary}
.menu-item.single{margin-bottom:18px}
.menu-icon{
  width:28px;
  height:28px;
  border-radius:10px;
  display:grid;
  place-items:center;
  background:rgba(255,255,255,.62);
  color:$secondary-dark;
  font-size:14px;
  flex-shrink:0
}
.menu-copy{
  flex:1;
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:2px
}
.menu-name{
  font-size:14px;
  font-weight:600
}
.menu-note{
  font-size:12px;
  color:rgba(139,125,112,.78)
}
.menu-arrow{
  color:rgba(139,125,112,.68);
  font-size:14px
}
.sidebar-footer{
  padding:2px 4px 4px
}
.user-card{
  display:flex;
  align-items:center;
  gap:12px;
  padding:12px 14px;
  margin-bottom:12px;
  border-radius:18px;
  background:rgba(255,255,255,.46);
  border:1px solid rgba(255,255,255,.72)
}
.user-avatar{
  width:42px;
  height:42px;
  border-radius:14px;
  display:grid;
  place-items:center;
  background:linear-gradient(135deg,#e3bb7a,#f5dfb7);
  color:#6a5d52;
  font-weight:700
}
.user-name{
  color:$text-primary;
  font-weight:600
}
.user-role{
  margin-top:2px;
  font-size:12px;
  color:$text-secondary
}
.logout-btn{
  width:100%;
  height:44px;
  border:1px solid rgba(106,93,82,.12);
  border-radius:999px;
  background:rgba(255,255,255,.5);
  color:$text-primary;
  font-weight:600;
  cursor:pointer;
  transition:transform $transition-fast,background $transition-normal,border-color $transition-normal;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px
}
.logout-btn:hover{
  transform:translateY(-1px);
  background:rgba(217,124,112,.14);
  border-color:rgba(217,124,112,.28)
}
.logout-icon{
  font-size:16px
}
.main-content{
  flex:1;
  min-width:0;
  min-height:100vh;
  min-height:100dvh;
  display:flex;
  flex-direction:column;
  padding:18px;
  @include respond-to(md){padding:16px}
  @include respond-to(sm){
    padding:10px;
    padding-top:calc(10px + var(--safe-area-inset-top));
    padding-left:calc(10px + var(--safe-area-inset-left));
    padding-right:calc(10px + var(--safe-area-inset-right));
  }
}
.top-bar{
  display:flex;
  align-items:center;
  gap:18px;
  min-height:106px;
  padding:18px 22px;
  border-radius:30px;
  background:rgba(255,252,247,.78);
  border:1px solid rgba(255,255,255,.72);
  backdrop-filter:blur(16px);
  box-shadow:0 18px 36px rgba(179,153,123,.12);
  @include respond-to(md){
    min-height:92px;
    padding:14px 16px;
    border-radius:22px;
    align-items:flex-start
  }
  @include respond-to(sm){
    gap:12px;
    min-height:auto;
    padding:12px;
    border-radius:18px
  }
}
.menu-toggle{
  display:none;
  width:42px;
  height:42px;
  padding:0;
  border:none;
  border-radius:14px;
  background:rgba(125,183,173,.12);
  cursor:pointer;
  span{
    display:block;
    width:20px;
    height:2px;
    margin:4px auto;
    background:$text-primary;
    border-radius:999px
  }
  @include respond-to(lg){
    display:block;
    flex-shrink:0
  }
  @include respond-to(sm){
    width:40px;
    height:40px;
    border-radius:12px
  }
}
.top-copy{
  flex:1;
  min-width:0
}
.top-date{
  margin:0 0 8px;
  font-size:12px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:$text-secondary;
  @include respond-to(sm){margin-bottom:6px;font-size:11px}
}
.page-title-row{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap
}
.page-title{
  margin:0;
  color:$text-primary;
  font-size:28px;
  line-height:1.05;
  @include respond-to(md){font-size:22px}
  @include respond-to(sm){font-size:20px}
}
.title-badge{
  padding:6px 10px;
  border-radius:999px;
  background:rgba(227,187,122,.18);
  color:$secondary-dark;
  font-size:12px;
  font-weight:700
}
.page-subtitle{
  margin:8px 0 0;
  font-size:14px;
  color:$text-secondary;
  @include respond-to(sm){
    margin-top:6px;
    font-size:12px;
    line-height:1.45;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden
  }
}
.top-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  @include respond-to(md){display:none}
}
.top-chip{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:10px 14px;
  border-radius:999px;
  background:rgba(255,255,255,.7);
  border:1px solid rgba(106,93,82,.08);
  color:$text-primary;
  font-weight:600;
  white-space:nowrap
}
.chip-dot{
  width:8px;
  height:8px;
  border-radius:999px;
  background:#9ecfc2;
  box-shadow:0 0 0 6px rgba(158,207,194,.18)
}
.page-content{
  flex:1;
  min-height:0;
  margin-top:16px;
  overflow-y:auto;
  @include scrollbar-beautiful;
  @include respond-to(md){margin-top:12px}
  @include respond-to(sm){
    margin-top:10px;
    padding-bottom:var(--safe-area-inset-bottom)
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .sidebar {
    width: 288px;
    flex-basis: 288px;
  }

  .sidebar-shell {
    padding: 18px 14px 16px;
    border-radius: 0 24px 24px 0;
  }

  .sidebar-title {
    font-size: 24px;
  }

  .brand-mark {
    width: 54px;
    height: 54px;
    border-radius: 16px;
  }

  .menu-item {
    padding: 12px;
    border-radius: 16px;
  }

  .menu-note {
    display: none;
  }

  .main-content {
    padding: 14px;
  }

  .top-bar {
    min-height: 92px;
    border-radius: 24px;
  }
}

@media (max-width: 480px) {
  .main-layout {
    min-height: 100dvh;
    background:
      linear-gradient(180deg, rgba(255, 250, 243, .98) 0%, rgba(245, 235, 222, .98) 100%);
  }

  .mobile-overlay {
    background: rgba(45, 36, 28, .2);
  }

  .sidebar {
    width: min(92vw, 316px);
  }

  .sidebar-shell {
    border-radius: 0 22px 22px 0;
    gap: 12px;
    padding-left: 14px;
    padding-right: 12px;
  }

  .sidebar-panel {
    padding: 14px 10px;
    border-radius: 20px;
  }

  .sidebar-title {
    font-size: 24px;
  }

  .brand-kicker,
  .brand-desc,
  .menu-note {
    display: none;
  }

  .menu-group {
    margin-bottom: 12px;
  }

  .menu-item.single {
    margin-bottom: 12px;
  }

  .user-card {
    margin-bottom: 8px;
  }

  .top-bar {
    position: sticky;
    top: calc(8px + var(--safe-area-inset-top));
    z-index: 20;
    box-shadow: 0 12px 26px rgba(179, 153, 123, .12);
  }

  .top-copy {
    overflow: hidden;
  }

  .page-title-row {
    gap: 6px;
  }

  .title-badge {
    padding: 4px 8px;
    font-size: 11px;
  }

  .page-content {
    overflow: visible;
  }
}

@media (prefers-color-scheme: dark) {
  .main-layout {
    background:
      radial-gradient(circle at left top, rgba(125, 183, 173, .12), transparent 24%),
      radial-gradient(circle at right top, rgba(227, 187, 122, .1), transparent 28%),
      linear-gradient(180deg, #171918 0%, #111312 100%);
  }

  .mobile-overlay {
    background: rgba(10, 12, 11, .64);
  }

  .sidebar-shell,
  .top-bar {
    background: rgba(32, 35, 33, .9);
    border-color: rgba(255, 255, 255, .08);
    box-shadow: 0 24px 54px rgba(0, 0, 0, .26);
  }

  .sidebar-panel,
  .user-card,
  .logout-btn,
  .top-chip,
  .menu-icon {
    background: rgba(255, 255, 255, .06);
    border-color: rgba(255, 255, 255, .08);
  }

  .brand-kicker,
  .brand-desc,
  .menu-note,
  .menu-group-label,
  .page-subtitle,
  .top-date,
  .user-role,
  .menu-arrow {
    color: var(--text-soft);
  }

  .sidebar-title,
  .menu-item,
  .menu-name,
  .page-title,
  .user-name,
  .logout-btn {
    color: var(--text-normal);
  }

  .menu-item:hover,
  .menu-item.pressed,
  .menu-item.active {
    background: linear-gradient(135deg, rgba(125, 183, 173, .16), rgba(227, 187, 122, .1));
    border-color: rgba(125, 183, 173, .24);
  }
}
</style>
