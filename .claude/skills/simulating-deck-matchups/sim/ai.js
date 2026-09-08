// デッキごとのプレイ方針（AI）
const { CARD_DB } = require('./cards.js');
const E = require('./engine.js');
const FX = require('./effects.js');

const threat = FX.threat;

// ---- マリガン ----
function mulligan(g, p) {
  const keepMax = p.style === 'aggro' ? 3 : 4;
  const kept = [], returned = [];
  for (const c of p.hand) {
    if (CARD_DB[c].cost <= keepMax) kept.push(c); else returned.push(c);
  }
  p.hand = kept;
  p.deck = p.deck.concat(returned);
  for (let i = 0; i < returned.length; i++) p.hand.push(p.deck.shift());
  p.deck = E.shuffle(p.deck, g.rng);
}

// ---- カード評価 ----
function reviveBest(p, maxCost) {
  let v = 0;
  for (const n of p.grave) {
    const d = CARD_DB[n];
    if (d.kind === 'unit' && d.cost <= maxCost) v = Math.max(v, d.atk + d.hp);
  }
  return v;
}

function cardScore(g, p, name) {
  const foe = g.opp(p);
  const d = CARD_DB[name];
  const enemyUnits = foe.board;
  const enemyTaunts = enemyUnits.filter((u) => u.kw.has('守護'));
  const bigThreat = enemyUnits.filter((u) => threat(u) >= 8).length;

  if (d.kind === 'unit') {
    let s = d.atk + d.hp;
    if (d.kw) {
      if (d.kw.includes('速攻')) s += 3;
      if (d.kw.includes('突進')) s += 1;
      if (d.kw.includes('守護')) s += (p.style === 'aggro' ? 0 : 2);
    }
    switch (name) {
      // アグロリーゼ
      case '火の子': s += 1; break;
      case '学舎の見習い': s += FX.afterburn(p) ? 2 : 0; break;
      case 'ギズモ': s += FX.afterburn(p) ? 3 : 0; break;
      case 'ドロテ': s += FX.afterburn(p) ? 4 : 0; break;
      case 'マルカ': s += p.hand.includes('ポルカ') ? 3 : 0; break;
      case 'ポルカ': s += p.board.some((u) => u.name === 'マルカ') ? 3 : 0; break;
      case '教授ハルド': s += 1; break;
      case '火口の洞守り': s += enemyUnits.length ? 2 : 0; break;
      case 'ヴェルド': s += enemyTaunts.length ? 5 : 0; break;
      case '師ベルゼ': s += Math.min(6, enemyUnits.length * 2); break;
      // ミッドレンジ奇数エルナ
      case '凶兆のまたたき': s += 1; break;
      case '使い魔サキュ': s += FX.lookOdd(p) ? 2 : 0; break;
      case '夜番の観測者': s += FX.lookOdd(p) ? 2 : 0; break;
      case '姉マイア': s += 1; break;
      case '相棒ヴァルザ': s += 1; break;
      case '写し手ヨナ': s += reviveBest(p, 4) * 0.6; break;
      case '天文台の護り': s += (FX.lookOdd(p) && p.leaderHp < 22) ? 3 : 0; break;
      case '双つの未来': s += FX.lookOdd(p) ? 5 : 0; break;
      case '識りすぎたヴァルザ': s += p.grave.includes('相棒ヴァルザ') ? 6 : 0; s += FX.lookOdd(p) ? 3 : 0; break;
      case '傲慢のノクス': s += FX.lookOdd(p) ? 8 : -12; break;
      // コントロールアルベル
      case '傷ついた巡礼者': s -= 2; break;
      case '修道女キーラ': s += 3; break;
      case '聖獣キメラ': s += 3; break;
      case '聖騎士ザキエル': s += bigThreat ? 7 : (enemyUnits.length ? 2 : 0); break;
      case '老司祭ドラン': s += 3; break;
      case '祈る巡礼者': s += enemyUnits.length >= 2 ? 5 : (enemyUnits.length ? 2 : 0); break;
      case '偽善のミゼリア': s += enemyUnits.length >= 2 ? 5 : 2; break;
      case '継承の大鐘': s += 6; break;
      default: break;
    }
    return s;
  }

  // スペル
  switch (name) {
    // アグロリーゼ
    case '火の粉': return burnScore(g, p, 1);
    case '焔弾': return burnScore(g, p, 3);
    case '焼き払い': {
      if (!enemyUnits.length) return -100;
      const kills = enemyUnits.filter((u) => u.hp <= 2).length;
      return 1 + kills * 1.5 + (enemyUnits.length >= 2 ? 1 : 0);
    }
    case '消えぬ焔':
      return p.board.length ? 1 + p.board.length * 2.5 : -100;
    // ミッドレンジ奇数エルナ
    case '一手先を読む': return 2 + (enemyUnits.some((u) => u.hp <= 1) ? 2 : 0);
    case '深読み': {
      if (!enemyUnits.length) return -100;
      const dmg = FX.lookOdd(p) ? 6 : 2;
      const kill = enemyUnits.some((u) => u.hp <= dmg);
      return (kill ? 4 + dmg * 0.6 : 1) + 1;
    }
    // コントロールアルベル
    case '小さな手当て': return 2 + (p.leaderHp <= 22 ? 2 : 0) + (p.board.some((u) => u.hp < u.maxhp) ? 1 : 0);
    case '間に合わせの蘇生': return reviveBest(p, 2) > 0 ? 2 + reviveBest(p, 2) * 0.3 : -100;
    case '記録を繰る': return p.hand.length <= 5 ? 5 : 2;
    case '継ぐ者の儀': {
      const v = reviveBest(p, 3);
      return v > 0 && p.grave.filter((n) => CARD_DB[n].kind === 'unit' && CARD_DB[n].cost <= 3).length >= 2 ? 6 : -100;
    }
    default: return 0;
  }
}

