// カード効果の実装と対象選択ヒューリスティック
const { CARD_DB } = require('./cards.js');
const E = require('./engine.js');
const K = require('./knobs.js');

// ---- ルック ----
function topCost(p) { return p.deck.length ? CARD_DB[p.deck[0]].cost : null; }
function lookOdd(p) { const c = topCost(p); return c !== null && c % 2 === 1; }
function lookEven(p) { const c = topCost(p); return c !== null && c % 2 === 0; }

// ---- 残火：このターンに自分がスペルを使っていたか（場に出たとき1回だけ判定）----
// 師ベルゼを出したあとはバトル終了までON、火の子を出したターンはそのターン中ON
function afterburn(p) { return p.afterburnAlways || p.afterburnTurn || p.spellsThisTurn > 0; }
// スペル自身の残火は、そのスペルより前に別のスペルを撃っている必要がある
function afterburnForSpell(p) { return p.afterburnAlways || p.afterburnTurn || p.spellsThisTurn > 1; }

// ---- 解放／全解放 ----
function released(p) { return p.maxMp >= 8; }
function fullyReleased(p) { return p.maxMp >= 10; }

// ---- 手札にある間のコスト修正（ギズモ：手札で働く）----
function handCostMod(p, name) {
  if (name === 'ギズモ' && afterburn(p)) return 1;
  return 0;
}

// ---- 対象選択 ----
function threat(u) { return u.atk * 2 + u.hp + (u.kw.has('守護') ? 4 : 0); }
function best(list) { return list.slice().sort((a, b) => threat(b) - threat(a))[0]; }

