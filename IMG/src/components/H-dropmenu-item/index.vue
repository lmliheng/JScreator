<script setup>
import { ref } from 'vue'
import { H_Events } from '@/constants/index.js'
defineOptions({
    name: 'HDropmenuItem'
})

const props = defineProps({

    id: { // 菜单项唯一标识
        type: String,
        // required: true
        default: '0'
    },
    // 菜单项文本
    text: {
        type: String,
        required: true
    },

})


const emits = defineEmits([H_Events.MOUSE_CLICK])

const clickItem = () => {
    emits(H_Events.MOUSE_CLICK, props.id)
}
</script>
<template>

    <div @click="clickItem"
        class="w-20 h-8 flex items-center justify-start cursor-pointer  hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 duration-300"
        id='dropmenu-item'>
        <div id="icon" class="px-2 w-1/3">
            <slot name="icon"></slot>
        </div>
        <div class=" text-[12px] dark:text-white" id='text'>
            {{ text }}
        </div>
    </div>
</template>
<style scoped></style>