<template>
    <div class="home-setting">
        <!-- 顶部说明 + admin 选人 -->
        <div class="setting-toolbar">
            <div class="setting-toolbar-title">
                <h3 class="setting-title">博客主页设置</h3>
                <p class="setting-subtitle">
                    设置博主的个人主页：头像、昵称、简介、地区、社交媒体与精选文章（顺序即展示顺序）。
                </p>
            </div>
            <div v-if="isAdmin" class="setting-toolbar-picker">
                <el-select
                    v-model="selectedUsername"
                    filterable
                    remote
                    clearable
                    reserve-keyword
                    placeholder="搜索用户名/昵称，选择要设置的用户"
                    :remote-method="searchUsers"
                    :loading="searchLoading"
                    style="width: 320px"
                    @change="onSelectUser"
                >
                    <el-option
                        v-for="u in searchResult"
                        :key="u.id"
                        :label="`${u.name || u.username} (@${u.username})`"
                        :value="u.username"
                    />
                </el-select>
                <el-button v-if="selectedUsername" @click="switchToSelf">切回自己</el-button>
            </div>
        </div>

        <el-alert
            v-if="!isAdmin && targetUsername"
            type="info"
            :closable="false"
            show-icon
            title="你正在设置自己的博客主页"
            style="margin-bottom: 16px"
        />

        <!-- 加载中 / 未选择 -->
        <div v-if="loading" v-loading="true" class="setting-empty" />
        <el-empty v-else-if="!targetUsername" description="未选择用户" />

        <div v-else class="setting-body">
            <!-- 基础资料 -->
            <el-card shadow="never" class="setting-card">
                <template #header>
                    <span>基础资料</span>
                </template>
                <el-form :model="form" label-width="90px">
                    <el-form-item label="头像">
                        <div class="avatar-row">
                            <el-avatar :size="56" :src="form.avatar || undefined">
                                {{ (form.name || targetUsername || '?').charAt(0) }}
                            </el-avatar>
                            <el-input v-model="form.avatar" placeholder="粘贴头像图片 URL" clearable style="flex: 1" />
                            <el-button :loading="uploadingAvatar" @click="triggerAvatarUpload">上传</el-button>
                            <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden-file" @change="handleAvatarFile" />
                        </div>
                    </el-form-item>
                    <el-form-item label="昵称">
                        <el-input v-model="form.name" placeholder="博主昵称" />
                    </el-form-item>
                    <el-form-item label="简介">
                        <el-input v-model="form.bio" type="textarea" :rows="3" placeholder="自我介绍" />
                    </el-form-item>
                    <el-form-item label="地区">
                        <el-input v-model="form.area" placeholder="如：湖南长沙" />
                    </el-form-item>
                </el-form>
            </el-card>

            <!-- 社交媒体 -->
            <el-card shadow="never" class="setting-card">
                <template #header>
                    <span>社交媒体</span>
                </template>
                <div v-if="socials.length" class="social-list">
                    <div v-for="(s, i) in socials" :key="i" class="social-item">
                        <el-tag size="small" :type="s.type === 'wechat' ? 'success' : 'info'" effect="plain">
                            {{ socialLabel(s.type) }}
                        </el-tag>
                        <span class="social-url">{{ s.url }}</span>
                        <el-button size="small" type="danger" link @click="removeSocial(i)">删除</el-button>
                    </div>
                </div>
                <p v-else class="social-empty">还没有添加社交链接</p>
                <div class="social-add">
                    <el-input
                        v-model="newSocialUrl"
                        placeholder="链接地址（自动识别：GitHub/微信/QQ/Telegram/力扣/npm…）"
                        clearable
                        style="flex: 1"
                        @keyup.enter="addSocial"
                    />
                    <el-button type="primary" @click="addSocial">添加</el-button>
                </div>
                <div v-if="newSocialUrl" class="social-detect">
                    识别为：<el-tag size="small" effect="plain">{{ socialLabel(detectSocialType(newSocialUrl)) }}</el-tag>
                </div>
                <div class="social-qr">
                    <el-button :loading="uploadingQr" @click="triggerQrUpload">
                        上传微信二维码（作为微信社交项）
                    </el-button>
                    <span class="social-qr-tip">将图片上传为「微信」社交项，访客点击查看二维码</span>
                    <input ref="socialQrInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden-file" @change="handleQrFile" />
                </div>
            </el-card>

            <!-- 精选文章 -->
            <el-card shadow="never" class="setting-card">
                <template #header>
                    <span>精选文章（主页展示，可排序，最多 6 篇）</span>
                </template>
                <div v-if="featured.length" class="featured-list">
                    <div v-for="(id, i) in featured" :key="id" class="featured-item">
                        <span class="featured-order">{{ i + 1 }}</span>
                        <span class="featured-title">{{ articleTitle(id) }}</span>
                        <el-button size="small" :disabled="i === 0" @click="moveFeatured(i, -1)">↑</el-button>
                        <el-button size="small" :disabled="i === featured.length - 1" @click="moveFeatured(i, 1)">↓</el-button>
                        <el-button size="small" type="danger" link @click="toggleFeatured(id)">移除</el-button>
                    </div>
                </div>
                <div v-if="articles.length" class="featured-pool">
                    <el-checkbox-group v-model="featured" :max="6" class="featured-checks">
                        <el-checkbox v-for="a in articles" :key="a.article_id" :value="Number(a.article_id)">
                            {{ a.title }}
                        </el-checkbox>
                    </el-checkbox-group>
                </div>
                <p v-else-if="!articlesLoading" class="social-empty">该用户还没有已发布的文章</p>
                <p v-else class="social-empty">文章加载中…</p>
            </el-card>

            <!-- GitHub 绑定（仅本人可操作：绑定逻辑按当前登录账号生效） -->
            <el-card v-if="isSelfTarget" shadow="never" class="setting-card">
                <template #header>
                    <span>GitHub 绑定</span>
                </template>
                <div v-if="githubId" class="social-item">
                    <el-tag type="success" effect="plain">已绑定</el-tag>
                    <span class="social-url">GitHub #{{ githubId }}</span>
                    <el-button size="small" type="danger" link :loading="unbindingGithub" @click="unbindGithub">取消绑定</el-button>
                </div>
                <div v-else class="social-item">
                    <el-button type="primary" @click="bindGithub">绑定 GitHub</el-button>
                    <span class="social-qr-tip">跳转 GitHub 授权后自动绑定到当前登录账号</span>
                </div>
            </el-card>

            <div class="setting-actions">
                <el-button :loading="saving" type="primary" size="large" @click="save">保存主页设置</el-button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { ElMessage } from 'element-plus'
