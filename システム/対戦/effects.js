// カード効果の実装と対象選択ヒューリスティック
const { CARD_DB } = require('./cards.js');
const E = require('./engine.js');
const K = require('./knobs.js');

// ---- ルック ----
function topCost(p) { return p.deck.length ? CARD_DB[p.deck[0]].cost : null; }
function lookOdd(p) { const c = topCost(p); return c !== null && c % 2 === 1; }
function lookEven(p) { const c = topCost(p); return c !== null && c % 2 === 0; }

// ---- 残火：このターンに自分がスペルを使っていたか（場に出たとき1回だけ判定）----
// 師ベルゼを出したあとはバトル終了までON、火の子が場にいるあいだは常にON（デッキ固有能力・カード一覧/02_火の子）
function afterburn(p) { return p.afterburnAlways || p.board.some((u) => u.name === '火の子') || p.spellsThisTurn > 0; }

// ---- 解放／全解放 ----
function released(p) { return p.maxMp >= 8; }
function fullyReleased(p) { return p.maxMp >= 10; }

// ---- 不屈（ガイル）／連携（シュリ）／表裏（ヴェイン）----
function unyielding(p) { return p.leaderHp <= 15; }
// 癒し状態（プリースト）：このターンに味方リーダーのHPを1以上回復している
function soothed(p) { return !!p.healedLeaderThisTurn; }
function chain(p) { return p.cardsThisTurn + p.chainBonus; }
// 黒の効果はヴェインだけが使える。ほかのリーダーは常に白として扱う
function isBlack(p) { return p.leader === 'ヴェイン' && p.side === '黒'; }
function isWhite(p) { return !isBlack(p); }

// ---- 手札にある間のコスト修正（ギズモ：手札で働く）----
// 立てなくなるまで：3ダメージ。不屈ならリーダーの攻撃力ぶん上乗せ
function tatenakuDamage(p) {
  return 3 + (unyielding(p) ? E.leaderAtkTotal(p) : 0);
}

function handCostMod(p, name) {
  if (name === 'ギズモ' && afterburn(p)) return 1;
  return 0;
}

// ---- 対象選択 ----
function threat(u) { return u.atk * 2 + u.hp + (u.kw.has('守護') ? 4 : 0); }
function best(list) { return list.slice().sort((a, b) => threat(b) - threat(a))[0]; }

// p の効果で対象に取れる敵キャラクター
function targetable(g, p) {
  return g.opp(p).board.slice();
}

function chooseDamageTarget(g, p, dmg, opts) {
  opts = opts || {};
  const foe = g.opp(p);
  const units = targetable(g, p);
  const faceOk = opts.faceOk !== false;
  if (faceOk && foe.leaderHp <= dmg) return { type: 'leader', p: foe };
  const killable = units.filter((u) => u.hp <= dmg);
  const taunts = killable.filter((u) => u.kw.has('守護'));
  if (K.knob(g, p, 'attackStyle') === 'aggro') {
    if (taunts.length) return { type: 'unit', u: best(taunts) };
    if (faceOk) return { type: 'leader', p: foe };
    if (killable.length) return { type: 'unit', u: best(killable) };
  } else {
    if (killable.length) {
      const b = best(killable);
      if (threat(b) >= K.knob(g, p, 'burnKillThreat') || !faceOk) return { type: 'unit', u: b };
    }
    if (faceOk) return { type: 'leader', p: foe };
  }
  if (units.length) return { type: 'unit', u: best(units) };
  return faceOk ? { type: 'leader', p: foe } : null;
}

// ---- デッキ・墓地の検索 ----
function searchDeck(p, pred, score) {
  let bestIdx = -1, bestScore = -Infinity;
  for (let i = 0; i < p.deck.length; i++) {
    if (!pred(p.deck[i])) continue;
    const s = score ? score(p.deck[i]) : 0;
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  }
  return bestIdx;
}

// デッキから1枚を手札に加えてシャッフルする
function tutor(g, p, pred, score) {
  const idx = searchDeck(p, pred, score);
  if (idx >= 0) p.hand.push(p.deck.splice(idx, 1)[0]);
  p.deck = E.shuffle(p.deck, g.rng);
}

// 復活先の評価への上乗せ（死亡時効果でもう一度得をするもの）
const REVIVE_BONUS = { '長屋の病人': 3 };

function reviveFromGrave(g, p, maxCost, opts) {
  opts = opts || {};
  let bestIdx = -1, bestVal = -1;
  for (let i = 0; i < p.grave.length; i++) {
    const d = CARD_DB[p.grave[i]];
    if (d.kind !== 'unit' || d.cost > maxCost) continue;
    if (opts.exclude && p.grave[i] === opts.exclude) continue;
    const v = (opts.value ? opts.value(p.grave[i]) : 0) || d.atk + d.hp + (REVIVE_BONUS[p.grave[i]] || 0);
    if (v > bestVal) { bestVal = v; bestIdx = i; }
  }
  if (bestIdx < 0 || E.boardFull(p)) return null;
  const name = p.grave.splice(bestIdx, 1)[0];
  const u = E.putUnit(g, p, name);
  if (u && opts.hpOne) u.hp = 1;
  return u;
}

// 「聖徒」タグ持ちをサーチするときの優先度（アルベル）
const SEITO_PRIORITY = {
  '聖騎士ザキエル': 100, '怒れる聖職者アン': 80, '老司祭ドラン': 70, '怪我をした修道女キーラ': 30,
};

