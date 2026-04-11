// 主数据事件工具
// 用于在组件间传递主数据（客户、品类、布料）变化事件

// 事件类型常量
export const MASTER_DATA_CHANGED_EVENT = 'master-data-changed'

// 触发主数据变化事件
export const emitMasterDataChanged = () => {
  const event = new CustomEvent(MASTER_DATA_CHANGED_EVENT, {
    bubbles: true,
    cancelable: true
  })
  window.dispatchEvent(event)
}

// 监听主数据变化事件
export const onMasterDataChanged = (callback) => {
  window.addEventListener(MASTER_DATA_CHANGED_EVENT, callback)
  return () => {
    window.removeEventListener(MASTER_DATA_CHANGED_EVENT, callback)
  }
}

export default {
  MASTER_DATA_CHANGED_EVENT,
  emitMasterDataChanged,
  onMasterDataChanged
}
