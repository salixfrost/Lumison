# Lumison

[English](README.md) | 简体中文

<div align="center">

![Lumison Logo](public/icon.svg)

**一个更克制的音乐播放器，强调视觉氛围、同步歌词与 Tauri 桌面封装。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

[在线体验](https://salixfrost.github.io/lumison/) • [版本发布](https://github.com/SalixJFrost/Lumison/releases)

</div>

---

## 项目简介

Lumison 是一个偏向播放体验、歌词展示和视觉氛围的音乐播放器，而不是堆叠大量复杂功能的播放器。当前版本已经做过一轮收敛：仅保留深色主题、两个背景模式、更轻的控制层级，以及更简洁的设置入口。

## 主要特性

- 支持 MP3、FLAC、WAV、OGG、M4A 等常见本地音频格式
- 保留两种背景模式：`Fluid` 和 `Melt`
- 提供同步歌词视图，并支持歌词字号调节
- 支持多来源搜索与音乐导入
- 支持专辑封面提取与动态取色
- 基于 Tauri 2 打包桌面应用
- 桌面端支持自动检查更新
- Web 与桌面端均提供响应式界面

## 当前版本取向

- 主题固定为深色模式
- 已移除 Lab / 实验室面板
- 已移除多余的背景特效
- 已移除无缝播放相关 UI 控件
- 播放设置维持极简

## 最近更新

- 桌面端 `Fluid` 背景已改为可见的动态流动，并下调为更慢的氛围流速。
- 顶栏支持 10 秒无操作自动收起，鼠标移动到顶部区域会再次显示。
- About 中外链在桌面端会通过系统默认浏览器打开。
- 搜索稳定性已优化，修复了删除后再次搜索与连续搜索触发异常的问题。

## 开发

### 环境要求

- Node.js 20+
- npm
- 如需构建桌面版，请安装 Rust 工具链与 Tauri 依赖

### 安装依赖

```bash
npm install
```

### 启动 Web 开发环境

```bash
npm run dev
```

### 构建 Web 版本

```bash
npm run build
```

### 构建桌面应用

```bash
npm run tauri:build
```

### 重新生成应用图标

```bash
npm run generate:all-icons
```

## 技术栈

- React 19
- TypeScript 5.8
- Vite 6
- Tailwind CSS 3
- Tauri 2
- Rust
- react-spring

## 项目结构

```text
src/
	components/     界面组件
	contexts/       React Context
	hooks/          自定义 Hooks
	i18n/           国际化资源
	services/       音频、音乐、歌词与 UI 服务
	utils/          通用工具函数
src-tauri/
	src/            Tauri 后端入口
	icons/          应用图标源文件
public/           静态资源
scripts/          辅助脚本
```

## 说明

- Web 版本部署在 GitHub Pages。
- 桌面版本会在可用环境下调用 Tauri API。
- 如果 GitHub Pages 仍然加载旧 bundle，请强制刷新浏览器缓存。

## 许可证

本项目采用 MIT License。

## 致谢

设计灵感来自 Apple Music。

---

<div align="center">

用心制作。

</div>
