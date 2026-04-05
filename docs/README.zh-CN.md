<div align="center">
<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/public/icon.svg" alt="Lumison Logo" width="120">

# Lumison

**一款极简的沉浸式音乐播放器**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev/)

[在线体验](https://salixfrost.github.io/lumison/) • [下载应用](https://github.com/SalixJFrost/Lumison/releases) • [报告问题](https://github.com/SalixJFrost/Lumison/issues)

</div>

---

## ✨ 功能特性

### 🎵 多源音乐
- **本地文件**: MP3、FLAC、WAV、OGG、M4A、AAC 等格式
- **在线音乐搜索**: 搜索歌曲、专辑
- **Internet Archive**: 访问存档音频收藏
- **URL 导入**: 直接音频 URL 支持

### 🎨 视觉体验
- **六种背景模式**: Gradient（渐变）、Fluid（流体）、Melt（融化）、Wave（波浪）、Halo（光环）、Swirl（漩涡）
- **动态主题**: 颜色根据专辑封面自动调整
- **专辑封面展示**: 全屏专辑视图与进度条

### 🎤 同步歌词
- **实时同步**: 逐字歌词高亮
- **自动滚动**: 平滑歌词跟踪
- **点击跳转**: 跳转到任意歌词行

### 🖥️ 桌面体验
- **跨平台**: Windows、macOS、Linux
- **键盘快捷键**: 完整的快捷键支持
- **多窗口支持**: 多屏幕扩展
- **系统集成**: 媒体会话 API、自动更新

---

## 📸 界面截图

<div align="center">

<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/images/img1.png" alt="Lumison 播放器" width="800">

<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/images/img2.png" alt="歌词视图" width="800">

</div>

---

## 🚀 快速开始

### 网页版

1. 访问 [Lumison 网页版](https://salixfrost.github.io/lumison/)
2. 点击云图标或拖拽音频文件
3. 按 `Cmd/Ctrl+K` 在线搜索

### 桌面应用

从 [GitHub Releases](https://github.com/SalixJFrost/Lumison/releases) 下载最新版本

**从源码构建:**

```bash
# 克隆并安装
git clone https://github.com/SalixJFrost/Lumison.git
cd Lumison
npm install

# 构建桌面应用
npm run tauri:build

# 启动开发模式
npm run tauri:dev
```

---

## ⌨️ 键盘快捷键

| 快捷键 | 操作 |
|----------|--------|
| `Space` | 播放/暂停 |
| `←` / `→` | 上一首/下一首 |
| `↑` / `↓` | 音量增加/减少 |
| `M` | 静音切换 |
| `P` | 切换播放列表 |
| `F` | 切换全屏 |
| `L` | 切换歌词视图 |
| `Cmd/Ctrl + K` | 打开搜索面板 |
| `Esc` | 关闭对话框 |

---

## 🛠️ 开发指南

### 前置要求

- Node.js 20+
- npm
- Rust 工具链 (桌面应用构建需要)

### 开发命令

```bash
# 开发
npm run dev              # 启动 Web 开发服务器
npm run tauri:dev        # 启动 Tauri 开发模式

# 构建
npm run build            # 构建 Web 版本
npm run tauri:build      # 构建桌面应用

# 测试
npm run test             # 运行测试
vitest                   # 监视模式
```

---

## 📁 项目结构

```
lumison/
├── src/                    # 前端 (React)
│   ├── components/         # UI 组件
│   │   ├── common/         # 图标、SmartImage、Toast
│   │   ├── layout/         # TopBar、ShaderBackground
│   │   ├── modals/         # 搜索、导入、关于
│   │   └── player/         # 控件、歌词、播放列表
│   ├── hooks/              # 自定义 React Hooks
│   ├── services/           # 业务逻辑
│   │   ├── audio/          # 音频处理
│   │   ├── cache/          # IndexedDB 缓存
│   │   ├── lyrics/         # 歌词解析
│   │   ├── music/          # 音乐搜索 API
│   │   └── streaming/      # Internet Archive
│   ├── contexts/           # React 上下文
│   ├── i18n/               # 国际化
│   └── utils/              # 工具函数
├── src-tauri/              # 后端 (Rust/Tauri)
│   ├── src/                # Rust 源码
│   └── icons/              # 应用图标
├── config/                 # 配置文件
├── docs/                   # 文档
└── public/                 # 静态资源
```

---

## 🌐 技术栈

| 层次 | 技术 |
|-------|-----------|
| **前端** | React 19、TypeScript 5.8、Vite 6 |
| **样式** | Tailwind CSS 3.4 |
| **动画** | @react-spring/web |
| **桌面端** | Tauri 2.0、Rust |
| **测试** | Vitest |
| **国际化** | 自定义实现 (EN/ZH) |

---

## 🌍 国际化

Lumison 支持多语言:
- English
- 中文 (简体)

在 设置 → 语言 中切换语言。

---

## 📄 许可证

MIT License - 详情请查看 [LICENSE](LICENSE)。

---

## 🙏 致谢

- 设计灵感来自 Apple Music
- 音乐搜索 API 集成
- 流媒体来自 [Internet Archive](https://archive.org/)

---

<div align="center">

**[下载应用](https://github.com/SalixJFrost/Lumison/releases)** •
**[在线体验](https://salixfrost.github.io/lumison/)** •
**[报告问题](https://github.com/SalixJFrost/Lumison/issues)**

用 ❤️ 制作，基于 React + Tauri

</div>
