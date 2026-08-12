
<script setup>
import { ref } from 'vue'
import { defineProps,defineEmits } from 'vue'
import { H_Events } from '@/constants/index.js'
/**
 * H-Button 组件
 */
defineOptions({
    name: 'HButton',
})

// 定义事件
const emits = defineEmits([H_Events.MOUSE_CLICK])

const props = defineProps({
    type: {
        type: String,
        default: 'h-yellow',
        validator: (val) => ['h-yellow', 'h-blue', 'h-green','h-gray','h-white','h-opacity'].includes(val)
    },
    outlook: {
        type: String,
        default: 'Rectangle',
        validator: (val) => ['Rectangle', 'Circle'].includes(val)
    },
    width: {
        type: Number,
        default: 60
    },
    height: {
        type: Number,
        default: 30
    },
    disabled: {
        type: Boolean,
        default: false
    },
    iconGap: {
        type: Number,
        default: 2
    },
  
})

// 点击事件
const handleClick = () => {
    // console.log('点击了子组件按钮')
    emits(H_Events.MOUSE_CLICK)
}


/**
 * 为不同type分配tailwindcss 或者 自定义类名
 */
const typeMap = {
    'h-yellow': 'bg-amber-500  text-white hover:bg-amber-300 transition-colors duration-600',
    'h-blue': 'bg-blue-500 text-white hover:bg-blue-400 transition-colors duration-600',
    'h-green': 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-400 transition-colors duration-600',
    'h-gray': 'bg-gray-500 text-white hover:bg-gray-400 transition-colors duration-600',
    'h-white': 'bg-slate-300 opacity-70 text-gray-800 hover:bg-white hover:opacity-100 transition-colors duration-600',
    'h-opacity': 'bg-opacity-50 text-white hover:bg-opacity-70 transition-colors duration-600',
}
const outlookMap = {
    'Rectangle': 'h-button--Rectangle',
    'Circle': 'h-button--Circle',
}
const disabledMap = {
    'true': 'h-button--disabled',
    'false': '',
}
const iconClass = 'w-4 h-4'

</script>
        <template>
            <button 
            @click="handleClick"
            class="h-button" 
            :style="{ width: props.width + 'px', height: props.height + 'px' }"
            :class="[ outlookMap[props.outlook], typeMap[props.type], disabledMap[props.disabled]]"
            :disabled="props.disabled"
            >
            <div class="flex items-center justify-center" :style="{ gap: props.iconGap + 'px' }">
                <slot name="icon" :class="iconClass"></slot>
            <slot></slot>
            </div>
    </button>

</template>

<style scoped>
.h-button {
    cursor: pointer;
}


/* 按钮外形 */
.h-button--Rectangle {
    border-radius: 4px;
}
.h-button--Circle {
    border-radius: 50%;
}



/* 禁用按钮 */
.h-button--disabled {
    background-color: #ccc;
    color: #ccc;
    cursor: not-allowed;
}




</style>