// 味方1体の回復先を選ぶ（減っているキャラクター優先、いなければリーダー）
function chooseHealTarget(g, p) {
  if (!soothed(p) && p.leaderHp < 25 && p.hand.includes('聖鳥リフルエル') && E.cardCost(p, '聖鳥リフルエル') <= p.mp) {
    return { type: 'leader', p };
  }
  const hurt = p.board.filter((u) => u.hp < u.maxhp);
  if (hurt.length) return { type: 'unit', u: hurt.slice().sort((a, b) => (b.maxhp - b.hp) - (a.maxhp - a.hp))[0] };
  return { type: 'leader', p };
}

// 火口の洞守りの死亡時にデッキから加えるスペル（特技）の優先度
const HORAMORI_SPELL_PRIORITY = { '焔弾': 4, '焼き払い': 3, '火の粉': 2 };

// 貪りの供物で差し出す味方。死亡時が得になるものを優先し、無ければ一番小さいもの
const SACRIFICE_PRIORITY = { '霊脈喰らい': 30, '眷属': 20, '無様な魔物': 20 };
function chooseSacrifice(p) {
  if (!p.board.length) return null;
  return p.board.slice().sort((a, b) =>
    ((SACRIFICE_PRIORITY[b.name] || 0) - b.value) - ((SACRIFICE_PRIORITY[a.name] || 0) - a.value))[0];
}

// 玉座の使い魔で加えるコスト8以上
function thronePick() {
  const prio = { '魔王ヴァルカス': 40, '六罪 ミゼリア': 20 };
  return (n) => prio[n] || 0;
}

// 六罪 ミゼリアで復活させる優先度。召喚時効果の強いものから
const MISERIA_REVIVE = { '六罪 グラーク': 40, '六罪 ヴェルド': 30, '霊脈喰らい': 20 };

// 倒せる相手を優先して1体選ぶ
function pickKill(list, dmg) {
  const killable = list.filter((u) => u.hp <= dmg);
  return best(killable.length ? killable : list);
}

// カード効果が「強化を1回行う」ときに、攻撃力と防御力のどちらを伸ばすか
function pickStrengthenStat(g, p) {
  const foe = g.opp(p);
  const incoming = E.leaderAtkTotal(foe) - p.leaderDef;
  const outgoing = E.leaderAtkTotal(p) - foe.leaderDef;
  return incoming >= outgoing ? 'def' : 'atk';
}

// ---- 表裏（ヴェイン）----
// 「白：」「黒：」の常在効果を今の状態に合わせる
function refreshSide(p) {
  const black = isBlack(p);
  for (const u of p.board) {
    if (u.name === 'さまよう魂') {
      if (black) u.kw.delete('守護'); else u.kw.add('守護');
      if (black && !u._sideAtk) { u.atk += 1; u._sideAtk = true; }
      if (!black && u._sideAtk) { u.atk = Math.max(0, u.atk - 1); u._sideAtk = false; }
    } else if (u.name === '魔軍一の剣') {
      if (black) { u.kw.delete('守護'); u.kw.add('必殺'); } else { u.kw.add('守護'); u.kw.delete('必殺'); }
    } else if (u.name === '黒いヴェイン') {
      if (black) u.kw.add('突進'); else u.kw.delete('突進');
    }
  }
}

function flip(g, p) {
  if (p.leader !== 'ヴェイン') return;
  p.side = p.side === '白' ? '黒' : '白';
  refreshSide(p);
  for (const u of p.board.slice()) {
    if (u.name === '罪の影') { u.atk += 1; u.maxhp += 1; u.hp += 1; }
  }
}

// どちらの面が今の盤面と手札に合っているか（AIの判断）
function sideValue(g, p, black) {
  const foe = g.opp(p);
  let v = 0;
  for (const u of p.board) {
    if (u.name === 'さまよう魂') v += black ? 1 : 1.5;
    else if (u.name === '魔軍一の剣') v += black ? 2 : 1.5;
    else if (u.name === '黒いヴェイン') v += black ? 2 : 0;
  }
  if (p.weapon && p.weapon.name === '呪剣ノア') v += black ? 2 : (p.leaderHp < 25 ? 1.5 : 0);
  if (black) {
    if (p.hand.includes('気まぐれの一太刀')) v += 1;
    if (p.hand.includes('皆殺しの命令') && foe.board.length >= 2) v += 1.5;
    if (p.hand.includes('黒いヴェイン')) v += 1;
    if (foe.board.length) v += 1;
  } else {
    if (p.leaderHp <= 15) v += 2;
    if (p.hand.includes('皆殺しの命令') && p.board.length >= 2) v += 1;
  }
  return v;
}
function wantBlack(g, p) { return sideValue(g, p, true) > sideValue(g, p, false); }

// ---- 捨てる・選別（トバル）----
// 捨てる札の優先度。選別で得をする札、薬草、今は使えない重い札の順
function discardPriority(g, p, name) {
  if (name === '早馬の隊商') return E.boardFull(p) ? 1 : 10;
  if (name === '毒入りの霊薬') return 9;
  if (name === '薬草') return p.hand.includes('捨て値の毒') ? 4 : 7;
  return (CARD_DB[name].cost - p.maxMp) * 0.5 - 2;
}

