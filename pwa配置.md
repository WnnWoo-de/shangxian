# 安卓平板 Vue PWA 添加到主屏幕按钮操作说明

> 适用场景：你已经有一个 Vue 项目，并且已经添加了 PWA。现在希望在前端页面放一个按钮，让安卓平板用户点击后把网站安装到桌面/主屏幕。

---

## 1. 先明确结论

安卓平板可以做“添加到主屏幕 / 安装到桌面”按钮，但不是前端代码直接强制安装，而是通过浏览器提供的 PWA 安装弹窗完成。

在 Android Chrome、Edge、Samsung Internet 等 Chromium 系浏览器中，浏览器检测到你的站点符合 PWA 安装条件后，会触发：

```js
beforeinstallprompt
```

我们需要做的是：

1. 监听 `beforeinstallprompt` 事件；
2. 把这个事件保存起来；
3. 页面上显示“添加到主屏幕”按钮；
4. 用户点击按钮时，调用 `prompt()`；
5. 浏览器弹出原生安装确认框；
6. 用户确认后，PWA 会被安装到安卓平板主屏幕。

---

## 2. 必须满足的 PWA 条件

按钮能不能弹出安装窗口，主要看浏览器是否认为你的项目“可以安装”。

至少需要满足这些条件：

| 条件 | 说明 |
|---|---|
| HTTPS | 线上必须是 `https`，本地 `localhost` 可以测试 |
| manifest.json | 必须有 PWA 配置文件 |
| Service Worker | 必须注册并正常运行 |
| 图标 | 建议至少有 `192x192` 和 `512x512` |
| display | 建议设置为 `standalone` |
| start_url | 建议设置为 `/` |
| 没有安装过 | 如果已经安装过，按钮一般应该隐藏 |
| 浏览器支持 | 安卓 Chrome / Edge 通常支持，iOS Safari 不支持直接弹安装框 |

---

## 3. 推荐目录结构

假设你的 Vue 项目是 Vite + Vue3，可以按下面结构放文件：

```txt
你的项目/
├─ public/
│  └─ icons/
│     ├─ icon-192.png
│     └─ icon-512.png
├─ src/
│  ├─ components/
│  │  └─ InstallPWAButton.vue
│  ├─ App.vue
│  └─ main.ts
├─ vite.config.ts
└─ package.json
```

---

## 4. 检查 vite-plugin-pwa 配置

如果你的项目用的是 `vite-plugin-pwa`，可以检查 `vite.config.ts`。

如果还没有安装：

```bash
npm install vite-plugin-pwa -D
```

然后在 `vite.config.ts` 中配置：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '进出货记账系统',
        short_name: '记账系统',
        description: '一个支持进出货、客户交易、品种分析和月度报表的记账系统',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1677ff',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ]
})
```

### 注意

`/icons/icon-192.png` 和 `/icons/icon-512.png` 必须真实存在。

如果图标路径写错，PWA 可能无法被浏览器识别为可安装。

---

## 5. 新建安装按钮组件

在 `src/components/` 目录中新建：

```txt
InstallPWAButton.vue
```

写入下面代码：

```vue
<template>
  <div v-if="shouldShow" class="pwa-install-card">
    <div class="pwa-install-text">
      <strong>安装到平板主屏幕</strong>
      <p>安装后可以像 App 一样从桌面打开，使用更方便。</p>
    </div>

    <button class="pwa-install-button" @click="installPWA">
      添加到主屏幕
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type UserChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<UserChoice>
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const canInstall = ref(false)
const isInstalled = ref(false)

const isStandaloneMode = () => {
  return window.matchMedia('(display-mode: standalone)').matches
}

const shouldShow = computed(() => {
  return canInstall.value && !isInstalled.value
})

const handleBeforeInstallPrompt = (event: Event) => {
  // 阻止浏览器自动弹出安装提示
  event.preventDefault()

  // 保存事件，等用户点击按钮时再触发
  deferredPrompt.value = event as BeforeInstallPromptEvent
  canInstall.value = true
}

const handleAppInstalled = () => {
  console.log('PWA 已安装')
  isInstalled.value = true
  canInstall.value = false
  deferredPrompt.value = null
}

const installPWA = async () => {
  if (!deferredPrompt.value) {
    console.log('当前浏览器还没有触发 PWA 安装事件')
    return
  }

  // 弹出浏览器原生安装确认框
  await deferredPrompt.value.prompt()

  // 获取用户选择结果
  const choice = await deferredPrompt.value.userChoice

  if (choice.outcome === 'accepted') {
    console.log('用户同意安装 PWA')
  } else {
    console.log('用户取消安装 PWA')
  }

  deferredPrompt.value = null
  canInstall.value = false
}

