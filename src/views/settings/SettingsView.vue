<script setup>
import { computed, onMounted, ref } from 'vue'
import { showToast } from '@/utils/toast'
import { getExportImageBrandName, setExportImageBrandName } from '@/utils/app-config'
import { getPreferredTheme, getResolvedTheme, setTheme } from '@/utils/theme'
// UUID is not necessary, just standard icons or simple css shapes

const settingsList = ref([
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
const themeMode = ref('system')
const resolvedTheme = ref('light')

const themeOptions = [
  { value: 'light', label: '亮色', iconClass: 'sun-icon' },
  { value: 'dark', label: '暗色', iconClass: 'moon-icon' },
  { value: 'system', label: '跟随系统', iconClass: 'system-icon' },
]

const themeLabel = computed(() => {
  const current = themeOptions.find((item) => item.value === themeMode.value)
  return current?.label || '跟随系统'
})

const loadBrandName = () => {
  exportImageBrandName.value = getExportImageBrandName()
}

const loadTheme = () => {
  themeMode.value = getPreferredTheme()
  resolvedTheme.value = getResolvedTheme(themeMode.value)
}

const changeTheme = (mode) => {
  themeMode.value = setTheme(mode)
  resolvedTheme.value = getResolvedTheme(themeMode.value)
  showToast(`已切换为${themeLabel.value}`, 'success')
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

onMounted(() => {
  loadBrandName()
  loadTheme()
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
      <div class="setting-item theme-setting">
        <div class="item-info">
          <h3>系统主题</h3>
          <p>切换亮色、暗色或跟随系统，暗色模式会同步适配侧边栏、表格、输入框和弹窗。</p>
        </div>
        <div class="theme-control" role="group" aria-label="系统主题">
          <button
            v-for="item in themeOptions"
            :key="item.value"
            type="button"
            :class="['theme-switch-btn', { active: themeMode === item.value }]"
            @click="changeTheme(item.value)"
          >
            <i :class="item.iconClass"></i>
            <span>{{ item.label }}</span>
          </button>
          <span class="theme-state">{{ resolvedTheme === 'dark' ? '当前暗色' : '当前亮色' }}</span>
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
  background: var(--input-bg);
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

.theme-setting {
  align-items: flex-start;
}

.theme-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.theme-switch-btn {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.theme-switch-btn:hover,
.theme-switch-btn.active {
  transform: translateY(-1px);
  background: var(--primary-soft);
  border-color: rgba(125, 183, 173, 0.42);
}

.theme-switch-btn i {
  flex-shrink: 0;
}

.theme-state {
  width: 100%;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: right;
}

.sun-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: currentColor;
  position: relative;
}

.moon-icon {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: inset -5px 0 0 var(--card-bg);
}

.system-icon {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 2px solid currentColor;
  position: relative;
}

.system-icon::after {
  content: '';
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: -5px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
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
  background: var(--input-bg);
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

  .theme-control {
    width: 100%;
    justify-content: flex-start;
  }

  .theme-state {
    text-align: left;
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