function burnScore(g, p, dmg) {
  const foe = g.opp(p);
  if (foe.leaderHp <= dmg) return 100;
  const taunts = foe.board.filter((u) => u.kw.has('守護') && u.hp <= dmg);
  if (taunts.length && p.board.filter((u) => E.canAttackUnit(u)).length >= 2) return dmg + 3;
  return dmg * 0.9;
}

// ---- リーサル計算 ----
function faceBurnOptions(g, p) {
  const out = [];
  for (const n of new Set(p.hand)) {
    let dmg = 0;
    if (n === '火の粉') dmg = 1;
    else if (n === '焔弾') dmg = 3;
    else if (n === '火の子') dmg = 1;
    else if (n === '凶兆のまたたき') dmg = 1;
    else if (n === '偽善のミゼリア') dmg = 4;
    else if (n === '傲慢のノクス') dmg = FX.lookOdd(p) ? 4 : 0;
    if (dmg <= 0) continue;
    const count = p.hand.filter((x) => x === n).length;
    for (let i = 0; i < count; i++) {
      out.push({ name: n, cost: E.cardCost(p, n), dmg, isUnit: CARD_DB[n].kind === 'unit' });
    }
  }
  return out.sort((a, b) => (b.dmg / Math.max(1, b.cost)) - (a.dmg / Math.max(1, a.cost)));
}

function planLethal(g, p) {
  const foe = g.opp(p);
  if (foe.board.some((u) => u.kw.has('守護'))) return null;
  let dmg = 0;
  for (const u of p.board) if (E.canAttackLeader(u)) dmg += u.atk;
  let mp = p.mp;
  let slots = E.BOARD_MAX - p.board.length;
  const plan = [];
  // テンションスキル（リーゼのみ打点）
  let skill = false;
  if (p.leader === 'リーゼ') {
    if (p.tension === 3) { dmg += 2; skill = true; }
    else if (p.tension === 2 && mp >= 1 && !p.tensionRaisedThisTurn) { mp -= 1; dmg += 2; skill = true; }
  }
  // 消えぬ焔：味方全体に+2/+0と速攻。酔っていた子も殴れるようになる
  if (p.hand.includes('消えぬ焔') && E.cardCost(p, '消えぬ焔') <= mp && p.board.length) {
    mp -= E.cardCost(p, '消えぬ焔');
    for (const u of p.board) {
      if (u.frozen || u.attacked || u.atk <= 0) continue;
      dmg += E.canAttackLeader(u) ? 2 : (u.atk + 2);
    }
    plan.push({ name: '消えぬ焔', cost: 0, dmg: 0, isUnit: false });
  }
  for (const o of faceBurnOptions(g, p)) {
    if (o.cost > mp) continue;
    if (o.isUnit && slots <= 0) continue;
    mp -= o.cost;
    if (o.isUnit) slots -= 1;
    dmg += o.dmg;
    plan.push(o);
  }
  return dmg >= foe.leaderHp ? { plan, skill } : null;
}

