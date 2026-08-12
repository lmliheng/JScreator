<script setup>
import { defineProps, defineOptions, ref, computed, onMounted, watch , nextTick } from 'vue';
import HButton from '@/components/H-Button/index.vue'
import Toast from '../messages/Toast.js';
import { useClipboard } from '@vueuse/core';

defineOptions({
    name: 'ImageBox',
})


const props = defineProps({
    ImageInfo: {
        type: Object,
        require: true
    }
})

const load = ref(false)
const Radio = computed(() => {
    const { photoWidth, photohight } = props.ImageInfo
    return photohight / photoWidth
})

const currentSrc = ref('')

/**
 * 
 * @图片预加载到浏览器内存
 */
const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(url)
        img.onerror = reject
        img.src = url
    })
}

/**
 * @加载
 */
const startLoading = async () => {
    load.value = false
    try {
        // 等待图片加载完成
        await preloadImage(props.ImageInfo.photo)
        currentSrc.value = props.ImageInfo.photo
        load.value = true
    } catch (error) {
        console.error('图片加载失败:', error)
        // 设置默认错误图 currentSrc.value = '/default-error.png'
        load.value = true
    }
}

const shareHandler = async (link) => {
    const source = ref(link)
    const { text, copy, copied, isSupported } = useClipboard({ source })

    if (!isSupported.value) {
        Toast.warning('当前环境不支持剪贴板')
        return
    }

    await copy()
    await nextTick()

    if (copied.value) {
        Toast.show('已复制链接至您的剪切板', 2000)
    } else {
        Toast.error('复制失败')
    }
}

const downloadHandler = async (link, name, FileTyep) => {
    try {
        const response = await fetch(link)
        if (!response.ok) {
            throw new Error('下载失败')
        }
        //提示开始下载
        let close=Toast.loading('开始下载',1000)
        let blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const downloadLink = document.createElement('a')
        downloadLink.href = blobUrl
        downloadLink.download = name || 'image'
        document.body.appendChild(downloadLink)
        downloadLink.click()
        URL.revokeObjectURL(blobUrl)
        document.body.removeChild(downloadLink)
        close()
        Toast.success('下载完成',1000)
    } catch (e) {
        console.error(e)
    }

}

const likeHandler=()=>{
    // 点赞逻辑...

    Toast.show('已赞')

}


onMounted(() => {
    startLoading()
})




</script>

