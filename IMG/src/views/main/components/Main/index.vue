<script setup>

import { isMobile } from '@/composables/useCheckMobile'
import mobileCom from './mobile/index.vue'
import pcCom from './pc/index.vue'
</script>
<template>

    <div class="w-full h-full bg-white dark:bg-gray-900" >
     <mobileCom v-if="isMobile"></mobileCom>
     <pcCom v-else></pcCom>
     </div>
</template>