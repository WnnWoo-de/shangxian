const HARMONY_UA_RE = /harmonyos|harmony|arkweb|huawei|honor|huaweibrowser/i
const IOS_UA_RE = /iphone|ipad|ipod/i
let initialized = false
let rafId = 0

const setRootFlag = (root, name, active) => {
  root.classList.toggle(name, Boolean(active))
}

const getPlatformFlags = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isHarmonyBrowser: false,
      isIosDevice: false,
      isIpadLike: false,
    }
  }

  const ua = navigator.userAgent || ''
  const isHarmonyBrowser = HARMONY_UA_RE.test(ua)
    || navigator.userAgentData?.brands?.some((brand) => HARMONY_UA_RE.test(brand.brand))
  const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isIosDevice = IOS_UA_RE.test(ua) || isIpadOS
  const isIpadLike = /ipad/i.test(ua) || isIpadOS

  return {
    isHarmonyBrowser,
    isIosDevice,
    isIpadLike,
  }
}

const isStandaloneDisplayMode = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
}

const updateViewportMetrics = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const root = document.documentElement
  const viewport = window.visualViewport
  const { isHarmonyBrowser, isIosDevice, isIpadLike } = getPlatformFlags()
  const layoutHeight = Math.max(window.innerHeight || 0, 320)
  const clientHeight = Math.max(root.clientHeight || 0, 320)
  const viewportOffsetTop = Math.max(viewport?.offsetTop || 0, 0)
  const visualHeight = Math.max(viewport?.height || layoutHeight, 320)
  const visibleHeight = Math.max(visualHeight + viewportOffsetTop, 320)
  const isStandalone = isStandaloneDisplayMode()
  const keyboardThreshold = isIosDevice ? 90 : 120
  const rawKeyboardInset = Math.max(0, layoutHeight - visibleHeight)
  const keyboardInset = rawKeyboardInset > keyboardThreshold ? rawKeyboardInset : 0
  const stableHeight = Math.max(Math.min(layoutHeight, clientHeight), 320)
  const standaloneHeight = Math.max(Math.min(stableHeight, visibleHeight), 320)
  const appHeight = isStandalone && keyboardInset === 0
    ? standaloneHeight
    : stableHeight
  const visualViewportHeight = isStandalone && isIosDevice && keyboardInset === 0
    ? appHeight
    : visibleHeight

  root.style.setProperty('--vh', `${appHeight * 0.01}px`)
  root.style.setProperty('--app-height', `${appHeight}px`)
  root.style.setProperty('--visual-height', `${visualViewportHeight}px`)
  root.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
  setRootFlag(root, 'is-harmony-browser', isHarmonyBrowser)
  setRootFlag(root, 'is-ios-device', isIosDevice)
  setRootFlag(root, 'is-ipad-device', isIpadLike)
  setRootFlag(root, 'is-harmony-keyboard', keyboardInset > 0 && isHarmonyBrowser)
  setRootFlag(root, 'is-ios-keyboard', keyboardInset > 0 && isIosDevice)
  setRootFlag(root, 'is-standalone-pwa', isStandalone)
}

const scheduleViewportUpdate = () => {
  if (rafId) window.cancelAnimationFrame(rafId)
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    updateViewportMetrics()
  })
}

const applyBrowserFlags = () => {
  const root = document.documentElement
  const { isHarmonyBrowser, isIosDevice, isIpadLike } = getPlatformFlags()

  setRootFlag(root, 'is-harmony-browser', isHarmonyBrowser)
  setRootFlag(root, 'is-ios-device', isIosDevice)
  setRootFlag(root, 'is-ipad-device', isIpadLike)
  root.dataset.browserCompat = isHarmonyBrowser ? 'harmony' : isIosDevice ? 'ios' : 'standard'
}

const setupBrowserCompatibility = () => {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true

  applyBrowserFlags()
  updateViewportMetrics()

  window.addEventListener('resize', scheduleViewportUpdate, { passive: true })
  window.addEventListener('orientationchange', scheduleViewportUpdate, { passive: true })
  window.visualViewport?.addEventListener('resize', scheduleViewportUpdate, { passive: true })
  window.visualViewport?.addEventListener('scroll', scheduleViewportUpdate, { passive: true })
  document.addEventListener('visibilitychange', scheduleViewportUpdate, { passive: true })
}

export { setupBrowserCompatibility }
