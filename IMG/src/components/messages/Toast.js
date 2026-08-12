
/**
 * @成功，失败 提示
 * Toast 吐司
 * 形式有： 右上角弹方形提示 或者 页面中心弹提示
 * 使用函数式调用
 */


// 默认配置
const DEFAULTS = {
  duration: 2500,
  types: {
    info: '#909399',
    success: '#67c23a',
    error: '#f56c6c',
    warning: '#e6a23c',
    loading: '#409eff'
  }
}

// 创建单个 toast DOM
function createToastEl(text, type, duration) {
  // 保证容器存在
  let container = document.querySelector('#my-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'my-toast-container'
    document.body.appendChild(container)
  }

  // 创建元素
  const el = document.createElement('div')
  el.className = `my-toast my-toast-${type}`
  
  // loading 特殊处理：加旋转图标
  if (type === 'loading') {
    const spinner = document.createElement('span')
    spinner.className = 'my-toast-spinner'
    el.appendChild(spinner)
  }
  
  const textNode = document.createTextNode(text)
  el.appendChild(textNode)

  container.appendChild(el)

  // 强制回流后触发入场动画
  requestAnimationFrame(() => {
    el.classList.add('my-toast-enter')
  })

  // 自动关闭
  let timer = null
  if (duration > 0) {
    timer = setTimeout(() => close(el), duration)
  }

  // 返回关闭函数
  return () => {
    clearTimeout(timer)
    close(el)
  }
}


function close(el) {
  if (!el || !el.parentNode) return
  
  el.classList.remove('my-toast-enter')
  el.classList.add('my-toast-leave')
  
  // 动画结束后移除 DOM
  el.addEventListener('transitionend', () => {
    el.remove()
  }, { once: true })
}


// Toast API
const Toast = {
  show(text, duration) {
    return createToastEl(text, 'info', duration ?? DEFAULTS.duration)
  },
  success(text, duration) {
    return createToastEl(text, 'success', duration ?? DEFAULTS.duration)
  },
  error(text, duration) {
    return createToastEl(text, 'error', duration ?? DEFAULTS.duration)
  },
  warning(text, duration) {
    return createToastEl(text, 'warning', duration ?? DEFAULTS.duration)
  },
  loading(text = '加载中...') {
    return createToastEl(text, 'loading', 0) // loading 默认不自动关闭
  }
}

export default Toast