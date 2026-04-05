<div align="center">
<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/public/icon.svg" alt="Lumison Logo" width="120">

# Lumison

**没入感のあるミニマリスト音楽プレーヤー**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vite.dev/)

[デモ](https://salixfrost.github.io/lumison/) • [ダウンロード](https://github.com/SalixJFrost/Lumison/releases) • [問題報告](https://github.com/SalixJFrost/Lumison/issues)

</div>

---

## ✨ 機能

### 🎵 マルチソース音楽
- **ローカルファイル**: MP3、FLAC、WAV、OGG、M4A、AAC 対応
- **オンライン音楽検索**: 楽曲、アルバム検索
- **Internet Archive**: アーカイブオーディオコレクションへのアクセス
- **URLインポート**: 直接オーディオURL対応

### 🎨 没入感のあるビジュアル
- **6つの背景モード**: Gradient（グラデーション）、Fluid（フロー）、Melt（溶解）、Wave（波）、Halo（ハロー）、Swirl（渦巻）
- **ダイナミックテーマ**: アルバムアートに応じて色が自動調整
- **アルバムアート表示**: フルスクリーンアルバムビューと進捗バー

### 🎤 同期歌詞
- **リアルタイム同期**: 単語単位の歌詞ハイライト
- **自動スクロール**: スムーズな歌詞追跡
- **クリックでシーク**: 任意の歌詞行にジャンプ

### 🖥️ デスクトップ体験
- **クロスプラットフォーム**: Windows、macOS、Linux
- **キーボードショートカット**: 完全なホットキーサポート
- **マルチウィンドウ**: マルチスクリーン対応
- **システム統合**: メディアセッションAPI、自動更新

---

## 📸 スクリーンショット

<div align="center">

<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/images/img1.png" alt="Lumison プレーヤー" width="800">

<img src="https://raw.githubusercontent.com/SalixJFrost/Lumison/main/images/img2.png" alt="歌詞ビュー" width="800">

</div>

---

## 🚀 クイックスタート

### Webバージョン

1. [Lumison Webデモ](https://salixfrost.github.io/lumison/) にアクセス
2. クラウドアイコンをクリックまたはオーディオファイルをドラッグ＆ドロップ
3. `Cmd/Ctrl+K` でオンライン検索

### デスクトップアプリ

[GitHub Releases](https://github.com/SalixJFrost/Lumison/releases) から最新バージョンをダウンロード

**ソースからビルド:**

```bash
# クローンとインストール
git clone https://github.com/SalixJFrost/Lumison.git
cd Lumison
npm install

# デスクトップアプリをビルド
npm run tauri:build

# 開発モードで起動
npm run tauri:dev
```

---

## ⌨️ キーボードショートカット

| ショートカット | 操作 |
|----------|--------|
| `Space` | 再生/一時停止 |
| `←` / `→` | 前へ/次へ |
| `↑` / `↓` | 音量アップ/ダウン |
| `M` | ミュート切替 |
| `P` | プレイリスト切替 |
| `F` | フルスクリーン切替 |
| `L` | 歌詞ビュー切替 |
| `Cmd/Ctrl + K` | 検索パネルを開く |
| `Esc` | ダイアログを閉じる |

---

## 🛠️ 開発

### 必要条件

- Node.js 20+
- npm
- Rustツールチェーン（デスクトップビルド用）

### コマンド

```bash
# 開発
npm run dev              # Web開発サーバー起動
npm run tauri:dev        # Tauri開発モード起動

# ビルド
npm run build            # Webバージョンビルド
npm run tauri:build      # デスクトップアプリビルド

# テスト
npm run test             # テスト実行
vitest                   # ウォッチモード
```

---

## 📁 プロジェクト構造

```
lumison/
├── src/                    # フロントエンド (React)
│   ├── components/         # UIコンポーネント
│   │   ├── common/         # アイコン、SmartImage、Toast
│   │   ├── layout/         # TopBar、ShaderBackground
│   │   ├── modals/         # 検索、インポートについて
│   │   └── player/         # コントロール、歌詞、プレイリスト
│   ├── hooks/              # カスタムReactフック
│   ├── services/           # ビジネスロジック
│   │   ├── audio/          # オーディオ処理
│   │   ├── cache/          # IndexedDBキャッシュ
│   │   ├── lyrics/          # 歌詞解析
│   │   ├── music/          # 音楽検索API
│   │   └── streaming/       # Internet Archive
│   ├── contexts/           # Reactコンテキスト
│   ├── i18n/              # 国際化
│   └── utils/             # ユーティリティ関数
├── src-tauri/              # バックエンド (Rust/Tauri)
│   ├── src/                # Rustソース
│   └── icons/              # アプリアイコン
├── config/                 # 設定ファイル
├── docs/                   # ドキュメント
└── public/                 # 静的アセット
```

---

## 🌐 技術スタック

| レイヤー | 技術 |
|-------|--------|
| **フロントエンド** | React 19、TypeScript 5.8、Vite 6 |
| **スタイリング** | Tailwind CSS 3.4 |
| **アニメーション** | @react-spring/web |
| **デスクトップ** | Tauri 2.0、Rust |
| **テスト** | Vitest |
| **国際化** | カスタム実装 (EN/ZH/JA) |

---

## 🌍 国際化

Lumisonは多言語をサポート:
- English
- 中文 (简体)
- 日本語

設定 → 言語 で言語を切り替えられます。

---

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) をご覧ください。

---

## 🙏 クレジット

- Apple Music からインスピレーションを得たデザイン
- 音楽検索API統合
- [Internet Archive](https://archive.org/) からのストリーミング

---

<div align="center">

**[ダウンロード](https://github.com/SalixJFrost/Lumison/releases)** •
**[デモ](https://salixfrost.github.io/lumison/)** •
**[問題報告](https://github.com/SalixJFrost/Lumison/issues)**

❤️ で製作、React + Tauri 使用

</div>
