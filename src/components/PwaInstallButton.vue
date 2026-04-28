<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  canPromptPwaInstall,
  getPwaInstallGuide,
  isPwaStandalone,
  promptPwaInstall,
  setupPwaInstallPrompt,
  subscribePwaInstallState,
} from '@/utils/pwa-install'

const deferredPrompt = ref(null)
const installed = ref(false)
const showGuide = ref(false)
const prompting = ref(false)

const updateInstallState = () => {
  installed.value = isPwaStandalone()
}

const shouldShowButton = computed(() => !installed.value)
const installGuide = computed(() => getPwaInstallGuide())

const handleBeforeInstallPrompt = (event) => {
  event.preventDefault()
  deferredPrompt.value = event
  updateInstallState()
}

const handleAppInstalled = () => {
  deferredPrompt.value = null
  installed.value = true
  showGuide.value = false
  prompting.value = false
}

const waitForInstallPrompt = (timeout = 2500) => {
  if (deferredPrompt.value || canPromptPwaInstall()) return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false
    let unsubscribe = null

    const finish = (ready) => {
      if (settled) return
      settled = true
      unsubscribe?.()
      window.clearTimeout(timer)
      resolve(ready)
    }

    const timer = window.setTimeout(() => finish(false), timeout)

    unsubscribe = subscribePwaInstallState(() => {
      updateInstallState()
      if (deferredPrompt.value || canPromptPwaInstall()) {
        finish(true)
      }
    })
  })
}

const installToHomeScreen = async () => {
  if (prompting.value) return

  if (isPwaStandalone()) {
    handleAppInstalled()
    return
  }

  prompting.value = true
  showGuide.value = false

  if (!deferredPrompt.value && !canPromptPwaInstall()) {
    await waitForInstallPrompt()
  }

  try {
    const result = await promptPwaInstall()
    deferredPrompt.value = null

    if (result?.outcome === 'unavailable') {
      showGuide.value = true
      return
    }

    updateInstallState()
  } finally {
    prompting.value = false
  }
}

const closeGuide = () => {
  showGuide.value = false
}

let unsubscribeInstallState = null

onMounted(() => {
  setupPwaInstallPrompt()
  updateInstallState()
  unsubscribeInstallState = subscribePwaInstallState(updateInstallState)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
})

onBeforeUnmount(() => {
  unsubscribeInstallState?.()
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<template>
  <button
    v-if="shouldShowButton"
    type="button"
    class="pwa-install-btn"
    :disabled="prompting"
    @click="installToHomeScreen"
  >
    <span class="install-icon" aria-hidden="true"></span>
    <span>{{ prompting ? '正在打开...' : '添加到主屏幕' }}</span>
  </button>

  <Teleport to="body">
    <div v-if="showGuide" class="install-guide-mask" @click.self="closeGuide">
      <div class="install-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-guide-title">
        <div class="guide-header">
          <div>
            <h3 id="pwa-install-guide-title">添加到主屏幕</h3>
            <p>当前浏览器需要手动完成添加。</p>
          </div>
          <button type="button" class="guide-close" aria-label="关闭" @click="closeGuide"></button>
        </div>

        <p class="guide-text">{{ installGuide }}</p>

        <div class="guide-steps">
          <div class="guide-step">
            <span>1</span>
            <p>打开浏览器菜单、分享按钮或更多选项。</p>
          </div>
          <div class="guide-step">
            <span>2</span>
            <p>选择“安装应用”或“添加到主屏幕”。</p>
          </div>
          <div class="guide-step">
            <span>3</span>
            <p>确认后即可从桌面图标直接进入系统。</p>
          </div>
        </div>

        <button type="button" class="guide-confirm" @click="closeGuide">知道了</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pwa-install-btn {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 18px;
  border: 1px solid rgba(95, 157, 146, 0.38);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fffdf8;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(95, 157, 146, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.pwa-install-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(95, 157, 146, 0.26);
  filter: saturate(1.05);
}

.pwa-install-btn:disabled {
  cursor: wait;
  opacity: 0.82;
  transform: none;
  filter: none;
}

.pwa-install-btn:active {
  transform: translateY(0);
  box-shadow: 0 8px 18px rgba(95, 157, 146, 0.18);
}

.install-icon {
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: 5px;
  position: relative;
  flex: 0 0 auto;
}

.install-icon::before,
.install-icon::after {
  content: '';
  position: absolute;
  left: 50%;
  background: currentColor;
  border-radius: 999px;
  transform: translateX(-50%);
}

.install-icon::before {
  top: 3px;
  width: 2px;
  height: 8px;
}

.install-icon::after {
  top: 9px;
  width: 8px;
  height: 2px;
  box-shadow: -3px -3px 0 -1px currentColor, 3px -3px 0 -1px currentColor;
}

.install-guide-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(16px, var(--safe-area-inset-top)) max(16px, var(--safe-area-inset-right)) max(16px, var(--safe-area-inset-bottom)) max(16px, var(--safe-area-inset-left));
  background: rgba(60, 52, 45, 0.38);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.install-guide-dialog {
  width: min(420px, 100%);
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  box-shadow: 0 24px 70px rgba(71, 59, 47, 0.24);
  padding: 22px;
}

.guide-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.guide-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.guide-header p,
.guide-text,
.guide-step p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.guide-header p {
  margin-top: 6px;
  font-size: 13px;
}

.guide-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--input-bg);
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
}

.guide-close::before,
.guide-close::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.guide-close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.guide-close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.guide-text {
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--primary-soft);
  font-size: 14px;
  color: var(--primary-dark);
}

.guide-steps {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.guide-step span {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--primary);
  color: #fffdf8;
  font-size: 12px;
  font-weight: 800;
}

.guide-step p {
  padding-top: 1px;
  font-size: 14px;
}

.guide-confirm {
  width: 100%;
  min-height: 44px;
  margin-top: 20px;
  border: 0;
  border-radius: 12px;
  background: var(--accent-blue-deep);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 768px) {
  .pwa-install-btn {
    width: 100%;
    min-height: 48px;
    font-size: 15px;
  }

  .install-guide-mask {
    align-items: flex-end;
  }

  .install-guide-dialog {
    border-radius: 18px 18px 14px 14px;
    padding: 20px;
  }
}
</style>
