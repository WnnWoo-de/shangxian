<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useCustomerStore } from '../../stores/customer'
import { useCategoryStore } from '../../stores/category'
import { useFabricStore } from '../../stores/fabric'
import { useBillRecordStore } from '../../stores/billRecord'
import { showToast } from '../../utils/toast'
import logoUrl from '../../assets/logo.svg'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const loginError = ref('')

const form = reactive({
  username: '',
  password: '',
})

// 获取演示账号列表
const demoAccounts = ref([])

onMounted(() => {
  // 加载演示账号列表
  demoAccounts.value = authStore.getDemoAccounts()
  // 默认填充第一个账号
  form.username = '皖盛布碎'
  form.password = '123456'
})

// 快速填充演示账号
const fillDemoAccount = (index) => {
  const account = demoAccounts.value[index]
  form.username = account.username
  form.password = account.password
}

const login = async () => {
  if (!form.username.trim() || !form.password) {
    return showToast('请填写完整账号和密码', 'warning')
  }

  loading.value = true
  loginError.value = ''

  try {
    const ok = await authStore.login(form.username.trim(), form.password, true)

    if (!ok) {
      loginError.value = '账号或密码错误'
      showToast('账号或密码错误', 'error')
      return
    }

    await Promise.allSettled([
      useCustomerStore().init(),
      useCategoryStore().init(),
      useFabricStore().init(),
      useBillRecordStore().init(),
    ])

    showToast('登录成功，欢迎回来', 'success')
    router.push('/dashboard')
  } catch (error) {
    console.error('Login failed:', error)
    loginError.value = '登录失败，请稍后重试'
    showToast('登录失败，请稍后重试', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="login-wrapper">
    <div class="login-shell">
      <div class="login-brand">
        <div class="brand-badge">移动端经营后台</div>
        <img :src="logoUrl" alt="皖盛布碎资源结算系统" class="brand-logo" />
        <h1>皖盛布碎资源结算系统</h1>
        <p class="brand-desc">像一本被重新设计过的账本，温润、清晰、适合高频移动操作。</p>

        <div class="brand-panels">
          <div class="brand-panel">
            <span>采购 / 销售 / 结算</span>
            <strong>同屏协作</strong>
          </div>
          <div class="brand-panel light">
            <span>今日建议</span>
            <strong>先录单，再复盘</strong>
          </div>
        </div>
      </div>

      <div class="login-card">
        <div class="form-header">
          <p class="eyebrow">Welcome back</p>
          <h2>登录系统</h2>
          <p class="form-desc">请输入账号与密码，继续今天的业务处理。</p>
        </div>

        <form @submit.prevent="login" class="login-form">
          <div class="field">
            <label>账号</label>
            <input v-model="form.username" type="text" placeholder="输入您的用户名" autocomplete="username" inputmode="text" />
          </div>

          <div class="field">
            <label>密码</label>
            <input v-model="form.password" type="password" placeholder="输入密码" autocomplete="current-password" @keyup.enter="login" />
          </div>

          <div class="helper-row">
            <span>默认演示账号已填充</span>
            <span>安全连接</span>
          </div>

          <!-- 演示账号列表 -->
          <div class="demo-accounts">
            <p class="demo-label">快速选择演示账号：</p>
            <div class="demo-list">
              <button
                v-for="(account, index) in demoAccounts"
                :key="account.username"
                type="button"
                class="demo-account-btn"
                @click="fillDemoAccount(index)"
              >
                <span class="demo-name">{{ account.name }}</span>
                <span class="demo-username">账号：{{ account.username }} / 密码：123456</span>
              </button>
            </div>
          </div>

          <div v-if="loginError" class="error-message">{{ loginError }}</div>

          <button type="submit" class="btn-login" :disabled="loading">
            <span>{{ loading ? '登录中...' : '进入工作台' }}</span>
          </button>
        </form>

        <div class="login-footer">
          <p>如需重置账号信息，请联系系统管理员。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.login-wrapper{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at top left,rgba(244,228,204,.18),transparent 24%),radial-gradient(circle at right top,rgba(227,187,122,.24),transparent 32%),linear-gradient(180deg,#fffaf3 0%,#f4e9dc 100%)}
.login-shell{width:min(1120px,100%);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);background:rgba(255,250,241,.62);border:1px solid rgba(255,255,255,.68);box-shadow:0 32px 80px rgba(187,161,130,.16);backdrop-filter:blur(20px);border-radius:34px;overflow:hidden}.login-brand,.login-card{padding:42px}.login-brand{position:relative;background:linear-gradient(155deg,rgba(255,250,244,.98) 0%,rgba(248,239,228,.96) 60%,rgba(239,222,196,.9) 140%);color:$text-primary;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}.login-brand::after{content:'';position:absolute;right:-90px;top:-70px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(240,210,157,.22),transparent 65%)}
.brand-badge,.brand-logo,h1,.brand-desc,.brand-panels{position:relative;z-index:1}.brand-badge{display:inline-flex;align-self:flex-start;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.56);font-size:12px;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(255,255,255,.7)}.brand-logo{width:78px;height:78px;object-fit:contain;margin:26px 0 22px;filter:drop-shadow(0 10px 16px rgba(187,161,130,.14))}.login-brand h1{margin:0;font-size:40px;line-height:1.08;color:#8f755b}.brand-desc{margin:18px 0 0;max-width:420px;font-size:15px;line-height:1.9;color:$text-secondary}
.brand-panels{display:grid;gap:14px;margin-top:34px}.brand-panel{padding:18px 20px;border-radius:22px;background:rgba(255,255,255,.34);border:1px solid rgba(255,255,255,.58);backdrop-filter:blur(8px)}.brand-panel.light{background:rgba(255,248,239,.48)}.brand-panel span{display:block;font-size:12px;color:$text-secondary;letter-spacing:.08em;text-transform:uppercase}.brand-panel strong{display:block;margin-top:8px;font-size:22px;color:$text-primary}
.login-card{display:flex;flex-direction:column;justify-content:center;background:rgba(255,250,241,.92)}.form-header{margin-bottom:26px}.eyebrow{margin:0 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:$secondary-dark}.form-header h2{margin:0;font-size:34px;color:$text-primary}.form-desc{margin:12px 0 0;font-size:14px;color:$text-secondary;line-height:1.8}.login-form{display:flex;flex-direction:column;gap:16px}.field{display:flex;flex-direction:column;gap:8px}.field label{font-size:14px;font-weight:600;color:$text-primary}.field input{height:52px;padding:0 16px;border-radius:16px;border:1px solid rgba(106,93,82,.1);background:rgba(255,250,241,.92);font-size:15px;color:$text-primary;transition:border-color $transition-normal,box-shadow $transition-normal,transform $transition-fast;outline:none}.field input:focus{border-color:rgba(200,154,84,.48);box-shadow:0 0 0 4px rgba(227,187,122,.14);transform:translateY(-1px)}
.helper-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:$text-muted}
.demo-accounts{padding:14px;border-radius:16px;background:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.6)}.demo-label{margin:0 0 10px;font-size:12px;font-weight:600;color:$text-secondary}.demo-list{display:flex;flex-direction:column;gap:8px}.demo-account-btn{width:100%;padding:10px 14px;border:1px solid rgba(200,154,84,.3);border-radius:12px;background:rgba(255,250,241,.9);text-align:left;cursor:pointer;transition:all $transition-fast}.demo-account-btn:hover{background:rgba(227,187,122,.15);border-color:rgba(200,154,84,.5);transform:translateY(-1px)}.demo-name{display:block;font-size:14px;font-weight:600;color:$text-primary}.demo-username{display:block;font-size:12px;color:$text-muted;margin-top:2px}
.error-message{padding:12px 14px;border-radius:14px;background:rgba(201,79,67,.08);border:1px solid rgba(201,79,67,.2);color:$error;font-size:14px}.btn-login{width:100%;height:54px;border:none;border-radius:999px;background:linear-gradient(135deg,#f4e3ca 0%,#e7c797 100%);color:#7f6248;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 16px 28px rgba(227,187,122,.22);transition:transform $transition-fast,box-shadow $transition-normal}.btn-login:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 22px 34px rgba(227,187,122,.26)}.btn-login:disabled{opacity:.72;cursor:not-allowed}
.login-footer{margin-top:20px;color:$text-muted;font-size:13px;text-align:center}
@include respond-to(md){.login-shell{grid-template-columns:1fr}.login-brand,.login-card{padding:28px}.login-brand h1{font-size:30px}.form-header h2{font-size:28px}}
@include respond-to(sm){.login-wrapper{padding:10px}.login-shell{border-radius:24px}.brand-logo{width:64px;height:64px;margin:18px 0}.login-brand h1{font-size:26px}.brand-panels{margin-top:22px}.login-card{padding:22px}.field input,.btn-login{height:50px}.helper-row{flex-direction:column;align-items:flex-start}.demo-accounts{padding:12px}.demo-label{font-size:11px}.demo-account-btn{padding:8px 12px}.demo-name{font-size:13px}.demo-username{font-size:11px}}
</style>