// 捨てたカードは墓地へ置く。薬草はデッキの外のカードなので消える
function discardNames(g, p, names) {
  if (!names.length) return;
  p.discardedThisTurn = true;
  for (const name of names) if (!CARD_DB[name].token) p.grave.push(name);
  for (const name of names) {
    if (g.over) return;
    onDiscard(g, p, name);
  }
}

function discardOne(g, p) {
  if (!p.hand.length) return;
  let idx = 0, bestS = -Infinity;
  for (let i = 0; i < p.hand.length; i++) {
    const s = discardPriority(g, p, p.hand[i]);
    if (s > bestS) { bestS = s; idx = i; }
  }
  discardNames(g, p, p.hand.splice(idx, 1));
}

// 選別：手札から捨てられたとき
function onDiscard(g, p, name) {
  if (name === '早馬の隊商') {
    if (E.boardFull(p)) return;
    const gi = p.grave.lastIndexOf(name);
    if (gi >= 0) p.grave.splice(gi, 1);
    E.recPlay(g, p, name);
    E.putUnit(g, p, name);
  } else if (name === '毒入りの霊薬') {
    E.recPlay(g, p, name);
    E.damageLeader(g, g.opp(p), 2, p, name);
    if (!g.over) E.draw(g, p, 1);
  }
}

function addHerbs(p, n) {
  for (let i = 0; i < n; i++) p.hand.push('薬草');
}

// 結晶の粉：倒せる敵、並べる味方がいなければ一番強い敵、それ以外は一番強い味方
function crystalTarget(g, p) {
  const foes = targetable(g, p);
  const killable = foes.filter((u) => u.hp <= 2);
  if (killable.length) return best(killable);
  if (foes.length && !p.board.length) return best(foes);
  if (p.board.length) return p.board.slice().sort((a, b) => b.atk - a.atk)[0];
  return foes.length ? best(foes) : null;
}

// 型の写本で墓地から拾う優先度
const KATA_PRIORITY = {
  '掌打': 5, '朝駆け': 4, '弟弟子カイ': 4, '牽制の拳': 3, 'ガンザの門下生': 3, '息を整える': 2, '組み手の兄弟子': 2,
};

// ---- 場に出たとき（手札・効果どちらでも発動）----
function onEnter(g, p, u) {
  if (u.name === 'ポルカ') {
    if (p.board.some((x) => x.name === 'マルカ')) u.kw.add('突進');
  }
  refreshSide(p);
}

