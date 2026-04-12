import './assets/styles/main.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useCategoryStore } from '@/stores/category'
import { useFabricStore } from '@/stores/fabric'
import { useBillRecordStore } from '@/stores/billRecord'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus, {
  locale: zhCn
})

// 统一初始化所有 store，确保应用启动时数据已经准备好
const initStores = async () => {
  try {
    const authStore = useAuthStore()
    const customerStore = useCustomerStore()
    const categoryStore = useCategoryStore()
    const fabricStore = useFabricStore()
    const billRecordStore = useBillRecordStore()

    // 初始化所有 store
    await Promise.allSettled([
      authStore.init(),
      customerStore.init(),
      categoryStore.init(),
      fabricStore.init(),
      billRecordStore.init()
    ])

    console.log('所有 store 初始化完成')
  } catch (error) {
    console.error('初始化 store 时出错:', error)
  }
}

// 确保路由准备好后再初始化 store
router.isReady().then(async () => {
  await initStores()
  // 所有 store 初始化完成后再挂载应用
  app.mount('#app')
})
