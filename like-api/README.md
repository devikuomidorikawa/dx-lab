# Like API

`dx-lab` の記事ごとの「いいね」を受け付ける Cloudflare Worker です。

## 構成

- 保存先: Cloudflare D1
- 重複防止: `article_slug + visitor_id` の一意制約
- 匿名 ID: フロントエンドが `localStorage` に保存する `visitor_id`

## セットアップ

1. D1 データベースを作成する
2. `schema.sql` を適用する
3. `wrangler.jsonc` の `database_id` を差し替える
4. Worker を deploy する

```bash
wrangler deploy
```

## GitHub Pages 側の設定

GitHub リポジトリの Variables に以下を追加する。

- `PUBLIC_LIKE_API_URL`
  例: `https://dx-lab-like-api.<your-subdomain>.workers.dev`

`deploy.yml` ではこの Variable をビルド時に読む。

## 注意

- `visitor_id` は匿名で、ブラウザの `localStorage` に保存される
- `localStorage` を削除したり別ブラウザを使うと再度押せる
- その代わり、ログインなしで「通常利用では1ブラウザ1回」にかなり近づける構成になっている