// ---- 召喚時（手札から使って場に出したときだけ）----
function onSummon(g, p, u) {
  const foe = g.opp(p);
  // ブースト：召喚時にパワーを+1する（ルール/06_キーワード能力）
  if (u.kw.has('ブースト')) E.chargePower(g, p, 1);
  switch (u.name) {
    // ---- アグロリーゼ ----
    case '学舎の見習い':
      E.boostLeader(g, p, 1, 0);
      break;
    case '憤怒のヴェルド': {
      const cand = targetable(g, p);
      if (cand.length) {
        const t = best(cand);
        t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
        E.boostLeader(g, p, 3, 0);
      }
      break;
    }
    case '師ベルゼ':
      p.afterburnAlways = true;
      for (const x of foe.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      break;

    // ---- ミッドレンジ奇数エルナ ----
    case 'オルレアの民':
      if (lookOdd(p)) u.atk += 1;
      break;
    case '凶兆のまたたき':
      if (lookOdd(p)) {
        const t = chooseDamageTarget(g, p, 3, { faceOk: false });
        if (t) E.dealTo(g, t, 3, p, u.name);
      }
      break;
    case '使い魔サキュ':
      if (lookOdd(p)) E.draw(g, p, 1);
      break;
    case '夜番の観測者':
      if (lookOdd(p)) { u.atk += 1; u.maxhp += 1; u.hp += 1; }
      break;
    case '守り役オルド': {
      const seen = p.deck.splice(0, Math.min(5, p.deck.length));
      const odd = seen.filter((n) => CARD_DB[n].cost % 2 === 1).sort((a, b) => CARD_DB[a].cost - CARD_DB[b].cost);
      const even = seen.filter((n) => CARD_DB[n].cost % 2 === 0);
      p.deck = odd.concat(p.deck, even);
      break;
    }
    case '姉マイア':
      E.chargePower(g, p, 1);
      break;
    case '相棒ヴァルザ':
      if (lookOdd(p)) {
        const t = chooseDamageTarget(g, p, 3, { faceOk: false });
        if (t) E.dealTo(g, t, 3, p, u.name);
      }
      break;
    case '写し手ヨナ': {
      const odd = lookOdd(p);
      reviveFromGrave(g, p, 4);
      if (odd) reviveFromGrave(g, p, 1);
      break;
    }
    case '天文台の護り':
      if (lookOdd(p)) E.healLeader(g, p, 4, p, u.name);
      break;
    case '双子の星占いエマ&エリ':
      if (lookOdd(p) && !u.token) {
        E.putUnit(g, p, '双子の星占いエマ&エリ', { token: true });
      }
      break;
    case '識りすぎたヴァルザ':
      if (p.grave.includes('相棒ヴァルザ')) u.kw.add('速攻');
      if (lookOdd(p)) u.kw.add('貫通');
      break;
    case '傲慢のノクス': {
      if (lookOdd(p)) {
        for (const x of foe.board.slice()) E.damageUnit(g, x, 4, p, u.name);
        E.damageLeader(g, foe, 4, p, u.name);
      } else if (lookEven(p)) {
        for (const x of p.board.slice()) E.damageUnit(g, x, 4, p, u.name);
        p.leaderHp -= 4;
        E.checkLeaders(g);
      }
      break;
    }

    // ---- コントロールアルベル ----
    case '癒しの人形':
      E.boostLeader(g, p, 0, 1);
      break;
    case '傷ついた巡礼者':
      E.damageUnit(g, u, 2, p, u.name);
      break;
    case '聖獣キメラ': {
      E.healLeader(g, p, 3, p, u.name);
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 3), 3, p, u.name);
      break;
    }
    case '聖騎士ザキエル': {
      const cand = targetable(g, p);
      if (cand.length) {
        const t = best(cand);
        t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
      }
      break;
    }
    case '老司祭ドラン':
      E.boostLeader(g, p, 2, 2);
      break;
    case '怒れる聖職者アン':
      // 「場全体」は敵味方のキャラクター（リーダーは含まない。ルール/06_キーワード能力 記法）
      for (const x of foe.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      for (const x of p.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      E.cleanup(g);
      break;
    case '偽善のミゼリア':
      p.spellDiscount = 99; // ターン終了時まで、次に使う特技（スペル）のコストを0にする
      break;
    case '聖鳥リフルエル': {
      const picked = [];
      const n = soothed(p) ? 3 : 2;
      for (let i = 0; i < n; i++) {
        if (E.boardFull(p)) break;
        const idx = searchDeck(p, (n) => CARD_DB[n].tag === '聖徒' && CARD_DB[n].cost <= 5 && !picked.includes(n),
          (n) => SEITO_PRIORITY[n] || 0);
        if (idx < 0) break;
        const name = p.deck.splice(idx, 1)[0];
        picked.push(name);
        // カードテキストが「その召喚時効果を発動する」と指定している
        const nu = E.putUnit(g, p, name);
        if (nu) onSummon(g, p, nu);
      }
      p.deck = E.shuffle(p.deck, g.rng);
      break;
    }

    // ---- ランプヴァルカス ----
    case '檻の番人':
      E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      if (released(p)) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      break;
    case '玉座の使い魔':
      tutor(g, p, (n) => CARD_DB[n].cost >= 8, thronePick());
      break;
    case '記憶喰らい':
      foe.power = Math.max(0, foe.power - 1);
      break;
    case '魔軍のヴェイン':
      if (released(p)) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      if (fullyReleased(p)) E.boostLeader(g, foe, -1, -1);
      break;
    case '霊脈喰らい':
      E.dealTo(g, chooseDamageTarget(g, p, 4), 4, p, u.name);
      break;
    case '六罪 ヴェルド':
      // 敵全体：敵リーダーと敵キャラクター
      E.damageLeader(g, foe, 3, p, u.name);
      for (const x of foe.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      E.cleanup(g);
      E.boostLeader(g, p, 2, 1);
      break;
    case '六罪 グラーク': {
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 7), 7, p, u.name);
      break;
    }
    case '六罪 ミゼリア': {
      const nu = reviveFromGrave(g, p, 9, { value: (n) => MISERIA_REVIVE[n] || 0 });
      if (nu) onSummon(g, p, nu);
      break;
    }
    case '六罪 ノクス': {
      const c = topCost(p);
      if (c === null) break;
      if (c <= 5) {
        u.kw.add('守護');
        E.draw(g, p, 3);
      } else {
        u.kw.add('速攻');
        const cand = targetable(g, p);
        if (cand.length) E.damageUnit(g, best(cand), 6, p, u.name);
      }
      break;
    }

    // ---- アグロトバル ----
    case '市場の荷運び':
      discardOne(g, p);
      break;
    case '隊商の用心棒':
      discardOne(g, p);
      u.kw.add('速攻');
      break;
    case '護衛バルド':
      if (p.discardedThisTurn) { u.atk += 2; u.maxhp += 2; u.hp += 2; u.kw.add('突進'); }
      break;
    case '運び屋ゴルダ':
      addHerbs(p, 3);
      break;
    case '隊商の頭':
      for (const x of p.board) x.atk += 1;
      break;
    case '強欲のネフィス':
      discardOne(g, p);
      if (!g.over) discardOne(g, foe);
      break;
    case '早馬の隊商': {
      u.atk += 1; u.maxhp += 1; u.hp += 1;
      u.kw.add('速攻');
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 4), 4, p, u.name);
      break;
    }
    case '弟子ザイル': {
      // 手札をすべて捨てる。選別で引いたカードは捨てない
      const names = p.hand.splice(0);
      discardNames(g, p, names);
      u.atk += names.length; u.maxhp += names.length; u.hp += names.length;
      u.kw.add('速攻');
      break;
    }

    // ---- コンボシュリ ----
    case 'ガンザの門下生': {
      const c = chain(p);
      if (c >= 2) { u.maxhp += 2; u.hp += 2; }
      if (c >= 4) { u.atk += 1; u.maxhp += 1; u.hp += 1; }
      break;
    }
    case '弟弟子カイ':
      E.draw(g, p, 1);
      break;
    case '組み手の兄弟子':
      if (chain(p) >= 1) u.kw.add('守護');
      break;
    case '岩窟の見張り': {
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 5), 5, p, u.name);
      break;
    }
    case '老師ロウ':
      // 最大MPを超えては回復しない
      if (chain(p) >= 3) p.mp = Math.max(p.mp, Math.min(p.maxMp, p.mp + 4));
      break;
    case '妹リン':
      E.damageLeader(g, p, 3, null, null);
      break;

    // ---- ミッドレンジヴェイン ----
    case '魔軍の小鬼':
    case '魔軍の剣兵':
    case '魔軍一の剣':
      E.chargePower(g, p, 1);
      break;
    case '魔軍の伝令':
      E.chargePower(g, p, 1);
      if (wantBlack(g, p) !== isBlack(p)) flip(g, p);
      break;
    case '六罪 ガドル':
      for (const x of p.board) { x.atk += 2; x.maxhp += 2; x.hp += 2; }
      break;
    case '六罪 ネフィス': {
      // 回復量は実際に減ったHPの合計。残りHPを超えたぶんは数えない
      let total = 0;
      for (const x of foe.board.slice()) {
        total += Math.max(0, Math.min(2, x.hp));
        E.damageUnit(g, x, 2, p, u.name);
      }
      const before = foe.leaderHp;
      E.damageLeader(g, foe, 2, p, u.name);
      total += Math.max(0, before - Math.max(0, foe.leaderHp));
      if (!g.over) E.healLeader(g, p, total, p, u.name);
      break;
    }

    // ---- ミッドレンジガイル ----
    case 'ロダンの傭兵': {
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 2), 2, p, u.name);
      break;
    }
    case '鍛冶師ドヴァル': {
      const n = unyielding(p) ? 3 : 2;
      for (let i = 0; i < n; i++) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      break;
    }
    case '傭兵仲間リナ': {
      const dmg = unyielding(p) ? 2 : 1;
      for (const x of foe.board.slice()) E.damageUnit(g, x, dmg, p, u.name);
      E.cleanup(g);
      break;
    }
    case '砦の古参兵':
      if (unyielding(p)) p.preventNext = true;
      break;
    case '剣術学校の師範':
      E.healLeader(g, p, 4, p, u.name);
      break;
    case '裏切りのグラーク': {
      // 自分以外の味方全体（自分のリーダーとほかのキャラクター）
      E.damageLeader(g, p, 3, null, null);
      for (const x of p.board.slice()) if (x !== u) E.damageUnit(g, x, 3, p, u.name);
      E.cleanup(g);
      break;
    }
    default:
      break;
  }
}

