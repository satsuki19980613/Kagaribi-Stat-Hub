# Kagaribi Stat Hub

[![CI](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/ci.yml)
[![Live](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/live.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/live.yml)
[![CodeQL](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/codeql.yml)
[![Secrets](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/secrets.yml/badge.svg?branch=main)](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/secrets.yml)

ポーカーチェイスのクラブ「燎」のクラブマッチの戦績を記録・集計する Web アプリ。スマートフォンや PC にインストールでき、オフラインでも動作する（PWA）。

**公開サイト**：https://kagaribi-stat-hub.wsk641.workers.dev/

## 機能

- **記録** — 日付を選び、参加メンバーの順位（1〜6 位）をタップして保存する。得点は公式の個人ポイント（1 位 +5 〜 6 位 −1）で自動的に決まる。
- **メンバー情報登録** — 人数の上限は無い（代走も登録できる）。参加回数と基本スタッツ（優勝回数・VPIP・参加ハンド数）を記録する。
- **スタッツビュー** — シーズン内・シーズン推移のグラフと表（合計 pt・平均 pt・加点率・1 位率・平均順位・生存ターン数）と、上位 30 クラブとの比較。
- **シーズン設定** — シーズンは日付から自動的に判定する。急な短縮・延長・休催は手動で修正できる。
- **バックアップ** — 変更のたびに端末内へ自動で保存し、任意の時点に復元できる。PC ではファイルへの自動保存にも対応する。

使い方と指標の定義の詳細は [docs/GUIDE.md](docs/GUIDE.md) を参照。

## セキュリティとプライバシー

### 要約

- **記録は端末のブラウザ内にのみ保存する。** 運営者のサーバーは無く、運営者を含め誰にも送信しない。
- **ログインもアカウントも無い。** メールアドレスや氏名の入力も求めない。
- **自サイト以外へは通信しない。** 取得するのはアプリのファイルと公開済みのクラブ順位だけである。フォントも自サイトから配信しており、ページを開くだけで Google などに通信することはない。
- **課金・広告・アクセス解析は無い。** 自サイト以外のスクリプトは実行されない設定である。
- **以上の内容は自動検証で継続的に確認している。** 結果は上部のバッジで公開している。

**制約**：記録の保全は利用者の端末に依存する。端末の紛失やブラウザのデータ削除で記録も失われるため、バックアップで備えること。端末を操作できる人には記録が見える。

### 取り扱う情報

| 情報 | 保存先 | 運営者による閲覧 | 他者への表示 |
|---|---|---|---|
| 試合の記録（日付・順位・1 部／2 部） | **端末のブラウザ内のみ**（IndexedDB） | 不可 | 不可 |
| メンバーの名前・参加回数・基本スタッツ | **端末のブラウザ内のみ** | 不可 | 不可 |
| シーズン設定 | **端末のブラウザ内のみ** | 不可 | 不可 |
| 自動バックアップの履歴 | **端末のブラウザ内のみ**（直近 30 件と、それ以前は 1 日 1 件を 60 日分） | 不可 | 不可 |
| 書き出したバックアップ（JSON。メンバーの名前を含む） | 利用者が選んだファイル | 不可 | ファイルを渡した相手 |
| 表示設定（強調するメンバー・比較するクラブ） | **端末のブラウザ内のみ**（localStorage） | 不可 | 不可 |
| クラブ順位（上位 30） | このリポジトリの [public/data/clubs.json](public/data/clubs.json) | 可 | 可（X で公開されている集計の転記） |

外部サービスに送信される情報：

- **Cloudflare**（サイト配信） — アプリとクラブ順位の取得時。通信を中継するため、接続情報（IP アドレスなど）が送信される。記録は送信されない。
- 上記以外には無い。フォントも自サイトから配信しており、ページを開くだけで Google に通信することはない。

### 保証範囲と制約

保証する事項：

- 記録が運営者や他者に送信されない。
- アプリのコードに不具合があっても、記録を他サイトへ送信できない（ブラウザが通信先を自サイトに制限する）。
- 他サイトのスクリプトが実行されない。他サイトへの埋め込みによるクリックジャッキングを受けない。
- 通信は HTTPS に限られ、盗聴や改ざんを受けない。
- 破損したファイルや無関係なファイルを読み込んでも、記録が部分的に壊れない（読み込み前に全件の形式を検証し、不正なら何も変更しない）。
- オフラインでも利用できる。

制約：

- **端末の紛失、ブラウザのデータ削除、アプリの削除で記録も失われる。** 端末外への退避手段は、ファイルへの書き出しと自動保存のみである。iPhone では Safari とホーム画面のアプリで保存領域が分かれる（[DEPLOY.md](DEPLOY.md)）。
- **端末を操作できる人や、ブラウザの拡張機能は記録を読める。** 記録は暗号化していない。
- **他の端末との共有・同期の仕組みは無い。** 移行はバックアップの書き出しと読み込みで行う。
- **サイトの URL を知っていれば誰でもアプリを開ける。** ただし、閲覧できるのはその人の端末にある記録だけである。
- **外部サービス（Cloudflare）における取り扱いは、同社の規約に従う。**
- **第三者による監査は受けていない。** 個人による運営であり、検証は下記の自動検証に限られる。

### 脅威モデルと対策

想定する脅威は、記録の覗き見を試みる他者、一般的な Web 攻撃（他サイトのスクリプト・埋め込み・通信の盗聴）、記録を収集してしまう運営者自身、および記録の消失である。サーバーを持たず、記録を端末の外に出さない設計とする。

| 対策目標 | 実装 | 根拠 |
|---|---|---|
| 記録を端末の外に出さない | 保存先はブラウザの IndexedDB のみで、サーバーへ送信するコードは無い。通信は、自サイトに置いたクラブ順位の取得 1 か所のみ | [src/data/store.ts](src/data/store.ts)・[src/data/clubData.ts](src/data/clubData.ts) |
| 不具合時の外部送信の防止 | 通信先・スクリプト・フォント・画像を自サイトに制限する（Content-Security-Policy） | [public/_headers](public/_headers)。本番への適用を毎週検証する [scripts/live-check.mjs](scripts/live-check.mjs) |
| XSS の防止 | 表示は React がエスケープする（HTML として書き込む箇所は無い）。加えて、自サイト以外のスクリプトを実行させない | [public/_headers](public/_headers) |
| クリックジャッキングの防止 | 埋め込みを禁止する（`frame-ancestors 'none'`・`X-Frame-Options`） | [public/_headers](public/_headers) |
| 通信の盗聴防止 | HTTPS のみで通信するようブラウザに指示する（`Strict-Transport-Security`） | [public/_headers](public/_headers) |
| 記録の消失防止 | 変更のたびに端末内へ自動でバックアップを残し、PC ではファイルにも書き出す。ストレージ不足時に消去されないよう、ブラウザに永続化を要求する | [src/data/autoBackup.ts](src/data/autoBackup.ts)・[src/domain/autoBackup.ts](src/domain/autoBackup.ts) |
| 読み込みによる記録の破損防止 | 全件の形式を検証してから、1 回の書き込みでまとめて置き換える | [src/domain/backup.ts](src/domain/backup.ts)・[src/data/store.ts](src/data/store.ts)（`replaceAll`） |
| 秘密情報の管理 | 秘密情報を持たない（サーバーも API キーも無い） | — |

### 自動検証

上部のバッジは、次の検証の結果を示す（安全性を保証するものではない）。

| 検証 | 内容 | 実行タイミング |
|---|---|---|
| [CI](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/ci.yml) | 型検査・テスト・ビルド | コード変更時 |
| [Live](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/live.yml) | 本番サイトの疎通、セキュリティヘッダーが [public/_headers](public/_headers) どおりであること、クラブ順位を取得できること、Mozilla HTTP Observatory の評価が A+ であること | 毎週・配信設定の変更時 |
| [CodeQL](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/codeql.yml) | GitHub CodeQL による静的解析 | コード変更時・毎週 |
| [Secrets](https://github.com/satsuki19980613/Kagaribi-Stat-Hub/actions/workflows/secrets.yml) | gitleaks による秘密情報（API キー・トークン・パスワード・秘密鍵など）の検査。全ブランチの全履歴が対象 | コード変更時・毎週 |
| [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=kagaribi-stat-hub.wsk641.workers.dev) | 公開サイトのセキュリティヘッダー。**A+**（125 点、12 項目すべて合格。2026-10-10 測定）。Live が毎週測定し、A+ 未満なら失敗とする | リンク先で随時再測定できる |

### 脆弱性の報告

[SECURITY.md](SECURITY.md) を参照。リポジトリの Security タブから非公開で報告できる。

### 記載方針

本節は次の指針に基づいて構成している。

- 要点を先に、詳細を後に示す（英国 ICO の[段階的な情報提供](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/)）
- 取り扱う情報を定型の表で示す（カーネギーメロン大学の[プライバシーの「栄養成分表示」の研究](https://doi.org/10.1145/1753326.1753561)。Apple・Google のアプリストアの表示も同じ考え方）
- 保証範囲と制約、想定する脅威と対策の根拠を示す（[OpenSSF Best Practices](https://www.bestpractices.dev/en/criteria/1)）
- 報告窓口と実施中の検証を示す（[GitHub のリポジトリのベストプラクティス](https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories)）

## 開発

### 必要環境

- [Node.js](https://nodejs.org/) 20 以上（Windows / macOS / Linux）

### コマンド

| コマンド | 内容 |
|---|---|
| `npm install` | 依存パッケージのインストール |
| `npm start` | ビルドして配信（http://localhost:4181/）。セキュリティヘッダーも本番と同じ。同一ネットワークのスマートフォンからは `npm run preview -- --host` の URL で開く |
| `npm run dev` | 開発サーバー（ホットリロード。http://localhost:5181/） |
| `npm test` | 単体テスト（Vitest） |
| `npm run typecheck` | 型検査 |
| `npm run build:demo` | サンプルデータ入りのデモ版を `dist-demo/` にビルド。`npx vite preview --outDir dist-demo` で開く |
| `npm run icons` | `public/icon.svg` から PWA のアイコン（PNG）を生成 |
| `npm run ranking` | X の集計ポストからクラブ順位を `public/data/clubs.json` に取り込む |
| `node scripts/live-check.mjs` | 公開サイトの検証（Live と同じ。`SITE=` で対象を変更できる） |

デモ版は「今日」を 2026/12/17 として表示し、S32 で「急遽 1 日短縮・11/17 休催」の手動修正の例を示す。メニューの「サンプルに戻す」で初期状態に戻せる。

### ディレクトリ構成

```
src/
  domain/     純粋ロジック（得点・シーズン判定・集計・1 日分の保存計画・バックアップ）とテスト
  data/       IndexedDB の保存層・クラブ順位の読み込み・自動バックアップ
  screens/    画面（メニュー・記録・履歴・メンバー・スタッツ・シーズン設定・バックアップ）
  components/ 共通 UI・SVG チャート・焚き火背景
  demo/       デモ版のサンプルデータ
```

### 関連資料

- デプロイとスマートフォンへのインストール（Cloudflare。`main` への反映で自動配信）：[DEPLOY.md](DEPLOY.md)
- クラブ順位の取り込み：[docs/GUIDE.md](docs/GUIDE.md#クラブ順位上位30)
- デザイン：[kagaribiICM](https://github.com/satsuki19980613/kagaribiICM)（直角・焚き火背景）を基に、ルルルン風のピンクに寄せている
