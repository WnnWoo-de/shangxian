import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@/utils'
import { useRouter } from 'vue-router'
import { loginApi } from '@/api/cloud'

const MOCK_USERS = [
  {
    username: '皖盛布碎',
    password: '123456',
    userInfo: {
      id: 'user-001',
      username: '皖盛布碎',
      name: '系统管理员',
      phone: '',
      avatar: '',
      email: 'admin@wsbs.com',
      department: '财务部',
      role: 'admin',
      permissions: ['all'],
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  }
]

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()
  const user = ref(null)
  const token = ref(null)
  const isLoading = ref(false)
  const isAuthenticated = ref(false)

  function init() {
    const savedToken = storage.getToken()
    const savedUser = storage.getUser()

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = savedUser
      isAuthenticated.value = true
    }
  }

  const currentUser = computed(() => user.value)
  const isLoggedIn = computed(() => isAuthenticated.value)
  const hasPermission = computed(() => {
    return (permissions) => {
      if (!user.value || !user.value.permissions) return false
      if (user.value.permissions.includes('all')) return true

      if (Array.isArray(permissions)) {
        return permissions.some(p => user.value.permissions.includes(p))
      }

      return user.value.permissions.includes(permissions)
    }
  })

  async function login(username, password) {
    isLoading.value = true

    try {
      let authUser = null
      let authToken = null

      try {
        const cloudAuth = await loginApi(username, password)
        authUser = cloudAuth?.user || null
        authToken = cloudAuth?.token || null
      } catch (error) {
        console.warn('云端登录失败，回退本地登录:', error)
      }

      if (!authUser || !authToken) {
        const mockUser = MOCK_USERS.find(u => u.username === username && u.password === password)
        if (!mockUser) return false
        authUser = mockUser.userInfo
        authToken = `token_${Date.now()}`
      }

      user.value = authUser
      token.value = authToken
      isAuthenticated.value = true

      storage.setToken(authToken)
      storage.setUser(authUser)

      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    isLoading.value = true

    try {
      await new Promise(resolve => setTimeout(resolve, 120))

      user.value = null
      token.value = null
      isAuthenticated.value = false

      storage.removeToken()
      storage.removeUser()

      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function changePassword(oldPassword, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      throw new Error('新密码与确认密码不一致')
    }

    await new Promise(resolve => setTimeout(resolve, 300))
    MOCK_USERS[0].password = newPassword
    return true
  }

  async function updateUserInfo(data) {
    if (!user.value) {
      throw new Error('用户未登录')
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 200))

      user.value = {
        ...user.value,
        ...data
      }

      storage.setUser(user.value)
      return true
    } catch (error) {
      console.error('Update user info error:', error)
      return false
    }
  }

  function checkSession() {
    return !!token.value && isAuthenticated.value
  }

  function getPermissions() {
    return user.value?.permissions || []
  }

  function isAdmin() {
    return user.value?.role === 'admin'
  }

  function getDemoAccounts() {
    return MOCK_USERS.map(u => ({
      username: u.username,
      password: u.password,
      name: u.userInfo.name,
      role: u.userInfo.role
    }))
  }

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    currentUser,
    isLoggedIn,
    hasPermission,
    init,
    login,
    logout,
    changePassword,
    updateUserInfo,
    checkSession,
    getPermissions,
    isAdmin,
    getDemoAccounts
  }
})
