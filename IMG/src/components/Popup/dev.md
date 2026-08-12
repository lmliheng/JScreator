| 属性 | 类型 | 参考值 | 默认值 | 必填 |
|------|------|--------|--------|------|
| modelValue | Boolean | - | false | 是 |
| PopupPosition | string | 'center', 'top', 'bottom', 'left', 'right' | 'center' | 否 |
| maskClosable | Boolean | - | true | 否 |
| lockScroll | Boolean | - | true | 否 |
| zIndex | Number | - | 1000 | 否 |
| width | [String, Number] | - | 'auto' | 否 |
| height | [String, Number] | - | 'auto' | 否 |

## 插槽

| 名称 | 说明 |
|------|------|
| 默认插槽 | 弹窗内容 |

## 事件

| 事件 | 描述 |
|------|------|
| update:modelValue | 控制弹窗显示隐藏 |
| open | 弹窗打开时触发 |
| close | 弹窗关闭时触发 |
| mask-click | 点击遮罩层时触发 |

---

建议：
1. modelValue 建议改为 `v-model:visible` 或 `v-model`，更符合 Vue3 规范
2. 建议添加 `title` 插槽或 `title` 属性，支持弹窗标题
3. 建议添加 `footer` 插槽，支持自定义底部操作按钮
4. 建议添加 `close` 事件（除 mask-click 外），支持多种关闭方式（ESC 键、关闭按钮）
5. 建议添加 `transition` 属性，支持自定义过渡动画
6. lockScroll 实现已考虑 scrollBarWidth，建议提取为独立 hook 复用
7. 建议添加 `destroy-on-close` 属性，支持关闭时销毁内容
8. 建议支持 dialog 类型（带标题栏和操作栏）