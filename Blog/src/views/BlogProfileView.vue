<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getBlogProfile, getBlogArticles } from '@/api/blog'
import { updateProfile } from '@/api/auth'
import http from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import ArticleCard from '@/components/ArticleCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()

const profile = ref(null) // data.user
const articles = ref([])
const total = ref(0)
const allTotal = ref(0) // 用户全部已发布文章数（「查看全部」入口）
const loading = ref(true) // 初始加载中，避免首帧渲染 profile 为 null
const notFound = ref(false)

const username = computed(() => String(route.params.username || ''))

const displayName = computed(
  () => (profile.value && (profile.value.name || profile.value.username)) || username.value || '用户',
)
const avatar = computed(() => (profile.value && profile.value.avatar) || '')
const bio = computed(() => (profile.value && profile.value.bio) || '')
const area = computed(() => (profile.value && profile.value.area) || '')
const vip = computed(() => Number(profile.value && profile.value.vip) || 0)
const monogram = computed(() => displayName.value.trim().charAt(0).toUpperCase())

// 是否当前登录用户自己的主页
const isSelf = computed(
  () => auth.isLoggedIn && username.value && username.value === auth.username,
)

// ===== 社交媒体（URL 自动识别类型 + 品牌图标） =====
import {
  siGithub, siTelegram, siQq, siWechat, siLeetcode,
  siNpm, siBilibili, siRss, siGmail, siZhihu, siDouban,
} from 'simple-icons'

const PHONE_PATH =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'
const LINK_PATH =
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
// 中南大学（CSU）校徽风格盾形
const CSU_PATH =
  'M12 2l7 2.5v7c0 4.5-3 7.6-7 9.5-4-1.9-7-5-7-9.5v-7L12 2zm0 2.6L8.2 6.7V11c0 3.1 1.6 5.2 3.8 6.5 2.2-1.3 3.8-3.4 3.8-6.5V6.7L12 4.6z'

const ICON_MAP = {
  github: { label: 'GitHub', path: siGithub.path },
  telegram: { label: 'Telegram', path: siTelegram.path },
  qq: { label: 'QQ', path: siQq.path },
  wechat: { label: '微信', path: siWechat.path },
  leetcode: { label: '力扣', path: siLeetcode.path },
  npm: { label: 'npm', path: siNpm.path },
  bilibili: { label: 'B站', path: siBilibili.path },
  rss: { label: 'RSS', path: siRss.path },
  email: { label: '邮箱', path: siGmail.path },
  phone: { label: '电话', path: PHONE_PATH },
  zhihu: { label: '知乎', path: siZhihu.path },
  douban: { label: '豆瓣', path: siDouban.path },
  csu: { label: '中南大学', path: CSU_PATH },
  custom: { label: '链接', path: LINK_PATH },
}
const socialIconPath = (t) => (ICON_MAP[t] || ICON_MAP.custom).path
const socialLabel = (t) => (ICON_MAP[t] || ICON_MAP.custom).label

// 根据 URL 自动识别社交类型
function detectSocialType(url) {
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

// 主页展示（公开）
const socialsDisplay = computed(() => profile.value?.socials || [])
// 编辑用
const socials = ref([])
const newSocial = reactive({ url: '' })
const newSocialType = computed(() => detectSocialType(newSocial.url))
const addSocial = () => {
  const url = newSocial.url.trim()
  if (!url) {
    toast.error('请输入社交链接')
    return
  }
  const type = detectSocialType(url)
  socials.value.push({ type, url, label: socialLabel(type) })
  newSocial.url = ''
}
const removeSocial = (i) => socials.value.splice(i, 1)

// 上传微信二维码（图片类型）
const socialQrInput = ref(null)
const uploadingQr = ref(false)
const triggerQrUpload = () => {
  if (socialQrInput.value) socialQrInput.value.click()
}
const handleQrFile = async (e) => {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    toast.error('仅支持 jpg/png/webp/gif 图片')
    e.target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('图片不能超过 5MB')
    e.target.value = ''
    return
  }
  uploadingQr.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await http.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (res && res.data && res.data.url) {
      socials.value.push({ type: 'wechat', url: res.data.url, label: '微信', image: true })
      toast.success('微信二维码已添加')
    } else {
      toast.error((res && res.message) || '上传失败')
    }
  } catch (err) {
    toast.error(err?.response?.data?.message || '上传失败')
  } finally {
    uploadingQr.value = false
    e.target.value = ''
  }
}

