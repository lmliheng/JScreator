<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getBlogProfile } from '@/api/blog'
import { updateProfile } from '@/api/auth'
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
const loading = ref(false)
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

// 编辑资料弹窗
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
  editVisible.value = true
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
    })
    toast.success('资料已更新')
    editVisible.value = false
    // 同步更新本地登录态缓存
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
    <!-- 顶部导航条：右侧登录/注册/编辑入口 -->
    <header class="profile-topbar">
      <div class="mx-auto flex max-w-5xl items-center justify-end gap-3 px-4 py-3">
        <div class="flex items-center gap-2">
          <template v-if="isSelf">
            <button class="ghost-btn" @click="openEdit">Edit</button>
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

    <main class="mx-auto max-w-5xl px-4 py-8">
      <!-- 加载中 -->
      <p v-if="loading" class="py-16 text-center text-faint">加载中…</p>

      <!-- 用户不存在 -->
      <div v-else-if="notFound" class="card py-16 text-center">
        <p class="text-lg font-bold text-ink">用户不存在</p>
        <p class="mt-2 text-sm text-muted">没有找到名为「{{ username }}」的博客主页。</p>
        <RouterLink to="/" class="btn-accent mt-6">返回首页</RouterLink>
      </div>

      <!-- 两栏：左用户信息 + 右文章 -->
      <div v-else class="flex flex-col gap-8 md:flex-row">
        <!-- 左侧：用户信息（hugo-theme-stack 侧边栏风格） -->
        <aside class="shrink-0 md:w-72">
          <div class="card text-center">
            <!-- 头像（自己的主页时带编辑图标） -->
            <div class="relative mx-auto h-24 w-24">
              <span v-if="avatar" class="block h-24 w-24 overflow-hidden rounded-full">
                <img :src="avatar" :alt="displayName" class="h-full w-full object-cover" />
              </span>
              <span v-else class="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-3xl font-bold text-on-accent">
                {{ monogram }}
              </span>
              <button
                v-if="isSelf"
                class="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm transition-transform hover:scale-110"
                title="编辑头像与资料"
                @click="openEdit"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>

            <!-- 昵称 -->
            <h1 class="mt-4 text-xl font-bold leading-tight text-ink">{{ displayName }}</h1>
            <p class="mt-1 text-sm text-faint">@{{ username }}</p>

            <!-- 简介 -->
            <p v-if="bio" class="mt-3 text-sm leading-relaxed text-body">{{ bio }}</p>

            <!-- 信息 -->
            <dl class="mt-4 space-y-2 text-sm text-muted">
              <div v-if="area" class="flex items-center justify-center gap-2">
                <dt class="text-faint">地区</dt>
                <dd>{{ area }}</dd>
              </div>
              <div v-if="vip" class="flex items-center justify-center gap-2">
                <dt class="text-faint">会员</dt>
                <dd class="rounded-tag bg-accent/10 px-2 py-0.5 text-accent">VIP {{ vip }}</dd>
              </div>
              <div class="flex items-center justify-center gap-2">
                <dt class="text-faint">文章</dt>
                <dd>{{ total }} 篇</dd>
              </div>
            </dl>
          </div>
        </aside>

        <!-- 右侧：最新文章卡片 -->
        <section class="min-w-0 flex-1">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-bold uppercase tracking-wide text-faint">最新文章</h2>
            <RouterLink
              v-if="total > 4"
              :to="`/${username}/articles`"
              class="text-sm font-medium text-accent hover:text-accent-strong"
            >查看全部 {{ total }} 篇 →</RouterLink>
          </div>
          <div v-if="articles.length" class="grid gap-6 sm:grid-cols-2">
            <ArticleCard v-for="a in articles" :key="a.article_id" :article="a" />
          </div>
          <div v-else class="card py-16 text-center text-faint">还没有发布任何文章</div>
        </section>
      </div>
    </main>

    <!-- 底部注册引导（仅对访客展示） -->
    <footer v-if="!isSelf" class="mx-auto max-w-5xl px-4 pb-10 pt-2 text-center">
      <p class="text-sm text-muted">
        你也想创建你的博客？
        <RouterLink to="/register" class="font-medium text-accent hover:text-accent-strong">请注册JScreate吧~</RouterLink>
      </p>
    </footer>

    <!-- 编辑资料弹窗（纯 Tailwind） -->
    <div
      v-if="editVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="editVisible = false"
    >
      <div class="w-full max-w-md rounded-card border border-line bg-card p-6">
        <h3 class="text-lg font-bold text-ink">编辑个人资料</h3>
        <div class="mt-4 space-y-4">
          <div>
            <label class="mb-1 block text-sm text-muted">头像 URL</label>
            <input v-model="editForm.avatar" class="input" placeholder="粘贴头像图片链接" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted">昵称</label>
            <input v-model="editForm.name" class="input" placeholder="你的昵称/姓名" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted">简介</label>
            <textarea v-model="editForm.bio" class="input" rows="3" placeholder="介绍一下自己"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm text-muted">地区</label>
            <input v-model="editForm.area" class="input" placeholder="如：湖南长沙" />
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

.card {
  @apply bg-card border border-line rounded-card p-6;
}
</style>
