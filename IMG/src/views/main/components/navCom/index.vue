<script setup>
import { isMobile } from '@/composables/useCheckMobile'
import mobileCom from './mobile/index.vue'
import pcCom from './pc/index.vue'
</script>
<template>
    
          <mobileCom v-if="isMobile"></mobileCom>
          <pcCom v-else></pcCom>
    
</template>