// 单据事件工具
// 用于在组件间传递单据数据变化事件

// 事件类型常量
export const BILL_DATA_CHANGED_EVENT = 'bill-data-changed'

// 触发单据数据变化事件
export const emitBillDataChanged = () => {
  const event = new CustomEvent(BILL_DATA_CHANGED_EVENT, {
    bubbles: true,
    cancelable: true
  })
  window.dispatchEvent(event)
}

// 监听单据数据变化事件
export const onBillDataChanged = (callback) => {
  window.addEventListener(BILL_DATA_CHANGED_EVENT, callback)
  return () => {
    window.removeEventListener(BILL_DATA_CHANGED_EVENT, callback)
  }
}

export default {
  BILL_DATA_CHANGED_EVENT,
  emitBillDataChanged,
  onBillDataChanged
}
