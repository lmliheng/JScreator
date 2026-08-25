<script setup>
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  UserInfo: {
    type: Object,
    default: () => ({})
  },
  routePath: {
    type: String,
    default: '/user-profile',
  },
  isCollapse: {
    type: Boolean,
    default: () => false
  }}
)

// 当前登录用户的 role_id（来自 /sys/profile 的 user_detail）
const roleId = computed(() => {
  const id = props.UserInfo?.user_detail?.role_id
  return id === undefined || id === null || id === '' ? null : Number(id)
})

// 是否超级管理员（role_id = 1）
const isAdmin = computed(() => roleId.value === 1)

console.log(props.UserInfo)
import {
  User,
  Menu as IconMenu,
  Operation,
  Notebook,
  Bell,
  Monitor,
} from '@element-plus/icons-vue'


onMounted(() => {

})
</script>

<template>
 
  <el-menu
    class="el-menu-vertical-demo"
    :router=true
    :default-active="props.routePath"  
    :collapse="props.isCollapse"
  >
  
  <div id="aside-logo">
  <el-avatar id="header-avatar" shape="square" size="default" :src="props.UserInfo?.user_detail?.avatar" />
  <span id="logo-text" v-if="!props.isCollapse">{{ props.UserInfo?.user_detail?.username }}</span>
  </div>
  
   <el-menu-item index="/user-profile">
     <el-icon><User /></el-icon>
      <template #title>{{ $t('user_profile') }}</template>
    </el-menu-item>

    <el-sub-menu index="2" v-if="isAdmin">
      <template #title>
        <el-icon><Operation /></el-icon>
        <span>{{ $t('user') }}</span>
      </template>
        <el-menu-item index="/user/user-manage">{{ $t('user_manage') }}</el-menu-item>  
        <el-menu-item index="/user/role-manage">{{ $t('role_manage') }}</el-menu-item>
        <el-menu-item index="/user/permission-manage">{{ $t('permission_manage') }}</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="3">
      <template #title>
       <el-icon><Notebook /></el-icon>
        <span>{{ $t('article') }}</span>
      </template>
        <el-menu-item index="/article/article-create">{{ $t('article_create') }}</el-menu-item>
        <el-menu-item index="/article/article-manage">{{ $t('article_manage') }}</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="4">
      <template #title>
        <el-icon><Bell /></el-icon>
        <span>{{ $t('notification') }}</span>
      </template>
        <el-menu-item index="/notification/notification-center">{{ $t('notification_center') }}</el-menu-item>
        <el-menu-item v-if="isAdmin" index="/notification/notification-manage">{{ $t('notification_manage') }}</el-menu-item>
    </el-sub-menu>

    <el-menu-item v-if="isAdmin" index="/system/system-monitor">
      <el-icon><Monitor /></el-icon>
      <template #title>{{ $t('system_monitor') }}</template>
    </el-menu-item>
  </el-menu>
</template>

<style scoped>
::deep(.el-menu-vertical-demo:not(.el-menu--collapse)) {
  width: 200px;
  min-height: 400px;
}
#aside-logo {
height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  
}

#logo-text {
  font-size: 16px;
  font-weight: bold;
  font-family: 'logo-en';
}

</style>