<template>
    <div v-if="!load" class="placeholder " :style="{ paddingBottom: `${Radio * 100}%` }">
        <span>加载中...</span>
    </div>

    <div v-show="load" id="image" class="w-full h-2/3 m-auto rounded-md relative mb-1 cursor-zoom-in">

        <img :src="currentSrc" alt="" class="w-full h-full object-cover rounded-md">
        <!-- 遮罩层 -->
        <div id="mask" class="opacity-0 w-full h-full m-auto rounded-md absolute 
                top-0 left-0  hover:opacity-100 duration-300 bg-black/50">

            <HButton type="h-gray" class="absolute top-0 left-0 tranform translate-x-2 translate-y-2" :width='60'
                :height='30'>
                <p class="text-md font-bold" @:click="shareHandler(props.ImageInfo.photoLink)">分享</p>
            </HButton>

            <HButton id="like" type="h-white" class="absolute top-0 right-0 tranform -translate-x-2 translate-y-2" :width='50'
                :height='30' @:click="likeHandler()">
                <template #icon>
                    <svg width="20" t="1779711017756" class="icon" viewBox="0 0 1024 1024" version="1.1"
                        xmlns="http://www.w3.org/2000/svg" p-id="5089">
                        <path
                            d="M512 896l-60.8-55.2C236 645.6 93.6 516 93.6 358.4 93.6 229.6 194.4 128 324 128c72.8 0 142.4 33.6 188 87.2C557.6 162.4 627.2 128 700 128c128.8 0 230.4 100.8 230.4 230.4 0 157.6-142.4 287.2-357.6 482.4L512 896z"
                            p-id="5090" fill="red"></path>
                    </svg>
                </template>
            </HButton>


            <HButton id="donwload" type="h-opacity"
                class="absolute bottom-0 left-0 tranform translate-x-2 -translate-y-2" :width='50' :height='30'
                @:click="downloadHandler(props.ImageInfo.photo, props.ImageInfo.id, props.ImageInfo.photoType)">
                <template #icon>
                    <svg t="1779711224724" class="icon" viewBox="0 0 1024 1024" version="1.1"
                        xmlns="http://www.w3.org/2000/svg" p-id="6111" width="20">
                        <path
                            d="M307.173388 679.532423c0 28.903692-22.882089 52.26751-51.183621 52.267509h-51.123405C101.174367 731.920364 13.800914 652.796507 1.456629 547.599112-10.82744 442.401716 55.771484 344.49046 156.57311 319.561025 177.046558 156.255165 301.69373 27.031576 461.266196 3.727974c159.452034-23.243386 314.568515 65.213955 378.939445 216.17553 121.997667 36.731775 199.074179 159.452034 180.828723 288.073463-18.245456 128.621429-126.212788 224.003613-253.449249 223.822965a51.725565 51.725565 0 0 1-51.123405-52.267509c0-28.903692 22.882089-52.26751 51.183621-52.26751 76.35392 0.180648 141.266795-57.024576 152.226111-134.281736 10.959317-77.196944-35.346807-150.901359-108.569493-172.880208l-45.764179-13.849685-19.08848-44.559859c-45.884611-107.846901-156.682097-171.073727-270.671032-154.51432-113.928719 16.619623-203.048436 108.930789-217.68093 225.56923L249.305788 404.224756l-68.525836 16.920703c-49.979301 12.826013-82.917466 61.600994-76.835648 113.92872 6.142035 52.387942 49.37714 91.829438 100.982274 92.190734h51.183621c28.241316 0 51.183621 23.424034 51.183621 52.26751z m385.743856 107.003876a53.050318 53.050318 0 0 1 0 73.885063l-145.000188 148.010989a50.461029 50.461029 0 0 1-72.379662 0L330.597422 860.421362a53.050318 53.050318 0 0 1 0.60216-73.222687 50.400813 50.400813 0 0 1 71.777502-0.662376l57.747168 59.011704V418.25509c0-28.903692 22.882089-52.26751 51.183621-52.26751 28.241316 0 51.123405 23.363818 51.123405 52.26751v427.112265l57.626736-58.831056a50.400813 50.400813 0 0 1 72.25923 0z"
                            fill="#ffffff" p-id="6112"></path>
                    </svg>
                </template>
            </HButton>

            <HButton id="biger" type="h-opacity" class="absolute bottom-0 right-0 transform -translate-x-2 -translate-y-2"
                :width='50' :height='30'>
                <template #icon>
                    <svg t="1779711435514" class="icon" viewBox="0 0 1024 1024" version="1.1"
                        xmlns="http://www.w3.org/2000/svg" p-id="7972" width="20">
                        <path
                            d="M0.042667 749.792759v164.515811A110.075414 110.075414 0 0 0 109.691431 1023.957335h164.515812a54.867047 54.867047 0 1 0 0-109.648765H109.691431V749.792759a54.867047 54.867047 0 1 0-109.648764 0zM329.07429 54.867047A54.867047 54.867047 0 0 0 274.207243 0H109.691431A110.075414 110.075414 0 0 0 0.042667 109.648765v164.515811a54.867047 54.867047 0 1 0 109.648764 0V109.648765h164.515812a54.867047 54.867047 0 0 0 54.867047-54.781718z m365.894088 0c0 30.292071 24.574976 54.781717 54.867047 54.781718h164.515812v164.515811a54.867047 54.867047 0 0 0 109.648765 0V109.648765A110.075414 110.075414 0 0 0 914.351237 0H749.835425a54.867047 54.867047 0 0 0-54.867047 54.867047z m0 914.223241c0 30.292071 24.574976 54.867047 54.867047 54.867047h164.515812A110.075414 110.075414 0 0 0 1024.000002 914.30857V749.792759a54.867047 54.867047 0 1 0-109.648765 0v164.515811H749.835425a54.867047 54.867047 0 0 0-54.867047 54.781718z"
                            fill="#ffffff" p-id="7973"></path>
                        <path
                            d="M512.021334 261.36511A250.698888 250.698888 0 1 0 729.612268 387.397192a50.08858 50.08858 0 1 0-87.036374 49.83259A150.436398 150.436398 0 1 1 512.021334 361.542269a50.173909 50.173909 0 0 0 0-100.262489z"
                            fill="#ffffff" p-id="7974"></path>
                    </svg>
                </template>
            </HButton>

        </div>

    </div>


</template>

<style scoped>
.placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }

    100% {
        background-position: 200% 0;
    }
}
</style>