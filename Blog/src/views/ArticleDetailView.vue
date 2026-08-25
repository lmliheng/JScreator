<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getArticle } from '@/api/article'
import { renderMarkdown } from '@/utils/markdown'
import { formatDate } from '@/utils/format'
import { useToastStore } from '@/stores/toast'
import { useAuthorStore } from '@/stores/author'
import CommentSection from '@/components/CommentSection.vue'

const route = useRoute()
const toast = useToastStore()
const authorStore = useAuthorStore()

const article = ref(null)
const loading = ref(true)
const notFound = ref(false)

const html = computed(() => renderMarkdown(article.value?.content))

onMounted(async () => {
  loading.value = true
  try {
    article.value = await getArticle(route.params.id)
    // 把文章作者写入全局作者上下文，供左侧 Sidebar 展示该作者信息
    authorStore.setAuthor({
      username: article.value.author_username || '',
      name: article.value.author_name || '',
      avatar: article.value.author_avatar || '',
      bio: article.value.author_bio || '',
    })
    // tab 标题 + 头像 favicon（跟随文章作者）
    const authorDisplay = article.value.author_name || article.value.author_username || ''
    document.title = authorDisplay ? `${authorDisplay}的博客` : '博客'
    if (article.value.author_avatar) {
      setFavicon(article.value.author_avatar)
    }
  } catch (e) {
    notFound.value = true
    toast.error(e.message || '文章加载失败')
  } finally {
    loading.value = false
  }
})

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

onBeforeUnmount(() => {
  authorStore.clear()
  const link = document.querySelector("link[rel='icon']")
  if (link) link.href = '/vite.svg'
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <p v-if="loading" class="py-16 text-center text-faint">加载中…</p>

    <div v-else-if="notFound || !article" class="card py-16 text-center">
      <p class="text-faint">文章不存在或未公开</p>
      <RouterLink to="/" class="mt-4 inline-block text-sm text-accent hover:text-accent-strong">返回首页</RouterLink>
    </div>

    <article v-else>
      <header class="mb-8">
        <h1 class="text-3xl font-bold leading-tight tracking-tight text-ink">{{ article.title }}</h1>
        <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span class="font-medium text-body">{{ article.author_name || '匿名' }}</span>
          <span class="text-faint">·</span>
          <time>{{ formatDate(article.created_at) }}</time>
        </div>
        <div v-if="(article.category_names || []).length" class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="name in article.category_names"
            :key="name"
            class="rounded-full bg-card px-3 py-1 text-sm text-muted"
          >
            {{ name }}
          </span>
        </div>
      </header>

      <!-- Markdown 正文 -->
      <div class="prose" v-html="html"></div>

      <CommentSection :article-id="article.article_id" />
    </article>
  </div>
</template>

<style scoped>
@reference "../style.css";
.card {
  @apply bg-card border border-line rounded-card p-6;
}
</style>
