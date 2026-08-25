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
            default: '500px'
        },
        placeholder: {
            type: String,
            default: '请输入文章内容…'
        }
    })
    const emit = defineEmits(['update:modelValue'])

    const editorEl = ref(null)
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
                        const res = await api.post('/upload/image', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        })
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
    })

    // 父组件（编辑场景）异步回填内容时同步进编辑器
    watch(() => props.modelValue, (val) => {
        if (editor && val !== editor.getMarkdown()) {
            editor.setMarkdown(val || '')
        }
    })

    const getMarkdown = () => (editor ? editor.getMarkdown() : props.modelValue)
    const getHTML = () => (editor ? editor.getHTML() : '')

    defineExpose({ getMarkdown, getHTML })

    onBeforeUnmount(() => {
        if (editor) {
            editor.destroy()
            editor = null
        }
    })
</script>
<template>
   <div ref="editorEl" style="width: 100%;"></div>
</template>