function executeLethal(g, p, lethal) {
  const foe = g.opp(p);
  if (lethal.skill) {
    if (p.tension < 3 && !p.tensionRaisedThisTurn && p.mp >= 1) {
      p.mp -= 1; p.tensionRaisedThisTurn = true; E.raiseTension(g, p, 1);
    }
    if (p.tension === 3) FX.useTensionSkill(g, p);
  }
  for (const o of lethal.plan) {
    if (g.over) return;
    const idx = p.hand.indexOf(o.name);
    if (idx < 0) continue;
    E.payAndPlay(g, p, idx, { type: 'leader', p: foe });
  }
  attackPhase(g, p, true);
}

function followupScore(g, p, mpLeft, excludeIdx) {
  if (mpLeft <= 0) return 0;
  const firstIsUnit = CARD_DB[p.hand[excludeIdx]].kind === 'unit';
  const slots = E.BOARD_MAX - p.board.length - (firstIsUnit ? 1 : 0);
  let v = 0;
  for (let i = 0; i < p.hand.length; i++) {
    if (i === excludeIdx) continue;
    const name = p.hand[i];
    const d = CARD_DB[name];
    if (E.cardCost(p, name) > mpLeft) continue;
    if (d.kind === 'unit' && slots <= 0) continue;
    const s = cardScore(g, p, name);
    if (s > v) v = s;
  }
  return v;
}

// ---- メインフェイズ ----
function playPhase(g, p) {
  for (let guard = 0; guard < 40 && !g.over; guard++) {
    let bestIdx = -1, bestVal = -Infinity, bestName = null;
    for (let i = 0; i < p.hand.length; i++) {
      const name = p.hand[i];
      const d = CARD_DB[name];
      const cost = E.cardCost(p, name);
      if (cost > p.mp) continue;
      if (d.kind === 'unit' && E.boardFull(p)) continue;
      // 同ターンに続けて出せる札まで見て、MPを余らせない組み合わせを選ぶ
      const s = cardScore(g, p, name) + cost * 0.3 + followupScore(g, p, p.mp - cost, i);
      if (s > bestVal) { bestVal = s; bestIdx = i; bestName = name; }
    }
    if (bestIdx < 0 || bestVal <= 0) break;
    // 残火：同ターンにスペルを撃ってから出すと追加効果が乗る
    if (['学舎の見習い', 'ギズモ', 'ドロテ'].includes(bestName) && p.spellsThisTurn === 0) {
      const cost = E.cardCost(p, bestName);
      const spellIdx = p.hand.findIndex((n) => ['火の粉', '焔弾'].includes(n)
        && E.cardCost(p, n) + cost <= p.mp);
      if (spellIdx >= 0) {
        E.payAndPlay(g, p, spellIdx, null);
        continue;
      }
    }
    if (!E.payAndPlay(g, p, bestIdx, null)) break;
  }
}

// MPを1残してもプレイの質がほとんど落ちないなら、先にテンションを上げる
function bestPlayScore(g, p, mpLimit) {
  let bestVal = -Infinity;
  for (const name of p.hand) {
    const d = CARD_DB[name];
    if (E.cardCost(p, name) > mpLimit) continue;
    if (d.kind === 'unit' && E.boardFull(p)) continue;
    const s = cardScore(g, p, name);
    if (s > bestVal) bestVal = s;
  }
  return bestVal === -Infinity ? 0 : bestVal;
}

