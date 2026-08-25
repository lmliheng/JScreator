<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownCom from '@/components/MarkdownCom.vue'
import { ElMessage } from 'element-plus'
import {
    requestArticleAdd,
    requestArticleUpdate,
    requestArticleDetail,
    requestArticleCategoryList
} from '@/composables/useRequest'

const route = useRoute()
const router = useRouter()

// 编辑模式：路由带 id（query 优先，兼容 params）
const articleId = computed(() => {
    const id = route.query.id ?? route.params.id
    return id ? Number(id) : null
})
const isEdit = computed(() => !!articleId.value)

const loading = ref(false)
const submitting = ref(false)
const categoryList = ref([])

const form = reactive({
    title: '',
    content: '',
    category_ids: [],
    status: 1 // 0-草稿，1-已发布，2-仅自己可见
})

const statusOptions = [
    { value: 0, label: '草稿' },
    { value: 1, label: '已发布' },
    { value: 2, label: '仅自己可见' }
]

const getCategories = async () => {
    try {
        const res = await requestArticleCategoryList()
        categoryList.value = res.data?.list || []
    } catch (e) {
        // 分类加载失败不阻塞编辑
        console.error(e)
    }
}

const getDetail = async () => {
    if (!articleId.value) return
    loading.value = true
    try {
        const res = await requestArticleDetail(articleId.value)
        const d = res.data || {}
        form.title = d.title || ''
        form.content = d.content || ''
        form.category_ids = Array.isArray(d.category_ids) ? d.category_ids : []
        form.status = d.status ?? 1
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '获取文章详情失败')
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    if (!form.title || !form.title.trim()) {
        ElMessage.warning('请输入文章标题')
        return
    }
    if (!form.content || !form.content.trim()) {
        ElMessage.warning('请输入文章内容')
        return
    }
    submitting.value = true
    try {
        const payload = {
            title: form.title.trim(),
            content: form.content,
            category_ids: form.category_ids || [],
            status: Number(form.status)
        }
        if (isEdit.value) {
            await requestArticleUpdate(articleId.value, payload)
            ElMessage.success('文章更新成功')
        } else {
            await requestArticleAdd(payload)
            ElMessage.success('文章创建成功')
        }
        router.push('/article/article-manage')
    } catch (e) {
        ElMessage.error(e?.response?.data?.message || '提交失败')
    } finally {
        submitting.value = false
    }
}

const handleBack = () => {
    router.push('/article/article-manage')
}

onMounted(() => {
    getCategories()
    getDetail()
})
</script>

<template>
    <div v-loading="loading">
        <div class="article-create-header">
            <span class="page-title">{{ isEdit ? '编辑文章' : '写文章' }}</span>
            <el-button @click="handleBack">返回列表</el-button>
        </div>

        <el-form :model="form" label-width="80px">
            <el-form-item label="标题" required>
                <el-input
                    v-model="form.title"
                    placeholder="请输入文章标题"
                    maxlength="200"
                    show-word-limit
                />
            </el-form-item>

            <el-form-item label="分类">
                <el-select
                    v-model="form.category_ids"
                    multiple
                    clearable
                    placeholder="请选择分类（可多选）"
                    style="width: 100%"
                >
                    <el-option
                        v-for="c in categoryList"
                        :key="c.category_id"
                        :label="c.category_name"
                        :value="c.category_id"
                    />
                </el-select>
            </el-form-item>

            <el-form-item label="状态">
                <el-radio-group v-model="form.status">
                    <el-radio v-for="s in statusOptions" :key="s.value" :value="s.value">
                        {{ s.label }}
                    </el-radio>
                </el-radio-group>
            </el-form-item>

            <el-form-item label="内容" required>
                <MarkdownCom v-model="form.content" />
            </el-form-item>
        </el-form>

        <div class="article-create-footer">
            <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
                {{ isEdit ? '保存修改' : '提交' }}
            </el-button>
        </div>
    </div>
</template>

<style scoped>
.article-create-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.page-title {
    font-size: 18px;
    font-weight: bold;
}

.article-create-footer {
    text-align: right;
    margin-top: 8px;
}
</style>