// ---- 死亡時 ----
function onDeath(g, p, u) {
  if (u.token) return;
  const foe = g.opp(p);
  if (u.name === '相棒ヴァルザ') {
    const idx = p.deck.indexOf('識りすぎたヴァルザ');
    if (idx >= 0) {
      p.hand.push(p.deck.splice(idx, 1)[0]);
      p.deck = E.shuffle(p.deck, g.rng);
    }
  } else if (u.name === '師ベルゼ') {
    E.damageLeader(g, foe, 5, p, u.name);
  } else if (u.name === '長屋の病人') {
    E.boostLeader(g, p, 0, 1);
  } else if (u.name === '火口の洞守り') {
    tutor(g, p, (n) => CARD_DB[n].kind === 'spell', (n) => HORAMORI_SPELL_PRIORITY[n] || 0);
  } else if (u.name === '無様な魔物') {
    E.dealTo(g, chooseDamageTarget(g, p, 2), 2, p, u.name);
  } else if (u.name === '眷属') {
    E.draw(g, p, 1);
  } else if (u.name === '癒しの人形') {
    E.freeStrengthen(g, p, pickStrengthenStat(g, p));
  } else if (u.name === '霊脈喰らい') {
    E.gainMaxMp(p, 1);
  } else if (u.name === '市場の売り子' || u.name === '弟子ザイル') {
    E.draw(g, p, 1);
  } else if (u.name === '黒いヴェイン') {
    if (isBlack(p)) {
      const gi = p.grave.lastIndexOf(u.name);
      if (gi >= 0) p.grave.splice(gi, 1);
      p.hand.push(u.name);
    }
  } else if (u.name === '兄ゲイン') {
    for (let i = 0; i < 3; i++) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
  }
}

// ---- ターン開始／終了 ----
function onTurnStart(g, p) { /* 該当カードなし */ }

function onTurnEnd(g, p) {
  for (const u of p.board.slice()) {
    if (g.over) return;
    if (u.name === '怪我をした修道女キーラ') {
      E.freeStrengthen(g, p, pickStrengthenStat(g, p));
    } else if (u.name === 'ドロテ') {
      E.damageLeader(g, g.opp(p), afterburn(p) ? 3 : 2, p, u.name);
    } else if (u.name === 'マルカ') {
      if (p.board.some((x) => x.name === 'ポルカ')) {
        u.maxhp += 1; u.hp += 1; u.kw.add('守護');
      }
    } else if (u.name === '空籠の行商人') {
      if (p.discardedThisTurn) u.atk += 2;
    } else if (u.name === '妹リン') {
      u.hp = Math.min(u.hp, 0);
    } else if (u.name === '魔王ヴァルカス') {
      E.boostLeader(g, p, 2, 2);
    } else if (u.name === '兵士長サム') {
      E.freeStrengthen(g, p, pickStrengthenStat(g, p));
    }
  }
}

