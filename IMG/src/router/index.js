import { createRouter, createWebHashHistory } from 'vue-router'
import { pcRouter } from './pc_router'
import { mobileRouter } from './mobile_router'

import { isMobile } from '@/composables/useCheckMobile'

const router = createRouter({
  history: createWebHashHistory(),
  routes: isMobile ? mobileRouter : pcRouter,
})

export default router