import {
    requestUser,
    requestUserDetail,
    requestSelfUpdate,
    requestBlogArticles
} from '../../composables/useRequest'
import { api } from '../../composables/useAxiosConfig'

const route = useRoute()
const authStore = useAuthStore()

// ===== 角色 =====
const isAdmin = computed(() => Number(authStore.userInfo?.user_detail?.role_id) === 1)
const selfId = computed(() => Number(authStore.userInfo?.user_detail?.id))

// ===== 目标用户选择（admin） =====
const selectedUsername = ref('')
const targetUsername = ref('')
const searchResult = ref([])
const searchLoading = ref(false)
const searchUsers = async (kw) => {
    if (!kw) {
        searchResult.value = []
        return
    }
    searchLoading.value = true
    try {
        const res = await requestUser({ keyword: kw, page: 1, pageSize: 20 })
        searchResult.value = res.data.list || []
    } catch (e) {
        searchResult.value = []
    } finally {
        searchLoading.value = false
    }
}
const onSelectUser = (val) => {
    if (val) loadTarget(val)
}
const switchToSelf = async () => {
    // 切回自己：用 /sys/profile 里的 username
    const uname = authStore.userInfo?.user_detail?.username
    if (uname) {
        selectedUsername.value = uname
        loadTarget(uname)
    }
}

// ===== 表单 =====
const loading = ref(false)
const saving = ref(false)
const form = reactive({ avatar: '', name: '', bio: '', area: '' })
const socials = ref([])
const featured = ref([])
const articles = ref([])
const articlesLoading = ref(false)
const githubId = ref(null)
const targetUserId = ref(null)
// 当前目标是否为本人（GitHub 绑定仅本人可操作）
const isSelfTarget = computed(() => Number(targetUserId.value) === Number(selfId.value))