// ---- パワーリンク ----
function onPowerLink(g, p, u) {
  if (u.name === 'マルカ') {
    const idx = p.hand.indexOf('ポルカ');
    if (idx >= 0 && !E.boardFull(p)) {
      p.hand.splice(idx, 1);
      E.recPlay(g, p, 'ポルカ');
      E.putUnit(g, p, 'ポルカ');
    }
  } else if (u.name === '姉マイア') {
    if (lookOdd(p)) {
      const foe = g.opp(p);
      for (const x of foe.board.slice()) E.damageUnit(g, x, 1, p, u.name);
      for (const x of p.board.slice()) E.damageUnit(g, x, 1, p, u.name);
    }
  }
}

// ---- リーダー回復時 ----
function onLeaderHealed(g, p) { p.healedLeaderThisTurn = true; }

// 焼き払い：異なる2体に4ダメージ。倒せる敵キャラクターを優先し、残りは敵リーダー
function burnDownTargets(g, p) {
  const foe = g.opp(p);
  const units = targetable(g, p);
  const out = [];
  if (foe.leaderHp <= 4) out.push({ type: 'leader', p: foe });
  const killable = units.filter((u) => u.hp <= 4).sort((a, b) => threat(b) - threat(a));
  for (const u of killable) if (out.length < 2) out.push({ type: 'unit', u });
  if (out.length < 2 && !out.some((t) => t.type === 'leader')) out.push({ type: 'leader', p: foe });
  const rest = units.filter((u) => !out.some((t) => t.u === u));
  if (out.length < 2 && rest.length) out.push({ type: 'unit', u: best(rest) });
  return out;
}

