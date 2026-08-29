# カードとデッキの実装方法

## 目次

- ファイル構成
- Step A. カードを `cards.js` に登録する
- Step B. デッキリストを `cards.js` に登録する
- Step C. 効果を `effects.js` に実装する
  - 召喚時 / 死亡時 / ターン終了時 / テンションリンク / リーダー回復時 / スペル / テンションスキル
- よく使うヘルパー
- 対象の選び方
- 実装するときの落とし穴
- AIにカードを認識させる（`ai.js`）

---

## ファイル構成

| ファイル | 役割 | 触る頻度 |
|---|---|---|
| `cards.js` | カードのステータス、デッキリスト | カード追加のたび |
| `effects.js` | カードの効果、対象選択 | 効果を持つカードのたび |
| `ai.js` | プレイ方針、カードの評価値 | 新しい役割のカードを足したとき |
| `engine.js` | ルール本体（ダメージ、戦闘、ターン進行） | ルールが変わったときだけ |
| `run.js` `ace.js` `mirror.js` `trace.js` `validate.js` | 実行と集計 | 基本触らない |

---

## Step A. カードを `cards.js` に登録する

`CARD_DB` に1行足す。デッキファイルの表記をそのままキーにする。

```js
// ユニット：コスト / 攻撃力 / HP
'ヴェルド':       { kind: 'unit', cost: 5, atk: 5, hp: 2, kw: ['速攻'] },

// スペル：dmg は固定ダメージ量。効果が複雑ならここは省いて effects.js だけで書く
'焔弾':           { kind: 'spell', cost: 2, dmg: 3 },

// 種族タグを参照する効果があるカードには tag を付ける
'修道女キーラ':   { kind: 'unit', cost: 3, atk: 2, hp: 2, kw: ['守護'], tag: '聖徒' },
```

`kw` に書けるのは `ルール/06_キーワード能力.md` の常在キーワード（守護・突進・速攻・必殺・貫通）。
召喚時や死亡時などの誘発は `kw` ではなく `effects.js` に書く。

---

## Step B. デッキリストを `cards.js` に登録する

```js
'ミッドレンジ奇数エルナ': {
  style: 'midrange',        // aggro / midrange / control のどれか。AIの方針が変わる
  leader: 'エルナ',          // effects.js の useTensionSkill に同じ名前で分岐が要る
  list: { 'オルレアの民': 3, '使い魔サキュ': 3, /* … 合計40枚 */ },
},
```

`style` は勝ち筋で選ぶ。顔を詰めるなら `aggro`、盤面を取り合うなら `midrange`、
除去と回復で長引かせるなら `control`。

---

## Step C. 効果を `effects.js` に実装する

誘発のタイミングごとに関数が分かれている。該当する関数に分岐を足す。

### 召喚時 — `onSummon(g, p, u)`

`u` が出たユニット、`p` が持ち主、`g` がゲーム全体。`case` で足す。

```js
case '凶兆のまたたき':
  E.dealTo(g, chooseDamageTarget(g, p, 1), 1, p, u.name);
  break;

case '夜番の観測者':                       // ルック：奇数なら +1/+1
  if (lookOdd(p)) { u.atk += 1; u.maxhp += 1; u.hp += 1; }
  break;

case '聖騎士ザキエル': {                    // 敵キャラクター1体を破壊
  if (foe.board.length) {
    const t = best(foe.board);
    t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
  }
  break;
}
```

### 死亡時 — `onDeath(g, p, u)`

```js
if (u.name === '相棒ヴァルザ' && !u.token) {
  const idx = p.deck.indexOf('識りすぎたヴァルザ');
  if (idx >= 0) {
    p.hand.push(p.deck.splice(idx, 1)[0]);
    p.deck = E.shuffle(p.deck, g.rng);     // デッキを探したらシャッフルする
  }
}
```

### ターン終了時 — `onTurnEnd(g, p)`

```js
if (u.name === '癒しの人形ホミ') E.healLeader(g, p, 1, p, u.name);
else if (u.name === '長屋の病人') E.healUnit(g, u, 1, p, u.name);
```

### テンションリンク — `onTensionLink(g, p, u)`

テンションが上がるたび、場の自分のユニット全部に対して呼ばれる。

```js
if (u.name === 'マルカ') {
  const idx = p.hand.indexOf('ポルカ');
  if (idx >= 0 && !E.boardFull(p)) {
    p.hand.splice(idx, 1);
    E.recPlay(g, p, 'ポルカ');              // 統計に「使った」と記録する
    E.putUnit(g, p, 'ポルカ', { trigger: true });
  }
}
```

### リーダー回復時 — `onLeaderHealed(g, p)`

実際にHPが増えたときだけ呼ばれる（満タンでは誘発しない）。

