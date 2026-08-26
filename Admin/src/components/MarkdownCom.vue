<script setup>
    import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

    import Editor from '@toast-ui/editor';
    import '@toast-ui/editor/dist/toastui-editor.css';
    import '@toast-ui/editor/dist/i18n/zh-cn';
    import { api } from '@/composables/useAxiosConfig'
    import { ElMessage } from 'element-plus'

    const props = defineProps({
        // markdown 内容（v-model）
        modelValue: {
            type: String,
            default: ''
        },
        height: {
            type: String,
            default: '650px'
        },
        placeholder: {
            type: String,
            default: '请输入文章内容…'
        }
    })
    const emit = defineEmits(['update:modelValue', 'fullscreen-change'])

    const editorEl = ref(null)
    const isFullscreen = ref(false)
    let editor = null

    onMounted(() => {
        editor = new Editor({
            el: editorEl.value,
            language: 'zh-CN',
            height: props.height,
            initialEditType: 'markdown',
            previewStyle: 'vertical',
            placeholder: props.placeholder,
            initialValue: props.modelValue || '',
            hooks: {
                // 工具栏/拖拽/粘贴图片：上传到阿里 OSS 后把 URL 插入 markdown
                addImageBlobHook: async (blob, callback) => {
                    const formData = new FormData()
                    formData.append('image', blob)
                    try {
                        const res = await api.post('/upload/image', formData)
                        if (res && res.data && res.data.url) {
                            callback(res.data.url, blob.name || 'image')
                        } else {
                            ElMessage.error((res && res.message) || '图片上传失败')
                        }
                    } catch (e) {
                        ElMessage.error(e?.response?.data?.message || '图片上传失败')
                    }
                },
            },
        })
        // 用户编辑时同步 markdown 内容给父组件
        editor.on('change', () => {
            emit('update:modelValue', editor.getMarkdown())
        })
        // 全屏时 Esc 退出
        window.addEventListener('keydown', handleEsc)
    })

    // 父组件（编辑场景）异步回填内容时同步进编辑器
    watch(() => props.modelValue, (val) => {
        if (editor && val !== editor.getMarkdown()) {
            editor.setMarkdown(val || '')
        }
    })

    const handleEsc = (e) => {
        if (e.key === 'Escape' && isFullscreen.value) {
            setFullscreen(false)
        }
    }

    const setFullscreen = (v) => {
        isFullscreen.value = v
        // 通知父组件（父组件据此显示/隐藏全屏 overlay）
        emit('fullscreen-change', v)
        // 全屏时编辑器高度铺满
        if (editor) {
            editor.setHeight(v ? '100%' : props.height)
        }
        if (v) {
            requestAnimationFrame(() => {
                const el = editorEl.value
                if (el && el.querySelector('.toastui-editor-md-container')) {
                    el.querySelector('.toastui-editor-md-container').style.height = '100%'
                }
            })
        }
    }

    const toggleFullscreen = () => setFullscreen(!isFullscreen.value)

    const getMarkdown = () => (editor ? editor.getMarkdown() : props.modelValue)
    const getHTML = () => (editor ? editor.getHTML() : '')

    defineExpose({ getMarkdown, getHTML, toggleFullscreen, setFullscreen })

    onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleEsc)
        if (editor) {
            editor.destroy()
            editor = null
        }
    })
</script>
<template>
    <div class="editor-shell" :class="{ 'editor-fullscreen': isFullscreen }">
        <div ref="editorEl" class="editor-body"></div>
        <!-- 全屏切换按钮 -->
        <button
            class="editor-fs-btn"
            type="button"
            :title="isFullscreen ? '退出全屏 (Esc)' : '全屏书写'"
            @click="toggleFullscreen"
        >
            <svg v-if="!isFullscreen" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
        </button>
    </div>
</template>

<style scoped>
/* ---- 编辑器外观定制（现代风格，与 Element Plus 统一） ---- */
.editor-shell {
    position: relative;
    width: 100%;
}
.editor-fullscreen {
    height: 100%;
}

/* 编辑器容器圆角卡片 */
.editor-body :deep(.toastui-editor-defaultUI) {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
}
.editor-body :deep(.toastui-editor-defaultUI-toolbar) {
    background: #fafafa;
    border-bottom: 1px solid #ebeef5;
    padding: 6px 10px;
}
.editor-body :deep(.toastui-editor-toolbar-group) {
    border-right: 1px solid #ebeef5;
}
.editor-body :deep(.toastui-editor-toolbar-icons) {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    transition: background-color 0.15s ease;
}
.editor-body :deep(.toastui-editor-toolbar-icons:hover) {
    background: #ecf5ff;
}
.editor-body :deep(.toastui-editor-toolbar-icons.active) {
    background: #d9ecff;
}
.editor-body :deep(.toastui-editor-md-container) {
    background: #fff;
}
.editor-body :deep(.toastui-editor-contents) {
    font-size: 15px;
    line-height: 1.8;
}
.editor-body :deep(.toastui-editor-md-splitter) {
    border-left: 1px solid #ebeef5;
}
.editor-body :deep(.toastui-editor-md-preview) {
    background: #fbfbfd;
}

/* 全屏切换按钮：悬浮在编辑器右上角 */
.editor-fs-btn {
    position: absolute;
    top: 48px;
    right: 12px;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    background: #fff;
    color: #606266;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: color 0.15s ease, border-color 0.15s ease;
}
.editor-fs-btn:hover {
    color: #409eff;
    border-color: #409eff;
}
</style>