function raiseTensionFirst(g, p) {
  if (p.tension >= 3 || p.mp < 1 || p.tensionRaisedThisTurn) return false;
  // スキルが今すぐ欲しい場面は最優先で上げる
  // ただし1ターンを丸ごと潰してまで上げない（MPに余裕があるときだけ優先）
  if (p.tension === 2) {
    if (p.leader === 'リーゼ' && (g.opp(p).leaderHp <= 4 || p.mp >= 3)) return true;
    if (p.leader === 'アルベル' && p.leaderHp <= 18 && (p.mp >= 3 || p.leaderHp <= 8)) return true;
    if (p.leader === 'エルナ' && p.hand.length <= 4 && p.mp >= 3) return true;
  }
  const full = bestPlayScore(g, p, p.mp);
  const held = bestPlayScore(g, p, p.mp - 1);
  return held >= full - 2.5;
}

function tensionPhase(g, p) {
  if (g.over) return;
  if (!p.tensionRaisedThisTurn && p.tension < 3 && p.mp >= 1) {
    p.mp -= 1;
    p.tensionRaisedThisTurn = true;
    E.raiseTension(g, p, 1);
  }
  if (g.over) return;
  if (p.tension === 3 && shouldUseSkill(g, p)) {
    FX.useTensionSkill(g, p);
  }
}

function shouldUseSkill(g, p) {
  if (p.leader === 'リーゼ') return true;
  if (p.leader === 'エルナ') return p.hand.length <= 8;
  if (p.leader === 'アルベル') {
    const unitHeal = p.board.reduce((a, u) => a + Math.min(3, u.maxhp - u.hp), 0);
    return p.leaderHp <= 22 || unitHeal >= 3;
  }
  return true;
}

// ---- 攻撃 ----
function attackPhase(g, p, forceFace) {
  for (let guard = 0; guard < 40 && !g.over; guard++) {
    const foe = g.opp(p);
    const taunts = foe.board.filter((u) => u.kw.has('守護'));
    const ready = p.board.filter((u) => E.canAttackUnit(u) || E.canAttackLeader(u));
    if (!ready.length) break;

    if (taunts.length) {
      const act = pickTauntAttack(p, ready, taunts);
      if (!act) break;
      E.attackUnit(g, p, act.u, act.t);
      continue;
    }

    const act = pickAttack(g, p, ready, forceFace);
    if (!act) break;
    if (act.face) E.attackLeader(g, p, act.u);
    else E.attackUnit(g, p, act.u, act.t);
  }
}

function pickTauntAttack(p, ready, taunts) {
  const attackers = ready.filter((u) => E.canAttackUnit(u));
  if (!attackers.length) return null;
  const target = taunts.slice().sort((a, b) => a.hp - b.hp)[0];
  const killers = attackers.filter((u) => u.atk >= target.hp);
  if (killers.length) {
    const safe = killers.filter((u) => u.hp > target.atk);
    const pool = safe.length ? safe : killers;
    return { u: pool.slice().sort((a, b) => a.atk - b.atk)[0], t: target };
  }
  const survivors = attackers.filter((u) => u.hp > target.atk);
  if (survivors.length) return { u: survivors.slice().sort((a, b) => b.atk - a.atk)[0], t: target };
  if (p.style === 'aggro') return { u: attackers.slice().sort((a, b) => b.atk - a.atk)[0], t: target };
  return null;
}