### スペル — `castSpell(g, p, name, target)`

`target` はAIが渡してくる対象。無ければ自分で選ぶ。

```js
case '焔弾':
  E.dealTo(g, target || chooseDamageTarget(g, p, 3), 3, p, name);
  break;

case '記録を繰る':
  E.draw(g, p, 2);
  break;
```

### テンションスキル — `useTensionSkill(g, p)`

リーダーごとの分岐。`p.leader` で判定する。テンションの消費は関数の最後でまとめてやっている。

```js
} else if (p.leader === 'アルベル') {
  for (const x of p.board) E.healUnit(g, x, 3, p, 'テンションスキル');
  E.healLeader(g, p, 3, p, 'テンションスキル');
}
```

---

## よく使うヘルパー

| 呼び出し | 意味 |
|---|---|
| `E.dealTo(g, target, n, p, srcName)` | 対象に n ダメージ。target は `{type:'leader',p}` か `{type:'unit',u}` |
| `E.damageUnit(g, u, n, p, srcName)` | ユニットに直接 n ダメージ |
| `E.damageLeader(g, foe, n, p, srcName)` | リーダーに n ダメージ |
| `E.healUnit(g, u, n, p, srcName)` / `E.healLeader(...)` | 回復。最大値を超えない |
| `E.putUnit(g, p, '名前', { trigger: true })` | 場に出す。`trigger:false` で召喚時を発動させない |
| `E.draw(g, p, n)` | n枚引く。デッキ切れ敗北も処理される |
| `E.raiseTension(g, p, 1)` | テンションを上げる（おうえん用）。リンクも誘発する |
| `E.boardFull(p)` | 場が6体埋まっているか |
| `E.shuffle(p.deck, g.rng)` | シャッフル。**乱数は必ず `g.rng` を使う**（再現性のため） |
| `lookOdd(p)` / `lookEven(p)` | ルック。デッキトップのコストが奇数／偶数か |
| `best(list)` | 脅威度が最大のユニットを返す |
| `reviveFromGrave(g, p, maxCost, opts)` | 墓地から蘇生。`{hpOne:true}` でHP1にする |
| `E.recPlay(g, p, '名前')` | 統計に使用を記録。**手札を経由せず場に出すときは自分で呼ぶ** |

`srcName` は統計の帰属先。**必ずそのカード名を渡す。** 渡さないと顔ダメージや撃破数が集計されない。

---

## 対象の選び方

`chooseDamageTarget(g, p, dmg, opts)` がデッキの `style` を見て顔／ユニットを選び分ける。

- `{ faceOk: false }` — リーダーを狙えない効果（例：深読み「敵キャラクター1体」）
- 省略時 — リーダーも対象になる

自分で選ぶなら `foe.board` から条件で絞って `best()` に渡す。

---

## 実装するときの落とし穴

- **自傷ダメージの帰属**：味方を巻き込む効果（マーニャ、キングレオの偶数面）は、
  `srcPlayer` に**効果の持ち主**を渡す。相手を渡すと相手の撃破数に加算されてしまう
- **トークンの無限ループ**：コピーを出す効果（双つの未来）は `{ trigger: false, token: true }` で出す。
  `trigger: true` にするとコピーがまたコピーを出し続ける
- **墓地に入れない**：`token: true` のユニットは破壊されても墓地に残らない
- **デッキを探したらシャッフル**：`ルール/07_効果処理.md` の通り。`indexOf` で抜いたら `E.shuffle`
- **破壊はまとめて**：効果でHPを0にしたあと、`E.cleanup(g)` が呼ばれるまで破壊は起きない。
  召喚時のなかで複数体に触るときは順番を気にしなくてよい
- **`p.board` を回しながら破壊しない**：`p.board.slice()` でコピーしてから回す

---

## AIにカードを認識させる（`ai.js`）

`cardScore(g, p, name)` がプレイ優先度を決める。何も足さないと
ユニットは `攻撃力 + HP`、スペルは0点で評価され、**強力なスペルが一生プレイされない**。

```js
case '聖騎士ザキエル': s += bigThreat ? 7 : (enemyUnits.length ? 2 : 0); break;
case '傲慢のノクス': s += FX.lookOdd(p) ? 8 : -12; break;   // 撃ってはいけない状況は大きく下げる
```

スペルは `cardScore` の下半分の `switch` で必ず点数を付ける。
**打っても無意味な状況では `-100` を返す**（例：蘇生対象が墓地に無い「間に合わせの蘇生」）。そうしないとMPを捨てる。

リーサル（とどめ）に使える顔ダメージ源は `faceBurnOptions(g, p)` にも足す。
ここに無いカードはリーサル計算に入らず、勝てる場面を見逃す。
