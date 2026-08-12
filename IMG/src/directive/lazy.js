import { useIntersectionObserver } from '@vueuse/core'


const lazyImg = {
    mounted(el, binding) {
        // 保存原始图片路径
        const source_src = el.src

        // 监听元素是否进入视口
        const { stop } = useIntersectionObserver(el, ([{ isIntersecting }]) => {
            if (isIntersecting) {
                el.src = source_src
                // 监听完成后，停止监听
                stop()
            }
        })
    }
}

export default {
    // 应用到全局，参考app.use的参数
    install(app) {
        // console.log(app);
        app.directive('lazyImg', lazyImg)
    }
}