function pickAttack(g, p, ready, forceFace) {
  const foe = g.opp(p);
  const faceReady = ready.filter((u) => E.canAttackLeader(u));
  const unitReady = ready.filter((u) => E.canAttackUnit(u));

  if (forceFace) {
    if (faceReady.length) return { u: faceReady[0], face: true };
    const k = bestTrade(unitReady, foe.board, true);
    return k || null;
  }

  if (p.style === 'aggro') {
    // レースに勝てるなら顔、負けているなら盤面を捌く
    const myAtk = p.board.reduce((a, u) => a + (u.frozen ? 0 : u.atk), 0);
    const theirAtk = foe.board.reduce((a, u) => a + (u.frozen ? 0 : u.atk), 0);
    const myClock = myAtk > 0 ? Math.ceil(foe.leaderHp / myAtk) : 99;
    const theirClock = theirAtk > 0 ? Math.ceil(p.leaderHp / theirAtk) : 99;
    const trade = bestTrade(unitReady, foe.board, false);
    if (trade && myClock > theirClock) return trade;
    if (trade && threat(trade.t) >= 9 && trade.u.hp > trade.t.atk) return trade;
    if (faceReady.length) return { u: faceReady[0], face: true };
    // 突進のみ（召喚酔い）は敵ユニットを殴る
    const kills = bestTrade(unitReady, foe.board, true);
    if (kills) return kills;
    return null;
  }

  if (p.style === 'midrange') {
    const trade = bestTrade(unitReady, foe.board, false);
    if (trade && threat(trade.t) >= 6 && foe.leaderHp > 8) return trade;
    if (faceReady.length) return { u: faceReady[0], face: true };
    if (trade) return trade;
    return null;
  }

  // control
  const trade = bestTrade(unitReady, foe.board, false);
  if (trade) return trade;
  if (foe.board.length === 0 && faceReady.length) return { u: faceReady[0], face: true };
  if (faceReady.length && foe.leaderHp <= 10) return { u: faceReady[0], face: true };
  return null;
}

// 有利トレード（相手を倒して自分は生き残る）を探す。allowAny で相打ちも許容
function bestTrade(attackers, enemyUnits, allowAny) {
  let bestAct = null, bestVal = -Infinity;
  for (const u of attackers) {
    for (const t of enemyUnits) {
      const kills = u.atk >= t.hp;
      const dies = t.atk >= u.hp;
      if (!kills && !allowAny) continue;
      if (!kills && !allowAny) continue;
      let v = 0;
      if (kills && !dies) v = threat(t) * 2;
      else if (kills && dies) v = threat(t) - threat(u) + 2;
      else if (allowAny) v = -threat(u) * (dies ? 1 : 0) + t.hp * 0.5;
      else continue;
      if (v > bestVal) { bestVal = v; bestAct = { u, t }; }
    }
  }
  if (!bestAct) return null;
  if (bestVal <= 0 && !allowAny) return null;
  return bestAct;
}

// 聖水：1ターン1つまで。「あと1MPあれば手札が使える」ときに切る
function useHoly(g, p) {
  if (!p.holy || p.holyUsedThisTurn) return;
  const need = p.mp + 1;
  const playable = p.hand.some((n) => {
    const d = CARD_DB[n];
    if (E.cardCost(p, n) !== need) return false;
    return !(d.kind === 'unit' && p.board.length >= E.BOARD_MAX);
  });
  if (!playable) return;
  p.holy--;
  p.holyUsedThisTurn = true;
  p.mp += 1;
}

// ---- 1ターン ----
function takeTurn(g, p) {
  E.startPhase(g, p);
  if (g.over) return;

  // マルカ＋ポルカのコンボは先にテンションを上げる
  if (p.board.some((u) => u.name === 'マルカ') && p.hand.includes('ポルカ')
      && p.tension < 3 && p.mp >= 1 && !p.tensionRaisedThisTurn) {
    p.mp -= 1;
    p.tensionRaisedThisTurn = true;
    E.raiseTension(g, p, 1);
  }
  if (g.over) return;

  const lethal = planLethal(g, p);
  if (lethal) {
    executeLethal(g, p, lethal);
    if (g.over) return;
  }

  if (raiseTensionFirst(g, p)) {
    p.mp -= 1;
    p.tensionRaisedThisTurn = true;
    E.raiseTension(g, p, 1);
    if (g.over) return;
    if (p.tension === 3 && shouldUseSkill(g, p)) {
      FX.useTensionSkill(g, p);
      if (g.over) return;
    }
  }

  useHoly(g, p);
  playPhase(g, p);
  if (g.over) return;
  useHoly(g, p);
  tensionPhase(g, p);
  if (g.over) return;
  attackPhase(g, p, false);
  if (g.over) return;
  E.endPhase(g, p);
}

module.exports = { mulligan, takeTurn, attackPhase, cardScore };