const loadTarget = async (username) => {
    loading.value = true
    targetUsername.value = username
    Object.assign(form, { avatar: '', name: '', bio: '', area: '' })
    socials.value = []
    featured.value = []
    articles.value = []
    githubId.value = null
    try {
        // 用户详情（含 socials / featured_articles / github_id）
        // admin 可通过搜索拿到任意用户；普通用户固定查自己
        let detailRes = null
        if (!isAdmin.value && username === authStore.userInfo?.user_detail?.username) {
            detailRes = await requestUserDetail(selfId.value)
        } else {
            detailRes = await requestUserDetailByUsername(username)
        }
        if (detailRes && detailRes.data) {
            const d = detailRes.data
            targetUserId.value = Number(d.id)
            form.avatar = d.avatar || ''
            form.name = d.name || ''
            form.bio = d.bio || ''
            form.area = d.area || ''
            socials.value = Array.isArray(d.socials) ? d.socials.map(s => ({ ...s })) : []
            featured.value = (Array.isArray(d.featured_articles) ? d.featured_articles : []).map(Number)
            githubId.value = d.github_id || null
        }
        // 该用户的已发布文章（精选池）
        articlesLoading.value = true
        try {
            const artRes = await requestBlogArticles(username, { page: 1, pageSize: 100 })
            articles.value = (artRes && artRes.data && artRes.data.list) || []
        } catch (e) {
            articles.value = []
        } finally {
            articlesLoading.value = false
        }
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '加载用户主页设置失败')
    } finally {
        loading.value = false
    }
}

// 按用户名查用户 id（先搜列表再取详情）
const requestUserDetailByUsername = async (username) => {
    const listRes = await requestUser({ keyword: username, page: 1, pageSize: 20 })
    const found = (listRes.data.list || []).find(u => u.username === username)
    if (!found) throw new Error('用户不存在')
    return requestUserDetail(found.id)
}

// ===== 精选文章 =====
const articleTitle = (id) =>
    (articles.value.find((a) => Number(a.article_id) === Number(id)) || {}).title || `文章 #${id}`
const toggleFeatured = (id) => {
    const nid = Number(id)
    const i = featured.value.findIndex((x) => Number(x) === nid)
    if (i >= 0) featured.value.splice(i, 1)
    else if (featured.value.length < 6) featured.value.push(nid)
    else ElMessage.warning('精选文章最多 6 篇')
}
const moveFeatured = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= featured.value.length) return
    const tmp = featured.value[i]
    featured.value[i] = featured.value[j]
    featured.value[j] = tmp
}

// ===== 社交媒体 =====
const newSocialUrl = ref('')
const SOCIAL_LABELS = {
    github: 'GitHub', telegram: 'Telegram', qq: 'QQ', wechat: '微信', leetcode: '力扣',
    npm: 'npm', bilibili: 'B站', rss: 'RSS', email: '邮箱', phone: '电话',
    zhihu: '知乎', douban: '豆瓣', csu: '中南大学', custom: '链接',
}
const socialLabel = (t) => SOCIAL_LABELS[t] || '链接'
const detectSocialType = (url) => {
    const u = String(url || '').toLowerCase()
    if (u.includes('github')) return 'github'
    if (u.includes('t.me') || u.includes('telegram')) return 'telegram'
    if (u.includes('qq.com')) return 'qq'
    if (u.includes('weixin') || u.includes('wechat')) return 'wechat'
    if (u.includes('leetcode')) return 'leetcode'
    if (u.includes('npmjs')) return 'npm'
    if (u.includes('bilibili')) return 'bilibili'
    if (u.includes('zhihu')) return 'zhihu'
    if (u.includes('douban')) return 'douban'
    if (u.includes('csu.edu.cn') || u.includes('csu')) return 'csu'
    if (u.startsWith('tel:')) return 'phone'
    if (u.startsWith('mailto:')) return 'email'
    if (u.includes('rss') || u.includes('feed')) return 'rss'
    return 'custom'
}
const addSocial = () => {
    const url = newSocialUrl.value.trim()
    if (!url) {
        ElMessage.warning('请输入社交链接')
        return
    }
    const type = detectSocialType(url)
    socials.value.push({ type, url, label: socialLabel(type) })
    newSocialUrl.value = ''
}
const removeSocial = (i) => socials.value.splice(i, 1)

// ===== 上传（头像 / 微信二维码） =====
const avatarInput = ref(null)
const uploadingAvatar = ref(false)
const triggerAvatarUpload = () => avatarInput.value && avatarInput.value.click()
const handleAvatarFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        ElMessage.warning('仅支持 jpg/png/webp/gif 图片')
        e.target.value = ''
        return
    }
    if (file.size > 5 * 1024 * 1024) {
        ElMessage.warning('图片不能超过 5MB')
        e.target.value = ''
        return
    }
    uploadingAvatar.value = true
    try {
        const fd = new FormData()
        fd.append('image', file)
        const res = await api.post('/upload/image', fd)
        if (res && res.data && res.data.url) form.avatar = res.data.url
        else ElMessage.error((res && res.message) || '上传失败')
    } catch (err) {
        ElMessage.error(err?.response?.data?.message || '上传失败')
    } finally {
        uploadingAvatar.value = false
        e.target.value = ''
    }
}

