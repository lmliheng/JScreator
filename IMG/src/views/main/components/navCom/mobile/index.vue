<script setup>
import { requestCategory } from '@/composables/useRequest'
import { onMounted, ref, watch, onBeforeUpdate } from 'vue'
import { useScroll } from '@vueuse/core'
import { category_All, category_list } from '@/constants/index.js'

// 使用预处理,本地数据适配，防止数据刷新后页面数据部分闪烁,后续接口数据适配

const categoryList = ref(category_list)



/**
 * @数据请求
 * 请求图片类型数组
 */
const requestCategoryList = async () => {
    const res = await requestCategory()
    categoryList.value = res.data.data.categorys
    categoryList.value.unshift(category_All)
}

const ulRef = ref(null)

const currentIndex = ref(0)
//滑块实现,计算滚动宽度,给li的滑块属性平移
const { x: scrollWidth } = useScroll(ulRef)

const sliderstyle = ref({
    transform: `translateX(0px)`,
    width: '48px' //适配本地数据宽度
})

const checkItem = (index) => {
    currentIndex.value = index
}

// 需要拿v-for循环下的多个dom对象，不能直接拿所有dom组成的一个ref
const lirefList = ref([])
const setliRef = (el) => {
    if (el) {
        lirefList.value.push(el)
    }
}


onBeforeUpdate(() => {  // 组件数据更新后DOM更新前,清空li的ref
    lirefList.value = []
})

watch(
    () => currentIndex.value,
    (newVal) => {
        // lirefList.value是dom对象数组
        const { left, width } = lirefList.value[newVal].getBoundingClientRect()
        sliderstyle.value.transform = `translateX(${scrollWidth.value + left - 8}px)`
        sliderstyle.value.width = `${width}px`
    })

const showPopup = ref(false)
const onOpen = () => {
    console.log('弹窗打开了')
}
const onClose = () => {
    console.log('弹窗关闭了')
}

const PopupPosition = ref('bottom')
const Popupwidth = '100%'
onMounted(() => {
    requestCategoryList()
})


</script>
<template>
    <div class="h-[40px] w-full p-2">

        <ul ref="ulRef" class="h-full w-full flex flex-row items-center overflow-x-auto relative">
            <!-- 滑块 -->
            <li class="absolute top-0  bg-zinc-900  rounded-[20px] h-full duration-300" :style="sliderstyle"></li>

            <li :ref="setliRef" class="shrink-0 px-2 last:mr-[46px]" v-for="(item, index) in categoryList"
                :key="item.id" :class="{ 'text-white z-2': currentIndex === index }" @click="checkItem(index)">
                {{ item.name }}
            </li>
        </ul>
        <svg @click="showPopup = true" width="40"
            class="icon fixed top-0 right-0 bg-white z-10 shadow-[-1px_0px_5px_4px_rgba(255,255,255,1)]"
            t="1778602514889" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6092">
            <path
                d="M170.666667 213.333333h682.666666v85.333334H170.666667V213.333333z m0 512h682.666666v85.333334H170.666667v-85.333334z m0-256h682.666666v85.333334H170.666667v-85.333334z"
                fill="#444444" p-id="6093"></path>
        </svg>
    </div>


    <Popup v-model="showPopup" :width="Popupwidth" :height="300" :PopupPosition="PopupPosition" mask-closable
        @open="onOpen" @close="onClose">
        <div class="popup-content">
            <h3>这是弹窗内容</h3>
            可以通过插槽自定义内容
            <p>为什么buttom样式不生效</p>
            <button class="w-[10px] h-[10px] border-amber-50 border-solid border-2 rounded-full hover:bg-amber-50"
                @click="showPopup = false">关闭</button>
        </div>
    </Popup>



</template>