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
      case 'メラゴースト': s += 1; break;
      case 'ベビーマジシャン': s += Math.min(2, p.spellsInGrave); break;
      case 'まほうつかい': s += p.hand.some((n) => CARD_DB[n].kind === 'spell') ? 1 : 0; break;
      case 'ヒートギズモ': s += p.spellsThisTurn > 0 ? 3 : 0; break;
      case 'マージマタンゴ': s += enemyUnits.length ? 2 : 0; break;
      case 'マルク': s += p.hand.includes('ポルク') ? 3 : 0; break;
      case 'サーベルト': s += enemyTaunts.length ? 5 : 0; break;
      case 'ベルゼバブ': s += 5; break;
      case 'サキュバス': s += FX.lookOdd(p) ? 2 : 0; break;
      case 'インキュバス': s += FX.lookOdd(p) ? 2 : 0; break;
      case 'マーニャ': s += 1; break;
      case 'エドガン': s += reviveBest(p, 4) * 0.6; break;
      case 'しりょうのきし': s += (FX.lookOdd(p) && p.leaderHp < 22) ? 3 : 0; break;
      case 'わかめ王子': s += FX.lookOdd(p) ? 5 : 0; break;
      case 'バルザック＋': s += p.grave.includes('バルザック') ? 6 : 0; s += FX.lookOdd(p) ? 3 : 0; break;
      case 'キングレオ': s += FX.lookOdd(p) ? 8 : -12; break;
      case 'さまようたましい': s -= 2; break;
      case 'イザヤール': s += 3; break;
      case 'リトルライバーン': s += 3; break;
      case 'クリフト': s += bigThreat ? 7 : (enemyUnits.length ? 2 : 0); break;
      case 'ラヴィエル': s += 3; break;
      case 'プリン': s += enemyUnits.length >= 2 ? 5 : (enemyUnits.length ? 2 : 0); break;
      case 'マルチェロ': s += enemyUnits.length >= 2 ? 5 : 2; break;
      case 'レティス': s += 6; break;
      default: break;
    }
    return s;
  }

  // スペル
  switch (name) {
    case 'メラ': return burnScore(g, p, 1);
    case 'メラミ': return burnScore(g, p, 3);
    case 'メラゾーマ': return burnScore(g, p, 5);
    case 'アルカナショット': return 2 + (enemyUnits.some((u) => u.hp <= 1) ? 2 : 0);
    case 'アルカナバースト': {
      if (!enemyUnits.length) return -100;
      const dmg = FX.lookOdd(p) ? 6 : 2;
      const kill = enemyUnits.some((u) => u.hp <= dmg);
      return (kill ? 4 + dmg * 0.6 : 1) + 1;
    }
    case 'いのりのゆびわ': return 2 + (p.leaderHp <= 22 ? 2 : 0) + (p.board.some((u) => u.hp < u.maxhp) ? 1 : 0);
    case 'ザオ': return reviveBest(p, 2) > 0 ? 2 + reviveBest(p, 2) * 0.3 : -100;
    case 'ようせいの笛': return p.hand.length <= 5 ? 5 : 2;
    case 'メガザル': {
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
    if (n === 'メラ') dmg = 1;
    else if (n === 'メラミ') dmg = 3;
    else if (n === 'メラゾーマ') dmg = 5;
    else if (n === 'ベルゼバブ') dmg = 5;
    else if (n === 'メラゴースト') dmg = 1;
    else if (n === 'ベビーマジシャン') dmg = Math.min(2, p.spellsInGrave);
    else if (n === 'マルチェロ') dmg = 4;
    else if (n === 'キングレオ') dmg = FX.lookOdd(p) ? 4 : 0;
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
  // テンションスキル（ゼシカのみ打点）
  let skill = false;
  if (p.leader === 'ゼシカ' && !p.skillUsedThisTurn) {
    if (p.tension === 3) { dmg += 2; skill = true; }
    else if (p.tension === 2 && mp >= 1 && !p.tensionRaisedThisTurn) { mp -= 1; dmg += 2; skill = true; }
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
    if (p.tension === 3) { FX.useTensionSkill(g, p); p.skillUsedThisTurn = true; }
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
    // ヒートギズモは同ターンにスペルを撃ってから出すと速攻を得る
    if (bestName === 'ヒートギズモ' && p.spellsThisTurn === 0) {
      const spellIdx = p.hand.findIndex((n) => CARD_DB[n].kind === 'spell'
        && ['メラ', 'メラミ', 'メラゾーマ'].includes(n)
        && E.cardCost(p, n) + 2 <= p.mp);
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
    if (p.leader === 'ゼシカ' && (g.opp(p).leaderHp <= 4 || p.mp >= 3)) return true;
    if (p.leader === 'ククール' && p.leaderHp <= 18 && (p.mp >= 3 || p.leaderHp <= 8)) return true;
    if (p.leader === 'ミネア' && p.hand.length <= 4 && p.mp >= 3) return true;
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
  if (p.tension === 3 && !p.skillUsedThisTurn && shouldUseSkill(g, p)) {
    FX.useTensionSkill(g, p);
    p.skillUsedThisTurn = true;
  }
}

function shouldUseSkill(g, p) {
  if (p.leader === 'ゼシカ') return true;
  if (p.leader === 'ミネア') return p.hand.length <= 8;
  if (p.leader === 'ククール') {
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

// ---- 1ターン ----
function takeTurn(g, p) {
  E.startPhase(g, p);
  if (g.over) return;

  // マルク＋ポルクのコンボは先にテンションを上げる
  if (p.board.some((u) => u.name === 'マルク') && p.hand.includes('ポルク')
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
    if (p.tension === 3 && !p.skillUsedThisTurn && shouldUseSkill(g, p)) {
      FX.useTensionSkill(g, p);
      p.skillUsedThisTurn = true;
      if (g.over) return;
    }
  }

  playPhase(g, p);
  if (g.over) return;
  tensionPhase(g, p);
  if (g.over) return;
  attackPhase(g, p, false);
  if (g.over) return;
  E.endPhase(g, p);
}

module.exports = { mulligan, takeTurn, attackPhase, cardScore };
