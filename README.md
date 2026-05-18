# DX Lab 管理メモ

DX Lab は、AI・Google Workspace などを使った業務改善事例を Markdown で管理する静的サイトです。

公開ページ: https://devikuomidorikawa.github.io/dx-lab/

## 基本方針

- 記事本文は `src/content/projects/` の Markdown ファイルで管理する。
- 1記事につき1ファイルにする。
- 公開・下書き・退避は frontmatter の `status` で管理する。
- 記事を他サービスへ移すときは `npm run export:content` で一括出力する。

## よく使うコマンド

```bash
npm run dev
npm run build
npm run new:project
npm run export:content
npm run export:likes
```

## 記事を追加する

次のコマンドで下書き記事を作成します。

```bash
npm run new:project
```

質問に答えると `src/content/projects/` に Markdown ファイルが作成されます。作成直後は `status: "draft"` なので公開されません。

公開するときは記事ファイルの frontmatter を変更します。

```yaml
status: "published"
```

## 記事を非公開・退避する

一時的に非公開にする場合:

```yaml
status: "draft"
```

過去記事として残すが、公開ページには出したくない場合:

```yaml
status: "archived"
```

削除は最後の手段です。まずは `draft` または `archived` にしてください。Git 履歴で復元はできますが、ファイルを残しておく方が管理しやすいです。

## 記事の書式

```yaml
---
title: "記事タイトル"
description: "記事一覧や検索結果で使う短い説明"
tags: ["Gemini", "Google Drive", "業務改善"]
createdAt: "2026-05-18"
updatedAt: "2026-05-18"
status: "draft"
featured: false
highlightUpdated: false
---
```

本文は次の構成を基本にします。

```markdown
## 課題

## 使ったツール

## 実装手順

## 効果

## 注意点

## 今後の改善
```

## タグの管理

使えるタグは `src/lib/projectTags.ts` で管理しています。

未登録タグを記事に書くと `npm run build` が失敗します。表記ゆれを防ぐため、新しいタグを使う場合は先に `src/lib/projectTags.ts` へ追加してください。

## 一括エクスポート

記事を引っ越し・バックアップ・note 転用したい場合は次を実行します。

```bash
npm run export:content
```

出力先:

- `exports/projects.json`: 記事メタ情報のJSON
- `exports/projects.csv`: Excel等で確認しやすい一覧
- `exports/note-md/*.md`: noteなどへ貼り付けやすいMarkdown

`exports/` は生成物なのでGit管理から外しています。

## いいね機能の管理方針

いいね機能は残します。ただし、記事本文とは違い、いいね数は Cloudflare D1 に保存されます。

おすすめの管理方法:

- 記事本文はこのリポジトリの Markdown を正本にする。
- いいね数は補助データとして扱う。
- 引っ越し時に必須ではないなら、いいね数は捨ててもよいデータと考える。
- 残したい場合は Cloudflare D1 から定期的にJSONでエクスポートする。

Cloudflare にログイン済みの環境では、次のコマンドで記事ごとのいいね数だけを出力できます。

```bash
npm run export:likes
```

出力先:

- `exports/likes.json`

このコマンドは閲覧者IDを出力しません。記事ごとの件数だけをバックアップするため、管理しやすく、余計な個人識別情報を持ち出さない運用にできます。

## Mermaid/CDNについて

記事内で Mermaid 図を使う場合、現在は表示時に外部CDNから Mermaid を読み込みます。

簡単に言うと、図を表示するために外部サービスから部品を借りている状態です。通常利用では大きな問題はありませんが、外部サービスが止まると図だけ表示されない可能性があります。

おすすめ方針:

- Mermaid 図をほとんど使わないなら、今のままでよい。
- Mermaid 図を重要な資料として使うなら、将来 npm 依存に移してサイト内に同梱する。

今すぐ対応が必要なセキュリティ問題ではありません。

## 公開前チェック

- `npm run build` が成功する。
- `status` が意図した状態になっている。
- タイトルと説明文が具体的になっている。
- タグが既存タグまたは追加済みタグになっている。
- 公開したくない情報が本文に入っていない。