onMounted(() => {
  isInstalled.value = isStandaloneMode()

  if (isInstalled.value) return

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<style scoped>
.pwa-install-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  margin: 12px 0;
  border-radius: 12px;
  background: #f5f8ff;
  border: 1px solid #dbe7ff;
}

.pwa-install-text strong {
  font-size: 15px;
  color: #1f2937;
}

.pwa-install-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6b7280;
}

.pwa-install-button {
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  background: #1677ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.pwa-install-button:active {
  opacity: 0.85;
}
</style>
```

---

## 6. 在页面中引入按钮

如果你想让按钮在整个项目首页显示，可以在 `App.vue` 中引入。

例如：

```vue
<template>
  <div>
    <InstallPWAButton />

    <router-view />
  </div>
</template>

<script setup lang="ts">
import InstallPWAButton from './components/InstallPWAButton.vue'
</script>
```

如果你的首页是 `HomeView.vue`，也可以只放在首页：

```vue
<template>
  <main>
    <InstallPWAButton />

    <!-- 你的首页内容 -->
  </main>
</template>

<script setup lang="ts">
import InstallPWAButton from '@/components/InstallPWAButton.vue'
</script>
```

---

## 7. 安卓平板测试步骤

### 第一步：打包项目

```bash
npm run build
```

### 第二步：部署到 HTTPS 线上环境

可以部署到：

- Cloudflare Pages
- Vercel
- Netlify
- 自己的云服务器 + Nginx + HTTPS

注意：

```txt
PWA 安装测试不要只看 npm run dev。
```

最好用正式部署后的 HTTPS 地址测试。

---

### 第三步：安卓平板打开网站

在安卓平板上使用 Chrome 或 Edge 打开你的项目地址。

例如：

```txt
https://your-domain.com
```

---

### 第四步：等待安装按钮出现

如果 PWA 条件满足，浏览器会触发 `beforeinstallprompt`，你的页面就会显示：

```txt
添加到主屏幕
```

点击按钮后，浏览器会弹出安装确认框。

用户点击确认后，网站就会像 App 一样出现在安卓平板桌面。

---

## 8. 如果按钮没有出现，按这个顺序排查

### 1. 是否使用 HTTPS

错误示例：

```txt
http://your-domain.com
```

正确示例：

```txt
https://your-domain.com
```

本地开发环境可以用：

```txt
http://localhost:5173
```

但真实平板测试建议用线上 HTTPS。

---

### 2. manifest 是否正常加载

浏览器访问：

```txt
https://你的域名/manifest.webmanifest
```

或者：

```txt
https://你的域名/manifest.json
```

看是否能正常打开。

如果 404，说明 manifest 没有正确生成或路径错误。

---

### 3. 图标路径是否正确

检查这两个地址能不能打开：

```txt
https://你的域名/icons/icon-192.png
https://你的域名/icons/icon-512.png
```

如果打不开，说明图标路径错误。

---

### 4. Service Worker 是否注册成功

在电脑 Chrome 中打开你的网站，按 F12：

```txt
Application → Service Workers
```

确认是否有 Service Worker。

如果没有，说明 PWA 没有注册成功。

---

### 5. 是否已经安装过

如果这个 PWA 已经安装过，浏览器可能不会再次触发安装事件。

解决方法：

1. 在安卓平板桌面删除已安装的 PWA；
2. 打开 Chrome 设置；
3. 清除该网站的数据；
4. 重新打开网站测试。

---

### 6. 用户之前是否点过取消

如果用户刚刚取消过安装，Chrome 可能不会立刻再次触发安装提示。

解决方法：

- 等一段时间再测试；
- 清除站点数据；
- 换一个浏览器测试；
- 改用无痕窗口测试。

---

## 9. 给 Codex 的修改提示词

如果你想直接让 Codex 帮你改项目，可以复制下面这段：

```txt
我有一个 Vue3 + Vite 项目，已经配置了 PWA。现在需要在前端页面添加一个安卓平板可用的“添加到主屏幕”按钮。

请帮我完成以下修改：

