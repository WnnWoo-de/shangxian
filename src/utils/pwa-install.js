let deferredPrompt = null
const listeners = new Set()
let initialized = false

const getDeviceType = () => {
  if (typeof window === 'undefined') return 'other'
  const userAgent = window.navigator.userAgent || ''
  const isIpadOS = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1
  if (/iPad|iPhone|iPod/i.test(userAgent) || isIpadOS) return 'ios'
  if (/harmonyos|harmony|arkweb|huawei|honor|huaweibrowser|android/i.test(userAgent)) return 'android'
  return 'other'
}

const notify = () => {
  listeners.forEach((listener) => listener())
}

export const isPwaStandalone = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
}

export const canPromptPwaInstall = () => Boolean(deferredPrompt) && !isPwaStandalone()

export const getPwaInstallLabel = () => {
  if (isPwaStandalone()) return '已安装'
  if (canPromptPwaInstall()) return '安装到主屏幕'
  return getDeviceType() === 'ios' ? '添加到主屏幕' : '安装到主屏幕'
}

export const getPwaInstallGuide = () => {
  if (typeof window === 'undefined') return '请在浏览器菜单中选择“安装应用”或“添加到主屏幕”。'

  const deviceType = getDeviceType()

  if (deviceType === 'ios') {
    return '请在 Safari 中点击分享按钮，然后选择“添加到主屏幕”。在 iPad 上如果地址栏位于顶部，分享按钮通常也在顶部工具栏。'
  }

  if (deviceType === 'android') {
    return '请点击浏览器右上角菜单，然后选择“安装应用”或“添加到主屏幕”。鸿蒙平板如果使用华为浏览器，也可在菜单中查找“添加到桌面”或“安装应用”。'
  }

  return '请在浏览器地址栏或菜单中选择“安装应用”或“添加到主屏幕”。'
}

export const setupPwaInstallPrompt = () => {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export const promptPwaInstall = async () => {
  if (isPwaStandalone()) return { outcome: 'installed' }
  if (!deferredPrompt) return { outcome: 'unavailable' }

  const promptEvent = deferredPrompt
  promptEvent.prompt()
  const choice = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }))
  deferredPrompt = null
  notify()
  return choice
}

export const subscribePwaInstallState = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
