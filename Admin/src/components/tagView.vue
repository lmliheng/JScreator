<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { usePathTagStore, type PathTagItem } from '@/store/pathTag'
import { useRoute, useRouter } from 'vue-router'
import contextmenu from './contextmenu.vue'

const router = useRouter()
const route = useRoute()
const pathTagStore = usePathTagStore()
const pathTagsList = computed(() => pathTagStore.pathTagsList)

const isShow = ref(false)

const contextmenuLocationStyle = ref({
    top: '0',
    left: '0',
    position: 'absolute'
})
const type = ref('primary')
const removeTag = (tag: PathTagItem) => {
    pathTagStore.removePathTag(tag)
}
const toTag = (tag: PathTagItem) => {
    router.push(tag.fullPath)
}

const handleContextMenu = (e: MouseEvent, tag: PathTagItem) => {
   contextmenuLocationStyle.value.top = e.y + 'px'
   contextmenuLocationStyle.value.left = e.x + 'px'
   isShow.value = true
}


onMounted(() => {

})
</script>

<template>
  
    <el-tag 
    :effect="tag.name===route.name?'dark':'light'" 
    v-for="tag in pathTagsList" 
    :key="tag.name" 
    :closable=true 
    @close="removeTag(tag)" 
    @click="toTag(tag)"
    @contextmenu.prevent="handleContextMenu($event,tag)"
    :type="type"
    size="large"
    id="tagview"
    >
    {{ $t(String(tag.meta.title || '')) }}
    </el-tag>

    <contextmenu 
    v-show="isShow" 
    :style="contextmenuLocationStyle" 
    :isShow="isShow" 
    @close="isShow = false">
    </contextmenu>
</template>


<style scoped>
#tagview{
    cursor: pointer;
}
</style>
