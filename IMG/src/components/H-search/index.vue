<script setup>
import { ref } from 'vue'
import { H_Events } from '@/constants/index.js'
import HButton from '../H-Button/index.vue'


/**
 * 1.输入内容实现双向数据绑定 使用useVModel
 * 2.搜索按钮在 hover 是展示
 * 3.一键清空文本功能
 * 4.触发搜索事件
 * 5.控制下拉展示区的展示
 * 6.事件处理
 */
defineOptions({
    name: 'HSearch',
})


const props = defineProps({
    modelValue: {
        type: String,
    },
    inputStyle: { // 输入框样式，缺少判断，而且这个写法也不好
        type: Object,
        default: () => ({
            width: '300px', // 输入框宽度,可使用px,rem，百分号等
            height: '50px',
            placeholder: '请输入搜索内容',
            type: 'text',
        }),
    },

})

const emits = defineEmits([
    H_Events.UPDATE_VALUE,
    H_Events.SEARCH,
    H_Events.CLEAR,
    H_Events.INPUT_FOCUS,
    H_Events.INPUT_BLUR
])


const isFocus = ref(false)
const focusStyle = ref('')
// 聚焦事件 这里用hover代替聚焦事件，
const handleFocus = () => {
    isFocus.value = true
    focusStyle.value = 'border border-gray-400 outline-none dark:border-sky-500'
    emits(H_Events.INPUT_FOCUS)
}

// 失焦事件
const handleBlur = () => {
    isFocus.value = false
    focusStyle.value = ''
    emits(H_Events.INPUT_BLUR)
}

// 点击搜索按钮事件
const handleSearch = () => {
    console.log("点击了搜索按钮")
    if (props.modelValue) {
        emits(H_Events.SEARCH, props.modelValue)
    }
}

const inputStyle = 'w-full h-full focus:border-none outline-none px-2 dark:bg-gray-700 dark:text-gray-200'

</script>
<template>
<div 
:class="focusStyle" 
class="flex items-center bg-gray-200 dark:bg-gray-700 justify-center rounded-xl " 
:style="{ width: props.inputStyle.width, height: props.inputStyle.height }"
@mouseenter="handleFocus"
@mouseleave="handleBlur"
>
    <div id="icon" class="px-2">
         <slot name="icon"></slot>
    </div>
    <div id="input" class="flex-1 h-full">
        <input 
        :value="props.modelValue" @input="$emit(H_Events.UPDATE_VALUE, $event.target.value)"
        :class="inputStyle" 
        :placeholder="props.inputStyle.placeholder"

        >
    </div>
    <Transition name="search-btn">
    <div v-show="isFocus" id="search-button" class="mr-2">
        <HButton :type="'h-gray'" :outlook="'Circle'" :width="40" :height="40" 
           @click="handleSearch" 
            >
            <template #icon>
                <svg fill="#ffffff" width="26" height="26" t="1778852850367" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="17973"><path d="M935.8 882.9c8 9.3 12 19.6 12 31 0 12.6-4.5 23.5-13.5 32.5-8.5 8.8-20.3 13.7-32.5 13.5-5.3 0-10.5-0.9-15.5-2.5s-9.5-4.1-13.5-7.4l-5-4-247.1-249c-59.5 42-125.8 62.9-199.2 62.9-7.3 0-14.8-0.3-22.4-1-7.6-0.6-15.1-1.6-22.6-3-50.8-5.8-99.5-23.6-142.1-52-46.7-30-84.1-69.6-112-118.9-13.5-23-24.1-47.5-31.5-72.9-7.7-25.7-12.3-52.2-14-79-1.6-26.8-0.1-53.6 4.5-80 6.7-42.6 21.6-83.6 44-120.4 22.2-37.1 51.5-69.5 86-95.5 29.3-23.3 62.2-41.3 98.5-54 35.8-12.6 73.6-19 111.6-19 16 0 31.4 1 46.1 3 39.4 5.3 77.1 17.3 113 35.9 35.4 18.2 67.2 42.5 94.1 72 31.3 32.7 55.1 71.3 71.6 116 16.3 44.7 23.5 90 21.5 136-2.7 76.6-29 145.7-79.1 207L936.9 883h-1.1zM715.7 426c2.2-41-4.6-81.9-20-120-8.7-23.4-20.5-45.6-35.1-65.9-14.7-20.6-31.8-39.2-51.5-55.5-19.3-16.2-40.7-29.8-63.6-40.5-48.7-22.6-102.7-31.2-156-24.9-3 0-6 0.3-9 1l-6 1c-42.6 6.6-83.2 22.9-118.6 47.5-35.6 24.2-65.2 56.1-86.5 93.5-24.6 40.7-38.2 86-40.6 136-2.4 50 6.8 96.4 27.5 139 17.3 38.6 43.2 72.7 75.5 99.9 32 27.5 69.8 47.7 110.5 59 42.7 12 85.7 14.4 129.1 7 22.8-4 44.9-10.7 66-20 21-9.2 41-20.7 59.6-34.5 18.5-13.7 35.2-29.5 50.1-47 15-17.7 27.5-36.8 37.6-57.5 18.6-36.7 29.1-77 31-118.1z m0 0" p-id="17974" ></path></svg>
            </template>
        </HButton>
    </div>
    </Transition>
</div>
</template>
<style scoped>

.search-btn-enter-active, .search-btn-leave-active {
    transition: opacity 0.7s;
}
.search-btn-enter-from, .search-btn-leave-to {
    opacity: 0;
}

</style>