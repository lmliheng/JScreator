<script setup>
import { useAuthStore } from '../../store/auth';
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const authStore = useAuthStore();

const permissionRead = (val) => {
    switch (val) {
        case 'user:create':
            return t('创建用户');
        case 'user:read':
            return t('读取用户信息');
        case 'user:update':
            return t('删除用户');
        case 'user:delete':
            return t('distribute_permission');
        default:
            return t('unknown_permission');
    }

}

</script>
<template>
    <div class="user-profile">
        <div class="block">
            <el-avatar :size="100" :src="authStore.userInfo?.user_detail?.avatar" />
            <p>{{ $t('user_id') }}：{{ authStore?.userInfo?.user_detail?.id }}</p>
            <p>{{ $t('role') }}：{{ authStore?.userInfo?.user_detail?.role_name }}</p>
            <p>{{ $t('username') }}：{{ authStore?.userInfo?.user_detail?.username }}</p>
            <p>{{ $t('permission') }}：</p>
            <ul>
                <li v-for="item in authStore?.userInfo?.user_permission" :key="item" id="permission">
                    {{ permissionRead(item['permission_name']) }}
                </li>

            </ul>
        </div>
    </div>
</template>

<style scoped>
.user-profile {
    border: 1px solid #e4e7ed;
    padding: 20px;
}

#permission {
    list-style-type: decimal;
}
</style>
