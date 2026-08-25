<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell } from '@element-plus/icons-vue'
import {
    requestNotificationList,
    requestNotificationUnreadCount,
    requestNotificationRead
} from '@/composables/useRequest'

const router = useRouter()
const unreadCount = ref(0)
const list = ref([])
let timer = null

const hasUnread = computed(() => unreadCount.value > 0)

const fetchData = async () => {
    try {
        const countRes = await requestNotificationUnreadCount()
        if (countRes.code === 200 && countRes.data) {
            unreadCount.value = countRes.data.unread_count || 0
        }
        const listRes = await requestNotificationList()
        if (listRes.code === 200 && listRes.data) {
            list.value = (listRes.data.list || []).slice(0, 8)
        }
    } catch (e) {
        // 静默失败，避免打扰用户
    }
}

const handleRead = async (row) => {
    if (Number(row.is_read) === 1) return
    try {
        const res = await requestNotificationRead(row.notification_id)
        if (res.code === 200) {
            row.is_read = 1
            await fetchData()
        }
    } catch (e) {
        ElMessage.error('标记已读失败')
    }
}

const goAll = () => {
    router.push('/notification/notification-center')
}

onMounted(() => {
    fetchData()
    timer = setInterval(fetchData, 30000)
})

onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
})
</script>

<template>
    <el-popover placement="bottom-end" :width="340" trigger="click" @show="fetchData">
        <template #reference>
            <div id="header-notification">
                <el-badge :value="unreadCount" :hidden="!hasUnread" :max="99">
                    <el-icon :size="20"><Bell /></el-icon>
                </el-badge>
            </div>
        </template>

        <div class="notification-panel">
            <div class="notification-head">
                <span class="notification-title">{{ $t('notification') }}</span>
                <span v-if="hasUnread" class="notification-unread">{{ unreadCount }} {{ $t('unread') }}</span>
            </div>

            <el-empty
                v-if="list.length === 0"
                :description="$t('no_notification')"
                :image-size="50"
            />

            <div
                v-for="item in list"
                :key="item.notification_id"
                class="notification-item"
                :class="{ unread: Number(item.is_read) === 0 }"
                @click="handleRead(item)"
            >
                <div class="notification-item-title">
                    <span v-if="Number(item.is_read) === 0" class="dot"></span>
                    {{ item.title }}
                </div>
                <div class="notification-item-time">{{ item.created_at }}</div>
            </div>

            <div class="notification-footer">
                <el-button type="primary" text size="small" @click="goAll">
                    {{ $t('view_all') }}
                </el-button>
            </div>
        </div>
    </el-popover>
</template>

<style scoped>
#header-notification {
    cursor: pointer;
    border: none;
    margin-right: 16px;
    width: 30px;
    height: 60px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.notification-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
    margin-bottom: 8px;
}

.notification-title {
    font-weight: bold;
    font-size: 14px;
}

.notification-unread {
    font-size: 12px;
    color: #f56c6c;
}

.notification-item {
    padding: 8px 4px;
    border-bottom: 1px solid #f5f5f5;
    cursor: pointer;
}

.notification-item:hover {
    background-color: #f5f7fa;
}

.notification-item-title {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.notification-item.unread .notification-item-title {
    font-weight: bold;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #f56c6c;
    flex-shrink: 0;
}

.notification-item-time {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
}

.notification-footer {
    text-align: center;
    padding-top: 8px;
}
</style>
