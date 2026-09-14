
import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'


export const usePathTagStore = defineStore('pathTag', () => {

    const pathTagsList:Ref<number[]> = ref([])
    const setPathTags = (val:any) => {
        pathTagsList.value = val
    }
    const addPathTag = (val:any) => { // val是一个对象，包含路由信息和标签信息
        if (pathTagsList.value.some(item => item.name === val.name)) {
            return
        }
        pathTagsList.value.push(val:any)
    }

    const removePathTag = (val:any) => {
        pathTagsList.value = pathTagsList.value.filter(item => item.name !== val.name)
    }

    const removeAllPathTags = (val:any) => { // 当前route
        pathTagsList.value = pathTagsList.value.filter(item => item.name == val.name)
    }

    return { pathTagsList, setPathTags, addPathTag, removePathTag, removeAllPathTags }
}, {
    persist: true,
}
)