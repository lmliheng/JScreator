<script setup>

import { onMounted, ref, toHandlerKey, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useI18n } from 'vue-i18n'
const { locale, t } = useI18n()

import { checkTokenUsed } from '@/composables/useCheckTokenUsed'
import { loginOut } from '@/composables/useLoginOut'
import { requestUserInfo } from '@/composables/useRequest'

import { useAuthStore } from '@/store/auth'
import { usePathTagStore } from '@/store/pathTag'

import AsideCom from '@/components/AsideCom.vue'
import i18nCom from '@/components/i18nCom.vue'
import Breadcrumb from '@/components/Breadcrumb.vue'
import FullScreen from '@/components/FullScreen.vue'
import searchCom from '@/components/searchCom.vue'
import tagView from '@/components/tagView.vue'
import DriverCom from '@/components/DriverCom.vue'
import NotificationBell from '@/components/NotificationBell.vue'

import { ElMessage } from 'element-plus'
import { Fold, Expand } from '@element-plus/icons-vue'
import { tr } from 'element-plus/es/locale/index.mjs'

const isCollapse = ref(false)
const routePath = useRoute() // 获取当前路由路径
const UserInfo = ref({})
const authStore = useAuthStore()
const pathTagStore = usePathTagStore()
const loading = ref(false)

const getUserInfo = async () => {
  try {
    loading.value = true
    const res = await requestUserInfo()
    authStore.setUserInfo(res.user_info)
    UserInfo.value = res.user_info
    if (res.code == 200) {
      loading.value = false
    }
  } catch (e) {
    loading.value = false
    ElMessage.error('用户身份获取失败')
  }

}

watch(
  () => routePath,
  (to, from) => {
    // console.log(to)
    const { name, meta, fullPath } = to
    pathTagStore.addPathTag({ name, meta, fullPath })
  },
  {
    deep: true,
    immediate: true
  }
)

// watch(
//   () => authStore.token,
//   () => {
//     getUserInfo()
//   }
// )

onMounted(() => {
  getUserInfo()
  checkTokenUsed()
})

</script>

<template>
  <div class="common-layout" v-loading="loading">
    <el-container>
      <el-aside :width="isCollapse ? '64px' : '200px'" id="aside">
        <AsideCom :UserInfo="UserInfo" :routePath="routePath.path" :isCollapse="isCollapse" />
      </el-aside>
      <el-container>


        <el-header id="header">
          <div id="header-content">
            <div id="header-left">
              <div id="header-left-1">
                <el-icon v-if="!isCollapse" id="header-fold" @click="isCollapse = true">
                  <Fold />
                </el-icon>
                <el-icon v-else id="header-expand" @click="isCollapse = false">
                  <Expand />
                </el-icon>
                <div id="header-breadcrumb">
                  <Breadcrumb />
                </div>
              </div>
              <div id="header-left-2">
                <tagView />
              </div>
            </div>

            <div id="header-right">
              <div id="header-driver">
                <DriverCom />
              </div>
              <searchCom />
              <div id="header-fullscreen">
                <FullScreen />
              </div>

              <NotificationBell />

              <div id="header-i18n">
                <i18nCom />
              </div>

              <el-dropdown placement="top-start" id="header-avatar">
                <!-- 时序问题：页面一进来，模板立即渲染，此时 getUserInfo() 还是异步的（没返回），UserInfo 还是 {}，
              于是 UserInfo.user_detail 是 undefined，再访问 .avatar 就直接抛 TypeError，导致组件渲染失败 → 页面白屏/进不去。 -->
                <el-avatar shape="square" size="default" :src="UserInfo.user_detail?.avatar" />

                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="loginOut">{{ $t('login_out') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

        </el-header>

        <el-main>
          <router-view v-slot="{ Component }">
            <transition name="fade">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>


<style scoped>
.common-layout {
    height: 100vh;
    overflow: hidden;
}
.common-layout :deep(.el-container) {
    height: 100%;
}
.common-layout :deep(.el-main) {
    overflow-y: auto;
}
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease-in-out;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(-100px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(100px);
}


#tagview {
  width: 100%;
  height: 30px;
  line-height: 30px;
  text-align: left;
  /* border-bottom: 1px solid #ccc; */
}

#header {
  height: 100px;
  line-height: 80px;
  text-align: center;
  border-bottom: 1px solid #ccc;
}

#aside {

  height: 100vh;
  background-color: #f5f5f5;

}

#header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#header-right {
  width: 240px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: right;
}

#header-i18n {
  cursor: pointer;
  border: none;
  margin-right: 16px;
  height: 60px;
  width: 30px;
  line-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}


#header-driver {
  cursor: pointer;
  border: none;
  margin-right: 16px;
  width: 30px;
  height: 60px;
  line-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#header-fullscreen {
  cursor: pointer;
  border: none;
  margin-right: 16px;
  width: 30px;
  height: 60px;
  line-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#logo-i18n {

  cursor: pointer;
}

#header-avatar {
  cursor: pointer;
}

#header-fold {
  cursor: pointer;
}

#header-expand {
  cursor: pointer;
}

#aside {
  transition: all 0.3s ease-in-out;
}

#header-left {
  width: 300px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: left;
  justify-content: center;
}

#header-left-1 {
  width: 300px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: left;
}

#header-left-2 {
  width: 300px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: left;
}

#header-breadcrumb {
  margin-left: 20px;
}
</style>