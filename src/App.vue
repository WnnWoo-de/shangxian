<script setup>
import { RouterView, useRouter, useRoute } from 'vue-router'
import { onMounted, watch, computed } from 'vue'
import { useAuthStore } from './stores/auth'
import MainLayout from './layouts/MainLayout.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// 判断是否是登录页面
const isLoginPage = computed(() => route.path === '/login')

// 先初始化认证状态，确保在组件挂载前就获取到用户信息
authStore.init()

// 监听路由变化，确保认证状态一致
watch(
  () => route.path,
  (newPath) => {
    if (newPath !== '/login' && !authStore.isLoggedIn) {
      router.push('/login')
    }
  },
  { immediate: true }
)
</script>

<template>
  <div id="app">
    <MainLayout v-if="authStore.isLoggedIn && !isLoginPage">
      <RouterView />
    </MainLayout>
    <div v-else>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  min-height: 100vh;
  font-family: inherit;
}
</style>
