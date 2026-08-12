<script setup>

import { useIntersectionObserver } from '@vueuse/core'
import { shallowRef, useTemplateRef } from 'vue'
import { ref, onMounted, watch } from 'vue'
import { getImageList } from '@/composables/useRequest'
import { useCategoryStore } from '@/stores/category.js'
import ImageBox from '@/components/Image/index.vue'

const categoryStore = useCategoryStore()
// 不能重复请求
const imageList = ref([])
let page = ref(1)
const query = ref({
    page: page.value,
    pageSize: 20,
    categoryId: categoryStore.categoryIdSelected,
    searchText: ''
})


const totalImages = ref(0)

/**
 * @获取图片列表
 */
const handleGetImageList = async () => {
    const res = await getImageList(query.value)
    imageList.value = [...imageList.value, ...res.data.data.list]
    totalImages.value = res.data.data.total
    // console.log(imageList.value)
}

const target = useTemplateRef('target')
const targetIsVisible = shallowRef(false)

const { stop } = useIntersectionObserver(
    target,
    ([entry], observerElement) => {
        targetIsVisible.value = entry?.isIntersecting || false
        console.log('目标元素是否可见:', targetIsVisible.value)

        if (targetIsVisible.value) {
            page.value += 1
            query.value.page = page.value
            handleGetImageList()
        }
    },
)

/**
 * @监听分类切换
 * 
 */
watch(
    () => categoryStore.categoryIdSelected,
    (newVal) => {
        // 分类切换时重置图片列表和页码
        imageList.value = []
        page.value = 1
        query.value.page = page.value
        query.value.categoryId = newVal
        handleGetImageList()
    },
    { immediate: true },
)


onMounted(async () => {
    await handleGetImageList()
})

</script>
<template>

    <!-- {   imageList数组元素内容：
    "tags": [
        "all",
        "home",
        "desire",
        "pets"
    ],
    "_id": "62208123fb7e8b6da85b7dfe",
    "photoLink": "https://www.pexels.com/zh-cn/photo/8051987/",
    "photo": "https://images.pexels.com/photos/8051987/pexels-photo-8051987.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500",
    "authorLike": "https://www.pexels.com/zh-cn/@ugurcan-ozmen-61083217",
    "avatar": "https://images.pexels.com/users/avatars/61083217/ugurcan-ozmen-235.jpeg?auto=compress&fit=crop&h=60&w=60",
    "author": "Uğurcan Özmen",
    "photoDownLink": "https://www.pexels.com/photo/8051987/download/",
    "id": "8051987",
    "title": "图片数据来自 pexels ",
    "photoWidth": 500,
    "photoHeight": 625,
    "photoType": "jpg",
    "__v": 0
} -->

    <div class="w-4/5 m-auto  mt-10  dark:text-gray-200 dark:bg-gray-900" 
    style="column-count: 5; column-gap: 2rem">


    <!-- 宽度没有定死 -->
        <div v-for="image in imageList" :key="image._id" id="img_container"
            class=" flex flex-col items-start justify-center gap-1 rounded-md mb-10"
            style="break-inside: avoid;"
            ">

            <div id="image" class="w-full h-2/3 m-auto rounded-md relative mb-1">
                <ImageBox :ImageInfo="image" ></ImageBox>
            <div id="title">
                <p class="text-left text-md font-semibold mt-2 ">{{ image.title }}</p>
            </div>
            <div class="flex justify-start items-center mt-2">
                <img :src="image?.avatar" alt="" class="w-5 h-5 rounded-full cursor-alias">
                <span class="ml-2 text-xs">{{ image?.author }}</span>
            </div>
            </div>

        </div>

        <div ref="target">
        </div>

    </div>
</template>
<style scoped>


</style>