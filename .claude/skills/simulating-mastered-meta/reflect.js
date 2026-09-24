// 1戦ごとの反省：試合の記録から悪手を拾い、つまみを直す案を出す
const C = require('./common.js');

const LATE_TURN = 16;   // 両者合計の手番。各自8ターン目あたり
const EARLY_TURNS = 3;  // 序盤として見る自分の手番数

const LABELS = {
  MP_WASTE: 'MPを使い残したターンが2回以上あった',
  EARLY_STALL: '序盤3ターン、場に何も残せなかった',
  LATE_FLOOD: '終盤に軽いカードが手札に3枚以上余った',
  CLOSE_RACE_LOSS: 'あと少しで削り切れる所まで行って負けた',
  OVERRUN_LOSS: '相手をほとんど削れずに押し切られた',
  SKILL_LOW_STAGE: 'パワースキルを第1段階で2回以上使った',
  SKILL_HELD: 'パワー3のまま手番を終えたことが2回以上あった',
  SKILL_UNUSED: '6手番以上戦ってパワースキルを1回も使わなかった',
};

// パワーの使い方を動かす案。反省に無いときも1対面に1案は必ず試す
const POWER_PROPOSALS = [
  { key: 'chargeAtTwo', delta: 1 }, { key: 'chargeAtTwo', delta: -1 },
  { key: 'skillEarly', delta: 1 }, { key: 'skillEarly', delta: -1 },
  { key: 'skillMinStage', delta: 1 }, { key: 'skillMinStage', delta: -1 },
  { key: 'powerSlack', delta: 0.5 }, { key: 'powerSlack', delta: -0.5 },
];

function labelOf(finding) {
  if (finding.startsWith('STUCK:')) return `「${finding.slice(6)}」を使えるのに抱えたまま終わった`;
  return LABELS[finding];
}

function skillCount(g, p) {
  const s = g.stats[p.deckName] && g.stats[p.deckName]['パワースキル'];
  return s ? s.played : 0;
}

// learnerSeat の手番ごとに、MPの残り・手札・パワースキルを使った段階を記録する
function makeRecorder(learnerSeat) {
  const rec = { turns: [], held: {}, skillStages: [] };
  let before = null;
  const observe = (g, p, phase) => {
    if (p.idx !== learnerSeat) return;
    if (phase === 'start') {
      before = { skills: skillCount(g, p), stage: C.E.powerSkillStage(p) };
      return;
    }
    if (phase !== 'end') return;
    if (before) {
      for (let i = before.skills; i < skillCount(g, p); i++) rec.skillStages.push(before.stage);
    }
    const foe = g.opp(p);
    const playable = p.hand.some((n) => C.E.cardCost(p, n) <= p.mp
      && !(C.CARD_DB[n].kind === 'unit' && C.E.boardFull(p)));
    rec.turns.push({
      turn: g.turn,
      mpLeft: p.mp,
      playable,
      board: p.board.length,
      foeHp: foe.leaderHp,
      cheapInHand: p.hand.filter((n) => C.CARD_DB[n].cost <= 2).length,
      power: p.power,
    });
    for (const n of new Set(p.hand)) {
      if (C.CARD_DB[n].cost <= p.maxMp) rec.held[n] = (rec.held[n] || 0) + 1;
    }
  };
  return { rec, observe };
}

// 1戦ぶんの反省。見つけた悪手の名前を返す
function reflectGame(result, rec) {
  const { g, seat, win } = result;
  const p = g.players[seat];
  const foe = g.players[1 - seat];
  const found = [];
  if (rec.turns.filter((t) => t.mpLeft > 0 && t.playable).length >= 2) found.push('MP_WASTE');
  const early = rec.turns.slice(0, EARLY_TURNS);
  if (early.length === EARLY_TURNS && early.every((t) => t.board === 0)) found.push('EARLY_STALL');
  if (rec.turns.some((t) => t.turn >= LATE_TURN && t.cheapInHand >= 3)) found.push('LATE_FLOOD');
  if (!win && foe.leaderHp <= 5) found.push('CLOSE_RACE_LOSS');
  if (!win && foe.leaderHp >= 15) found.push('OVERRUN_LOSS');
  if (rec.skillStages.filter((s) => s === 1).length >= 2) found.push('SKILL_LOW_STAGE');
  if (rec.turns.filter((t) => t.power === 3).length >= 2) found.push('SKILL_HELD');
  if (rec.turns.length >= 6 && rec.skillStages.length === 0) found.push('SKILL_UNUSED');
  for (const n of new Set(p.hand)) {
    if ((rec.held[n] || 0) >= 2) found.push('STUCK:' + n);
  }
  return found;
}

// 顔を狙う寄り（dir=+1）か、盤面を捌く寄り（dir=-1）に動かす案。今の攻め方で効くつまみだけ
function faceProposals(style, dir) {
  const common = [{ key: 'burnKillThreat', delta: 2 * dir }];
  if (style === 'aggro') {
    return [{ key: 'raceMargin', delta: dir }, { key: 'aggroBigTradeThreat', delta: 2 * dir }, ...common];
  }
  if (style === 'midrange') {
    return [{ key: 'midrangeTradeThreat', delta: 2 * dir }, { key: 'midrangeFaceGuardHp', delta: 2 * dir }, ...common];
  }
  return [{ key: 'controlFaceHp', delta: 3 * dir }, ...common];
}

