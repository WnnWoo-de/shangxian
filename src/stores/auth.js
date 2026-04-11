import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, StorageTypes } from '@/utils'
import { useRouter } from 'vue-router'

// 模拟用户数据
const MOCK_USER = {
  id: 'user-001',
  username: '皖盛布碎',
  name: '管理员',
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

// 模拟用户列表（用于开发调试）
const MOCK_USERS = [
  {
    username: '皖盛布碎',
    password: '123456',
    userInfo: MOCK_USER
  }
]

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const router = useRouter()
  const user = ref(null)
  const token = ref(null)
  const isLoading = ref(false)
  const isAuthenticated = ref(false)

  // 初始化
  function init() {
    const savedToken = storage.getToken()
    const savedUser = storage.getUser()

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = savedUser
      isAuthenticated.value = true
    }
  }

  // 计算属性
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

  // 登录
  async function login(username, password, remember = false) {
    isLoading.value = true

    try {
      // 模拟登录请求
      const mockUser = MOCK_USERS.find(u => u.username === username && u.password === password)

      if (!mockUser) {
        return false
      }

      // 模拟 token 生成
      const mockToken = `token_${Date.now()}`

      // 保存用户信息和token
      user.value = mockUser.userInfo
      token.value = mockToken
      isAuthenticated.value = true

      if (remember) {
        storage.setToken(mockToken)
        storage.setUser(mockUser.userInfo)
      }

      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 登出
  async function logout() {
    isLoading.value = true

    try {
      // 模拟登出请求
      await new Promise(resolve => setTimeout(resolve, 500))

      // 清除状态
      user.value = null
      token.value = null
      isAuthenticated.value = false

      // 清除本地存储
      storage.removeToken()
      storage.removeUser()

      // 跳转到登录页
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 修改密码（模拟）
  async function changePassword(oldPassword, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      throw new Error('新密码与确认密码不一致')
    }

    // 模拟API请求
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 更新密码（仅用于演示）
    MOCK_USERS[0].password = newPassword
    return true
  }

  // 更新用户信息
  async function updateUserInfo(data) {
    if (!user.value) {
      throw new Error('用户未登录')
    }

    try {
      // 模拟API请求
      await new Promise(resolve => setTimeout(resolve, 800))

      user.value = {
        ...user.value,
        ...data
      }

      // 更新本地存储
      storage.setUser(user.value)
      return true
    } catch (error) {
      console.error('Update user info error:', error)
      return false
    }
  }

  // 检查会话是否过期
  function checkSession() {
    return !!token.value && isAuthenticated.value
  }

  // 获取权限列表
  function getPermissions() {
    return user.value?.permissions || []
  }

  // 检查是否是管理员
  function isAdmin() {
    return user.value?.role === 'admin'
  }

  return {
    // 状态
    user,
    token,
    isLoading,
    isAuthenticated,

    // 计算属性
    currentUser,
    isLoggedIn,
    hasPermission,

    // 方法
    init,
    login,
    logout,
    changePassword,
    updateUserInfo,
    checkSession,
    getPermissions,
    isAdmin
  }
})
