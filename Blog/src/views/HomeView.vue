<script setup>
import { ref, computed, onMounted } from 'vue'
import { getBlogUsers } from '@/api/blog'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import Pagination from '@/components/Pagination.vue'

const auth = useAuthStore()
const toast = useToastStore()

const displayName = computed(() => auth.displayName || 'JScreator')

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 24
const loading = ref(false)

async function fetchUsers() {
  loading.value = true
  try {
    const data = await getBlogUsers({ page: page.value, pageSize })
    list.value = (data && data.list) || []
    total.value = Number(data && data.total) || 0
  } catch (e) {
    toast.error(e.message || '用户列表加载失败')
  } finally {
    loading.value = false
  }
}

function changePage(p) {
  page.value = p
  fetchUsers()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function userName(u) {
  return u.name || u.username || '匿名'
}

function monogram(u) {
  return userName(u).trim().charAt(0).toUpperCase()
}

onMounted(fetchUsers)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <header class="mb-6">
      <h1 class="text-3xl font-bold tracking-tight text-ink">博主</h1>
      <p class="mt-2 text-muted">发现并关注你感兴趣的博主。</p>
    </header>

    <!-- 登录引导 -->
    <section
      v-if="!auth.isLoggedIn"
      class="mb-6 flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-card p-6 sm:flex-row sm:items-center md:p-8"
    >
      <div>
        <h2 class="text-lg font-bold text-ink">欢迎来到 JScreator 的博客</h2>
        <p class="mt-1 text-sm text-muted">登录后即可参与评论等互动，获得更完整的阅读体验。</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <RouterLink to="/login" class="btn-accent">登录</RouterLink>
        <RouterLink to="/register" class="secondary-btn">注册</RouterLink>
      </div>
    </section>
    <section v-else class="mb-6 rounded-card border border-line bg-card p-6 md:p-8">
      <h2 class="text-lg font-bold text-ink">欢迎回来，{{ displayName }}</h2>
      <p class="mt-1 text-sm text-muted">在下方选择一个博主的主页开始阅读。</p>
    </section>

    <!-- 用户列表 -->
    <p v-if="loading" class="py-16 text-center text-faint">加载中…</p>
    <div v-else-if="list.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="u in list"
        :key="u.id"
        :to="`/${u.username}`"
        class="group flex flex-col gap-4 rounded-card border border-line bg-card p-6 transition-shadow hover:shadow-sm"
      >
        <div class="flex items-center gap-4">
          <span v-if="u.avatar" class="h-14 w-14 shrink-0 overflow-hidden rounded-full">
            <img :src="u.avatar" :alt="userName(u)" class="h-full w-full object-cover" />
          </span>
          <span v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-on-accent">
            {{ monogram(u) }}
          </span>
          <div class="min-w-0">
            <div class="truncate text-lg font-bold text-ink group-hover:text-accent">{{ userName(u) }}</div>
            <div class="truncate text-xs text-faint">@{{ u.username }}</div>
          </div>
        </div>

        <p v-if="u.bio" class="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">{{ u.bio }}</p>
        <p v-else class="min-h-[2.5rem] text-sm text-faint">这位博主还没有写简介。</p>

        <div class="flex items-center justify-between text-xs text-faint">
          <span v-if="u.area">{{ u.area }}</span>
          <span v-else></span>
          <span class="rounded-tag bg-accent/10 px-2 py-0.5 text-accent">{{ u.article_count }} 篇文章</span>
        </div>
      </RouterLink>
    </div>
    <div v-else class="card py-16 text-center text-faint">还没有博主</div>

    <Pagination :page="page" :page-size="pageSize" :total="total" unit="位" @change="changePage" />
  </div>
</template>

<style scoped>
@reference "../style.css";
.secondary-btn {
  @apply rounded-tag border border-line px-4 py-2 text-sm text-body hover:bg-card;
}
</style>