// p の効果で対象に取れる敵キャラクター（檻の番人の対象耐性を除く）
function targetable(g, p) {
  return g.opp(p).board.filter((u) => !u.kw.has('対象耐性'));
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

function reviveFromGrave(g, p, maxCost, opts) {
  opts = opts || {};
  let bestIdx = -1, bestVal = -1;
  for (let i = 0; i < p.grave.length; i++) {
    const d = CARD_DB[p.grave[i]];
    if (d.kind !== 'unit' || d.cost > maxCost) continue;
    if (opts.exclude && p.grave[i] === opts.exclude) continue;
    const v = (opts.value ? opts.value(p.grave[i]) : 0) || d.atk + d.hp;
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
  const hurt = p.board.filter((u) => u.hp < u.maxhp);
  if (hurt.length) return { type: 'unit', u: hurt.slice().sort((a, b) => (b.maxhp - b.hp) - (a.maxhp - a.hp))[0] };
  return { type: 'leader', p };
}

// 火口の洞守りの死亡時にデッキから加えるスペルの優先度
const HORAMORI_SPELL_PRIORITY = { '焔弾': 4, '焼き払い': 3, '火の粉': 2, '消えぬ焔': 1 };

// 貪りの供物で差し出す味方。死亡時が得になるものを優先し、無ければ一番小さいもの
const SACRIFICE_PRIORITY = { '霊脈喰らい': 30, '眷属': 20, '無様な魔物': 20 };
function chooseSacrifice(p) {
  if (!p.board.length) return null;
  return p.board.slice().sort((a, b) =>
    ((SACRIFICE_PRIORITY[b.name] || 0) - b.value) - ((SACRIFICE_PRIORITY[a.name] || 0) - a.value))[0];
}

// 玉座の使い魔で加えるコスト8以上。敵が横に並んでいれば王の一瞥
function thronePick(g, p) {
  const wide = g.opp(p).board.length >= 3;
  const prio = {
    '王の一瞥': wide ? 50 : 10, '魔王ヴァルカス': 40, '六罪 ノクス': 30, '六罪 ミゼリア': 20,
  };
  return (n) => prio[n] || 0;
}

// 魔王の復活で墓地から戻すカード。解決中は直前に墓地へ置いた自分自身を除く
function graveReturnPick(p, resolving) {
  const pool = resolving ? p.grave.slice(0, -1) : p.grave;
  return pool.map((n, i) => ({ n, i, v: CARD_DB[n].cost })).sort((a, b) => b.v - a.v);
}

// ---- 場に出たとき（手札・効果どちらでも発動）----
function onEnter(g, p, u) {
  if (u.name === 'ポルカ') {
    if (p.board.some((x) => x.name === 'マルカ')) u.kw.add('速攻');
  }
}

// ---- 召喚時（手札から使って場に出したときだけ）----
function onSummon(g, p, u) {
  const foe = g.opp(p);
  switch (u.name) {
    // ---- アグロリーゼ ----
    case '火の子': {
      const t = chooseDamageTarget(g, p, 1, { faceOk: false });
      if (t) E.dealTo(g, t, 1, p, u.name);
      p.afterburnTurn = true;
      break;
    }
    case '学舎の見習い':
      if (afterburn(p)) u.atk += 2;
      break;
    case '教授ハルド':
      E.chargePower(g, p, 1);
      break;
    case 'ヴェルド': {
      const taunts = targetable(g, p).filter((x) => x.kw.has('守護'));
      if (taunts.length) {
        const t = best(taunts);
        t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
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
    case '癒しの人形': {
      const t = chooseHealTarget(g, p);
      if (t.type === 'unit') E.healUnit(g, t.u, 1, p, u.name);
      else E.healLeader(g, p, 1, p, u.name);
      break;
    }
    case '傷ついた巡礼者':
      E.damageUnit(g, u, 2, p, u.name);
      break;
    case '聖獣キメラ':
      E.healLeader(g, p, 2, p, u.name);
      break;
    case '聖騎士ザキエル': {
      const cand = targetable(g, p);
      if (cand.length) {
        const t = best(cand);
        t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
      }
      break;
    }
    case '老司祭ドラン': {
      const idx = searchDeck(p, (n) => CARD_DB[n].tag === '聖徒' && CARD_DB[n].cost <= 3,
        (n) => SEITO_PRIORITY[n] || 0);
      if (idx >= 0 && !E.boardFull(p)) {
        const name = p.deck.splice(idx, 1)[0];
        const nu = E.putUnit(g, p, name);
        if (nu) { nu.atk += 1; nu.maxhp += 1; nu.hp += 1; }
      }
      p.deck = E.shuffle(p.deck, g.rng);
      break;
    }
    case '怒れる聖職者アン':
      // 「味方全体」なのでリーダーも回復する（ルール/06）
      for (const x of foe.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      for (const x of p.board) E.healUnit(g, x, 3, p, u.name);
      E.healLeader(g, p, 3, p, u.name);
      break;
    case '偽善のミゼリア':
      // 「敵全体」はリーダーとキャラクター
      for (const x of foe.board.slice()) E.damageUnit(g, x, 1, p, u.name);
      E.damageLeader(g, foe, 1, p, u.name);
      p.spellDiscount = 99; // ターン終了時まで、次に使うスペルのコストを0にする
      break;
    case '聖鳥リフルエル': {
      for (let i = 0; i < 2; i++) {
        if (E.boardFull(p)) break;
        const idx = searchDeck(p, (n) => CARD_DB[n].tag === '聖徒' && CARD_DB[n].cost <= 5,
          (n) => SEITO_PRIORITY[n] || 0);
        if (idx < 0) break;
        const name = p.deck.splice(idx, 1)[0];
        // カードテキストが「その召喚時効果を発動する」と指定している
        const nu = E.putUnit(g, p, name);
        if (nu) onSummon(g, p, nu);
      }
      p.deck = E.shuffle(p.deck, g.rng);
      break;
    }

    // ---- ランプヴァルカス ----
    case '檻の番人':
      if (released(p)) { u.atk += 1; u.maxhp += 3; u.hp += 3; }
      break;
    case '玉座の使い魔':
      tutor(g, p, (n) => CARD_DB[n].cost >= 8, thronePick(g, p));
      break;
    case '眷属':
      if (released(p)) E.putUnit(g, p, '眷属');
      break;
    case '記憶喰らい':
      foe.power = Math.max(0, foe.power - 1);
      E.chargePower(g, p, 1);
      break;
    case '魔軍のヴェイン':
      if (fullyReleased(p)) u.kw.add('速攻');
      break;
    case '霊脈喰らい':
      E.dealTo(g, chooseDamageTarget(g, p, 3), 3, p, u.name);
      break;
    case '六罪 ヴェルド':
      for (const x of foe.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      break;
    case '六罪 ミゼリア': {
      // カードテキストが「その召喚時効果を発動する」と指定している
      const nu = reviveFromGrave(g, p, 5, { value: (n) => (n === '霊脈喰らい' ? 20 : 0) });
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
  } else if (u.name === '火口の洞守り') {
    tutor(g, p, (n) => CARD_DB[n].kind === 'spell', (n) => HORAMORI_SPELL_PRIORITY[n] || 0);
  } else if (u.name === '長屋の病人') {
    const cand = targetable(g, p);
    if (cand.length) E.damageUnit(g, best(cand), 3, p, u.name);
  } else if (u.name === '聖獣キメラ') {
    const cand = targetable(g, p);
    if (cand.length) E.damageUnit(g, best(cand), 2, p, u.name);
  } else if (u.name === '無様な魔物') {
    E.dealTo(g, chooseDamageTarget(g, p, 2), 2, p, u.name);
  } else if (u.name === '眷属') {
    E.draw(g, p, 1);
  } else if (u.name === '霊脈喰らい') {
    E.gainMaxMp(p, 1);
  }
}

// ---- ターン開始／終了 ----
function onTurnStart(g, p) { /* 該当カードなし */ }

function onTurnEnd(g, p) {
  for (const u of p.board.slice()) {
    if (g.over) return;
    if (u.name === '怪我をした修道女キーラ') {
      for (const x of p.board) E.healUnit(g, x, 1, p, u.name);
      E.healLeader(g, p, 1, p, u.name);
    } else if (u.name === 'ドロテ') {
      E.damageLeader(g, g.opp(p), 2, p, u.name);
    } else if (u.name === 'マルカ') {
      if (p.board.some((x) => x.name === 'ポルカ')) {
        u.maxhp += 1; u.hp += 1; u.kw.add('守護');
      }
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
function onLeaderHealed(g, p) { /* 該当カードなし */ }

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
    case '消えぬ焔': {
      // 場全体（敵味方のキャラクター）に3、お互いのリーダーに1。残火でそれぞれ+1
      const boost = afterburnForSpell(p) ? 1 : 0;
      const dmg = 3 + boost;
      const face = 1 + boost;
      for (const x of foe.board.slice()) E.damageUnit(g, x, dmg, p, name);
      for (const x of p.board.slice()) E.damageUnit(g, x, dmg, p, name);
      E.damageLeader(g, foe, face, p, name);
      p.leaderHp -= face;
      E.checkLeaders(g);
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
    case '謎の日記':
      E.dealTo(g, target || chooseDamageTarget(g, p, 4), 4, p, name);
      E.cleanup(g);
      E.draw(g, p, 1);
      break;
    case '死のパレード':
      reviveFromGrave(g, p, 3);
      reviveFromGrave(g, p, 3);
      break;

    // ---- ランプヴァルカス ----
    case '貪りの供物': {
      const s = chooseSacrifice(p);
      if (s) s.hp = Math.min(s.hp, 0);
      E.gainMaxMp(p, 1);
      E.cleanup(g);
      break;
    }
    case '魔王の復活': {
      const n = released(p) ? 2 : 1;
      const picks = graveReturnPick(p, true).slice(0, n).map((x) => x.i).sort((a, b) => b - a);
      for (const i of picks) p.hand.push(p.grave.splice(i, 1)[0]);
      break;
    }
    case '王の一瞥':
      for (const x of foe.board.slice()) E.damageUnit(g, x, 6, p, name);
      break;
    default: break;
  }
}

// ---- パワースキル ----
function usePowerSkill(g, p) {
  E.recPlay(g, p, 'パワースキル');
  if (p.leader === 'リーゼ') {
    E.dealTo(g, chooseDamageTarget(g, p, 2), 2, p, 'パワースキル');
  } else if (p.leader === 'アルベル') {
    for (const x of p.board) E.healUnit(g, x, 3, p, 'パワースキル');
    E.healLeader(g, p, 3, p, 'パワースキル');
  } else if (p.leader === 'ヴァルカス') {
    // 吸魔：最大MP+1してMPを1回復。最大MPが10なら代わりに1枚引く
    if (fullyReleased(p)) E.draw(g, p, 1);
    else { E.gainMaxMp(p, 1); p.mp += 1; }
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
  }
  p.power = 0;
  E.cleanup(g);
}

module.exports = {
  onEnter, onSummon, onDeath, onTurnStart, onTurnEnd, onPowerLink, onLeaderHealed,
  castSpell, usePowerSkill, chooseDamageTarget, threat, best, targetable,
  lookOdd, lookEven, topCost, afterburn, afterburnForSpell, handCostMod,
  released, fullyReleased, chooseSacrifice, graveReturnPick, burnDownTargets,
};
