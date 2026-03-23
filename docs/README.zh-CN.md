# Lumison

[English](README.md) | 简体中文

<div align="center">

![Lumison Logo](public/icon.svg)

**一款极简音乐播放器，提供沉浸式视觉效果、同步歌词显示与 Tauri 桌面端集成。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev/)

[在线体验](https://salixfrost.github.io/lumison/) • [版本发布](https://github.com/SalixJFrost/Lumison/releases) • [报告问题](https://github.com/SalixJFrost/Lumison/issues)

</div>

---

## 简介

Lumison 是一款基于 React、TypeScript 和 Tauri 构建的跨平台音乐播放器。它专注于播放体验、视觉氛围和同步歌词展示，而非堆砌复杂功能。界面经过精简设计，采用深色主题、两种背景模式和简洁的控制方式。

## 功能特性

| 类别 | 功能 |
|------|------|
| **播放** | 本地音频播放（MP3、FLAC、WAV、OGG、M4A、AAC 等），无缝播放 |
| **视觉效果** | 两种背景模式（Fluid、Melt），专辑封面提取，动态主题色 |
| **歌词** | 同步歌词显示，支持歌词字号调节，逐字高亮 |
| **搜索** | 多源音乐搜索（网易云、Internet Archive），云音乐导入 |
| **桌面端** | Tauri 2.0 打包，自动更新支持，系统托盘，键盘快捷键 |

## 快速开始

### 网页版

1. 在浏览器中打开 [Lumison 网页版](https://salixfrost.github.io/lumison/)
2. 点击导入按钮或拖拽音频文件来添加音乐
3. 使用搜索面板（Cmd/Ctrl+K）在线搜索音乐

### 桌面应用

#### 使用预构建版本

从 [Releases](https://github.com/SalixJFrost/Lumison/releases) 下载对应平台的最新版本。

#### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/SalixJFrost/Lumison.git
cd Lumison

# 安装依赖
npm install

# 构建桌面应用
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/`（开发构建位于 `target/debug/`）。

## 使用指南

### 添加音乐

- **本地文件**：点击播放列表面板中的云图标，或将文件拖拽到播放器上
- **URL 导入**：点击 + 图标添加来自直接链接的音乐
- **在线搜索**：按 `Cmd/Ctrl+K` 打开搜索面板，搜索网易云或 Internet Archive

### 播放控制

| 操作 | 桌面端 | 移动端 |
|------|--------|--------|
| 播放/暂停 | 空格键 | 点击播放按钮 |
| 下一曲 | `→` 或 `Shift+空格` | 左滑 |
| 上一曲 | `←` 或 `Shift+空格` | 右滑 |
| 音量增减 | `↑` / `↓` | 滑块或按钮 |
| 静音切换 | `M` | 点击扬声器图标 |
| 切换播放列表 | `P` | 点击列表图标 |

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 打开搜索面板 |
| `空格` | 播放/暂停 |
| `←` / `→` | 上一曲/下一曲 |
| `↑` / `↓` | 音量增加/减少 |
| `M` | 静音切换 |
| `F` | 切换全屏 |
| `L` | 切换歌词视图 |
| `Esc` | 关闭对话框/面板 |

### 视觉模式

- **Fluid 模式**：动态渐变背景，随专辑颜色变化
- **Melt 模式**：柔和、更具氛围感的模糊背景

在顶部栏或设置中切换模式。

## 开发

### 环境要求

- Node.js 20+
- npm
- Rust 工具链（用于桌面端构建）
- Tauri CLI 依赖

### 项目初始化

```bash
# 安装依赖
npm install
```

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（端口 3000） |
| `npm run build` | 构建生产环境网页版 |
| `npm run preview` | 本地预览生产版本 |
| `npm run tauri:dev` | 启动 Tauri 开发模式 |
| `npm run tauri:build` | 构建生产环境桌面应用 |

### 平台特定构建

```bash
# Windows (x86_64)
npm run tauri:build:windows

# macOS (通用)
npm run tauri:build:macos

# macOS (Intel)
npm run tauri:build:macos:intel

# macOS (Apple Silicon)
npm run tauri:build:macos:silicon

# Linux (x86_64)
npm run tauri:build:linux
```

### 运行测试

```bash
# 运行所有测试
npm run test

# 监听模式运行测试
vitest

# 运行指定测试文件
vitest run src/services/music/neteaseRequest.test.ts
```

## 技术栈

- **前端**：React 19, TypeScript 5.8, Vite 6
- **样式**：Tailwind CSS 3.4
- **动画**：@react-spring/web
- **桌面端**：Tauri 2.0, Rust
- **测试**：Vitest

## 项目结构

```
lumison/
├── src/
│   ├── components/         # React UI 组件
│   │   ├── common/         # 通用组件（Icons、SmartImage、Toast）
│   │   ├── layout/         # 布局组件（TopBar、ShaderBackground）
│   │   ├── modals/         # 模态对话框（搜索、关于、专注模式）
│   │   ├── player/         # 播放器控件、播放列表面板、专辑模式
│   │   └── ui/             # UI 工具（语言切换器）
│   ├── contexts/           # React Context（播放器、主题、国际化的）
│   ├── hooks/             # 自定义 Hooks
│   ├── i18n/              # 国际化资源（zh.ts、en.ts）
│   ├── services/          # 业务逻辑
│   │   ├── audio/         # 音频播放与处理
│   │   ├── cache/         # IndexedDB 缓存
│   │   ├── lyrics/        # 歌词解析与同步
│   │   ├── music/         # 音乐搜索、网易云 API
│   │   └── streaming/    # Internet Archive 流媒体
│   ├── utils/             # 工具函数
│   └── types.ts           # TypeScript 类型定义
├── src-tauri/             # Tauri 后端（Rust）
│   ├── src/               # Rust 源代码
│   ├── icons/             # 应用图标资源
│   └── Cargo.toml         # Rust 依赖
├── public/                # 静态资源
├── docs/                  # 文档
├── scripts/               # 构建辅助脚本
└── package.json           # Node 依赖
```

## 注意事项

- 网页版本在推送到 main 分支后会自动部署到 GitHub Pages。
- 桌面端构建会在可用环境下调用 Tauri API（文件系统、系统托盘等）。
- 如果 GitHub Pages 显示旧版本，请强制刷新浏览器（Ctrl+Shift+R）。
- 应用依赖 Web Audio API，建议使用现代浏览器（Chrome、Firefox、Safari、Edge）。

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE)。

## 致谢

- 设计灵感来源于 Apple Music
- 音乐搜索由 [网易云音乐 API](https://github.com/Binaryify/NeteaseCloudMusicApi) 提供支持
- 流媒体服务由 [Internet Archive](https://archive.org/) 支持

---

<div align="center">

基于 React + Tauri 构建

</div>