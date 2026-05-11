import storage from './storage'

const DEFAULT_EXPORT_IMAGE_BRAND_NAME = '皖盛布碎'
const ONBOARDING_TUTORIAL_VERSION = '2026-05-onboarding-v1'
export const APP_ONBOARDING_REQUEST_EVENT = 'wsbs:onboarding-request'

const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
const toNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export const getAppConfig = () => toObject(storage.getAppConfig())

export const setAppConfig = (patch = {}) => {
  const merged = {
    ...getAppConfig(),
    ...toObject(patch),
  }
  storage.setAppConfig(merged)
  return merged
}

export const getExportImageBrandName = () => {
  const value = String(getAppConfig().exportImageBrandName || '').trim()
  return value || DEFAULT_EXPORT_IMAGE_BRAND_NAME
}

export const setExportImageBrandName = (value) => {
  const nextValue = String(value || '').trim() || DEFAULT_EXPORT_IMAGE_BRAND_NAME
  return setAppConfig({ exportImageBrandName: nextValue })
}

export const getOnboardingSeenVersion = () => String(getAppConfig().onboardingSeenVersion || '').trim()

export const hasSeenOnboardingTutorial = () => getOnboardingSeenVersion() === ONBOARDING_TUTORIAL_VERSION

export const shouldAutoOpenOnboardingTutorial = () => !hasSeenOnboardingTutorial()

export const getOnboardingRequestedAt = () => toNumber(getAppConfig().onboardingRequestedAt)

export const clearOnboardingTutorialRequest = () => setAppConfig({ onboardingRequestedAt: 0 })

export const consumeOnboardingTutorialRequest = () => {
  const requestedAt = getOnboardingRequestedAt()
  if (!requestedAt) return 0
  clearOnboardingTutorialRequest()
  return requestedAt
}

export const markOnboardingTutorialSeen = () => {
  return setAppConfig({
    onboardingSeenVersion: ONBOARDING_TUTORIAL_VERSION,
    onboardingRequestedAt: 0,
  })
}

export const requestOnboardingTutorial = () => {
  const requestedAt = Date.now()
  setAppConfig({ onboardingRequestedAt: requestedAt })

  if (
    typeof window !== 'undefined'
    && typeof window.dispatchEvent === 'function'
    && typeof CustomEvent === 'function'
  ) {
    window.dispatchEvent(new CustomEvent(APP_ONBOARDING_REQUEST_EVENT, {
      detail: { requestedAt },
    }))
  }

  return requestedAt
}

export default {
  getAppConfig,
  setAppConfig,
  getExportImageBrandName,
  setExportImageBrandName,
  getOnboardingSeenVersion,
  hasSeenOnboardingTutorial,
  shouldAutoOpenOnboardingTutorial,
  getOnboardingRequestedAt,
  clearOnboardingTutorialRequest,
  consumeOnboardingTutorialRequest,
  markOnboardingTutorialSeen,
  requestOnboardingTutorial,
}
