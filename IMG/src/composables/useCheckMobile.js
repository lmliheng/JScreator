import { useWindowSize } from '@vueuse/core'
import { PC_WIDTH } from '@/constants/index'
import { computed } from 'vue'

const { width } = useWindowSize()

export const isMobile = computed(() => {
  return width.value < PC_WIDTH
})
