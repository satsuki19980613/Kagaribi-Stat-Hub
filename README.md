# Kagaribi Stat Hub

[![CI](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/ci.yml)
[![Live](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/live.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/live.yml)
[![CodeQL](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/codeql.yml)

ポーカーチェイスのクラブ「燎」のクラブマッチ戦績を記録・集計する Web アプリ。スマホやPCにインストールして使える（PWA・オフラインで動く）。

サイト：https://kagaribi-stat-hub.wsk641.workers.dev/

- **記録** — 日付を選び、参加したメンバーの順位（1〜6位）をタップして保存。得点は公式の個人ポイント（1位 +5 〜 6位 −1）で自動で決まる。
- **メンバー情報登録** — 人数の上限なし（代走も登録できる）。参加回数と基本スタッツ（優勝回数・VPIP・参加ハンド数）を残す。
- **スタッツビュー** — シーズン内・シーズン推移のグラフと表（合計pt・平均pt・加点率・1位率・平均順位・生存ターン数）と、上位 30 クラブとの比較。
- **シーズン設定** — シーズンは日付から自動で決まる。急な短縮・延長・休催は手で直せる。
- **バックアップ** — 変更のたびに端末の中へ自動で残し、好きな時点に戻せる。PC ではファイルへの自動保存もできる。

詳しい使い方と指標の定義：[docs/GUIDE.md](docs/GUIDE.md)

デザインは [kagaribiICM](https://github.com/satsuki19980613/kagaribiICM)（直角・焚き火背景）をもとに、ルルルン風のピンクに寄せている。

## 安全とプライバシー

### ひと目で

- **記録は、あなたの端末のブラウザの中にだけ保存されます。** 運営者のサーバーは無く、運営者を含めて誰にも送りません。
- **ログインもアカウントもありません。** メールアドレスや氏名を求めることもありません。
- **このサイト以外へは通信しません。** 読みに行くのはアプリのファイルと、公開されているクラブ順位だけです。フォントもこのサイトから配っているので、開いただけで Google などに通信することはありません。
- **課金・広告・アクセス解析はありません。** このサイト以外のスクリプトは動かない設定です。
- **ここに書いたことは、自動の確認で確かめ続けています。** 結果は誰でも見られます（上のバッジ）。

一方で、**記録を守っているのはあなたの端末です。** 端末をなくしたりブラウザのデータを消したりすると記録も消えるので、バックアップで備えてください。端末を触れる人には記録が見えます。

以下は、その詳しい中身と根拠です。

### 扱う情報の一覧

| 情報 | 保存される場所 | 運営者が見られるか | ほかの人に見えるか |
|---|---|---|---|
| 試合の記録（日付・順位・1部／2部） | **この端末のブラウザの中だけ**（IndexedDB） | 見られない | 見えない |
| メンバーの名前・参加回数・基本スタッツ | **この端末のブラウザの中だけ** | 見られない | 見えない |
| シーズン設定 | **この端末のブラウザの中だけ** | 見られない | 見えない |
| 自動バックアップの履歴 | **この端末のブラウザの中だけ**（直近 30 件と、それより前は 1 日 1 件を 60 日ぶん） | 見られない | 見えない |
| 書き出したバックアップ（JSON。メンバーの名前を含む） | あなたが選んだファイル | 見られない | ファイルを渡した相手には見える |
| 画面の表示の好み（強調したメンバー・比べるクラブ） | **この端末のブラウザの中だけ**（localStorage） | 見られない | 見えない |
| クラブ順位（上位 30） | このリポジトリの [public/data/clubs.json](public/data/clubs.json) | 見られる | 誰でも見られる（X で公開されている集計を写したもの） |

外部のサービスに届くもの：

- **Cloudflare**（サイトの配信） — アプリを開くとき・クラブ順位を読むとき。通信を中継するので、接続の情報（IP アドレスなど）が届く。記録は届かない。
- ほかには無い。フォントもこのサイトから配っているので、開いただけで Google に通信することはない。

### 期待できること・できないこと

期待できること：

- 記録が運営者やほかの人に送られない。
- 仮にアプリのコードに誤りがあっても、記録をほかのサイトへ送ることはできない（ブラウザが通信先をこのサイトだけに制限する）。
- ほかのサイトのスクリプトが画面で動かない。ほかのサイトに埋め込まれて操作を盗まれない。
- 通信は HTTPS だけで、途中で盗み見られたり書き換えられたりしない。
- 壊れたファイルや別のファイルを読み込んでも、記録が半端に壊れない（読み込む前に全件の形を確かめ、読めなければ何も変えない）。
- ネットにつながらない場所でも使える。

期待できないこと（限界）：

- **端末をなくす・ブラウザのデータを消す・アプリを消すと、記録も消える。** 端末の外への控えは、ファイルへの書き出し・自動保存だけ。iPhone では Safari とホーム画面のアプリで保存場所が分かれる（[DEPLOY.md](DEPLOY.md)）。
- **端末を触れる人や、ブラウザに入れた拡張機能は記録を読める。** 記録は暗号化していない。
- **記録をほかの端末と共有・同期する仕組みは無い。** 移すときはバックアップの書き出しと読み込みで行う。
- **サイトの URL を知っている人は誰でもアプリを開ける。** ただし見えるのは、その人の端末にある記録だけ。
- **外部のサービス（Cloudflare）がどう扱うかは、その規約による。**
- **第三者による監査は受けていない。** 個人で運営していて、確かめているのは下の自動の確認だけ。

### 仕組みと根拠

想定している相手は、記録をのぞこうとするほかの人、Web の一般的な攻撃（ほかのサイトのスクリプト・埋め込み・通信の盗み見）、記録を集めてしまう運営者自身、そして記録をうっかり失うことです。サーバーを持たず、記録は端末の外に出しません。

| 守ること | 仕組み | 根拠 |
|---|---|---|
| 記録を端末の外に出さない | 保存はブラウザの IndexedDB だけで、サーバーに送るコードが無い。通信は、このサイトに置いたクラブ順位を読む 1 か所だけ | [src/data/store.ts](src/data/store.ts)・[src/data/clubData.ts](src/data/clubData.ts) |
| 誤りがあっても外に送れない | 通信先・スクリプト・フォント・画像を、このサイトだけに制限する（Content-Security-Policy） | [public/_headers](public/_headers)。本番に届いているかを毎週確かめる [scripts/live-check.mjs](scripts/live-check.mjs) |
| メンバーの名前などで画面を乗っ取られない | 表示する前に React が無害化する（HTML として書き込む箇所は無い）。さらに、このサイト以外のスクリプトは動かない設定にしている | [public/_headers](public/_headers) |
| ほかのサイトに埋め込まれない | 埋め込みを禁止する（`frame-ancestors 'none'`・`X-Frame-Options`） | [public/_headers](public/_headers) |
| 通信を盗み見られない | HTTPS だけで通信するようブラウザに伝える（`Strict-Transport-Security`） | [public/_headers](public/_headers) |
| 記録をなくさない | 変更のたびに端末内へ自動で控えを残し、PC ではファイルにも書き出す。容量不足でブラウザが消さないよう頼む | [src/data/autoBackup.ts](src/data/autoBackup.ts)・[src/domain/autoBackup.ts](src/domain/autoBackup.ts) |
| 読み込んだファイルで記録を壊さない | 全件の形を確かめてから、1 回の書き込みでまとめて置き換える | [src/domain/backup.ts](src/domain/backup.ts)・[src/data/store.ts](src/data/store.ts)（`replaceAll`） |
| 鍵やパスワードを漏らさない | そもそも持たない（サーバーも API キーも無い） | — |

### 自動の確認

このページの上のバッジは、次の確認に通っていることを示します（安全を保証するものではありません）。

| 確認 | 何を確かめているか | いつ |
|---|---|---|
| [CI](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/ci.yml) | 型チェック・テスト・ビルド | コードを変えるたび |
| [Live](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/live.yml) | 本番のサイトに届くか、保護ヘッダが [public/_headers](public/_headers) のとおりか、クラブ順位が読めるか、Mozilla HTTP Observatory の評価が A+ か | 毎週と、配信の設定を変えたとき |
| [CodeQL](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/codeql.yml) | GitHub 公式のコードスキャン（危ない書き方が無いか） | コードを変えるたびと毎週 |
| [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=kagaribi-stat-hub.wsk641.workers.dev) | 公開しているサイトの保護ヘッダ。**A+**（2026-10-10 に、この設定の版を Preview の URL で測定）。Live が毎週測り、A+ でなければ失敗にする | リンク先でいつでも測り直せる |

### 問題を見つけたら

[SECURITY.md](SECURITY.md) を見てください。このリポジトリの Security タブから、公開されない形で運営者に知らせることができます。

### この節の書き方について

読む人が確かめやすいよう、次の考え方に沿って書いています。

- **大事なことを先に短く、詳しいことは後ろに**（英国の個人情報保護機関 ICO の「[段階的に示す](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/)」考え方）
- **扱う情報を決まった形の表にする**（カーネギーメロン大学の[プライバシーの「栄養成分表示」の研究](https://doi.org/10.1145/1753326.1753561)。Apple や Google のアプリストアの表示も同じ考え方）
- **期待できること・できないことを両方書き、想定する相手と対策の根拠を示す**（[OpenSSF Best Practices](https://www.bestpractices.dev/en/criteria/1) の基準）
- **知らせ方を用意し、動かしている検査を示す**（[GitHub のリポジトリのベストプラクティス](https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories)）

## 開発

[Node.js](https://nodejs.org/) 20 以上が必要（Windows / macOS / Linux 共通）。

- 起動：`npm install && npm start` → http://localhost:4181 （ビルドして配信。保護ヘッダも本番と同じ。同じネットワークのスマホからは `npm run preview -- --host` の URL）
- 開発（ホットリロード）：`npm run dev` → http://localhost:5181
- デモ版：`npm run build:demo && npx vite preview --outDir dist-demo`（サンプルデータ入り。「今日」を 2026/12/17 として表示し、S32 は「急遽 1 日短縮・11/17 休催」の手動修正の例。メニューの「サンプルに戻す」で初期状態へ戻せる）
- デプロイとスマホへのインストール（Cloudflare・`main` に入ると自動で配り直す）：[DEPLOY.md](DEPLOY.md)
- クラブ順位の取り込み：[docs/GUIDE.md](docs/GUIDE.md#クラブ順位上位30)

| コマンド | 内容 |
| --- | --- |
| `npm test` | 単体テスト（Vitest） |
| `npm run typecheck` | 型チェック |
| `npm run build:demo` | サンプルデータ入りのデモ版を `dist-demo/` にビルド |
| `npm run icons` | `public/icon.svg` から PWA アイコン PNG を生成 |
| `npm run ranking` | X の集計ポストからクラブ順位を `public/data/clubs.json` に取り込む |
| `node scripts/live-check.mjs` | 公開しているサイトの確認（Live と同じ。`SITE=` で確かめる先を変えられる） |

```
src/
  domain/     純ロジック（得点・シーズン判定・集計・1日ぶんの保存計画・バックアップ）とテスト
  data/       IndexedDB の保存層・クラブ順位の読み込み・自動バックアップ
  screens/    画面（メニュー・記録・履歴・メンバー・スタッツ・シーズン設定・バックアップ）
  components/ 共通 UI・SVG チャート・焚き火背景
  demo/       デモ版のサンプルデータ
```
