<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticle } from '@/api/article'
import { renderMarkdown } from '@/utils/markdown'
import { formatDate } from '@/utils/format'
import { useToastStore } from '@/stores/toast'
import { useAuthorStore } from '@/stores/author'
import { useAuthStore } from '@/stores/auth'
import CommentSection from '@/components/CommentSection.vue'
import ShareModal from '@/components/ShareModal.vue'
import AdSlot from '@/components/AdSlot.vue'
import { toggleLike, toggleFavorite, getSocialStatus } from '@/api/social'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const authorStore = useAuthorStore()
const auth = useAuthStore()

const article = ref(null)
const loading = ref(true)
const notFound = ref(false)

const html = computed(() => renderMarkdown(article.value?.content))
const shareVisible = ref(false)

// ===== 点赞 / 收藏 =====
const liked = ref(false)
const favorited = ref(false)
const likeCount = ref(0)
const favCount = ref(0)
const actionLoading = ref(false)

const loadSocialStatus = async () => {
  if (!auth.isLoggedIn || !article.value) return
  try {
    const res = await getSocialStatus([article.value.article_id])
    if (res && res.data) {
      liked.value = res.data.likes.includes(Number(article.value.article_id))
      favorited.value = res.data.favorites.includes(Number(article.value.article_id))
    }
  } catch (e) {
    // 状态查询失败不阻塞
  }
}

const doLike = async () => {
  if (!auth.isLoggedIn) {
    toast.error('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  actionLoading.value = true
  try {
    const res = await toggleLike(article.value.article_id)
    // social.js 已解包 body，res 即 { liked, count }
    liked.value = !!res?.liked
    likeCount.value = Number(res?.count) || 0
  } catch (e) {
    toast.error(e?.response?.data?.message || e.message || '操作失败')
  } finally {
    actionLoading.value = false
  }
}

const doFavorite = async () => {
  if (!auth.isLoggedIn) {
    toast.error('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  actionLoading.value = true
  try {
    const res = await toggleFavorite(article.value.article_id)
    // social.js 已解包 body，res 即 { favorited, count }
    favorited.value = !!res?.favorited
    favCount.value = Number(res?.count) || 0
    toast.success(res?.favorited ? '已收藏' : '已取消收藏')
  } catch (e) {
    toast.error(e?.response?.data?.message || e.message || '操作失败')
  } finally {
    actionLoading.value = false
  }
}

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
    loadSocialStatus()
  } catch (e) {
    notFound.value = true
    toast.error(e.message || '文章加载失败')
  } finally {
    loading.value = false
    await nextTick()
    enhanceCodeBlocks()
    bindCodeEvents()
  }
})

// 内容变化（如后续切换文章）时重新增强代码块
watch(html, async () => {
  await nextTick()
  enhanceCodeBlocks()
})

// 给 .prose pre.hljs 包上 mac 风格标题栏，并处理折叠/复制
function enhanceCodeBlocks() {
  document.querySelectorAll('.prose pre.hljs').forEach((pre) => {
    if (pre.closest('.code-block')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'code-block'
    const code = pre.querySelector('code')
    const lang = pre.getAttribute('data-lang') || 'text'
    const lines = code ? code.textContent.split('\n').filter((l) => l.trim()).length : 0

    const bar = document.createElement('div')
    bar.className = 'code-bar'
    bar.innerHTML =
      '<span class="code-dots"><i class="dot-r"></i><i class="dot-y"></i><i class="dot-g"></i></span>' +
      '<span class="code-lang"></span>' +
      '<span class="code-actions">' +
      (lines >= 6 ? '<button class="code-fold" type="button">折叠</button>' : '') +
      '<button class="code-copy" type="button">复制</button>' +
      '</span>'
    bar.querySelector('.code-lang').textContent = lang

    pre.parentNode.insertBefore(wrapper, pre)
    wrapper.appendChild(bar)
    wrapper.appendChild(pre)
  })
}

// 复制文本（clipboard API + 降级 execCommand）
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy failed'))
    } catch (e) {
      reject(e)
    } finally {
      document.body.removeChild(ta)
    }
  })
}

// 复制 + 折叠（事件委托，一次绑定）
function bindCodeEvents() {
  const proseEl = document.querySelector('.prose')
  if (!proseEl) return
  proseEl.addEventListener('click', (e) => {
    const foldBtn = e.target.closest('.code-fold')
    if (foldBtn) {
      const block = foldBtn.closest('.code-block')
      block.classList.toggle('folded')
      foldBtn.textContent = block.classList.contains('folded') ? '展开' : '折叠'
      return
    }
    const copyBtn = e.target.closest('.code-copy')
    if (copyBtn) {
      const block = copyBtn.closest('.code-block')
      const code = block.querySelector('pre code')
      const text = code ? code.textContent : ''
      copyText(text)
        .then(() => {
          copyBtn.textContent = '已复制 ✓'
          setTimeout(() => (copyBtn.textContent = '复制'), 1500)
        })
        .catch(() => {})
    }
  })
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
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span class="font-medium text-body">{{ article.author_name || '匿名' }}</span>
            <span class="text-faint">·</span>
            <time>{{ formatDate(article.created_at) }}</time>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <!-- 点赞 -->
            <button
              class="action-btn"
              :class="{ 'action-btn-active': liked }"
              type="button"
              :disabled="actionLoading"
              :title="liked ? '取消点赞' : '点赞'"
              @click="doLike"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
              <span>{{ liked ? '已赞' : '点赞' }}</span>
              <span v-if="likeCount" class="action-count">{{ likeCount }}</span>
            </button>
            <!-- 收藏 -->
            <button
              class="action-btn"
              :class="{ 'action-btn-active': favorited }"
              type="button"
              :disabled="actionLoading"
              :title="favorited ? '取消收藏' : '收藏'"
              @click="doFavorite"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>{{ favorited ? '已收藏' : '收藏' }}</span>
              <span v-if="favCount" class="action-count">{{ favCount }}</span>
            </button>
            <button class="share-icon-btn" type="button" title="分享" aria-label="分享" @click="shareVisible = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
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

      <!-- 正文顶部广告位 -->
      <AdSlot position="article_top" />

      <!-- Markdown 正文 -->
      <div class="prose" v-html="html"></div>

      <!-- 评论区上方广告位 -->
      <AdSlot position="article_bottom" />

      <CommentSection :article-id="article.article_id" />
    </article>

    <ShareModal v-if="shareVisible" :article="article" @close="shareVisible = false" />
  </div>
</template>

<style scoped>
@reference "../style.css";
.card {
  @apply bg-card border border-line rounded-card p-6;
}

.share-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.share-icon-btn:hover {
  background-color: color-mix(in oklab, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
}
.share-icon-btn svg {
  width: 18px;
  height: 18px;
}

/* 点赞 / 收藏按钮 */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-line);
  background: transparent;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
}
.action-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.action-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.action-btn svg {
  width: 16px;
  height: 16px;
}
.action-count {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.85;
}
.action-btn-active {
  border-color: var(--color-accent);
  background-color: color-mix(in oklab, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
}
</style>
