<script setup>
import { ref, onMounted, watch } from 'vue'
import { requestCategory } from "@/composables/useRequest";
import { category_All, category_list } from '@/constants/index.js'
import { useCategoryStore } from '@/stores/category.js'

const categoryStore = useCategoryStore()
const categoryList = ref(category_list)

const isOpen = ref(false)
const category_style = ref({
    ul_closed: 'flex-nowrap justify-start overflow-x-auto custom-scroll',
    ul_open: 'flex-wrap justify-center',

    li_closed: '',
    li_open: '',

    icon_closed: 'top-0 right-0 transform translate-x-11 translate-y-3',
    icon_open: 'bottom-0 right-0 tranform -translate-y-3'

})


//数据请求
const requestCategoryList = async () => {
    const res = await requestCategory()
    categoryList.value = res.data.data.categorys
    categoryList.value.unshift(category_All)
    console.log(categoryList.value)
    // 为空处理
}

// 发送change事件，父组件监听
const emit = defineEmits(['categoryChange'])
watch(categoryStore.categoryIdSelected, (newVal) => {
    emit('categoryChange', newVal)
})

const toggle_category_style = () => {
    isOpen.value = !isOpen.value
}

onMounted(() => {
    requestCategoryList()
})
</script>
<template>

    <div class="w-full sticky top-0 left-0 z-3 bg-white dark:bg-gray-900 ">
        <div class="w-200 mx-auto relative">

            <!-- 过渡未生效 -->
            <Transition name="fade">
                <ul class="w-200 mx-auto flex 
            items-center gap-2  py-2   text-zinc-950
            text-sm font-semibold dark:text-zinc-300"
                    :class='isOpen ? category_style.ul_open : category_style.ul_closed'>
                    <li v-for="category in categoryList" :key="category.id"
                        class=' flex-none py-1 px-2 cursor-pointer  hover:transform hover:scale-105 duration-300 rounded-md'
                        :class="{ 'bg-gray-600 text-amber-50': categoryStore.categoryIdSelected === category.id }"
                        @click="categoryStore.categorySelected(category.id);console.log(category.id)">
                        {{ category.name }}
                    </li>
                </ul>
            </Transition>
            <div @click="toggle_category_style"
                class="w-8 h-6 rounded-md flex justify-center items-center absolute  cursor-pointer hover:bg-gray-100  duration-200"
                :class="isOpen ? category_style.icon_open : category_style.icon_closed">
                <svg v-show="!isOpen" width="24" class="icon p-1 block" t="1779675588503" viewBox="0 0 1024 1024"
                    version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6161">
                    <path
                        d="M978.176 464.832a34.816 34.816 0 0 0-49.088 0L511.936 881.92 94.848 464.832a34.688 34.688 0 0 0-49.088 49.088l441.6 441.6a34.816 34.816 0 0 0 49.088 0l441.6-441.6a34.816 34.816 0 0 0 0.128-49.088z"
                        p-id="6162"></path>
                    <path
                        d="M978.176 68.48a34.816 34.816 0 0 0-49.088 0L511.936 485.568 94.848 68.48a34.688 34.688 0 0 0-49.088 49.088l441.6 441.6a34.816 34.816 0 0 0 49.088 0l441.6-441.6a34.816 34.816 0 0 0 0.128-49.088z"
                        p-id="6163"></path>
                </svg>


                <svg v-show="isOpen" width="28" class="icon p-1 block" t="1779678504547" viewBox="0 0 1024 1024"
                    version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5467">
                    <path
                        d="M844.965 559.635L510.367 250.162 175.77 559.635c-20.477 13.199-47.786 13.199-61.438 0-13.656-19.75-13.656-46.145 0-59.254l382.473-348.887c0-6.554 6.828-6.554 13.656-6.554 6.824 0 6.824 0 13.652 6.554L906.59 500.381c20.48 19.754 13.652 46.059 0 59.254-20.664 13.199-47.969 13.199-61.625 0z m-348.34-105.403c0-6.554 6.824-6.554 13.652-6.554 6.828 0 13.653 0 13.653 6.554l382.476 348.891c20.481 19.75 13.653 46.055 0 59.254-20.48 13.105-47.785 13.105-61.441 0L510.277 552.99 175.68 869.022c-20.481 13.199-47.785 13.199-61.442 0-13.652-19.754-13.652-46.149 0-59.254l382.387-355.536z m0 0"
                        p-id="5468"></path>
                </svg>
            </div>
        </div>
    </div>

</template>
<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: all 1s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}


.custom-scroll::-webkit-scrollbar {
  height: 7px;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: #444649;
  border-radius: 9999px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: #848688;
  border-radius: 9999px;
}
</style>