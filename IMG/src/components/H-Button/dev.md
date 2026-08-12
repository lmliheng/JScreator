| 属性 | 类型 | 参考值 | 默认值 | 必填 |
|------|------|--------|--------|------|
| type | string | 'h-yellow', 'h-blue', 'h-green' | 'h-yellow' | 否 |
| outlook | string | 'Rectangle', 'Circle' | 'Rectangle' | 否 |
| width | Number | - | 60 | 否 |
| height | Number | - | 30 | 否 |
| disabled | Boolean | - | false | 否 |
| iconGap | Number | - | 2 | 否 |

## 插槽

| 名称 | 说明 |
|------|------|
| 默认插槽 | 文本内容 |
| icon | 图标插槽 |

## 事件

| 事件 | 描述 |
|------|------|
| click | 点击事件 |
| omMouse | 鼠标事件 |
| hover | 悬停事件 |

---

建议：
1. `diabled` 属性名拼写错误，应为 `disabled`
2. 建议添加 `loading` 状态属性，支持加载中状态
3. 建议添加 `size` 属性，支持 small/medium/large 尺寸
4. outlook 建议改名为 `shape`，更语义化
5. 建议添加 `plain` 属性，支持朴素按钮样式
6. 建议统一事件命名，omMouse 应为 onMouse