// 点击社交项：图片类型弹二维码大图，否则跳转
const qrVisible = ref(false)
const qrUrl = ref('')
const openSocial = (s) => {
  if (s.image || (s.type === 'wechat' && /^https?:\/\//.test(s.url) && !/^(www\.)?(weixin|wechat)/.test(s.url))) {
    qrUrl.value = s.url
    qrVisible.value = true
    return
  }
  window.open(s.url, '_blank', 'noopener')
}

// ===== 精选文章（主页自定义展示） =====
const featuredArticles = ref([]) // 编辑用（文章 id 数组，顺序即展示顺序）
const myArticles = ref([])
const featuredLoading = ref(false)
const fetchMyArticles = async () => {
  featuredLoading.value = true
  try {
    const data = await getBlogArticles(username.value, { page: 1, pageSize: 100 })
    myArticles.value = (data && data.list) || []
  } catch (e) {
    myArticles.value = []
  } finally {
    featuredLoading.value = false
  }
}
const articleTitle = (id) =>
  (myArticles.value.find((a) => Number(a.article_id) === Number(id)) || {}).title || `文章 #${id}`
const toggleFeatured = (id) => {
  const nid = Number(id)
  const i = featuredArticles.value.findIndex((x) => Number(x) === nid)
  if (i >= 0) featuredArticles.value.splice(i, 1)
  else featuredArticles.value.push(nid)
}
const moveFeatured = (i, dir) => {
  const j = i + dir
  if (j < 0 || j >= featuredArticles.value.length) return
  const tmp = featuredArticles.value[i]
  featuredArticles.value[i] = featuredArticles.value[j]
  featuredArticles.value[j] = tmp
}

// ===== GitHub 绑定 / 解绑 =====
const isGithubBound = computed(() => !!profile.value?.github_id)
const bindGithub = () => {
  const base = http.defaults.baseURL || 'http://127.0.0.1:7000'
  const redirect = window.location.origin + '/' + username.value
  const rawToken = String(auth.token || '').replace(/^Bearer\s+/i, '')
  window.location.href =
    `${base}/auth/github/bind?redirect=${encodeURIComponent(redirect)}` +
    `&token=${encodeURIComponent(rawToken)}`
}
const unbindGithub = async () => {
  try {
    await http.post('/userInfo/unbind-github')
    toast.success('已解除 GitHub 绑定')
    await fetchProfile()
  } catch (e) {
    toast.error(e?.response?.data?.message || '解绑失败')
  }
}

// ===== 编辑资料 =====
const editVisible = ref(false)
const editLoading = ref(false)
const editForm = reactive({ name: '', bio: '', area: '', avatar: '' })

async function fetchProfile() {
  if (!username.value) return
  loading.value = true
  notFound.value = false
  try {
    const data = await getBlogProfile(username.value, { page: 1, pageSize: 4 })
    profile.value = (data && data.user) || null
    const arts = (data && data.articles) || {}
    articles.value = (arts && arts.list) || []
    total.value = Number(arts && arts.total) || 0
    allTotal.value = Number(data && data.all_total) || total.value
    document.title = `${displayName.value}的博客`
    if (profile.value && profile.value.avatar) {
      setFavicon(profile.value.avatar)
    }
  } catch (e) {
    notFound.value = true
    profile.value = null
    articles.value = []
    total.value = 0
    toast.error(e.message || '主页加载失败')
  } finally {
    loading.value = false
  }
}

function openEdit() {
  editForm.name = profile.value?.name || ''
  editForm.bio = profile.value?.bio || ''
  editForm.area = profile.value?.area || ''
  editForm.avatar = profile.value?.avatar || ''
  socials.value = JSON.parse(JSON.stringify(profile.value?.socials || []))
  featuredArticles.value = [...(profile.value?.featured_articles || [])]
  editVisible.value = true
  fetchMyArticles()
}

async function submitEdit() {
  editLoading.value = true
  try {
    await updateProfile({
      id: auth.userId,
      name: editForm.name,
      bio: editForm.bio,
      area: editForm.area,
      avatar: editForm.avatar,
      socials: socials.value,
      featured_articles: featuredArticles.value,
    })
    toast.success('资料已更新')
    editVisible.value = false
    if (auth.user) {
      auth.user.name = editForm.name
      auth.user.bio = editForm.bio
      auth.user.area = editForm.area
    }
    await fetchProfile()
  } catch (e) {
    toast.error(e?.response?.data?.message || e.message || '更新失败')
  } finally {
    editLoading.value = false
  }
}

function logout() {
  auth.logout()
  router.push('/')
}

function setFavicon(url) {
  if (!url) return
  let link = document.querySelector("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = url
}

// ===== 头像上传 =====
const avatarInput = ref(null)
const uploadingAvatar = ref(false)

function triggerAvatarUpload() {
  if (avatarInput.value) avatarInput.value.click()
}

async function handleAvatarFile(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    toast.error('仅支持 jpg/png/webp/gif 图片')
    e.target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('图片不能超过 5MB')
    e.target.value = ''
    return
  }
  uploadingAvatar.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)
    const res = await http.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    if (res && res.data && res.data.url) {
      editForm.avatar = res.data.url
      toast.success('头像上传成功')
    } else {
      toast.error((res && res.message) || '上传失败')
    }
  } catch (err) {
    toast.error(err?.response?.data?.message || '上传失败')
  } finally {
    uploadingAvatar.value = false
    e.target.value = ''
  }
}

