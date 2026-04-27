import './assets/styles/main.scss'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useCustomerPriceStore } from '@/stores/customerPrice'
import { useFabricStore } from '@/stores/fabric'
import { useBillRecordStore } from '@/stores/billRecord'
import { setupPwaAutoUpdate } from '@/pwa'
import { setupPwaInstallPrompt } from '@/utils/pwa-install'
import { incrementalSync, startAutoSync, stopAutoSync } from '@/utils/sync'
import { initTheme } from '@/utils/theme'

const app = createApp(App)
const pinia = createPinia()

initTheme()

app.use(pinia)
app.use(router)
app.use(ElementPlus, {
  locale: zhCn
})

// 初始化所有 stores
const authStore = useAuthStore()
authStore.init()

const customerStore = useCustomerStore()
customerStore.init()

const customerPriceStore = useCustomerPriceStore()
customerPriceStore.init()

const fabricStore = useFabricStore()
fabricStore.init()

const billRecordStore = useBillRecordStore()
billRecordStore.init()

watch(
  () => authStore.isLoggedIn,
  async (loggedIn) => {
    if (loggedIn) {
      startAutoSync(30000)
      await incrementalSync()
      return
    }
    stopAutoSync()
  },
  { immediate: true }
)

setupPwaAutoUpdate()
setupPwaInstallPrompt()

// 挂载应用
app.mount('#app')
