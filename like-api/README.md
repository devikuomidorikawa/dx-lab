# Like API

`dx-lab` の記事ごとの「いいね」を受け付ける Cloudflare Worker です。

## 構成

- Bot 対策: Cloudflare Turnstile
- 保存先: Cloudflare D1
- 重複防止: `article_slug + visitor_id` の一意制約
- 匿名 ID: フロントエンドが `localStorage` に保存する `visitor_id`

## セットアップ

1. Cloudflare で Turnstile widget を作成し、`site key` と `secret key` を取得する
2. D1 データベースを作成する
3. `schema.sql` を適用する
4. `wrangler.jsonc` の `database_id` を差し替える
5. Worker secret を設定する

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

6. Worker を deploy する

```bash
wrangler deploy
```

## GitHub Pages 側の設定

GitHub リポジトリの Variables に以下を追加する。

- `PUBLIC_LIKE_API_URL`
  例: `https://dx-lab-like-api.<your-subdomain>.workers.dev`
- `PUBLIC_TURNSTILE_SITE_KEY`
  Turnstile の site key

`deploy.yml` ではこれらの Variables をビルド時に読む。

## 注意

- `visitor_id` は匿名で、ブラウザの `localStorage` に保存される
- `localStorage` を削除したり別ブラウザを使うと再度押せる
- その代わり、ログインなしで「通常利用では1ブラウザ1回」にかなり近づける構成になっている
