# DX Lab - ポートフォリオサイト

大学職員向けDX推進・AI活用事例のポートフォリオサイト。

- **フレームワーク**: Astro v5（静的サイト生成）
- **ホスティング**: GitHub Pages（`main`ブランチへのpushで自動デプロイ）
- **サイトURL**: https://devikuomidorikawa.github.io/dx-lab/

## 記事の管理

記事は `src/content/projects/` にMarkdownファイルとして配置する。

### ファイル命名規則

- 英語のケバブケース: `meet-summary.md`, `budget-report-auto.md`
- 内容が推測できる簡潔な名前にする

### frontmatter（必須）

```yaml
---
title: "記事タイトル"
description: "1〜2文の概要。トップページのカード表示に使われる。"
tags: ["Google Sheets", "Gemini", "AI", "業務改善"]
createdAt: "YYYY-MM-DD"
updatedAt: "YYYY-MM-DD"
status: "published"
order: 31
---
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| title | string | 記事タイトル |
| description | string | 概要（トップページのカードに表示） |
| tags | string[] | タグ。既存タグを優先的に使う（下記参照） |
| createdAt | string | 作成日（YYYY-MM-DD） |
| updatedAt | string | 更新日（YYYY-MM-DD） |
| status | "published" \| "draft" | `draft`にするとサイトに表示されない |
| order | number | 任意。現在の最大値を確認して連番で振る |

### 既存タグ一覧（新規作成時はなるべく既存タグを再利用する）

- Google系: `Google Workspace Studio`, `Google Sheets`, `Google Meet`, `Google Forms`, `Google Docs`, `Google Drive`, `Google Calendar`, `Google Chat`, `Google Slides`, `Google Apps Script`, `Gmail`
- AI系: `Gemini`, `NotebookLM`, `AI`
- 分類系: `自動化`, `業務改善`, `文書作成`, `経理`, `議事録`, `多言語対応`, `法令`, `マニュアル`, `引き継ぎ`

### 記事の本文構成（統一パターン）

```markdown
## 課題
（導入前の問題点を2〜3文で記述）

## 解決策
（使用ツールを**太字**で示しながら、解決方法を簡潔に記述）

## 構築手順
### 1. ステップ名
（具体的な手順。プロンプト例はコードブロックで記載）

### 2. ステップ名
...

## 導入効果
| 項目 | 導入前 | 導入後 |
|------|--------|--------|
| ... | ... | ... |

## 応用例（任意）
- **応用名**: 説明

## 注意点
- 箇条書きで3項目程度
```

### 記事作成の注意事項

- 「社内」ではなく「学内」を使う（大学事務の文脈）
- GAS（Google Apps Script）はできるだけ使わない。Google既存サービスとAIで完結させる
- プロンプト例やコードはコードブロック（```）で記載する（コピーボタンが自動付与される）
- ツール名は初出時に**太字**にする
- 導入効果は表形式で「導入前 / 導入後」の比較にする

## 記事の操作

### 追加

1. `src/content/projects/` に新しい `.md` ファイルを作成
2. frontmatterの`order`は既存の最大値+1にする
3. `npm run build` でビルド確認
4. コミット & プッシュ（GitHub Actionsで自動デプロイ）

### 編集

1. 該当ファイルを直接編集
2. `updatedAt` を更新日に変更
3. ビルド確認 → コミット & プッシュ

### 非公開（下書き化）

- frontmatterの `status` を `"draft"` に変更

### 削除

- ファイルを削除してコミット & プッシュ

## 開発コマンド

```bash
npm run dev      # ローカルプレビュー（http://localhost:4321/dx-lab/）
npm run build    # ビルド確認
```

## スキーマ定義

`src/content.config.ts` で Zod によるバリデーションが定義されている。frontmatterの形式が間違っているとビルドエラーになる。
