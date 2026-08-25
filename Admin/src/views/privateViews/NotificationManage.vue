<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import {
    requestNotificationAdd,
    requestNotificationList
} from '@/composables/useRequest'

const authStore = useAuthStore()
const isAdmin = computed(() => Number(authStore.userInfo?.user_detail?.role_id) === 1)

const form = reactive({
    title: '',
    content: '',
    target_type: 'all',
    target_id: null
})

const list = ref([])
const loading = ref(false)
const publishing = ref(false)

const targetTypeMap = {
    all: 'target_all',
    user: 'target_user',
    role: 'target_role'
}

const getList = async () => {
    loading.value = true
    try {
        const res = await requestNotificationList()
        if (res.code === 200 && res.data) {
            list.value = res.data.list || []
        }
    } catch (e) {
        ElMessage.error('获取通知列表失败')
    } finally {
        loading.value = false
    }
}

const handlePublish = async () => {
    if (!form.title || !form.content) {
        ElMessage.warning('标题和内容不能为空')
        return
    }
    if (form.target_type !== 'all' && !form.target_id) {
        ElMessage.warning("目标类型为「指定用户」或「指定角色」时必须填写目标ID")
        return
    }
    publishing.value = true
    try {
        const res = await requestNotificationAdd({
            title: form.title,
            content: form.content,
            target_type: form.target_type,
            target_id: form.target_type === 'all' ? null : Number(form.target_id)
        })
        if (res.code === 200) {
            ElMessage.success('通知发布成功')
            form.title = ''
            form.content = ''
            form.target_type = 'all'
            form.target_id = null
            getList()
        } else {
            ElMessage.error(res.message || '发布失败')
        }
    } catch (e) {
        ElMessage.error('发布失败')
    } finally {
        publishing.value = false
    }
}

onMounted(() => {
    if (isAdmin.value) {
        getList()
    }
})

// userInfo 异步加载完成后，若为管理员再拉取列表
watch(isAdmin, (val) => {
    if (val) {
        getList()
    }
})
</script>

<template>
    <div v-if="!isAdmin">
        <el-empty :description="$t('no_permission')" />
    </div>

    <div v-else>
        <el-card class="publish-card">
            <template #header>
                <span class="card-title">{{ $t('publish_notification') }}</span>
            </template>

            <el-form :model="form" label-width="90px">
                <el-form-item :label="$t('notification_title')">
                    <el-input v-model="form.title" :placeholder="$t('notification_title')" maxlength="100" show-word-limit />
                </el-form-item>

                <el-form-item :label="$t('notification_content')">
                    <el-input
                        v-model="form.content"
                        type="textarea"
                        :rows="4"
                        :placeholder="$t('notification_content')"
                    />
                </el-form-item>

                <el-form-item :label="$t('target_type')">
                    <el-radio-group v-model="form.target_type">
                        <el-radio value="all">{{ $t('target_all') }}</el-radio>
                        <el-radio value="user">{{ $t('target_user') }}</el-radio>
                        <el-radio value="role">{{ $t('target_role') }}</el-radio>
                    </el-radio-group>
                </el-form-item>

                <el-form-item v-if="form.target_type !== 'all'" :label="$t('target_id')">
                    <el-input
                        v-model="form.target_id"
                        :placeholder="form.target_type === 'user' ? '用户 ID' : '角色 ID (1=admin, 2=editor, 3=user)'"
                    />
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" :loading="publishing" @click="handlePublish">
                        {{ $t('publish') }}
                    </el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="list-card">
            <template #header>
                <span class="card-title">{{ $t('notification_list') }}</span>
            </template>

            <el-table :data="list" border stripe v-loading="loading" style="width: 100%">
                <el-table-column align="center" prop="notification_id" :label="$t('id')" width="80" />
                <el-table-column align="center" prop="title" :label="$t('notification_title')" />
                <el-table-column align="center" prop="content" :label="$t('notification_content')" show-overflow-tooltip />
                <el-table-column align="center" :label="$t('target_type')" width="110">
                    <template #default="scope">
                        <el-tag size="small" :type="scope.row.target_type === 'all' ? 'success' : 'primary'">
                            {{ $t(targetTypeMap[scope.row.target_type] || 'target_all') }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column align="center" prop="target_id" :label="$t('target_id')" width="90" />
                <el-table-column align="center" prop="created_at" :label="$t('created_at')" width="170" />
            </el-table>
        </el-card>
    </div>
</template>

<style scoped>
.publish-card {
    margin-bottom: 16px;
}

.card-title {
    font-weight: bold;
}
</style>
