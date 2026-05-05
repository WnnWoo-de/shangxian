const HARMONY_UA_RE = /harmonyos|harmony|arkweb|huawei|honor|huaweibrowser/i
let initialized = false
let rafId = 0

const setRootFlag = (root, name, active) => {
  root.classList.toggle(name, Boolean(active))
}

const updateViewportMetrics = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const root = document.documentElement
  const viewport = window.visualViewport
  const layoutHeight = Math.max(window.innerHeight || 0, 320)
  const visualHeight = Math.max(viewport?.height || layoutHeight, 320)
  const keyboardInset = Math.max(0, layoutHeight - visualHeight - (viewport?.offsetTop || 0))

  root.style.setProperty('--vh', `${layoutHeight * 0.01}px`)
  root.style.setProperty('--app-height', `${layoutHeight}px`)
  root.style.setProperty('--visual-height', `${visualHeight}px`)
  root.style.setProperty('--keyboard-inset', `${keyboardInset}px`)
  setRootFlag(root, 'is-harmony-keyboard', keyboardInset > 120)
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
