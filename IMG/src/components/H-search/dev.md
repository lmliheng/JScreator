| 属性 | 类型 | 参考值 | 默认值 | 必填 |
|------|------|--------|--------|------|
| modelValue | String | - | '' | 否 |
| inputStyle | Object | {width:'300px', height:'50px', placeholder:'请输入搜索内容', type:'text'} | - | 否 |

## 插槽

| 名称 | 说明 |
|------|------|
| icon | 左侧图标插槽 |

## 事件

| 事件 | 描述 |
|------|------|
| updateValue | 输入框值变化时触发 |
| search | 点击搜索按钮时触发 |
| clear | 点击清除按钮时触发 |
| inputFocus | 输入框聚焦时触发 |
| inputBlur | 输入框失焦时触发 |

---

建议：
1. 建议使用 `v-model:modelValue` 替代单独的 updateValue 事件，更符合 Vue3 规范
2. inputStyle 建议拆分为独立属性（width、height、placeholder 等），提高可用性
3. 建议添加 clear 事件图标，支持一键清空功能
4. 搜索图标使用内联 SVG，建议替换为 H-Input 组件或 H-Button 组件
5. 建议添加 `loading` 状态，显示搜索加载中状态
6. 聚焦样式用 hover 代替不够准确，建议使用 @focus 和 @blur 事件
7. 建议添加搜索防抖功能