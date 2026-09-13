# 対戦

`ルール/` を実装した対戦シミュレーター。デッキ同士を戦わせる部分だけを持ち、集計や学習はスキル側が持つ。

## 中身

| ファイル | 役割 |
|---|---|
| `cards.js` | カードのステータスとデッキリスト |
| `effects.js` | カードの効果と対象の選び方 |
| `engine.js` | ルール本体（ダメージ、戦闘、ターン進行、テンション） |
| `ai.js` | プレイ方針（マリガン、カードの評価、攻撃、テンション） |
| `knobs.js` | 打ち方のつまみ。既定値・学習で動かせる範囲・値の引き方。**何も渡さなければ既定値＝固定AIの打ち方** |
| `match.js` | 1試合の準備と進行（`playGame`）、先攻後攻を入れ替えたマッチの集計（`runMatch`）、総当たりの組み合わせ（`resolveMatchups`） |
| `validate.js` | デッキ定義と効果実装の整合チェック |
| `trace.js` | 1試合の進行をターンごとに出力する |
| [reference/adding-cards.md](reference/adding-cards.md) | カード・デッキを実装する手順とコードの型 |
| [reference/rule-interpretations.md](reference/rule-interpretations.md) | カードテキストが曖昧な箇所の決定済み一覧 |

## 使っているスキル

| スキル | 使うもの |
|---|---|
| `simulating-deck-matchups` | `match.js` で総当たり・エースカード・ミラーを回す。検証に `validate.js` `trace.js`。つまみは使わない（固定AI） |
| `simulating-mastered-meta` | `match.js` の `playGame` にデッキ別のつまみと手番ごとの記録（`observe`）を渡して学習し、`runMatch` で評価する |

## コマンド

プロジェクトルートから実行する。

```bash
"C:/Users/beron/scoop/apps/nvm/current/nodejs/nodejs/node.exe" システム/対戦/validate.js
"C:/Users/beron/scoop/apps/nvm/current/nodejs/nodejs/node.exe" システム/対戦/trace.js アグロリーゼ コントロールアルベル 777
```

## 直すときの注意

- **カードの実装はここだけ。** どのスキルの数字も同じ実装から出る。スキル側にカードの効果を書かない
- **ルール解釈は [reference/rule-interpretations.md](reference/rule-interpretations.md) に書き残す。** 解釈を変えたら `effects.js` も直し、変更日を書く
- **ここを変えると、全スキルの数字が同時に変わる。** 変更の前後で同じシードの総当たりを突き合わせ、意図しない差が出ていないか確かめる
- 乱数は必ず `g.rng` を使う。同じシードで同じ試合を再現できなくなる
- **`ai.js` に新しい判断基準の数値を足すときは `knobs.js` の既定値として足す。** 既定値を変えると固定AIの数字も変わるので、変えるなら変更の前後を突き合わせる
- 外部パッケージは使わない（Node標準のみ）
