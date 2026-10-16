# このリポジトリで作業するときの決まり

## main に入れる前に（main へのマージ = 本番へのデプロイ）

`main` に入ると、Cloudflare がそのまま本番に配る（DEPLOY.md）。だから `main` へのマージは本番へのデプロイと同じ。
**SonarCloud が A になってからデプロイする**（ユーザーの決まり）。次の 1〜3 がすべてそろうまでマージしない。
ユーザーにマージを勧めるのも、そろってから。順位の取り込み（`.claude/skills/club-ranking`）も同じ。

1. PR の GitHub の検査がすべて成功している: `check`（CI）、`analyze` と `CodeQL`、`gitleaks`（Secrets）、`Workers Builds`（プレビュー）。
2. **`SonarCloud Code Analysis`** の検査が成功している（品質ゲート合格）。PR を出してから 5 分ほどかかり、ほかの検査より遅れて出る。
   これが出る前に「検査は全部通った」と判断しない。
3. SonarCloud の PR 解析で、品質ゲートが `OK`、新しい指摘が 0 件。品質ゲートは新しいコードの Security・Reliability・Maintainability が
   すべて A、Security Hotspots の確認が 100% であることを見ている。確かめ方（`<PR>` は PR の番号）:

   ```sh
   curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=satsuki19980613_Kagaribi-Stat-Hub&pullRequest=<PR>"
   curl -s "https://sonarcloud.io/api/issues/search?componentKeys=satsuki19980613_Kagaribi-Stat-Hub&pullRequest=<PR>&resolved=false"
   ```

   1 つ目の `status` が `OK`、2 つ目の `total` が 0 であること。`status` が `NONE` はまだ解析されていないので待つ。

指摘が出たら直して push し、1〜3 をもう一度待つ。

## マージしたあと

`main` の解析（マージの数分後）で、プロジェクト全体の評価がすべて A のままか確かめる。

```sh
curl -s "https://sonarcloud.io/api/project_branches/list?project=satsuki19980613_Kagaribi-Stat-Hub"
curl -s "https://sonarcloud.io/api/measures/component?component=satsuki19980613_Kagaribi-Stat-Hub&metricKeys=security_rating,reliability_rating,sqale_rating,security_review_rating"
```

1 つ目は main の `analysisDate` がマージより後で `qualityGateStatus` が `OK`、2 つ目は値がすべて `1.0`（= A）であること。
崩れていたら、すぐ直す PR を出してユーザーに知らせる。