// 悪手ごとの、直す案の候補
function rulesFor(finding, style) {
  if (finding.startsWith('STUCK:')) return [{ card: finding.slice(6), delta: 1 }];
  switch (finding) {
    case 'MP_WASTE': return [{ key: 'playThreshold', delta: -0.5 }, { key: 'costWeight', delta: 0.1 }];
    case 'EARLY_STALL': return [{ key: 'mulliganKeepMax', delta: -1 }];
    case 'LATE_FLOOD': return [{ key: 'mulliganKeepMax', delta: 1 }];
    case 'CLOSE_RACE_LOSS': return [{ key: 'attackStyle', dir: -1 }, ...faceProposals(style, 1)];
    case 'OVERRUN_LOSS': return [{ key: 'attackStyle', dir: 1 }, ...faceProposals(style, -1), { key: 'tauntValue', delta: 1 }];
    case 'SKILL_LOW_STAGE': return [{ key: 'skillMinStage', delta: 1 }];
    case 'SKILL_HELD': return [{ key: 'skillMinStage', delta: -1 }, { key: 'skillEarly', delta: 1 }, { key: 'skillEarly', delta: -1 }];
    case 'SKILL_UNUSED': return [{ key: 'chargeAtTwo', delta: 1 }, { key: 'chargeAtTwo', delta: -1 }, { key: 'powerSlack', delta: 0.5 }];
    default: return [];
  }
}

// 反省に無い変化を1つ選ぶ。人が「なんとなく別の打ち方を試す」ぶん。攻め方は毎回試すので選ばない
function randomProposal(deck, rng) {
  if (rng() < 0.35) {
    const names = Object.keys(C.DECKS[deck].list);
    return { card: names[Math.floor(rng() * names.length)], delta: rng() < 0.5 ? -1 : 1 };
  }
  const keys = Object.keys(C.K.SPEC).filter((k) => k !== 'attackStyle' && k !== 'cardOffset');
  const key = keys[Math.floor(rng() * keys.length)];
  return { key, delta: (rng() < 0.5 ? -1 : 1) * C.K.SPEC[key].step };
}

// 負けた試合で多く、勝った試合で少ない悪手ほど優先する
function scoreFindings(games) {
  const wins = games.filter((x) => x.win);
  const losses = games.filter((x) => !x.win);
  const tally = (list) => {
    const m = {};
    for (const x of list) for (const f of new Set(x.found)) m[f] = (m[f] || 0) + 1;
    return m;
  };
  const tw = tally(wins);
  const tl = tally(losses);
  const keys = new Set([...Object.keys(tw), ...Object.keys(tl)]);
  return [...keys]
    .map((f) => ({
      finding: f,
      label: labelOf(f),
      lossRate: (tl[f] || 0) / Math.max(1, losses.length),
      winRate: (tw[f] || 0) / Math.max(1, wins.length),
    }))
    .map((x) => ({ ...x, score: x.lossRate - x.winRate }))
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score || (a.finding < b.finding ? -1 : 1));
}

// 攻め方の両方向とパワーの案1つを必ず試し、ほかに反省から count-1 個、反省に無い試しを最低1個
// 足りないぶんは反省に無い試しで埋め、全デッキで試す数を count+3 に揃える
function proposalsFor(deck, knobs, opp, games, rng, count) {
  const total = count + 3;
  const scored = scoreFindings(games);
  const style = C.effective(deck, knobs, opp, 'attackStyle');
  const base = JSON.stringify(knobs);
  const seen = new Set();
  const out = [];
  const push = (prop, reason) => {
    const next = C.applyProposal(deck, knobs, opp, prop);
    const sig = JSON.stringify(next);
    if (sig === base || seen.has(sig)) return;
    seen.add(sig);
    out.push({ prop, reason, knobs: next });
  };
  // 攻め方は3択で、一番効くつまみなので、偶然に任せず毎回両方向を試す
  push({ key: 'attackStyle', dir: -1 }, '毎回試す：攻め方を攻め寄りに');
  push({ key: 'attackStyle', dir: 1 }, '毎回試す：攻め方を守り寄りに');
  const powerStart = out.length;
  for (let guard = 0; out.length === powerStart && guard < 50; guard++) {
    push(POWER_PROPOSALS[Math.floor(rng() * POWER_PROPOSALS.length)], '毎回試す：パワーの使い方');
  }
  for (const s of scored) {
    for (const prop of rulesFor(s.finding, style)) {
      if (out.length >= total - 1) break;
      push(prop, `反省：${s.label}（負け ${(s.lossRate * 100).toFixed(0)}% / 勝ち ${(s.winRate * 100).toFixed(0)}%）`);
    }
    if (out.length >= total - 1) break;
  }
  for (let guard = 0; out.length < total && guard < 50; guard++) {
    push(randomProposal(deck, rng), '試し：反省に無い変化');
  }
  return { proposals: out, findings: scored.slice(0, 6) };
}

module.exports = { makeRecorder, reflectGame, proposalsFor, scoreFindings, labelOf };
