import storage from './storage'

const DEFAULT_EXPORT_IMAGE_BRAND_NAME = '皖盛布碎'

const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

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

export default {
  getAppConfig,
  setAppConfig,
  getExportImageBrandName,
  setExportImageBrandName,
}
