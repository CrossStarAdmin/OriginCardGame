# システム

**複数のスキルが共通で使うコード。**どのスキルにも属さない。

スキル同士が直接依存すると、片方を消したり動かしたりしたときにもう片方が壊れる。
共通部分をここに置いて、**各スキルはここだけを見る**。

## フォルダ

| フォルダ | 役割 | 使っているスキル |
|---|---|---|
| [デッキ読み込み/](デッキ読み込み/) | `デッキ/<デッキ名>/overview.md` と `カード一覧/*.md` を読む（`decks.js`） | `generating-card-art` `showing-card-prompt` `importing-card-art` |
| [カード絵/](カード絵/README.md) | 絵の共通ルールを読み、イラストのプロンプトを組み立てる | `generating-card-art` `showing-card-prompt` `importing-card-art` |
| [対戦/](対戦/README.md) | 対戦シミュレーター（ルール、カードの実装、AI、打ち方のつまみ） | `simulating-deck-matchups` `simulating-mastered-meta` |

`カードフレーム/tools/compose.ps1` は `デッキ読み込み/decks.js` と同じ書式のmdを PowerShell で読んでいる。書式を変えるときは両方を直す。

## 置き方の約束

- **この直下にコードを置かない。** 役割ごとのフォルダに入れる。役割が増えたらフォルダを増やす
- **フォルダ同士は横に依存しない。** 複数の役割で使うものは、`デッキ読み込み/` のように独立したフォルダにする
- **スキルはフォルダ単位で使う。** 別のフォルダの中身を直接触らない
- パスは `__dirname` 起点で解決する。どのディレクトリから実行しても同じ場所を指す
- 外部パッケージは使わない（Node標準のみ）
- **Node.js v23.5.0 は日本語を含むパスで無出力のまま落ちる。** v22 系（`C:/Users/beron/scoop/apps/nvm/current/nodejs/nodejs/node.exe`）で実行する
