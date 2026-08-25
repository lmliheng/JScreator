<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getBlogProfile, getBlogArticles } from '@/api/blog'
import { useToastStore } from '@/stores/toast'
import ArticleCard from '@/components/ArticleCard.vue'
import Pagination from '@/components/Pagination.vue'

const route = useRoute()
const toast = useToastStore()

const username = computed(() => String(route.params.username || ''))

const profile = ref(null)
const articles = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
const loading = ref(false)

const displayName = computed(
  () => (profile.value && (profile.value.name || profile.value.username)) || username.value || '用户',
)

// 只取用户昵称（顺带取 1 篇文章即可，文章列表用单独接口分页）
async function fetchProfile() {
  try {
    const data = await getBlogProfile(username.value, { page: 1, pageSize: 1 })
    profile.value = (data && data.user) || null
  } catch (e) {
    profile.value = null
  }
}

async function fetchArticles() {
  if (!username.value) return
  loading.value = true
  try {
    const data = await getBlogArticles(username.value, { page: page.value, pageSize })
    articles.value = (data && data.list) || []
    total.value = Number(data && data.total) || 0
    document.title = `${displayName.value}的全部文章`
  } catch (e) {
    toast.error(e.message || '文章加载失败')
  } finally {
    loading.value = false
  }
}

function changePage(p) {
  page.value = p
  fetchArticles()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(username, () => {
  page.value = 1
  fetchProfile()
  fetchArticles()
})

onMounted(() => {
  fetchProfile()
  fetchArticles()
})
</script>

<template>
  <div class="min-h-screen bg-page text-body antialiased">
    <!-- 顶部导航条 -->
    <header class="profile-topbar">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <RouterLink :to="`/${username}`" class="ghost-btn">← 返回主页</RouterLink>
        <span class="truncate text-sm text-muted">@{{ username }}</span>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-8">
      <!-- 标题 -->
      <header class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight text-ink">{{ displayName }} 的全部文章</h1>
        <p class="mt-1 text-sm text-muted">共 {{ total }} 篇</p>
      </header>

      <!-- 文章列表 -->
      <p v-if="loading" class="py-16 text-center text-faint">加载中…</p>
      <div v-else-if="articles.length" class="grid gap-6 sm:grid-cols-2">
        <ArticleCard v-for="a in articles" :key="a.article_id" :article="a" />
      </div>
      <div v-else class="card py-16 text-center text-faint">还没有发布任何文章</div>

      <Pagination :page="page" :page-size="pageSize" :total="total" @change="changePage" />
    </main>
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
