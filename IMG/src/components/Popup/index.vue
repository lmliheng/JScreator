<script setup>
import { computed, ref, watch, useAttrs, onUnmounted } from 'vue'

// 接收所有 attrs
const attrs = useAttrs()

// 定义 props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  PopupPosition: {
    type: String,
    default: 'center', // center | top | bottom | left | right
    validator: (value) => ['center', 'top', 'bottom', 'left', 'right'].includes(value)
  },
  maskClosable: {
    type: Boolean,
    default: true
  },
  lockScroll: {
    type: Boolean,
    default: true
  },
  zIndex: {
    type: Number,
    default: 1000
  },
  width: {
    type: [String, Number],
    default: 'auto'
  },
  height: {
    type: [String, Number],
    default: 'auto'
  }
})

// 定义 emits
const emit = defineEmits(['update:modelValue', 'open', 'close', 'mask-click'])

// 处理蒙版点击
const handleMaskClick = () => {
  if (props.maskClosable) {
    emit('update:modelValue', false)
    emit('mask-click')
  }
}

// 容器样式计算
const containerStyle = computed(() => {
  const style = {}
  if (props.width !== 'auto') {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  if (props.height !== 'auto') {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  return style
})

// 处理滚动锁定
const bodyOverflow = ref('')
const bodyPaddingRight = ref('')

watch(
  () => props.modelValue,
  (newVal) => {
    if (props.lockScroll) {
      if (newVal) {
        // 记录原始值
        bodyOverflow.value = document.body.style.overflow
        bodyPaddingRight.value = document.body.style.paddingRight
        
        // 锁定滚动
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
        document.body.style.overflow = 'hidden'
        document.body.style.paddingRight = `${scrollBarWidth}px`
        
        emit('open')
      } else {
        // 恢复滚动
        document.body.style.overflow = bodyOverflow.value
        document.body.style.paddingRight = bodyPaddingRight.value
        
        emit('close')
      }
    }
  },
  { immediate: true }
)

// 清理副作用
onUnmounted(() => {
  if (props.lockScroll) {
    document.body.style.overflow = bodyOverflow.value
    document.body.style.paddingRight = bodyPaddingRight.value
  }
})
</script>


<template>
  <Teleport to="body">

    <!-- 背景蒙版 -->
    <Transition name="popup-fade">
      <div
        v-if="modelValue"
        class="popup-mask"
        @click="handleMaskClick"
        :style="{ zIndex }"
      >
        <!-- 内容包裹容器 -->
        <div
          class="popup-container"
          :class="{ 'popup-container--center': PopupPosition === 'center' }"
          :data-position="PopupPosition"
          :style="containerStyle"
          @click.stop
        >
          <slot v-bind="attrs"></slot>
        </div>
      </div>

    </Transition>

  </Teleport>
</template>



<style scoped>
.popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  /* 确保蒙版在最上层 */
  z-index: var(--z-index, 1000);
}

.popup-container {
  position: absolute;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

/* 居中定位 */
.popup-container--center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 顶部定位 */
.popup-container[position="top"] {
  top: 0;
  left: 0;
  right: 0;
}

/* 底部定位 */
.popup-container[data-position="bottom"] {
  bottom: 0;
  left: 0;
  right: 0;
}

/* 左侧定位 */
.popup-container[data-position="left"] {
  top: 0;
  left: 0;
  bottom: 0;
}

/* 右侧定位 */
.popup-container[data-position="right"] {
  top: 0;
  right: 0;
  bottom: 0;
}

/* 过渡动画 */
.popup-fade-enter-active,
.popup-fade-leave-active {
  transition: opacity 0.3s ease;
}

.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
}

/* 容器动画优化 */
.popup-container {
  transition: all 0.3s ease;
}

.popup-fade-enter-active .popup-container,
.popup-fade-leave-active .popup-container {
  transition: all 0.3s ease;
}

.popup-fade-enter-from .popup-container,
.popup-fade-leave-to .popup-container {
  opacity: 0;
  transform: scale(0.95);
}

.popup-container--center.popup-fade-enter-from,
.popup-container--center.popup-fade-leave-to {
  transform: translate(-50%, -50%) scale(0.95);
}
</style>