1. 新建 src/components/InstallPWAButton.vue 组件；
2. 组件需要监听 beforeinstallprompt 事件；
3. 阻止浏览器默认安装提示，并保存事件对象；
4. 当浏览器判断 PWA 可安装时，显示“添加到主屏幕”按钮；
5. 用户点击按钮时调用 deferredPrompt.prompt() 弹出浏览器原生安装确认框；
6. 监听 appinstalled 事件，安装成功后隐藏按钮；
7. 如果已经处于 standalone 模式，也隐藏按钮；
8. 使用 Vue3 Composition API + TypeScript；
9. 给按钮添加简单美观的样式；
10. 在 App.vue 或首页组件中引入并显示该按钮；
11. 不要影响原有业务功能。

目标设备主要是安卓平板 Chrome / Edge 浏览器。
```

---

## 10. 最终推荐效果

页面顶部或首页卡片区域可以显示：

```txt
安装到平板主屏幕
安装后可以像 App 一样从桌面打开，使用更方便。
[添加到主屏幕]
```

用户点击后：

```txt
浏览器弹出安装确认框 → 用户确认 → 桌面生成应用图标
```

---

## 11. 重要提醒

这个按钮的作用不是“前端强制安装”，而是“在合适的时候调用浏览器提供的安装弹窗”。

如果浏览器没有触发 `beforeinstallprompt`，按钮就不应该显示。

也就是说：

```txt
按钮出现 = 浏览器认为你的 PWA 可以安装
按钮不出现 = PWA 条件、浏览器环境或安装状态可能不满足
```

---

## 12. 参考资料

- MDN：Trigger installation from your PWA
- web.dev：Installation prompt
- web.dev：How to provide your own in-app install experience
- web.dev：What does it take to be installable?

---

## 12. 移动端通用方案：安卓 + iPhone/iPad + 其他移动浏览器

如果你希望一个按钮尽量兼容所有手机/平板，可以做成“移动端通用安装引导组件”。

但是要注意：

```txt
移动端没有一个真正 100% 通用的 JS API 可以直接把 PWA 添加到主屏幕。
```

推荐做法是：

| 设备/浏览器 | 处理方式 |
|---|---|
| Android Chrome / Edge / 部分 Chromium 浏览器 | 使用 `beforeinstallprompt` 调出原生安装弹窗 |
| iPhone / iPad Safari | 不能用 JS 直接弹安装框，显示“分享 → 添加到主屏幕”教程 |
| 其他移动浏览器 | 显示浏览器菜单手动添加教程 |
| 已安装状态 | 自动隐藏安装入口 |

也就是说，前端页面可以统一放一个按钮，比如：

```txt
安装到手机/平板桌面
```

用户点击后：

- 如果是安卓 Chrome/Edge，并且浏览器已经触发 `beforeinstallprompt`，就弹出原生安装确认框；
- 如果是 iPhone/iPad，就弹出操作说明；
- 如果是其他移动浏览器，就提示用户从浏览器菜单里选择“添加到主屏幕”或“安装应用”。

---

## 13. 推荐使用：移动端通用安装组件

如果你想兼容安卓手机、安卓平板、iPhone、iPad，可以把原来的 `InstallPWAButton.vue` 替换成下面这个版本。

文件位置：

```txt
src/components/InstallPWAButton.vue
```

完整代码：

```vue
<template>
  <div v-if="showInstallCard" class="pwa-install-card">
    <div class="pwa-install-content">
      <div class="pwa-install-title">
        安装到手机/平板桌面
      </div>
      <div class="pwa-install-desc">
        安装后可以像 App 一样从桌面打开，使用更方便。
      </div>
    </div>

    <button class="pwa-install-button" @click="handleInstallClick">
      {{ buttonText }}
    </button>
  </div>

  <div v-if="showGuide" class="pwa-guide-mask" @click.self="closeGuide">
    <div class="pwa-guide-dialog">
      <div class="pwa-guide-header">
        <strong>{{ guideTitle }}</strong>
        <button class="pwa-guide-close" @click="closeGuide">×</button>
      </div>

      <div class="pwa-guide-body">
        <template v-if="deviceType === 'ios'">
          <p>当前设备是 iPhone / iPad，浏览器通常不能直接弹出 PWA 安装确认框。</p>
          <ol>
            <li>请使用 Safari 打开当前网站；</li>
            <li>点击底部或顶部的“分享”按钮；</li>
            <li>选择“添加到主屏幕”；</li>
            <li>点击“添加”完成安装。</li>
          </ol>
        </template>

        <template v-else-if="deviceType === 'android'">
          <p>如果没有自动弹出安装窗口，可以手动添加：</p>
          <ol>
            <li>请使用 Chrome、Edge 或系统浏览器打开网站；</li>
            <li>点击浏览器右上角的“⋮”菜单；</li>
            <li>选择“安装应用”或“添加到主屏幕”；</li>
            <li>确认后即可在桌面打开。</li>
          </ol>
        </template>

        <template v-else>
          <p>当前浏览器可能不支持直接安装提示。</p>
          <ol>
            <li>请先尝试使用 Chrome、Edge 或 Safari 打开；</li>
            <li>打开浏览器菜单；</li>
            <li>查找“添加到主屏幕”或“安装应用”；</li>
            <li>如果没有该选项，说明当前浏览器暂不支持。</li>
          </ol>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type UserChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<UserChoice>
}