watch(username, () => {
  fetchProfile()
})

onMounted(fetchProfile)

onBeforeUnmount(() => {
  const link = document.querySelector("link[rel='icon']")
  if (link) link.href = '/vite.svg'
})
</script>

<template>
  <div class="min-h-screen bg-page text-body antialiased">
    <!-- 顶部导航条 -->
    <header class="profile-topbar">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <RouterLink to="/" class="ghost-btn">← 返回首页</RouterLink>
        <div class="flex items-center gap-2">
          <template v-if="isSelf">
            <button class="btn-accent" @click="openEdit">编辑资料</button>
            <button class="ghost-btn" @click="logout">退出登录</button>
          </template>
          <template v-else-if="auth.isLoggedIn">
            <button class="ghost-btn" @click="logout">退出登录</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="ghost-btn">登录</RouterLink>
            <RouterLink to="/register" class="btn-accent">注册</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 pb-12">
      <!-- 加载中 -->
      <p v-if="loading" class="py-16 text-center text-faint">加载中…</p>

      <!-- 用户不存在 -->
      <div v-else-if="notFound" class="card py-16 text-center">
        <p class="text-lg font-bold text-ink">用户不存在</p>
        <p class="mt-2 text-sm text-muted">没有找到名为「{{ username }}」的博客主页。</p>
        <RouterLink to="/" class="btn-accent mt-6">返回首页</RouterLink>
      </div>

      <template v-else>
        <!-- Hero 横幅 -->
        <section class="profile-hero">
          <span class="hero-particle p1"></span>
          <span class="hero-particle p2"></span>
          <span class="hero-particle p3"></span>

          <div class="hero-avatar-wrap">
            <img v-if="avatar" :src="avatar" :alt="displayName" class="hero-avatar" />
            <span v-else class="hero-avatar hero-monogram">{{ monogram }}</span>
            <button
              v-if="isSelf"
              class="hero-edit-btn"
              title="编辑头像与资料"
              @click="openEdit"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>

          <h1 class="hero-name">{{ displayName }}</h1>
          <p class="hero-username">
            @{{ username }}<span v-if="area" class="hero-username-area"> · {{ area }}</span>
          </p>
          <p v-if="bio" class="hero-bio">{{ bio }}</p>

          <!-- 社交链接 -->
          <div v-if="socialsDisplay.length" class="hero-socials">
            <a
              v-for="(s, i) in socialsDisplay"
              :key="i"
              :href="s.image ? undefined : s.url"
              :target="s.image ? undefined : '_blank'"
              :rel="s.image ? undefined : 'noopener noreferrer'"
              class="hero-social-btn"
              :title="s.label || s.url"
              :data-label="s.label || s.url"
              @click.prevent="openSocial(s)"
            >
              <svg class="social-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="socialIconPath(s.type)" fill="currentColor" />
              </svg>
            </a>
          </div>

          <!-- VIP 缎带横幅（挂在 Hero 顶部，被框边缘裁剪出"挂"的效果） -->
          <div v-if="vip" class="hero-ribbon" title="VIP 等级">
            <svg class="ribbon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="6" />
              <path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5" />
            </svg>
            VIP {{ vip }}
          </div>
        </section>

        <!-- 文章区 -->
        <section class="mt-10">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wide text-faint">
              {{ profile?.featured_articles?.length ? '精选文章' : '最新文章' }}
            </h2>
            <RouterLink
              v-if="allTotal > 4"
              :to="`/${username}/articles`"
              class="text-sm font-medium text-accent hover:text-accent-strong"
            >查看全部 {{ allTotal }} 篇 →</RouterLink>
          </div>
          <div v-if="articles.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ArticleCard v-for="a in articles" :key="a.article_id" :article="a" compact />
          </div>
          <div v-else class="card py-16 text-center text-faint">还没有发布任何文章</div>
        </section>
      </template>
    </main>

    <!-- 底部注册引导（仅对访客展示） -->
    <footer v-if="!isSelf" class="mx-auto max-w-5xl px-4 pb-10 pt-2 text-center">
      <p class="text-sm text-muted">
        你也想创建你的博客？
        <RouterLink to="/register" class="font-medium text-accent hover:text-accent-strong">请注册JScreate吧~</RouterLink>
      </p>
    </footer>

    <!-- 编辑资料弹窗 -->
    <div
      v-if="editVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="editVisible = false"
    >
      <div class="w-full max-w-lg rounded-card border border-line bg-card p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-ink">编辑个人资料</h3>
        <div class="mt-4 space-y-4">
          <div>
            <label class="mb-1 block text-sm text-muted">头像</label>
            <div class="flex items-center gap-2">
              <input v-model="editForm.avatar" class="input" placeholder="粘贴图片链接或上传" />
              <button class="ghost-btn shrink-0" type="button" :disabled="uploadingAvatar" @click="triggerAvatarUpload">
                {{ uploadingAvatar ? '上传中…' : '上传' }}
              </button>
            </div>
            <input
              ref="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="hidden"
              @change="handleAvatarFile"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted">昵称</label>
            <input v-model="editForm.name" class="input" placeholder="你的昵称/姓名" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted">简介</label>
            <textarea v-model="editForm.bio" class="input" rows="2" placeholder="介绍一下自己"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted">地区</label>
            <input v-model="editForm.area" class="input" placeholder="如：湖南长沙" />
          </div>

          <!-- 社交媒体 -->
          <div class="border-t border-line pt-4">
            <label class="mb-2 block text-sm font-semibold text-ink">社交媒体</label>
            <div v-if="socials.length" class="mb-2 space-y-1.5">
              <div v-for="(s, i) in socials" :key="i" class="flex items-center gap-2">
                <span class="social-badge">
                  <svg viewBox="0 0 24 24" class="social-badge-svg"><path :d="socialIconPath(s.type)" fill="currentColor" /></svg>
                </span>
                <span class="flex-1 truncate text-sm">{{ socialLabel(s.type) }} · <span class="text-faint">{{ s.url }}</span></span>
                <button class="ghost-btn" type="button" @click="removeSocial(i)">删除</button>
              </div>
            </div>
            <p v-else class="mb-2 text-xs text-faint">还没有添加社交链接</p>
            <div class="flex items-center gap-2">
              <input v-model="newSocial.url" class="input" placeholder="链接地址（自动识别：GitHub/微信/QQ/Telegram/力扣/npm…）" />
              <button class="ghost-btn shrink-0" type="button" @click="addSocial">添加</button>
            </div>
            <p v-if="newSocial.url" class="mt-1 text-xs text-faint">
              识别为：
              <span class="inline-flex items-center gap-1 text-ink">
                <svg viewBox="0 0 24 24" class="social-badge-svg"><path :d="socialIconPath(newSocialType)" fill="currentColor" /></svg>
                {{ socialLabel(newSocialType) }}
              </span>
            </p>
            <div class="mt-2 flex items-center gap-2">
              <button class="ghost-btn shrink-0" type="button" :disabled="uploadingQr" @click="triggerQrUpload">
                {{ uploadingQr ? '上传中…' : '上传微信二维码' }}
              </button>
              <span class="text-xs text-faint">或上传二维码图片（作为微信）</span>
              <input
                ref="socialQrInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="handleQrFile"
              />
            </div>
          </div>

          <!-- 精选文章 -->
          <div class="border-t border-line pt-4">
            <label class="mb-2 block text-sm font-semibold text-ink">精选文章（主页展示，可排序）</label>
            <div v-if="featuredArticles.length" class="mb-2 space-y-1">
              <div v-for="(id, i) in featuredArticles" :key="id" class="flex items-center gap-2">
                <span class="flex-1 truncate text-sm">{{ articleTitle(id) }}</span>
                <button class="ghost-btn" type="button" :disabled="i === 0" @click="moveFeatured(i, -1)">↑</button>
                <button class="ghost-btn" type="button" :disabled="i === featuredArticles.length - 1" @click="moveFeatured(i, 1)">↓</button>
                <button class="ghost-btn" type="button" @click="toggleFeatured(id)">移除</button>
              </div>
            </div>
            <div v-if="myArticles.length" class="max-h-40 overflow-y-auto rounded-tag border border-line p-2">
              <label v-for="a in myArticles" :key="a.article_id" class="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                <input
                  type="checkbox"
                  :checked="featuredArticles.includes(Number(a.article_id))"
                  @change="toggleFeatured(a.article_id)"
                />
                <span class="truncate">{{ a.title }}</span>
              </label>
            </div>
            <p v-else-if="!featuredLoading" class="text-xs text-faint">还没有可精选的文章</p>
          </div>

          <!-- GitHub 绑定 -->
          <div class="border-t border-line pt-4">
            <label class="mb-2 block text-sm font-semibold text-ink">GitHub 绑定</label>
            <div v-if="isGithubBound" class="flex items-center gap-2">
              <span class="flex-1 text-sm">已绑定 GitHub（#{{ profile?.github_id }}）</span>
              <button class="ghost-btn" type="button" @click="unbindGithub">取消绑定</button>
            </div>
            <div v-else>
              <button class="ghost-btn" type="button" @click="bindGithub">绑定 GitHub</button>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button class="ghost-btn" @click="editVisible = false">取消</button>
          <button class="btn-accent" :disabled="editLoading" @click="submitEdit">
            {{ editLoading ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 二维码大图弹窗 -->
    <div
      v-if="qrVisible"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      @click.self="qrVisible = false"
    >
      <div class="rounded-card bg-card p-5 text-center">
        <img :src="qrUrl" alt="二维码" class="mx-auto max-h-[70vh] max-w-full rounded-tag" />
        <p class="mt-3 text-sm text-muted">长按保存 · 扫码添加</p>
        <button class="btn-accent mt-3" @click="qrVisible = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";

.profile-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background-color: var(--color-page);
  border-bottom: 1px solid var(--color-line);
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-tag);
  border: 1px solid var(--color-line);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.25rem;
  color: var(--color-body);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.ghost-btn:hover {
  background-color: color-mix(in oklab, var(--color-accent) 8%, transparent);
  color: var(--color-accent);
}
.ghost-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.card {
  @apply bg-card border border-line rounded-card p-6;
}

/* ---- Hero 横幅（动态渐变 + 漂浮光斑 + 浮动粒子） ---- */
.profile-hero {
  position: relative;
  margin-top: 24px;
  padding: 48px 32px 42px;
  border-radius: 18px;
  text-align: center;
  color: #fff;
  background: linear-gradient(135deg, #2c3e50, #405f7d, #1e3a5f, #4a6b8a, #2c3e50);
  background-size: 300% 300%;
  animation: heroGradient 8s ease infinite;
  overflow: hidden;
}
@keyframes heroGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.profile-hero::before {
  content: '';
  position: absolute;
  right: -60px;
  top: -60px;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16) 0%, transparent 70%);
  animation: heroOrb1 6s ease-in-out infinite;
}
.profile-hero::after {
  content: '';
  position: absolute;
  left: -40px;
  bottom: -80px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: heroOrb2 7s ease-in-out infinite;
}
@keyframes heroOrb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-46px, 34px) scale(1.25); }
}
@keyframes heroOrb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(38px, -24px) scale(1.2); }
}

