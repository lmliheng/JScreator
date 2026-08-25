# 博客前端设计规范（Blog Design System）

## 定位

现代、简洁的技术博客风格，使用 Tailwind CSS 4。内容优先、留白充足、克制一致。

## 设计原则

1. **内容优先**：文章正文是主角，UI 不喧宾夺主。
2. **简洁克制**：少用重阴影和渐变，靠排版与留白建立层次。
3. **全站一致**：颜色、圆角、间距、字号统一。

## 颜色（Tailwind 4）

| 用途 | Token |
|------|-------|
| 页面背景 | `zinc-50` |
| 卡片 / 正文背景 | `white` |
| 主文字 | `zinc-900` |
| 次文字 | `zinc-500` |
| 边框 / 分隔线 | `zinc-200` |
| 强调色（按钮、链接、hover、聚焦） | `indigo-600` → hover `indigo-700` |
| 成功 | `emerald-600` |
| 危险 | `red-600` |

## 字体

- 正文：Inter / 系统无衬线栈（`font-sans`）。
- 代码 / 行内代码：`ui-monospace, SFMono-Regular, Menlo, monospace`。

## 布局

- 文章正文最大宽度 `max-w-3xl`（约 48rem），水平居中。
- 文章列表容器 `max-w-5xl`，卡片栅格 2–3 列。
- 顶部导航 `sticky`，白底 + 细下边框（`border-b border-zinc-200`）。

## 圆角 & 阴影

- 卡片 / 输入 / 按钮：`rounded-lg`（8px）。
- 头像：`rounded-full`。
- 阴影：仅用 `shadow-sm`，避免重阴影。

## 组件样式

- 主按钮：`bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700`
- 次按钮：`border border-zinc-300 text-zinc-700 rounded-lg px-4 py-2 hover:bg-zinc-100`
- 卡片：`bg-white border border-zinc-200 rounded-lg shadow-sm p-6`
- 输入框：`border border-zinc-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none`
- 标签：`rounded-full bg-zinc-100 text-zinc-600 px-3 py-1 text-sm`

## 响应式

- 移动优先，使用 `sm` / `md` / `lg` 断点。
- 移动端顶部导航折叠为汉堡菜单。

## 参考气质

参考 shadcn/ui 的克制感与 Vercel Blog 的排版节奏；保持「干净、留白、易读」。
