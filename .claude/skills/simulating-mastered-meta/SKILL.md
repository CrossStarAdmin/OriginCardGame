---
name: simulating-mastered-meta
description: 各デッキの打ち方を、1戦ごとの反省とシーズン単位の学習で鍛え続け、伸びが止まった「やりこんだ状態」の対戦表・エースカード・デッキ別の上達幅を出す。共通の対戦シミュレーター（`システム/対戦/`）を使う。「やりこんだらどうなる？」「上級者同士だと勝率は？」「遊び込んだ末の環境を知りたい」「最終的な環境は？」「遊び込むほど伸びるデッキは？」など、固定AIのぱっと見ではなく、熟練した状態の結果を知りたいときに使う。
---

# 熟練した状態の対戦結果

各デッキの打ち方（`システム/対戦/knobs.js` のつまみ）を、対戦相手ごとに学習させる。
**1戦ごとに反省して直す案を出し、試して、効いた案だけ身につける**、を伸びが止まるまで繰り返す。
伸びが止まった時点の対戦表を「やりこんだ結果の環境」とみなす。

ぱっと見の結果（固定AI）は `simulating-deck-matchups` スキルの役目。こちらは時間がかかる代わりに、遊び込んだ状態を出す。

## 構成

| 場所 | 中身 |
|---|---|
| `システム/対戦/` | **共通の対戦シミュレーター。** ルール、カードの実装、AI、つまみ（`knobs.js`）。[README](../../../システム/対戦/README.md) |
| `train.js` | シーズンを回す。対戦と反省 → 直す案を試す → 定着 → 評価 |
| `reflect.js` | 1戦ごとの反省。悪手を拾い、直す案に変える |
| `evaluate.js` | 打ち方のセットで総当たり・エースカード・既定の相手への勝率 |
| `report.js` | 学習結果のまとめ。2つの学習を渡すと再現確認もする |
| `common.js` | つまみの当て方、同じシードで比べる検定、シードの作り方 |
| `out/<学習名>/` | シーズンごとの打ち方と評価（`season-XX.json`）、条件と停止理由（`run.json`）。git管理外 |
| [reference/learning.md](reference/learning.md) | 学習の仕組み。反省の中身、採用の基準、公平さの約束、限界 |
| [reference/reading-results.md](reference/reading-results.md) | 結果の読み方。上達幅の定義、言ってよいこと・言えないこと |

## 実行環境

**コマンドはプロジェクトルートから実行する。** 日本語パスを含むので、Node は v22 のフルパスを使う。

```bash
"C:/Users/beron/scoop/apps/nvm/current/nodejs/nodejs/node.exe" .claude/skills/simulating-mastered-meta/train.js --seed 1
```

以降のコマンド例では `node` と書く。

## コマンド

| コマンド | 用途 |
|---|---|
| `node …/train.js --seed 1` | 学習の本番。結果は `out/seed-1/` |
| `node …/train.js --seed 9 --seasons 1 --reflect 20 --test 40 --eval 100 --gain 50 --out <スクラッチパッド>` | 動作確認用の小さな学習 |
| `node …/report.js out/seed-1 out/seed-2` | 結果のまとめと再現確認 |
| `node …/evaluate.js out/seed-1/season-XX.json 1000` | 途中のシーズンの打ち方で評価し直す |

`train.js` の主なオプション（既定値）：`--seasons 30` 上限 / `--reflect 200` 反省に使う対戦数 / `--test 400` 1案を試す対戦数 /
`--proposals 4` 1対面で試す案の数（ほかに攻め方の両方向とパワーの使い方1案を毎回試す）/ `--eval 1000` 評価の対戦数 / `--gain 400` 上達幅の対戦数 /
`--minGain 0.02` `--minZ 2.5` 採用基準 / `--patience 5` 停止判定。

## 進め方

以下のチェックリストを応答にコピーし、完了したステップにチェックを入れながら進める。

```
熟練環境の進捗:
- [ ] Step1. 前提を揃える（カードの実装と検証）
- [ ] Step2. 小さな学習で動作確認
- [ ] Step3. 本番の学習（seed 1）
- [ ] Step4. 再現確認（seed 2）
- [ ] Step5. 結果をまとめる
```

---

## Step1. 前提を揃える

学習は今のカードの実装の上で行う。**実装が古いまま学習すると、何十分もかけて古いカードの環境を出すことになる。**