/* 浮动粒子：分布在四角边缘，避开中央内容 */
.hero-particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  pointer-events: none;
  z-index: 1;
}
.hero-particle.p1 {
  width: 10px;
  height: 10px;
  left: 9%;
  top: 18%;
  animation: floatParticle 4.5s ease-in-out infinite;
}
.hero-particle.p2 {
  width: 7px;
  height: 7px;
  right: 11%;
  top: 24%;
  animation: floatParticle 5.5s ease-in-out 0.8s infinite;
}
.hero-particle.p3 {
  width: 12px;
  height: 12px;
  right: 15%;
  bottom: 14%;
  animation: floatParticle 6s ease-in-out 1.6s infinite;
}
@keyframes floatParticle {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
  50% { transform: translateY(-22px) scale(1.25); opacity: 1; }
}

.hero-avatar-wrap {
  position: relative;
  display: inline-block;
  z-index: 1;
}
.hero-avatar {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  background-color: #fff;
}
.hero-monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: 800;
  color: #34495e;
}
.hero-edit-btn {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background-color: #fff;
  color: #34495e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease;
}
.hero-edit-btn:hover {
  transform: scale(1.1);
}

.hero-name {
  margin-top: 18px;
  font-size: 30px;
  font-weight: 800;
  color: #fff;
  position: relative;
  z-index: 1;
}
.hero-username {
  margin-top: 4px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  position: relative;
  z-index: 1;
}
.hero-username-area {
  color: rgba(255, 255, 255, 0.55);
}

