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

// 详情弹窗
const dialogVisible = ref(false)
const current = ref(null)

const typeMap = { system: '系统', announcement: '公告', reminder: '提醒' }
const typeTagMap = { system: 'danger', announcement: 'success', reminder: 'warning' }
const importanceMap = { high: '高', medium: '中', low: '低' }

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
            checkSystemNotif(list.value)
        }
    } catch (e) {
        // 静默失败，避免打扰用户
    }
}

// 系统级通知：登录后自动弹一次（未读的 system 通知）
const checkSystemNotif = (items) => {
    const systemNotif = items.find((item) => item.type === 'system' && Number(item.is_read) === 0)
    if (!systemNotif) return
    const key = 'system_notif_shown_' + systemNotif.notification_id
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    current.value = systemNotif
    dialogVisible.value = true
    // 自动弹出同时标记已读
    requestNotificationRead(systemNotif.notification_id).then(() => fetchData()).catch(() => {})
}

const openDetail = async (row) => {
    current.value = row
    dialogVisible.value = true
    if (Number(row.is_read) === 0) {
        try {
            await requestNotificationRead(row.notification_id)
            row.is_read = 1
            await fetchData()
        } catch (e) {
            ElMessage.error('标记已读失败')
        }
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
    <div>
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
                    <span class="notification-title">通知</span>
                    <span v-if="hasUnread" class="notification-unread">{{ unreadCount }} 未读</span>
                </div>

                <el-empty
                    v-if="list.length === 0"
                    description="暂无通知"
                    :image-size="50"
                />

                <div
                    v-for="item in list"
                    :key="item.notification_id"
                    class="notification-item"
                    :class="{ unread: Number(item.is_read) === 0 }"
                    @click="openDetail(item)"
                >
                    <div class="notification-item-title">
                        <el-tag size="small" :type="typeTagMap[item.type] || 'info'">{{ typeMap[item.type] || item.type || '-' }}</el-tag>
                        <span v-if="Number(item.is_read) === 0" class="dot"></span>
                        {{ item.title }}
                    </div>
                    <div class="notification-item-time">{{ item.created_at }}</div>
                </div>

                <div class="notification-footer">
                    <el-button type="primary" text size="small" @click="goAll">查看全部</el-button>
                </div>
            </div>
        </el-popover>

        <!-- 通知详情弹窗 -->
        <el-dialog v-model="dialogVisible" title="通知详情" width="520px">
            <div v-if="current">
                <div class="detail-title">{{ current.title }}</div>
                <div class="detail-meta">
                    <el-tag size="small" :type="typeTagMap[current.type] || 'info'">
                        {{ typeMap[current.type] || current.type || '-' }}
                    </el-tag>
                    <el-tag size="small" type="warning">
                        重要性：{{ importanceMap[current.importance] || current.importance || '-' }}
                    </el-tag>
                    <span class="detail-time">{{ current.created_at }}</span>
                </div>
                <div class="detail-content">{{ current.content }}</div>
            </div>
            <template #footer>
                <el-button @click="dialogVisible = false">关闭</el-button>
            </template>
        </el-dialog>
    </div>
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

.detail-title {
    font-size: 18px;
    font-weight: bold;
    color: #303133;
}

.detail-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
}

.detail-time {
    font-size: 12px;
    color: #909399;
}

.detail-content {
    margin-top: 16px;
    padding: 12px;
    background-color: #f5f7fa;
    border-radius: 4px;
    font-size: 14px;
    color: #606266;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
