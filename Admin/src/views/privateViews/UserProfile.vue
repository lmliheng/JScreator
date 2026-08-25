<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useAuthStore } from '../../store/auth'
import {
    requestUserInfo,
    requestSelfUpdate,
    requestSelfResetPassword
} from '../../composables/useRequest'
import { ElMessage } from 'element-plus'

const authStore = useAuthStore()

const permissionRead = (val) => {
    const map = {
        'user:create': '创建用户',
        'user:read': '读取用户信息',
        'user:update': '更新用户',
        'user:delete': '删除用户',
        'article:create': '创建文章',
        'article:read': '查看文章',
        'article:update': '更新文章',
        'article:delete': '删除文章',
        'category:create': '创建分类',
        'category:read': '查看分类',
        'category:update': '更新分类',
        'category:delete': '删除分类',
    }
    return map[val] || val
}

const detail = computed(() => authStore.userInfo?.user_detail || {})
const permissions = computed(() => authStore.userInfo?.user_permission || [])

const refreshUserInfo = async () => {
    try {
        const res = await requestUserInfo()
        if (res.code === 200) {
            authStore.setUserInfo(res.user_info)
        }
    } catch (e) {
        console.error(e)
    }
}

// 编辑资料
const editVisible = ref(false)
const editLoading = ref(false)
const editForm = reactive({
    username: '',
    email: '',
    name: '',
    area: '',
    bio: '',
    avatar: '',
    vip: 0,
    checkinDay: 0,
})

const openEdit = () => {
    const d = detail.value
    editForm.username = d.username || ''
    editForm.email = d.email || ''
    editForm.name = d.name || ''
    editForm.area = d.area || ''
    editForm.bio = d.bio || ''
    editForm.avatar = d.avatar || ''
    editForm.vip = Number(d.vip) || 0
    editForm.checkinDay = Number(d.checkinDay) || 0
    editVisible.value = true
}

const submitEdit = async () => {
    if (!editForm.username || !editForm.email) {
        ElMessage.warning('用户名和邮箱不能为空')
        return
    }
    const id = detail.value.id
    editLoading.value = true
    try {
        await requestSelfUpdate({
            id,
            username: editForm.username,
            email: editForm.email,
            name: editForm.name,
            area: editForm.area,
            bio: editForm.bio,
            avatar: editForm.avatar || '',
            vip: Number(editForm.vip) || 0,
            checkinDay: Number(editForm.checkinDay) || 0,
        })
        ElMessage.success('资料更新成功')
        editVisible.value = false
        await refreshUserInfo()
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '更新失败')
    } finally {
        editLoading.value = false
    }
}

// 重置密码
const pwdVisible = ref(false)
const pwdForm = reactive({ password: '', confirm: '' })

const submitPwd = async () => {
    if (!pwdForm.password) {
        ElMessage.warning('请输入新密码')
        return
    }
    if (pwdForm.password !== pwdForm.confirm) {
        ElMessage.warning('两次输入的密码不一致')
        return
    }
    try {
        await requestSelfResetPassword(pwdForm.password)
        ElMessage.success('密码重置成功')
        pwdVisible.value = false
        pwdForm.password = ''
        pwdForm.confirm = ''
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '重置失败')
    }
}

onMounted(() => {
    if (!authStore.userInfo?.user_detail) {
        refreshUserInfo()
    }
})
</script>

