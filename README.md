# Kapium Neo

> 谐元场域——大抵是序炁的龙窝

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Kapium 博客的第三代重构。从 C++ 自研 SSG + React SPA（[Kapium](https://github.com/ordchaos/kapium)）迁移至 **Astro**，保留 React 交互组件，获得更好的内容型站点体验。

## 功能

- 📝 **Astro 静态生成** — 基于 Astro Content Collections，Markdown/MDX 原生支持
- ⚛️ **React 交互岛屿** — 导航栏、搜索、目录等交互组件保留 React 实现
- 🎨 **深色/浅色主题** — 跟随系统或手动切换，刷新不闪烁
- 🔍 **全文搜索** — 前端 MiniSearch 引擎，中文分词友好
- 🤖 **AI 摘要** — 文章自动/手动 AI 摘要生成（通义千问）
- 📊 **Umami 统计** — 隐私友好的页面浏览统计
- 💬 **Twikoo 评论** — 无后端评论系统
- 📡 **RSS / Sitemap** — 自动生成
- ♿ **无障碍优化** — 语义化地标、ARIA 标签、跳过导航

## 技术栈

| 层   | 技术                                                         |
| ---- | ------------------------------------------------------------ |
| 框架 | [Astro](https://astro.build)                                 |
| UI   | React 19 + [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS |
| 搜索 | [MiniSearch](https://github.com/lucaong/minisearch)          |
| 图标 | Lucide + Iconify                                             |
| 数学 | KaTeX                                                        |

## 快速开始

```bash
pnpm install
pnpm dev        # 开发模式
pnpm build      # 生产构建
pnpm preview    # 预览构建产物
```

### 脚本

```bash
pnpm abbrlink   # 生成文章缩略链接
pnpm summary    # 生成 AI 摘要（需 .env 中配置 DASHSCOPE_API_KEY）
pnpm icons      # 生成图标 sprite
```

## 许可

- 代码：[MIT](LICENSE)
- 文章内容（`src/posts`）：[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
