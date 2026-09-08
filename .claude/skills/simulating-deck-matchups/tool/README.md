# カード調整卓（ブラウザ版）

`sim/` のシミュレーターをそのままブラウザで動かし、カードの数値をいじって勝率を見るツール。
アーティファクトとして公開して使う。

## 作り直す

`sim/` を直したら、そのつど作り直す。

```bash
node .claude/skills/simulating-deck-matchups/tool/build.js \
  .claude/skills/simulating-deck-matchups/sim \
  .claude/skills/simulating-deck-matchups/tool/template.html \
  <出力先>.html
```

日本語パスで落ちる場合は `node` を v22 のフルパスに置き換える（`sim/` と同じ制約）。

ビルドの最後に、生成したコードで1000戦を回して `run.js` と同じ勝率になるか検算する。
ズレたら移植が壊れているので、そこで止まる。

## 何をしているか

`cards.js` `engine.js` `effects.js` `ai.js` の4つを読み、`require` / `module.exports` を
IIFE の受け渡しに書き換えて `template.html` の `/*__SIM__*/` に差し込む。
**ロジックには一切手を入れない**ので、ツールとCLIの結果は常に一致する。

engine.js だけ1点だけ加工する。リーダーHPをツールから変えられるように
`const LEADER_HP` を `let` にして `setLeaderHp()` を生やす。

## ツールでいじれるもの

| いじれる | いじれない |
|---|---|
| コスト・攻撃力・HP・投入枚数 | 効果テキスト（`effects.js` に実装されている） |
| 常在キーワード（守護・突進・速攻・必殺・貫通） | 召喚時・死亡時などの誘発 |
| リーダーHP | AIのプレイ方針 |

効果そのものを変えたいときは `sim/effects.js` を直してから作り直す。

## 保存した調整を読み戻す

ツールは `db` ケイパビリティで調整内容を `presets` コレクションに保存する。
Artifact ツールの `read_db`（`db_op: "list"`, `collection: "presets"`）で読み出せるので、
「調整卓の〈名前〉をデッキファイルに反映して」と頼まれたらそこから取る。

保存されるのは基準値から変えたぶんだけ。

```json
{
  "name": "ギズモ2コスト戻し",
  "savedAt": "2026-09-08T...",
  "cards": { "ギズモ": { "cost": 2, "atk": 2, "hp": 2, "kw": ["速攻"] } },
  "lists": { "アグロリーゼ": { "火の子": 2 } },
  "leaderHp": 25,
  "winRates": { "アグロリーゼ": 53.8 },
  "games": 1000
}
```
