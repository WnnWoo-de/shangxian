// Toast 提示工具
// 简单的消息提示实现

let toastContainer = null
const DEDUPE_WINDOW_MS = 2500
const MAX_VISIBLE_TOAST = 2
const lastToastAt = new Map()

// 确保 toast 容器存在
function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

// Toast 类型
const ToastTypes = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

// Toast 类型颜色
const ToastColors = {
  success: '#1ea97c',
  error: '#dc2626',
  warning: '#f59e0b',
  info: '#247fd6'
}

// Toast 图标
const ToastIcons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
}

/**
 * 显示 Toast 提示
 * @param {string} message - 消息内容
 * @param {string} type - 类型：success, error, warning, info
 * @param {number} duration - 显示时长（毫秒）
 */
function showToast(message, type = ToastTypes.INFO, duration = 3000) {
  const dedupeKey = `${type}:${message}`
  const now = Date.now()
  const lastTime = lastToastAt.get(dedupeKey) || 0
  if (now - lastTime < DEDUPE_WINDOW_MS) {
    return null
  }
  lastToastAt.set(dedupeKey, now)

  ensureContainer()

  while (toastContainer.childElementCount >= MAX_VISIBLE_TOAST) {
    toastContainer.removeChild(toastContainer.firstChild)
  }

  const toast = document.createElement('div')
  const bgColor = ToastColors[type] || ToastColors.info
  const icon = ToastIcons[type] || ToastIcons.info

  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: ${bgColor};
    color: white;
    border-radius: 10px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    font-weight: 500;
    pointer-events: auto;
    animation: toast-in 0.3s ease;
  `

  toast.innerHTML = `
    <span style="font-size: 18px; font-weight: 700;">${icon}</span>
    <span>${message}</span>
  `

  toastContainer.appendChild(toast)

  // 自动移除
  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s ease forwards'
      setTimeout(() => {
        if (toast.parentNode === toastContainer) {
          toastContainer.removeChild(toast)
        }
      }, 300)
    }, duration)
  }

  return toast
}

// 便捷方法
function showSuccessToast(message, duration) {
  return showToast(message, ToastTypes.SUCCESS, duration)
}

function showErrorToast(message, duration) {
  return showToast(message, ToastTypes.ERROR, duration)
}

function showWarningToast(message, duration) {
  return showToast(message, ToastTypes.WARNING, duration)
}

function showInfoToast(message, duration) {
  return showToast(message, ToastTypes.INFO, duration)
}

// 添加动画样式
const style = document.createElement('style')
style.textContent = `
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes toast-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`
document.head.appendChild(style)

export default {
  showToast,
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
  ToastTypes
}

export {
  showToast,
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
  ToastTypes
}
