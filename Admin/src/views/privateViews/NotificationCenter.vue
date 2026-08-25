<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
    requestNotificationList,
    requestNotificationRead
} from '@/composables/useRequest'

const loading = ref(false)
const list = ref([])

const unreadCount = computed(() => list.value.filter(item => Number(item.is_read) === 0).length)

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
        } else {
            ElMessage.error(res.message || '获取通知列表失败')
        }
    } catch (e) {
        ElMessage.error('获取通知列表失败')
    } finally {
        loading.value = false
    }
}

const handleRead = async (row) => {
    if (Number(row.is_read) === 1) return
    try {
        const res = await requestNotificationRead(row.notification_id)
        if (res.code === 200) {
            row.is_read = 1
            ElMessage.success('已标记为已读')
        } else {
            ElMessage.error(res.message || '标记已读失败')
        }
    } catch (e) {
        ElMessage.error('标记已读失败')
    }
}

const handleReadAll = async () => {
    const unread = list.value.filter(item => Number(item.is_read) === 0)
    if (unread.length === 0) {
        ElMessage.info('没有未读通知')
        return
    }
    for (const item of unread) {
        await handleRead(item)
    }
}

onMounted(getList)
</script>

<template>
    <div>
        <div class="head">
            <div>
                <span class="title">{{ $t('notification_center') }}</span>
                <el-tag v-if="unreadCount > 0" type="danger" size="small">
                    {{ unreadCount }} {{ $t('unread') }}
                </el-tag>
            </div>
            <el-button type="primary" size="small" @click="handleReadAll">
                {{ $t('mark_all_read') }}
            </el-button>
        </div>

        <el-table :data="list" border stripe v-loading="loading" style="width: 100%">
            <el-table-column align="center" prop="notification_id" :label="$t('id')" width="80" />
            <el-table-column align="center" :label="$t('notification_title')">
                <template #default="scope">
                    <span :style="{ fontWeight: Number(scope.row.is_read) === 0 ? 'bold' : 'normal' }">
                        {{ scope.row.title }}
                    </span>
                </template>
            </el-table-column>
            <el-table-column align="center" prop="content" :label="$t('notification_content')" show-overflow-tooltip />
            <el-table-column align="center" :label="$t('target_type')" width="110">
                <template #default="scope">
                    <el-tag size="small" :type="scope.row.target_type === 'all' ? 'success' : 'primary'">
                        {{ $t(targetTypeMap[scope.row.target_type] || 'target_all') }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column align="center" :label="$t('is_read')" width="90">
                <template #default="scope">
                    <el-tag size="small" :type="Number(scope.row.is_read) === 1 ? 'info' : 'danger'">
                        {{ Number(scope.row.is_read) === 1 ? $t('read') : $t('unread') }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column align="center" prop="created_at" :label="$t('created_at')" width="170" />
            <el-table-column align="center" :label="$t('operation')" width="120">
                <template #default="scope">
                    <el-button
                        type="primary"
                        size="small"
                        :disabled="Number(scope.row.is_read) === 1"
                        @click="handleRead(scope.row)"
                    >
                        {{ $t('mark_read') }}
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<style scoped>
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.title {
    font-size: 16px;
    font-weight: bold;
    margin-right: 8px;
}
</style>
