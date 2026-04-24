import { registerSW } from 'virtual:pwa-register'

const UPDATE_CHECK_INTERVAL = 60 * 1000

export const setupPwaAutoUpdate = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  let hasReloaded = false
  let intervalId = 0

  const reloadApp = () => {
    if (hasReloaded) return
    hasReloaded = true
    window.location.reload()
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      reloadApp()
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const checkForUpdates = () => {
        if (document.visibilityState !== 'visible') return
        registration.update().catch(() => {})
      }

      checkForUpdates()
      window.addEventListener('focus', checkForUpdates)
      document.addEventListener('visibilitychange', checkForUpdates)

      intervalId = window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL)
    },
    onRegisterError(error) {
      console.error('PWA register failed:', error)
    },
  })

  navigator.serviceWorker.addEventListener('controllerchange', reloadApp)

  window.addEventListener('beforeunload', () => {
    if (intervalId) window.clearInterval(intervalId)
  })

  return updateSW
}
