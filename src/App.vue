<script setup>
import { RouterView, useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import MainLayout from './layouts/MainLayout.vue'
import OnboardingTutorial from './components/onboarding/OnboardingTutorial.vue'

const authStore = useAuthStore()
const route = useRoute()

// 判断是否是登录页面
const isLoginPage = computed(() => route.path === '/login')
const showOnboardingTutorial = computed(() => authStore.isLoggedIn && !isLoginPage.value)

onMounted(() => {
  // 确保在应用挂载时重新初始化 auth store
  authStore.init()
})
</script>

<template>
  <div id="app">
    <MainLayout v-if="authStore.isLoggedIn && !isLoginPage">
      <RouterView />
    </MainLayout>
    <div v-else>
      <RouterView />
    </div>
    <OnboardingTutorial :enabled="showOnboardingTutorial" />
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  min-height: 100vh;
  min-height: var(--app-height, 100dvh);
  font-family: inherit;
}
</style>
