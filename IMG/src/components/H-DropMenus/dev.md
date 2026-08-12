| 属性 | 类型 | 参考值 | 默认值 | 必填 |
|------|------|--------|--------|------|
| drop_position | string | 'top', 'bottom', 'left', 'right', 'bottom-left', 'bottom-right', 'top-left', 'top-right', 'left-top', 'left-bottom', 'right-top', 'right-bottom' | 'bottom-right' | 否 |
| menu_transition | string | 过渡动画名称 | 'dropdown' | 否 |

## 插槽

| 名称 | 说明 |
|------|------|
| 默认插槽 | 触发菜单显示的内容 |
| dropmenus | 下拉菜单内容，仅限HDropMenusItem组件 |

## 事件

| 事件 | 描述 |
|------|------|
| mouseEnter | 鼠标进入时触发，显示菜单 |
| mouseLeave | 鼠标离开时触发，隐藏菜单 |

---

建议：
1. 建议添加 `disabled` 属性，控制菜单是否可用
2. 建议添加 `click` 事件，支持点击触发而非仅 hover 触发
3. drop_position 的命名可考虑统一为更简洁的风格，如 "bottom-right" 可简化为 "br"
4. 建议为菜单项添加 HDropMenusItem 组件文档
5. menu_transition 建议限制可选值类型，避免无效值