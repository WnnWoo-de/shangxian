let deferredPrompt = null
const listeners = new Set()
let initialized = false

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
  if (canPromptPwaInstall()) return '安装到桌面'
  return '安装到桌面'
}

export const getPwaInstallGuide = () => {
  if (typeof window === 'undefined') return '请在浏览器菜单中选择“安装应用”或“添加到主屏幕”。'

  const userAgent = window.navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(userAgent)

  if (isIos) {
    return '请点击浏览器底部或顶部的分享按钮，然后选择“添加到主屏幕”。'
  }

  if (isAndroid) {
    return '请点击浏览器右上角菜单，然后选择“安装应用”或“添加到主屏幕”。'
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