1. `デッキ/<デッキ名>/カード一覧/*.md` と `システム/対戦/cards.js` `effects.js` を突き合わせる
2. 食い違いがあれば、`システム/対戦/reference/adding-cards.md` の手順で実装を直す。曖昧なテキストはユーザーに確認し、`rule-interpretations.md` に書き残す
3. 整合チェックと1試合の目視を通す

```bash
node システム/対戦/validate.js
node システム/対戦/trace.js アグロリーゼ コントロールアルベル 777
```

---

## Step2. 小さな学習で動作確認

本番の前に、出力先をスクラッチパッドにして小さく1シーズン回す。数十秒で終わる。

```bash
node .claude/skills/simulating-mastered-meta/train.js --seed 9 --seasons 1 --reflect 20 --test 40 --eval 100 --gain 50 --out <スクラッチパッド>/mastered-smoke
node .claude/skills/simulating-mastered-meta/report.js <スクラッチパッド>/mastered-smoke
```

確認すること：

- エラーなく `season-00.json` と `season-01.json` ができる
- シーズン1の所要時間。**本番の1シーズンは、ここの数十倍かかる**。本番の見込み時間をユーザーに伝えてから Step3 へ
- `learned` に反省（`findings`）と試した案（`tried`）が入っている

---

## Step3. 本番の学習

```bash
node .claude/skills/simulating-mastered-meta/train.js --seed 1 > <スクラッチパッド>/mastered-seed-1.log
```

**時間がかかるのでバックグラウンドで回す。** 終わったら `run.json` の停止理由を見る。
上限のシーズン数で止まった（伸びが止まる前に打ち切った）ときは、そう報告に書く。

---

## Step4. 再現確認

**シードを変えてもう1回学習する。** 1回の学習だけでは、その学習がたまたま見つけた打ち方かもしれない。

```bash
node .claude/skills/simulating-mastered-meta/train.js --seed 2 > <スクラッチパッド>/mastered-seed-2.log
```

seed 1 と seed 2 は並列に回してよい。

---

## Step5. 結果をまとめる

```bash
node .claude/skills/simulating-mastered-meta/report.js .claude/skills/simulating-mastered-meta/out/seed-1 .claude/skills/simulating-mastered-meta/out/seed-2 > <スクラッチパッド>/mastered-report.txt
```

読み方は **[reference/reading-results.md](reference/reading-results.md)** にまとめてある。読んでから書く。

報告には必ず次を含める。

- **最終の対戦表と総合勝率**：学習前（シーズン0）との比較。先攻・後攻の内訳も出す
- **上達幅**：デッキごと。遊び込むほど伸びるデッキか
- **各デッキが覚えた打ち方**：つまみの変化を、人が読める言葉にする（例：「リーゼは vs アルベルで攻め方を攻め寄りにした」）
- **エースカード**：最終の打ち方での上位
- **再現確認の結果**：2つの学習の最終対戦表の最大差。±3ptを超えたらそう書く
- **条件と停止理由**：シード、戦数、何シーズンで止まったか、なぜ止まったか
- **限界**：つまみに無い判断は学習できないこと（[reference/learning.md](reference/learning.md) の「学習できないこと」）

ユーザーがレポート形式を求めたら、アーティファクトとして公開してリンクを渡す。

---

## 注意事項

このスキルでやってほしくないこと。

- **Step1 を飛ばして学習しない。** カードの実装が古いと、学習結果ごと無駄になる
- **1回の学習だけで結論を出さない。** Step4 の再現確認を必ずする
- **デッキごとに学習の条件を変えない。** 反省の戦数・試す案の数・採用基準は全デッキ同じ。特定のデッキだけ多く学習させると、そのデッキが強いだけの結果になる
- **`システム/対戦/knobs.js` の既定値を学習結果で書き換えない。** 既定値は固定AIの打ち方で、`simulating-deck-matchups` の数字が変わってしまう
- **学習用のコードに、相手の手札やデッキの順番を覗かせない。** 人間に見えない情報で上達したことになる
- **このスキルの中にカードの効果を書かない。** 実装は `システム/対戦/` にだけ置く
- **ぱっと見の数字と、評価のシードが違うことを忘れない。** 比べるときはこのスキルのシーズン0（同じ評価シードでの既定の打ち方）を基準にする
- **学習結果を実際のプレイヤーの行動の代わりに扱わない。** 「つまみの範囲で上達しきったらこうなる」という傾向として使う