type DeviceType = 'android' | 'ios' | 'other'

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const canUseNativePrompt = ref(false)
const isInstalled = ref(false)
const showGuide = ref(false)
const showFallbackEntry = ref(false)
const deviceType = ref<DeviceType>('other')

let fallbackTimer: number | null = null

const getDeviceType = (): DeviceType => {
  const ua = navigator.userAgent.toLowerCase()

  // iPadOS 13+ 可能会伪装成 Mac，需要用 maxTouchPoints 判断
  const isIPadOS =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  if (/android/.test(ua)) return 'android'
  if (/iphone|ipad|ipod/.test(ua) || isIPadOS) return 'ios'

  return 'other'
}

const isMobileLikeDevice = () => {
  const ua = navigator.userAgent.toLowerCase()

  return (
    /android|iphone|ipad|ipod|mobile|tablet/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

const isStandaloneMode = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari 添加到主屏幕后会有这个字段
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const showInstallCard = computed(() => {
  if (isInstalled.value) return false
  if (!isMobileLikeDevice()) return false

  // 安卓原生安装事件可用时显示按钮
  if (canUseNativePrompt.value) return true

  // iOS 或其他移动浏览器显示手动引导入口
  return showFallbackEntry.value
})

const buttonText = computed(() => {
  if (canUseNativePrompt.value) return '添加到主屏幕'
  return '查看添加方法'
})

const guideTitle = computed(() => {
  if (deviceType.value === 'ios') return 'iPhone / iPad 添加方法'
  if (deviceType.value === 'android') return '安卓设备添加方法'
  return '移动端添加方法'
})

const handleBeforeInstallPrompt = (event: Event) => {
  event.preventDefault()

  deferredPrompt.value = event as BeforeInstallPromptEvent
  canUseNativePrompt.value = true
  showFallbackEntry.value = false

  if (fallbackTimer) {
    window.clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
}

const handleAppInstalled = () => {
  console.log('PWA 已安装')
  isInstalled.value = true
  canUseNativePrompt.value = false
  showFallbackEntry.value = false
  deferredPrompt.value = null
}

const handleInstallClick = async () => {
  // 安卓 Chrome / Edge 等浏览器：优先使用原生安装弹窗
  if (deferredPrompt.value) {
    await deferredPrompt.value.prompt()

    const choice = await deferredPrompt.value.userChoice

    if (choice.outcome === 'accepted') {
      console.log('用户同意安装 PWA')
    } else {
      console.log('用户取消安装 PWA')
    }

    deferredPrompt.value = null
    canUseNativePrompt.value = false
    return
  }

  // iOS / 其他移动浏览器：显示手动添加教程
  showGuide.value = true
}

const closeGuide = () => {
  showGuide.value = false
}

onMounted(() => {
  deviceType.value = getDeviceType()
  isInstalled.value = isStandaloneMode()

  if (isInstalled.value) return

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)

  // iOS 没有 beforeinstallprompt，所以直接显示“查看添加方法”
  if (deviceType.value === 'ios') {
    showFallbackEntry.value = true
    return
  }

  // 安卓/其他移动浏览器：先等浏览器是否触发 beforeinstallprompt
  // 如果没有触发，再显示手动添加入口
  fallbackTimer = window.setTimeout(() => {
    if (!canUseNativePrompt.value && isMobileLikeDevice()) {
      showFallbackEntry.value = true
    }
  }, 1500)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)

  if (fallbackTimer) {
    window.clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
})
</script>

<style scoped>
.pwa-install-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  margin: 12px 0;
  border-radius: 14px;
  background: #f5f8ff;
  border: 1px solid #dbe7ff;
}

.pwa-install-content {
  flex: 1;
  min-width: 0;
}

.pwa-install-title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.pwa-install-desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: #6b7280;
}

.pwa-install-button {
  border: none;
  border-radius: 9px;
  padding: 9px 14px;
  background: #1677ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.pwa-install-button:active {
  opacity: 0.85;
}

.pwa-guide-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.pwa-guide-dialog {
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
}