// ---- スペル ----
function castSpell(g, p, name, target) {
  const foe = g.opp(p);
  switch (name) {
    // ---- アグロリーゼ ----
    case '火の粉':
      E.dealTo(g, target || chooseDamageTarget(g, p, 1), 1, p, name);
      E.cleanup(g);
      E.draw(g, p, 1);
      break;
    case '焔弾': E.dealTo(g, target || chooseDamageTarget(g, p, 3), 3, p, name); break;
    case '焼き払い': {
      const targets = target && target.type === 'leader'
        ? [target].concat(burnDownTargets(g, p).filter((t) => t.type === 'unit').slice(0, 1))
        : burnDownTargets(g, p);
      for (const t of targets) E.dealTo(g, t, 4, p, name);
      E.cleanup(g);
      break;
    }
    // ---- ミッドレンジ奇数エルナ ----
    case '先を読む力': {
      E.dealTo(g, target || chooseDamageTarget(g, p, 1), 1, p, name);
      E.draw(g, p, 1);
      if (g.over) return;
      // 奇数カードをデッキトップに置いてルックを仕込む
      let idx = -1, bestCost = -1;
      for (let i = 0; i < p.hand.length; i++) {
        const c = CARD_DB[p.hand[i]].cost;
        if (c % 2 === 1 && c > bestCost) { bestCost = c; idx = i; }
      }
      if (idx < 0) {
        for (let i = 0; i < p.hand.length; i++) {
          const c = CARD_DB[p.hand[i]].cost;
          if (c > bestCost) { bestCost = c; idx = i; }
        }
      }
      if (idx >= 0) p.deck.unshift(p.hand.splice(idx, 1)[0]);
      break;
    }
    case '深読み': {
      const dmg = lookOdd(p) ? 6 : 2;
      const t = target || chooseDamageTarget(g, p, dmg, { faceOk: false });
      E.dealTo(g, t, dmg, p, name);
      E.cleanup(g);
      E.draw(g, p, 1);
      break;
    }

    // ---- コントロールアルベル ----
    case '小さな手当て': {
      const t = target || chooseHealTarget(g, p);
      if (t.type === 'unit') E.healUnit(g, t.u, 2, p, name);
      else E.healLeader(g, p, 2, p, name);
      E.draw(g, p, 1);
      break;
    }
    case '禁術・蘇生':
      reviveFromGrave(g, p, 2);
      break;
    case '謎の日記': {
      // 「敵キャラクター1体まで」：リーダーは対象にならず、対象がいなくてもダメージ以外は解決する
      const cand = targetable(g, p);
      if (cand.length) E.dealTo(g, target || { type: 'unit', u: pickKill(cand, 4) }, 4, p, name);
      E.cleanup(g);
      E.draw(g, p, 1);
      break;
    }
    case '死のパレード':
      E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      reviveFromGrave(g, p, 3);
      reviveFromGrave(g, p, 3);
      break;

    // ---- ランプヴァルカス ----
    case '貪りの供物': {
      const s = chooseSacrifice(p);
      if (s) s.hp = Math.min(s.hp, 0);
      E.gainMaxMp(p, 1);
      E.cleanup(g);
      if (released(p)) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      if (fullyReleased(p)) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      break;
    }
    case '魔王の復活':
      E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      if (released(p)) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      if (fullyReleased(p)) E.freeStrengthen(g, p, pickStrengthenStat(g, p));
      break;
    case '王の一瞥':
      // 場全体：敵味方すべてのキャラクター
      for (const x of foe.board.slice().concat(p.board.slice())) E.damageUnit(g, x, 7, p, name);
      break;

    // ---- アグロトバル ----
    case '薬草の仕入れ':
      addHerbs(p, 2);
      break;
    case '結晶の粉': {
      // 味方なら+2/+2、敵なら-2/-2。最大HPも下がり、HPが0以下なら破壊される
      const t = crystalTarget(g, p);
      if (t && t.owner === p.idx) { t.atk += 2; t.maxhp += 2; t.hp += 2; }
      else if (t) {
        t.atk = Math.max(0, t.atk - 2); t.maxhp -= 2; t.hp -= 2;
        t._killer = name; t._killerOwner = p.idx;
      }
      E.cleanup(g);
      break;
    }
    case '捨て値の毒':
      p.poisonHerbs = true;
      break;
    case '薬草':
      if (p.poisonHerbs) {
        const t = target && target.type === 'leader' && target.p !== p ? target : chooseDamageTarget(g, p, 1);
        E.dealTo(g, t, 1, p, name);
      } else {
        const t = chooseHealTarget(g, p);
        if (t.type === 'unit') E.healUnit(g, t.u, 1, p, name);
        else E.healLeader(g, p, 1, p, name);
      }
      break;
    case '毒入りの霊薬':
      E.damageLeader(g, foe, 4, p, name);
      break;

    // ---- コンボシュリ ----
    case '朝駆け':
      E.draw(g, p, 1);
      break;
    case '牽制の拳': {
      const dmg = chain(p) >= 3 ? 3 : 1;
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, dmg), dmg, p, name);
      break;
    }
    case '掌打': {
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 4), 4, p, name);
      break;
    }
    case '息を整える':
      E.healLeader(g, p, 3, p, name);
      E.draw(g, p, 1);
      break;
    case '型の写本':
      for (let i = 0; i < 2; i++) {
        let bi = -1, bs = -Infinity;
        for (let j = 0; j < p.grave.length; j++) {
          const n = p.grave[j];
          if (CARD_DB[n].cost > 2) continue;
          const s = KATA_PRIORITY[n] || 1;
          if (s > bs) { bs = s; bi = j; }
        }
        if (bi < 0) break;
        p.hand.push(p.grave.splice(bi, 1)[0]);
      }
      break;
    case '拳で届かせる': {
      const dmg = chain(p) + 2;
      E.dealTo(g, target || chooseDamageTarget(g, p, dmg), dmg, p, name);
      break;
    }
    case '旋風脚': {
      const dmg = chain(p) >= 2 ? 4 : 2;
      for (const x of foe.board.slice()) E.damageUnit(g, x, dmg, p, name);
      break;
    }

    // ---- ミッドレンジヴェイン ----
    case '気まぐれの一太刀': {
      const dmg = isBlack(p) ? 4 : 2;
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, dmg), dmg, p, name);
      break;
    }
    case '逢瀬の記憶': {
      E.draw(g, p, 2);
      if (g.over) break;
      if (isWhite(p)) E.healLeader(g, p, 3, p, name);
      else {
        const cand = targetable(g, p);
        if (cand.length) E.damageUnit(g, pickKill(cand, 2), 2, p, name);
      }
      break;
    }
    case '皆殺しの命令':
      if (isBlack(p)) for (const x of foe.board.slice()) E.damageUnit(g, x, 2, p, name);
      else for (const x of p.board) { x.maxhp += 2; x.hp += 2; }
      break;
    case '千年の眠り': {
      flip(g, p);
      if (isWhite(p)) {
        E.healLeader(g, p, 6, p, name);
        E.draw(g, p, 1);
      } else {
        const cand = targetable(g, p);
        if (cand.length) {
          const t = best(cand);
          t.hp = 0; t._killer = name; t._killerOwner = p.idx;
        }
      }
      break;
    }

    // ---- ミッドレンジガイル ----
    case '踏み込み': {
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 3), 3, p, name);
      E.cleanup(g);
      break;
    }
    case '一騎打ち': {
      const cand = targetable(g, p);
      if (!cand.length) break;
      // 不屈でなければ味方リーダーに2ダメージ
      const t = best(cand);
      t.hp = 0; t._killer = name; t._killerOwner = p.idx;
      if (!unyielding(p)) E.damageLeader(g, p, 2, null, null);
      E.cleanup(g);
      break;
    }
    case '立てなくなるまで': {
      const dmg = tatenakuDamage(p);
      if (dmg > 0) E.dealTo(g, target || chooseDamageTarget(g, p, dmg), dmg, p, name);
      break;
    }
    default: break;
  }
}

