<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { showToast } from '@/utils/toast'
import { getExportImageBrandName, setExportImageBrandName } from '@/utils/app-config'
import { canPromptPwaInstall, getPwaInstallLabel, isPwaStandalone, promptPwaInstall, subscribePwaInstallState } from '@/utils/pwa-install'
// UUID is not necessary, just standard icons or simple css shapes

const settingsList = ref([
  {
    id: 1,
    title: '系统主题',
    desc: '当前系统采用浅色系主题，带来清新明亮的视觉体验。',
    value: '浅色系',
    type: 'badge'
  },
  {
    id: 2,
    title: '修改密码',
    desc: '定期修改密码有助于保护您的账号安全。',
    value: '去修改',
    type: 'action'
  },
  {
    id: 3,
    title: '清理缓存',
    desc: '清除本地的临时离线数据和图片缓存。',
    value: '23.5 MB',
    type: 'action'
  },
  {
    id: 4,
    title: '当前版本',
    desc: '系统核心版本信息，已是最新更新。',
    value: 'v2.1.0',
    type: 'text'
  }
])

const exportImageBrandName = ref('')
const savingBrandName = ref(false)
const canInstallPwa = ref(false)
const pwaInstallText = ref('检测安装状态中')
let unsubscribePwaInstall = null

const updatePwaInstallState = () => {
  canInstallPwa.value = canPromptPwaInstall()
  pwaInstallText.value = getPwaInstallLabel()
}

const loadBrandName = () => {
  exportImageBrandName.value = getExportImageBrandName()
}

const saveBrandName = async () => {
  if (savingBrandName.value) return
  savingBrandName.value = true
  try {
    const nextName = String(exportImageBrandName.value || '').trim()
    setExportImageBrandName(nextName)
    exportImageBrandName.value = getExportImageBrandName()
    showToast('导出图片顶部标题已保存', 'success')
  } catch (error) {
    console.error('保存导出图片标题失败:', error)
    showToast('保存失败，请重试', 'error')
  } finally {
    savingBrandName.value = false
  }
}

const installPwa = async () => {
  if (isPwaStandalone()) {
    showToast('当前已经是应用模式', 'success')
    updatePwaInstallState()
    return
  }

  const result = await promptPwaInstall()
  updatePwaInstallState()

  if (result?.outcome === 'unavailable') {
    showToast('请在安卓浏览器菜单中选择“安装应用”或“添加到主屏幕”', 'error')
    return
  }

  if (result?.outcome === 'accepted') {
    showToast('正在安装应用', 'success')
  }
}

onMounted(() => {
  loadBrandName()
  updatePwaInstallState()
  unsubscribePwaInstall = subscribePwaInstallState(updatePwaInstallState)
})

onBeforeUnmount(() => {
  unsubscribePwaInstall?.()
})
</script>

<template>
  <div class="settings-container">
    <div class="header-box">
      <h2 class="title">系统设置</h2>
      <p class="subtitle">管理您的偏好设置与系统状态</p>
    </div>

    <section class="panel settings-panel">
      <div class="setting-item">
        <div class="item-info">
          <h3>导出图片顶部标题</h3>
          <p>用于单据详情页和开单页导出图片顶部中间显示的文字。</p>
        </div>
        <div class="item-action item-action-row">
          <input
            v-model="exportImageBrandName"
            type="text"
            class="brand-input"
            placeholder="请输入导出图片顶部标题"
            maxlength="24"
          />
          <button class="action-btn" :disabled="savingBrandName" @click="saveBrandName">
            {{ savingBrandName ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </section>

    <section class="panel settings-panel">
      <div class="setting-item">
        <div class="item-info">
          <h3>安装到安卓平板桌面</h3>
          <p>安装后可像普通应用一样从桌面打开，并支持离线缓存。</p>
        </div>
        <div class="item-action">
          <button class="action-btn" :disabled="!canInstallPwa" @click="installPwa">
            {{ pwaInstallText }}
          </button>
        </div>
      </div>

      <div 
        class="setting-item" 
        v-for="(item, index) in settingsList" 
        :key="item.id"
      >
        <div class="item-info">
          <h3>{{ item.title }}</h3>
          <p>{{ item.desc }}</p>
        </div>
        
        <div class="item-action">
          <span v-if="item.type === 'text'" class="value-text">{{ item.value }}</span>
          
          <span v-else-if="item.type === 'badge'" class="theme-badge">
            <i class="sun-icon"></i>
            {{ item.value }}
          </span>

          <button v-else-if="item.type === 'action'" class="action-btn">
            {{ item.value }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 20px;
}

.header-box {
  margin-bottom: 8px;
}

.header-box .title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.header-box .subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-radius: 16px;
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.setting-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-blue-deep);
  transform: scaleX(0);
  transition: transform 0.3s;
}

.setting-item:hover::before {
  transform: scaleX(1);
}

.setting-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-blue-light);
}

.item-info h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-info p {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
  line-height: 1.4;
}

.item-action {
  display: flex;
  align-items: center;
}

.item-action-row {
  gap: 10px;
}

.brand-input {
  width: 260px;
  max-width: 100%;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--input-border);
  padding: 0 12px;
  font-size: 14px;
  background: #fff;
  color: var(--text-primary);
}

.brand-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(36, 127, 214, 0.12);
}

.value-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
}

.theme-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--primary-soft);
  color: var(--primary-dark);
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(45, 199, 176, 0.2);
}

.sun-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: currentColor;
  position: relative;
}

.sun-icon::before {
  content: '';
  position: absolute;
  top: -4px; right: -4px; bottom: -4px; left: -4px;
  border: 2px dashed currentColor;
  border-radius: 50%;
  opacity: 0.5;
}

.action-btn {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--accent-blue);
  background: #fff;
  color: var(--accent-blue-deep);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-btn:hover {
  background: var(--accent-blue-deep);
  color: #fff;
  border-color: var(--accent-blue-deep);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(36, 127, 214, 0.2);
}

@media (max-width: 768px) {
  .settings-container {
    padding: 0 16px;
    gap: 20px;
  }

  .header-box .title {
    font-size: 24px;
  }

  .setting-item {
    padding: 16px 20px;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .item-action {
    align-self: flex-end;
  }

  .item-action-row {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .brand-input {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .settings-container {
    padding: 0 12px;
    gap: 16px;
  }

  .header-box .title {
    font-size: 20px;
  }

  .header-box .subtitle {
    font-size: 14px;
  }

  .setting-item {
    padding: 14px 16px;
  }

  .item-info h3 {
    font-size: 16px;
  }

  .item-info p {
    font-size: 13px;
  }

  .action-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