/* VIP 缎带横幅：斜挂在 Hero 顶部，上部被框顶边缘裁剪出"挂"的效果 */
.hero-ribbon {
  position: absolute;
  top: 15px;
  right: -50px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 70px;
  border-radius: 0 0 10px 10px;
  background: linear-gradient(135deg, #f6b93b, #e58e26);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  pointer-events: none;
  transform: rotate(45deg);
}
.ribbon-svg {
  width: 15px;
  height: 15px;
}
.hero-bio {
  margin: 14px auto 0;
  max-width: 560px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.85);
  position: relative;
  z-index: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 社交图标行 */
.hero-socials {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}
.hero-social-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.16);
  color: #fff;
  text-decoration: none;
  transition: background-color 0.2s ease, transform 0.2s ease;
}
.hero-social-btn:hover {
  background-color: rgba(255, 255, 255, 0.32);
  transform: translateY(-2px);
}
.hero-social-btn .social-svg {
  width: 18px;
  height: 18px;
}
/* 社交名 tip */
.hero-social-btn::after {
  content: attr(data-label);
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: #303133;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 10;
}
.hero-social-btn:hover::after {
  opacity: 1;
}

/* 编辑弹窗内社交徽标 */
.social-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background-color: var(--color-accent);
  color: var(--color-on-accent);
  flex-shrink: 0;
}
.social-badge-svg {
  width: 14px;
  height: 14px;
}
</style>