<template>
    <div class="profile-page">
        <!-- 顶部信息卡 -->
        <el-card shadow="never" class="profile-hero">
            <div class="hero-left">
                <el-avatar :size="88" :src="detail.avatar">
                    {{ (detail.name || detail.username || 'U')[0] }}
                </el-avatar>
                <div class="hero-info">
                    <div class="hero-name-row">
                        <span class="hero-name">{{ detail.name || detail.username }}</span>
                        <el-tag v-if="detail.role_name" size="small" type="info">{{ detail.role_name }}</el-tag>
                        <el-tag v-if="detail.vip" size="small" type="warning">VIP {{ detail.vip }}</el-tag>
                    </div>
                    <div class="hero-sub">
                        <span>@{{ detail.username }}</span>
                        <span v-if="detail.area">· {{ detail.area }}</span>
                    </div>
                    <div v-if="detail.bio" class="hero-bio">{{ detail.bio }}</div>
                </div>
            </div>
            <div class="hero-actions">
                <el-button type="primary" @click="openEdit">编辑资料</el-button>
                <el-button @click="pwdVisible = true">重置密码</el-button>
            </div>
        </el-card>

        <!-- 资料卡片 -->
        <el-row :gutter="16" class="profile-cards">
            <el-col :span="14">
                <el-card shadow="never" header="基本信息">
                    <el-descriptions :column="2" border>
                        <el-descriptions-item label="用户ID">{{ detail.id }}</el-descriptions-item>
                        <el-descriptions-item label="角色">{{ detail.role_name || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="用户名">{{ detail.username || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="姓名">{{ detail.name || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="邮箱">{{ detail.email || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="地区">{{ detail.area || '-' }}</el-descriptions-item>
                        <el-descriptions-item label="VIP 等级">{{ detail.vip ?? '-' }}</el-descriptions-item>
                        <el-descriptions-item label="签到天数">{{ detail.checkinDay ?? '-' }}</el-descriptions-item>
                    </el-descriptions>
                </el-card>
            </el-col>
            <el-col :span="10">
                <el-card shadow="never" header="我的权限">
                    <ul class="perm-list">
                        <li v-for="(item, index) in permissions" :key="index" class="perm-item">
                            {{ permissionRead(item.permission_name) }}
                        </li>
                        <li v-if="!permissions.length" class="perm-empty">暂无权限记录</li>
                    </ul>
                </el-card>
            </el-col>
        </el-row>

        <!-- 编辑弹窗 -->
        <el-dialog v-model="editVisible" title="编辑资料" width="520px">
            <el-form :model="editForm" label-width="90px">
                <el-form-item label="头像">
                    <div class="avatar-edit-row">
                        <el-avatar :size="48" :src="editForm.avatar || undefined">
                            {{ (editForm.name || editForm.username || 'U')[0] }}
                        </el-avatar>
                        <el-input v-model="editForm.avatar" placeholder="粘贴头像图片 URL" clearable />
                    </div>
                </el-form-item>
                <el-row :gutter="12">
                    <el-col :span="12">
                        <el-form-item label="用户名">
                            <el-input v-model="editForm.username" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="姓名">
                            <el-input v-model="editForm.name" />
                        </el-form-item>
                    </el-col>
                </el-row>
                <el-form-item label="邮箱">
                    <el-input v-model="editForm.email" />
                </el-form-item>
                <el-row :gutter="12">
                    <el-col :span="12">
                        <el-form-item label="地区">
                            <el-input v-model="editForm.area" placeholder="如：上海" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="VIP 等级">
                            <el-input-number v-model="editForm.vip" :min="0" controls-position="right" style="width: 100%" />
                        </el-form-item>
                    </el-col>
                </el-row>
                <el-row :gutter="12">
                    <el-col :span="12">
                        <el-form-item label="签到天数">
                            <el-input-number v-model="editForm.checkinDay" :min="0" controls-position="right" style="width: 100%" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12"></el-col>
                </el-row>
                <el-form-item label="简介">
                    <el-input v-model="editForm.bio" type="textarea" :rows="3" placeholder="介绍一下自己…" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="editVisible = false">取消</el-button>
                <el-button type="primary" :loading="editLoading" @click="submitEdit">保存</el-button>
            </template>
        </el-dialog>

        <!-- 重置密码弹窗 -->
        <el-dialog v-model="pwdVisible" title="重置密码" width="420px">
            <el-form :model="pwdForm" label-width="80px">
                <el-form-item label="新密码">
                    <el-input v-model="pwdForm.password" type="password" show-password />
                </el-form-item>
                <el-form-item label="确认密码">
                    <el-input v-model="pwdForm.confirm" type="password" show-password />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="pwdVisible = false">取消</el-button>
                <el-button type="primary" @click="submitPwd">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<style scoped>
.profile-page {
    max-width: 960px;
}
.profile-hero {
    margin-bottom: 16px;
}
.profile-hero :deep(.el-card__body) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}
.hero-left {
    display: flex;
    align-items: center;
    gap: 16px;
}
.hero-left :deep(.el-avatar) {
    flex-shrink: 0;
}
.hero-info {
    min-width: 0;
    flex: 1;
}
.hero-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
}
.hero-name {
    font-size: 20px;
    font-weight: 600;
}
.hero-sub {
    margin-top: 4px;
    color: #909399;
    font-size: 13px;
}
.hero-bio {
    margin-top: 8px;
    color: #606266;
    font-size: 14px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.hero-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
.profile-cards {
    margin-top: 0;
}
.perm-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.perm-item {
    padding: 6px 0;
    border-bottom: 1px dashed #ebeef5;
    color: #606266;
}
.perm-item:last-child {
    border-bottom: none;
}
.perm-empty {
    color: #c0c4cc;
    font-size: 13px;
}

.avatar-edit-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
}
</style>
