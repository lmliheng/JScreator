<script setup>

// 弃用


import { defineProps, computed } from 'vue'

const props = defineProps({
    name: {
        type: String,
        default: ''
    },
    color: {
        type: String,
        default: ''
    },
    svgClass: {
        type: String,
        default: ''
    }

})

const Symbol = computed(() => {
    return '#icon-'+props.name
})
</script>
<template>
    <svg :class="svgClass" :style="{ color: color }">
        <use :href="Symbol"></use>
    </svg>
    
</template>
