import { createRouter, createWebHashHistory } from 'vue-router'
import storage from '@/utils/storage'

const LoginView = () => import('@/views/login/LoginView.vue')
const DashboardView = () => import('@/views/dashboard/DashboardView.vue')
const CustomerView = () => import('@/views/customer/CustomerView.vue')
const FabricView = () => import('@/views/fabric/FabricView.vue')
const PurchaseView = () => import('@/views/billing/PurchaseView.vue')
const SaleView = () => import('@/views/billing/SaleView.vue')
const PurchaseListView = () => import('@/views/bill-history/PurchaseListView.vue')
const SaleListView = () => import('@/views/bill-history/SaleListView.vue')
const BillDetailView = () => import('@/views/bill-detail/BillDetailView.vue')
const StatisticsView = () => import('@/views/statistics/StatisticsView.vue')
const MonthlyReportView = () => import('@/views/statistics/MonthlyReportView.vue')
const SettingsView = () => import('@/views/settings/SettingsView.vue')
const DataManagementView = () => import('@/views/settings/DataManagementView.vue')
const NotFoundView = () => import('@/views/NotFoundView.vue')

// 路由常量
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CUSTOMER: '/customer',
  FABRIC: '/fabric',
  PURCHASE_CREATE: '/purchase/create',
  PURCHASE_VIEW: '/purchase/view/:id',
  PURCHASE_EDIT: '/purchase/edit/:id',
  SALE_CREATE: '/sale/create',
  SALE_VIEW: '/sale/view/:id',
  SALE_EDIT: '/sale/edit/:id',
  PURCHASE_LIST: '/purchase/list',
  SALE_LIST: '/sale/list',
  STATISTICS: '/statistics',
  MONTHLY_REPORT: '/statistics/monthly',
  SETTINGS: '/settings',
  DATA_MANAGEMENT: '/settings/data'
}

// 路由配置
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'root',
      redirect: ROUTES.DASHBOARD
    },
    {
      path: ROUTES.LOGIN,
      name: 'login',
      component: LoginView,
      meta: {
        requiresAuth: false,
        title: '登录 - 皖盛布碎资源结算系统'
      }
    },
    {
      path: ROUTES.DASHBOARD,
      name: 'dashboard',
      component: DashboardView,
      meta: {
        requiresAuth: true,
        title: '工作台 - 皖盛布碎资源结算系统',
        icon: 'dashboard'
      }
    },
    {
      path: ROUTES.CUSTOMER,
      name: 'customer',
      component: CustomerView,
      meta: {
        requiresAuth: true,
        title: '客户管理 - 皖盛布碎资源结算系统',
        icon: 'customer'
      }
    },
    {
      path: ROUTES.FABRIC,
      name: 'fabric',
      component: FabricView,
      meta: {
        requiresAuth: true,
        title: '布料管理 - 皖盛布碎资源结算系统',
        icon: 'fabric'
      }
    },
    {
      path: ROUTES.PURCHASE_CREATE,
      name: 'purchaseCreate',
      component: PurchaseView,
      meta: {
        requiresAuth: true,
        title: '进货开单 - 皖盛布碎资源结算系统',
        icon: 'purchase'
      }
    },
    {
      path: ROUTES.PURCHASE_VIEW,
      name: 'purchaseView',
      component: BillDetailView,
      meta: {
        requiresAuth: true,
        title: '进货详情 - 皖盛布碎资源结算系统',
        icon: 'purchaseView'
      },
      props: { type: 'purchase' }
    },
    {
      path: ROUTES.PURCHASE_EDIT,
      name: 'purchaseEdit',
      component: PurchaseView,
      meta: {
        requiresAuth: true,
        title: '编辑进货单 - 皖盛布碎资源结算系统',
        icon: 'purchaseEdit'
      },
      props: { type: 'purchase' }
    },
    {
      path: ROUTES.SALE_CREATE,
      name: 'saleCreate',
      component: SaleView,
      meta: {
        requiresAuth: true,
        title: '出货开单 - 皖盛布碎资源结算系统',
        icon: 'sale'
      }
    },
    {
      path: ROUTES.SALE_VIEW,
      name: 'saleView',
      component: BillDetailView,
      meta: {
        requiresAuth: true,
        title: '出货详情 - 皖盛布碎资源结算系统',
        icon: 'saleView'
      },
      props: { type: 'sale' }
    },
    {
      path: ROUTES.SALE_EDIT,
      name: 'saleEdit',
      component: SaleView,
      meta: {
        requiresAuth: true,
        title: '编辑出货单 - 皖盛布碎资源结算系统',
        icon: 'saleEdit'
      },
      props: { type: 'sale' }
    },
    {
      path: ROUTES.PURCHASE_LIST,
      name: 'purchaseList',
      component: PurchaseListView,
      meta: {
        requiresAuth: true,
        title: '进货列表 - 皖盛布碎资源结算系统',
        icon: 'purchaseList'
      }
    },
    {
      path: ROUTES.SALE_LIST,
      name: 'saleList',
      component: SaleListView,
      meta: {
        requiresAuth: true,
        title: '出货列表 - 皖盛布碎资源结算系统',
        icon: 'saleList'
      }
    },
    {
      path: ROUTES.STATISTICS,
      name: 'statistics',
      component: StatisticsView,
      meta: {
        requiresAuth: true,
        title: '数据统计 - 皖盛布碎资源结算系统',
        icon: 'statistics'
      }
    },
    {
      path: ROUTES.MONTHLY_REPORT,
      name: 'monthlyReport',
      component: MonthlyReportView,
      meta: {
        requiresAuth: true,
        title: '月度报表 - 皖盛布碎资源结算系统',
        icon: 'monthlyReport'
      }
    },
    {
      path: ROUTES.SETTINGS,
      name: 'settings',
      component: SettingsView,
      meta: {
        requiresAuth: true,
        title: '系统设置 - 皖盛布碎资源结算系统',
        icon: 'settings'
      }
    },
    {
      path: ROUTES.DATA_MANAGEMENT,
      name: 'dataManagement',
      component: DataManagementView,
      meta: {
        requiresAuth: true,
        title: '数据管理 - 皖盛布碎资源结算系统',
        icon: 'dataManagement'
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: NotFoundView,
      meta: {
        requiresAuth: false,
        title: '页面未找到 - 皖盛布碎资源结算系统'
      }
    }
  ]
})

const CHUNK_RELOAD_GUARD_KEY = 'wsbs_chunk_reload_guard'
const isChunkLoadError = (error) => {
  const message = String(error?.message || error || '')
  return (
    message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('Failed to load module script')
  )
}

router.onError((error, to) => {
  if (!isChunkLoadError(error)) return

  const hasRetried = sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === '1'
  if (hasRetried) {
    console.error('Chunk load failed after retry:', error)
    return
  }

  sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1')
  const target = to?.fullPath || window.location.href
  window.location.assign(target)
})

router.afterEach(() => {
  sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY)
})

// 路由导航守卫
router.beforeEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }

  if (to.meta.requiresAuth) {
    const token = storage.getToken()
    const user = storage.getUser()
    const isAuthenticated = !!(token && user)

    if (!isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  return true
})

export default router
