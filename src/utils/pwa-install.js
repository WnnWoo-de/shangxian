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
  return '浏览器菜单中安装'
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
