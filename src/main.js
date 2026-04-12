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

// 初始化所有 stores
const authStore = useAuthStore()
authStore.init()

const customerStore = useCustomerStore()
customerStore.init()

const categoryStore = useCategoryStore()
categoryStore.init()

const fabricStore = useFabricStore()
fabricStore.init()

const billRecordStore = useBillRecordStore()
billRecordStore.init()

// 挂载应用
app.mount('#app')
