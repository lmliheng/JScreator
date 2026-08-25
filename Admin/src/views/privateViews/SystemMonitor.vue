<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { requestSystemMonitor } from '@/composables/useRequest'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const data = ref(null)
let timer = null

const formatBytes = (bytes) => {
    if (bytes == null) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const formatUptime = (seconds) => {
    if (seconds == null) return '-'
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (d > 0) return `${d} 天 ${h} 小时 ${m} 分`
    if (h > 0) return `${h} 小时 ${m} 分`
    if (m > 0) return `${m} 分 ${s} 秒`
    return `${s} 秒`
}

const formatTime = (v) => (v ? String(v).replace('T', ' ').slice(0, 19) : '-')

const loadText = computed(() => {
    const la = data.value?.cpu?.loadavg
    if (!Array.isArray(la)) return '-'
    return la.map((n) => n.toFixed(2)).join(' / ')
})

const cpuText = computed(() => {
    const u = data.value?.cpu?.usage
    return u == null ? '-' : `${u}%`
})

const loadData = async () => {
    try {
        const res = await requestSystemMonitor()
        if (res.code === 200) {
            data.value = res.data
        } else {
            ElMessage.error(res.message || '获取系统监控失败')
        }
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '获取系统监控失败')
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loading.value = true
    loadData()
    timer = setInterval(loadData, 5000)
})

onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
})
</script>

<template>
    <div v-loading="loading">
        <!-- 顶部指标卡片 -->
        <el-row :gutter="16" class="mb16">
            <el-col :span="6">
                <el-card shadow="never">
                    <div class="metric">
                        <div class="metric-label">CPU 使用率</div>
                        <div class="metric-value">{{ cpuText }}</div>
                    </div>
                </el-card>
            </el-col>
            <el-col :span="6">
                <el-card shadow="never">
                    <div class="metric">
                        <div class="metric-label">内存使用率</div>
                        <div class="metric-value">{{ data ? data.memory.usagePercent + '%' : '-' }}</div>
                        <el-progress
                            :percentage="data ? data.memory.usagePercent : 0"
                            :show-text="false"
                            :stroke-width="8"
                        />
                    </div>
                </el-card>
            </el-col>
            <el-col :span="6">
                <el-card shadow="never">
                    <div class="metric">
                        <div class="metric-label">系统负载 (1/5/15 分钟)</div>
                        <div class="metric-value metric-small">{{ loadText }}</div>
                    </div>
                </el-card>
            </el-col>
            <el-col :span="6">
                <el-card shadow="never">
                    <div class="metric">
                        <div class="metric-label">数据库</div>
                        <div class="metric-value">
                            <el-tag :type="data?.db?.connected ? 'success' : 'danger'" size="large">
                                {{ data?.db?.connected ? '连接正常' : '连接异常' }}
                            </el-tag>
                        </div>
                        <div v-if="data?.db?.version" class="metric-sub">MySQL {{ data.db.version }}</div>
                    </div>
                </el-card>
            </el-col>
        </el-row>

        <!-- 详情 -->
        <el-row :gutter="16">
            <el-col :span="12">
                <el-card shadow="never" header="系统信息">
                    <el-descriptions :column="1" border>
                        <el-descriptions-item label="主机名">{{ data?.system?.hostname || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="操作系统">
                            {{ data?.system?.osType || '-' }} {{ data?.system?.osRelease || '' }}
                        </el-descriptions-item>
                        <el-descriptions-item label="平台 / 架构">
                            {{ data?.system?.platform || '-' }} / {{ data?.system?.arch || '-' }}
                        </el-descriptions-item>
                        <el-descriptions-item label="CPU">
                            {{ data?.system?.cpuModel || '-' }}（{{ data?.system?.cpuCores || 0 }} 核）
                        </el-descriptions-item>
                        <el-descriptions-item label="系统运行时长">{{ formatUptime(data?.system?.uptime) }}</el-descriptions-item>
                    </el-descriptions>
                </el-card>
            </el-col>
            <el-col :span="12">
                <el-card shadow="never" header="内存与进程">
                    <el-descriptions :column="1" border>
                        <el-descriptions-item label="内存总量">{{ formatBytes(data?.memory?.total) }}</el-descriptions-item>
                        <el-descriptions-item label="已用 / 空闲">
                            {{ formatBytes(data?.memory?.used) }} / {{ formatBytes(data?.memory?.free) }}
                        </el-descriptions-item>
                        <el-descriptions-item label="Node 版本">{{ data?.process?.nodeVersion || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="进程 PID">{{ data?.process?.pid || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="进程运行时长">{{ formatUptime(data?.process?.uptime) }}</el-descriptions-item>
                        <el-descriptions-item label="进程内存 (RSS)">{{ formatBytes(data?.process?.memoryRss) }}</el-descriptions-item>
                        <el-descriptions-item label="堆内存">
                            {{ formatBytes(data?.process?.heapUsed) }} / {{ formatBytes(data?.process?.heapTotal) }}
                        </el-descriptions-item>
                    </el-descriptions>
                </el-card>
            </el-col>
        </el-row>

        <div class="footer-note">每 5 秒自动刷新 · 上次更新：{{ data?.timestamp ? formatTime(data.timestamp) : '-' }}</div>
    </div>
</template>

<style scoped>
.mb16 {
    margin-bottom: 16px;
}

.metric {
    min-height: 92px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.metric-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
}

.metric-value {
    font-size: 26px;
    font-weight: bold;
    color: #303133;
    line-height: 1.2;
}

.metric-small {
    font-size: 16px;
}

.metric-sub {
    margin-top: 6px;
    font-size: 12px;
    color: #909399;
}

.footer-note {
    margin-top: 16px;
    text-align: center;
    font-size: 12px;
    color: #909399;
}
</style>
