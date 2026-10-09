# デプロイ手順（スマホにインストールできるようにする）

このアプリは **端末ローカル完結**（記録はすべてブラウザ内に保存）なので、ビルドした静的ファイルを置くだけで動きます。
[kagaribiICM](https://github.com/satsuki19980613/kagaribiICM) と同じく、**リポジトリは非公開のまま** **Cloudflare**（無料）で配ります。
初回だけ下記の操作が必要です（数分）。

> GitHub Pages は無料プランだと非公開リポジトリから配信できないため使いません。

## 0. 既定のブランチを main にする（初回のみ）

Cloudflare は既定のブランチ（本番）を配ります。GitHub のリポジトリの **Settings → General → Default branch** を **`main`** にしてください。

## 1. Cloudflare に取り込む（初回のみ）

配信設定 `wrangler.jsonc`（リポジトリ直下・`assets.directory=dist`・Worker スクリプト無し）と
配信ヘッダー `public/_headers` はコミット済みです。ダッシュボードでは取り込んで Deploy を押すだけです。

1. https://dash.cloudflare.com/ にログイン
2. **Workers & Pages** → **Create** → リポジトリ **`Kagaribi-Stat-Hub`** を **Import**
   （GitHub アプリが Kagaribi-Stat-Hub にアクセスできない場合は、表示に従ってこのリポジトリへのアクセスを許可）
3. セットアップ画面で：

   | 項目 | 値 |
   |------|-----|
   | Project name | `kagaribi-stat-hub` |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy`（初期表示のまま） |
   | Protect with Cloudflare Access | OFF（ON だと閲覧にログインが要る） |

   Node は `.node-version`（= 22）で固定済み。
4. **Deploy** → 1〜2 分でビルド＆デプロイされ、`https://kagaribi-stat-hub.<サブドメイン>.workers.dev` が発行されます
   （kagaribiICM と同じアカウントなら https://kagaribi-stat-hub.wsk641.workers.dev ）。

以降は **`main` に入るたび自動で再デプロイ** されます。

## 2. インストール（ホーム画面に追加）

- **iPhone（Safari）**: 発行 URL を開く → 共有ボタン → **「ホーム画面に追加」**
- **Android（Chrome）**: 発行 URL を開く → メニュー → **「アプリをインストール」**
- **PC（Chrome / Edge）**: 発行 URL を開く → アドレスバー右の **インストール** アイコン

ピンクの炎のアイコンで起動し、一度開けばオフラインでも動きます（PWA）。

> 記録は **インストールした端末・ブラウザの中** に保存されます。Safari で使っていた記録はホーム画面のアプリには引き継がれないことがあるので、
> はじめからホーム画面のアプリで記録してください。別の端末へ移すときは「バックアップ」→「書き出す」→ 移した先で「読み込む」。

## 更新が届くまで

新しい版を `main` に入れると、アプリは次に開いたときに新しい版を受け取り、
「新しいバージョンがあります」と出ます（タップで更新。操作していないときに裏へ回すと自動で入れ替わります）。

クラブ順位（`public/data/clubs.json`）もアプリと一緒に配られます。`main` に入ってデプロイが終われば、
アプリを開いたとき（ネットにつながっているとき）に自動で読み込みます。

## PC だけで使う場合

Cloudflare を使わず、手元で `npm start` してもかまいません（`http://localhost:4181`）。
Chrome / Edge ならこの URL からもインストールできます（起動中のときだけ開けます）。