// ---- パワースキル ----
function usePowerSkill(g, p) {
  E.recPlay(g, p, 'パワースキル');
  const stage = E.powerSkillStage(p);
  if (p.leader === 'リーゼ') {
    // 業火：第1段階1ダメージ／第2段階2ダメージ／第3段階4ダメージ
    const dmg = stage >= 3 ? 4 : stage >= 2 ? 2 : 1;
    E.dealTo(g, chooseDamageTarget(g, p, dmg, { faceOk: false }), dmg, p, 'パワースキル');
  } else if (p.leader === 'アルベル') {
    // 聖なる祈り：第1段階1回復／第2段階3回復／第3段階5回復+リーダーを+0/+1
    const heal = stage >= 3 ? 5 : stage >= 2 ? 3 : 1;
    const t = chooseHealTarget(g, p);
    if (t.type === 'unit') E.healUnit(g, t.u, heal, p, 'パワースキル');
    else E.healLeader(g, p, heal, p, 'パワースキル');
    if (stage >= 3) E.boostLeader(g, p, 0, 1);
  } else if (p.leader === 'ガイル') {
    // 鍛錬の剣：第1段階+1/+0／第2段階+1/+1／第3段階+2/+1
    if (stage >= 3) E.boostLeader(g, p, 2, 1);
    else if (stage >= 2) E.boostLeader(g, p, 1, 1);
    else E.boostLeader(g, p, 1, 0);
  } else if (p.leader === 'ヴァルカス') {
    // 吸魔：第1段階MP1回復／第2段階最大MP+1・MP1回復／第3段階さらに1枚引く
    if (stage >= 2) E.gainMaxMp(p, 1);
    p.mp = Math.min(p.maxMp, p.mp + 1);
    if (stage >= 3) E.draw(g, p, 1);
  } else if (p.leader === 'エルナ') {
    const seen = p.deck.splice(0, Math.min(3, p.deck.length));
    if (seen.length) {
      // 一番使えそうな1枚を手札に、残りは奇数を上・偶数を下に
      let pick = 0, bestScore = -Infinity;
      for (let i = 0; i < seen.length; i++) {
        const d = CARD_DB[seen[i]];
        const playable = d.cost <= p.maxMp + 1 ? 3 : 0;
        const s = d.cost + playable * 2 + (d.kind === 'unit' ? (d.atk + d.hp) / 4 : 2);
        if (s > bestScore) { bestScore = s; pick = i; }
      }
      const taken = seen.splice(pick, 1)[0];
      p.hand.push(taken);
      const odd = seen.filter((n) => CARD_DB[n].cost % 2 === 1);
      const even = seen.filter((n) => CARD_DB[n].cost % 2 === 0);
      p.deck = odd.concat(p.deck, even);
    }
  } else if (p.leader === 'トバル') {
    addHerbs(p, 1);
  } else if (p.leader === 'シュリ') {
    E.draw(g, p, 1);
    p.chainBonus += 1;
  } else if (p.leader === 'ヴェイン') {
    // 揺れる魂：裏返してよい。白なら味方1体3回復とリーダー1回復、黒なら敵キャラクター1体に3と敵リーダーに1
    const foe = g.opp(p);
    const blackPay = targetable(g, p).some((u) => u.hp <= 3) ? 3 : (foe.board.length ? 1.5 : 1);
    const hurtUnit = p.board.reduce((a, u) => Math.max(a, Math.min(3, u.maxhp - u.hp)), 0);
    const whitePay = Math.max(hurtUnit, Math.min(3, 25 - p.leaderHp)) * 0.7 + (p.leaderHp < 25 ? 0.5 : 0);
    const toBlack = sideValue(g, p, true) + blackPay > sideValue(g, p, false) + whitePay;
    if (toBlack !== isBlack(p)) flip(g, p);
    if (isBlack(p)) {
      const cand = targetable(g, p);
      if (cand.length) E.damageUnit(g, pickKill(cand, 3), 3, p, 'パワースキル');
      E.damageLeader(g, foe, 1, p, 'パワースキル');
    } else {
      const t = chooseHealTarget(g, p);
      if (t.type === 'unit') E.healUnit(g, t.u, 3, p, 'パワースキル');
      else E.healLeader(g, p, 3, p, 'パワースキル');
      E.healLeader(g, p, 1, p, 'パワースキル');
    }
  }
  p.power = 0;
  E.cleanup(g);
}

// ---- 武器を装備したとき ----
function onWeaponEquip(g, p, name) {
  if (name === '兵士の剣') E.draw(g, p, 1);
  else if (name === 'ドヴァルの遺作') {
    E.dealTo(g, chooseDamageTarget(g, p, 4), 4, p, name);
  }
}

// ---- 武器が壊れたとき ----
function onWeaponBreak(g, p, w) { /* 該当カードなし */ }

// ---- キャラクターが攻撃されたとき（戦闘ダメージの前）----
function onAttacked(g, attackerOwner, target) {
  if (target.name === '渇望のガドル') E.damageLeader(g, attackerOwner, 1, g.opp(attackerOwner), target.name);
}

// ---- 武器の攻撃力の常在修正 ----
function weaponAtkMod(p) {
  const w = p.weapon;
  if (w.name === '呪剣ノア' && isBlack(p)) return 2;
  return 0;
}

// ---- ステージをレストにして発動したとき ----
function onStageActivate(g, p, st) {
  if (st.name === '消えぬ焔') E.boostLeader(g, p, 2, 0);
}

// ---- リーダーが受けるダメージの修正 ----
// 兄ゲイン：場にいるかぎり-3（0未満にならない）。砦の古参兵：実際に1回防ぐまで残る
function modifyLeaderDamage(g, target, amt) {
  if (target.board.some((u) => u.name === '兄ゲイン')) {
    amt = Math.max(0, amt - 3);
  }
  if (amt > 0 && target.preventNext) {
    target.preventNext = false;
    amt = 0;
  }
  return amt;
}

module.exports = {
  onEnter, onSummon, onDeath, onTurnStart, onTurnEnd, onPowerLink, onLeaderHealed,
  onWeaponEquip, onWeaponBreak, onAttacked, onStageActivate, weaponAtkMod, modifyLeaderDamage,
  castSpell, usePowerSkill, chooseDamageTarget, threat, best, targetable,
  lookOdd, lookEven, topCost, afterburn, handCostMod, tatenakuDamage, soothed,
  released, fullyReleased, chooseSacrifice, burnDownTargets,
  unyielding, chain, isBlack, isWhite, wantBlack, discardPriority,
};
