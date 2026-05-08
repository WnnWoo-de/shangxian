const HARMONY_UA_RE = /harmonyos|harmony|arkweb|huawei|honor|huaweibrowser/i
let initialized = false
let rafId = 0

const setRootFlag = (root, name, active) => {
  root.classList.toggle(name, Boolean(active))
}

const isStandaloneDisplayMode = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true
}

const updateViewportMetrics = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const root = document.documentElement
  const viewport = window.visualViewport
  const layoutHeight = Math.max(window.innerHeight || 0, 320)
  const clientHeight = Math.max(root.clientHeight || 0, 320)
  const viewportOffsetTop = Math.max(viewport?.offsetTop || 0, 0)
  const visualHeight = Math.max(viewport?.height || layoutHeight, 320)
  const visibleHeight = Math.max(visualHeight + viewportOffsetTop, 320)
  const keyboardInset = Math.max(0, layoutHeight - visibleHeight)
  const stableHeight = Math.max(Math.min(layoutHeight, clientHeight), 320)
  const appHeight = isStandaloneDisplayMode() && keyboardInset < 120
    ? Math.max(Math.min(stableHeight, visibleHeight), 320)
    : stableHeight

  root.style.setProperty('--vh', `${appHeight * 0.01}px`)
  root.style.setProperty('--app-height', `${appHeight}px`)
  root.style.setProperty('--visual-height', `${visibleHeight}px`)
  root.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
  setRootFlag(root, 'is-harmony-keyboard', keyboardInset > 120)
  setRootFlag(root, 'is-standalone-pwa', isStandaloneDisplayMode())
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
  const ua = navigator.userAgent || ''
  const isHarmonyBrowser = HARMONY_UA_RE.test(ua)
    || navigator.userAgentData?.brands?.some((brand) => HARMONY_UA_RE.test(brand.brand))

  setRootFlag(root, 'is-harmony-browser', isHarmonyBrowser)
  root.dataset.browserCompat = isHarmonyBrowser ? 'harmony' : 'standard'
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
