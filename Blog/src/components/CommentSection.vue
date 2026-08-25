<script setup>
import { ref, onMounted } from 'vue'
import { listComments, addComment } from '@/api/comment'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import CommentItem from './CommentItem.vue'

const props = defineProps({
  articleId: { type: [String, Number], required: true },
})

const auth = useAuthStore()
const toast = useToastStore()

const comments = ref([])
const loading = ref(true)

const nickname = ref('')
const content = ref('')
const submitting = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await listComments(props.articleId)
    // 后端返回 data = { list: [顶层评论] }；兼容纯数组兜底
    comments.value = (data && (data.list || (Array.isArray(data) ? data : []))) || []
  } catch (e) {
    comments.value = []
    toast.error(e.message || '评论加载失败')
  } finally {
    loading.value = false
  }
}

// 供顶层表单与楼中楼回复共用，返回是否成功
async function submitComment(payload) {
  if (submitting.value) return false
  if (!payload.content.trim()) {
    toast.error('评论内容不能为空')
    return false
  }
  if (!auth.isLoggedIn && !(payload.nickname || '').trim()) {
    toast.error('请填写昵称')
    return false
  }
  submitting.value = true
  try {
    await addComment({
      article_id: props.articleId,
      content: payload.content.trim(),
      parent_id: payload.parent_id || null,
      // 登录用户不传昵称（后端取用户名）；匿名传昵称
      nickname: auth.isLoggedIn ? undefined : (payload.nickname || '').trim(),
    })
    toast.success('评论成功')
    await load()
    return true
  } catch (e) {
    toast.error(e.message || '评论失败')
    return false
  } finally {
    submitting.value = false
  }
}

function submitTop() {
  const text = content.value.trim()
  if (!text) return
  const ok = submitComment({
    content: text,
    nickname: auth.isLoggedIn ? undefined : nickname.value.trim(),
  })
  ok.then((success) => {
    if (success) content.value = ''
  })
}

onMounted(load)
</script>

<template>
  <section class="mt-10">
    <h2 class="text-xl font-semibold text-ink">评论</h2>

    <!-- 发表评论 -->
    <div class="card mt-4">
      <input
        v-if="!auth.isLoggedIn"
        v-model="nickname"
        type="text"
        maxlength="50"
        placeholder="昵称（匿名评论必填）"
        class="input mb-3"
      />
      <textarea
        v-model="content"
        rows="3"
        class="input resize-y"
        :placeholder="auth.isLoggedIn ? `以 ${auth.username} 的身份发表评论` : '写下你的评论…'"
      />
      <div class="mt-3 flex items-center justify-between">
        <span class="text-xs text-faint">
          {{ auth.isLoggedIn ? `已登录：${auth.username}` : '未登录，将以匿名身份发表' }}
        </span>
        <button class="btn-accent disabled:opacity-60" :disabled="submitting" @click="submitTop">
          {{ submitting ? '提交中…' : '发表评论' }}
        </button>
      </div>
    </div>

    <!-- 评论列表 -->
    <div class="mt-6">
      <p v-if="loading" class="text-sm text-faint">评论加载中…</p>
      <p v-else-if="!comments.length" class="text-sm text-faint">还没有评论，来抢沙发～</p>
      <div v-else class="space-y-5">
        <CommentItem
          v-for="c in comments"
          :key="c.comment_id"
          :comment="c"
          :is-logged-in="auth.isLoggedIn"
          :nickname-hint="nickname"
          :submit="submitComment"
        />
      </div>
    </div>
  </section>
</template>