.pwa-guide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #eef2f7;
  color: #111827;
}

.pwa-guide-close {
  border: none;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
}

.pwa-guide-body {
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
}

.pwa-guide-body p {
  margin: 0 0 10px;
}

.pwa-guide-body ol {
  margin: 0;
  padding-left: 20px;
}

@media (max-width: 480px) {
  .pwa-install-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .pwa-install-button {
    width: 100%;
  }
}
```

---

## 14. 在页面中使用移动端通用组件

如果你想全站都能看到安装入口，可以放在 `App.vue`：

```vue
<template>
  <div>
    <InstallPWAButton />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import InstallPWAButton from './components/InstallPWAButton.vue'
</script>
```

如果你只想在首页显示，就放在首页页面，比如：

```txt
src/views/HomeView.vue
```

```vue
<template>
  <main>
    <InstallPWAButton />

    <!-- 你的首页内容 -->
  </main>
</template>

<script setup lang="ts">
import InstallPWAButton from '@/components/InstallPWAButton.vue'
</script>
```

---

## 15. 移动端通用版测试方法

### 1. 安卓平板 / 安卓手机

推荐使用：

```txt
Chrome / Edge / Samsung Internet
```

测试结果应该是：

```txt
点击按钮 → 浏览器弹出安装确认框 → 确认 → 桌面出现应用图标
```

如果没有弹出原生安装框，组件会显示教程，提示用户从浏览器菜单手动添加。

---

### 2. iPhone / iPad

推荐使用：

```txt
Safari
```

测试结果应该是：

```txt
点击按钮 → 显示操作教程 → 分享按钮 → 添加到主屏幕
```

iPhone / iPad 不建议期待 `beforeinstallprompt`，因为 Safari 通常不支持像安卓 Chrome 那样让网页按钮直接弹出 PWA 安装确认框。

---

### 3. 已经安装后的状态

如果用户已经从主屏幕打开你的 PWA，组件会检测：

```txt
window.matchMedia('(display-mode: standalone)')
```

或者 iOS 的：

```txt
window.navigator.standalone
```

检测到已经是 App 模式后，安装按钮会自动隐藏。

---

## 16. 移动端通用版给 Codex 的提示词

如果你想让 Codex 直接帮你改项目，可以复制这段：

```txt
我有一个 Vue3 + Vite 项目，已经配置了 PWA。现在需要添加一个移动端通用的“安装到手机/平板桌面”组件，兼容安卓手机、安卓平板、iPhone、iPad 和其他移动浏览器。

请帮我完成以下修改：

1. 新建或替换 src/components/InstallPWAButton.vue；
2. 使用 Vue3 Composition API + TypeScript；
3. 监听 beforeinstallprompt 事件；
4. 如果浏览器触发 beforeinstallprompt，就保存事件对象，并显示“添加到主屏幕”按钮；
5. 用户点击按钮时调用 deferredPrompt.prompt()，弹出浏览器原生安装确认框；
6. 监听 appinstalled 事件，安装成功后隐藏按钮；
7. 如果检测到 display-mode: standalone 或 iOS 的 window.navigator.standalone，则说明已经安装，隐藏按钮；
8. 识别 Android、iOS/iPadOS 和其他移动浏览器；
9. Android Chrome/Edge 优先使用原生安装弹窗；
10. iPhone/iPad 显示手动教程：Safari → 分享按钮 → 添加到主屏幕；
11. 其他移动浏览器显示通用教程：浏览器菜单 → 添加到主屏幕/安装应用；
12. 如果安卓浏览器 1.5 秒内没有触发 beforeinstallprompt，也显示手动添加教程入口；
13. 添加移动端友好的卡片样式和弹窗样式；
14. 在 App.vue 或首页组件中引入 InstallPWAButton；
15. 不要影响原有业务代码和路由。

注意：移动端没有 100% 通用的 JS 强制安装 API。安卓可以使用 beforeinstallprompt 调起安装弹窗，iOS/iPadOS 主要通过 Safari 分享菜单手动添加到主屏幕。
```

---

## 17. 最终建议

如果你的项目主要面向安卓平板，可以用第 5 节的简单版。

如果你希望以后手机、平板都能用，推荐直接用第 13 节的移动端通用版。

移动端通用版的用户体验是：

```txt
安卓 Chrome / Edge：点击按钮直接弹安装确认框

iPhone / iPad：点击按钮显示添加教程

其他移动浏览器：点击按钮显示兼容提示
```

这样是目前最稳的 PWA 移动端安装入口方案。