const socialQrInput = ref(null)
const uploadingQr = ref(false)
const triggerQrUpload = () => socialQrInput.value && socialQrInput.value.click()
const handleQrFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        ElMessage.warning('仅支持 jpg/png/webp/gif 图片')
        e.target.value = ''
        return
    }
    if (file.size > 5 * 1024 * 1024) {
        ElMessage.warning('图片不能超过 5MB')
        e.target.value = ''
        return
    }
    uploadingQr.value = true
    try {
        const fd = new FormData()
        fd.append('image', file)
        const res = await api.post('/upload/image', fd)
        if (res && res.data && res.data.url) {
            socials.value.push({ type: 'wechat', url: res.data.url, label: '微信', image: true })
            ElMessage.success('微信二维码已添加')
        } else {
            ElMessage.error((res && res.message) || '上传失败')
        }
    } catch (err) {
        ElMessage.error(err?.response?.data?.message || '上传失败')
    } finally {
        uploadingQr.value = false
        e.target.value = ''
    }
}

// ===== GitHub 绑定 / 解绑 =====
const unbindingGithub = ref(false)
const unbindGithub = async () => {
    unbindingGithub.value = true
    try {
        await api.post('/userInfo/unbind-github')
        githubId.value = null
        ElMessage.success('已解除 GitHub 绑定')
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '解绑失败')
    } finally {
        unbindingGithub.value = false
    }
}
const bindGithub = () => {
    // 注意：后端绑定态只认当前登录 token 的用户；admin 代他人绑定暂不支持，
    // 此按钮仅对"自己"生效。绑定后跳回本页。
    const base = api.defaults.baseURL || 'http://127.0.0.1:7000'
    const redirect = window.location.href.split('#')[0] + '#/user/home-setting'
    const rawToken = String(authStore.token || '').replace(/^Bearer\s+/i, '')
    window.location.href =
        `${base}/auth/github/bind?redirect=${encodeURIComponent(redirect)}` +
        `&token=${encodeURIComponent(rawToken)}`
}

// ===== 保存 =====
const save = async () => {
    if (!targetUserId.value) return
    saving.value = true
    try {
        await requestSelfUpdate({
            id: targetUserId.value,
            name: form.name,
            bio: form.bio,
            area: form.area,
            avatar: form.avatar,
            socials: socials.value,
            featured_articles: featured.value,
        })
        ElMessage.success('主页设置已保存')
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '保存失败')
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    const uname = authStore.userInfo?.user_detail?.username
    // 普通用户（非 admin）只能设置自己，忽略 URL 里的目标用户，防止越权
    if (!isAdmin.value) {
        if (uname) {
            selectedUsername.value = uname
            loadTarget(uname)
        }
        return
    }
    // admin：优先取 URL query（用户管理行内「主页设置」按钮跳转带入）
    const qUser = route.query.username
    if (qUser) {
        selectedUsername.value = String(qUser)
        loadTarget(String(qUser))
        return
    }
    if (uname) {
        selectedUsername.value = uname
        loadTarget(uname)
    }
})
</script>

<style scoped>
.home-setting {
    padding: 4px;
}
.setting-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.setting-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
}
.setting-subtitle {
    font-size: 12px;
    color: #909399;
    margin: 4px 0 0;
}
.setting-toolbar-picker {
    display: flex;
    align-items: center;
    gap: 8px;
}
.setting-empty {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.setting-body {
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.setting-card :deep(.el-card__header) {
    font-weight: 600;
}
.avatar-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
}
.hidden-file {
    display: none;
}
.social-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
}
.social-item {
    display: flex;
    align-items: center;
    gap: 10px;
}
.social-url {
    flex: 1;
    font-size: 13px;
    color: #606266;
    word-break: break-all;
}
.social-empty {
    font-size: 12px;
    color: #909399;
    margin: 8px 0 12px;
}
.social-add {
    display: flex;
    gap: 8px;
}
.social-detect {
    margin-top: 8px;
    font-size: 12px;
    color: #909399;
}
.social-qr {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.social-qr-tip {
    font-size: 12px;
    color: #909399;
}
.featured-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
}
.featured-item {
    display: flex;
    align-items: center;
    gap: 10px;
}
.featured-order {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #409eff;
    color: #fff;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.featured-title {
    flex: 1;
    font-size: 13px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.featured-pool {
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    padding: 10px;
    max-height: 240px;
    overflow-y: auto;
}
.featured-checks {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
}
.setting-actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
}
</style>
