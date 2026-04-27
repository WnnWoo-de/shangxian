import storage from './storage'

const THEME_KEY = 'theme_mode'
const THEMES = ['light', 'dark', 'system']

const normalizeTheme = (theme) => (THEMES.includes(theme) ? theme : 'system')

const getPreferredTheme = () => normalizeTheme(storage.get(THEME_KEY, 'system'))

const getResolvedTheme = (theme = getPreferredTheme()) => {
  const normalized = normalizeTheme(theme)
  if (normalized !== 'system') return normalized

  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyTheme = (theme = getPreferredTheme()) => {
  if (typeof document === 'undefined') return getResolvedTheme(theme)

  const normalized = normalizeTheme(theme)
  const resolved = getResolvedTheme(normalized)
  const root = document.documentElement

  root.dataset.themeMode = normalized
  root.dataset.theme = resolved
  root.style.colorScheme = resolved

  return resolved
}

const setTheme = (theme) => {
  const normalized = normalizeTheme(theme)
  storage.set(THEME_KEY, normalized)
  applyTheme(normalized)
  window.dispatchEvent(new CustomEvent('app-theme-changed', {
    detail: {
      mode: normalized,
      resolved: getResolvedTheme(normalized),
    },
  }))
  return normalized
}

const initTheme = () => {
  const mode = getPreferredTheme()
  applyTheme(mode)

  if (typeof window !== 'undefined') {
    const matcher = window.matchMedia?.('(prefers-color-scheme: dark)')
    matcher?.addEventListener?.('change', () => {
      if (getPreferredTheme() === 'system') applyTheme('system')
    })
  }

  return mode
}

export {
  THEMES,
  applyTheme,
  getPreferredTheme,
  getResolvedTheme,
  initTheme,
  setTheme,
}
