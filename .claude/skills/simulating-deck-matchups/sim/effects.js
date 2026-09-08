// カード効果の実装と対象選択ヒューリスティック
const { CARD_DB } = require('./cards.js');
const E = require('./engine.js');

// ---- ルック ----
function topCost(p) { return p.deck.length ? CARD_DB[p.deck[0]].cost : null; }
function lookOdd(p) { const c = topCost(p); return c !== null && c % 2 === 1; }
function lookEven(p) { const c = topCost(p); return c !== null && c % 2 === 0; }

// ---- 残火：このターンに自分がスペルを使っていたか（場に出たとき1回だけ判定）----
function afterburn(p) { return p.spellsThisTurn > 0; }

// ---- 対象選択 ----
function threat(u) { return u.atk * 2 + u.hp + (u.kw.has('守護') ? 4 : 0); }
function best(list) { return list.slice().sort((a, b) => threat(b) - threat(a))[0]; }

function chooseDamageTarget(g, p, dmg, opts) {
  opts = opts || {};
  const foe = g.opp(p);
  const units = foe.board;
  const faceOk = opts.faceOk !== false;
  if (faceOk && foe.leaderHp <= dmg) return { type: 'leader', p: foe };
  const killable = units.filter((u) => u.hp <= dmg);
  const taunts = killable.filter((u) => u.kw.has('守護'));
  if (p.style === 'aggro') {
    if (taunts.length) return { type: 'unit', u: best(taunts) };
    if (faceOk) return { type: 'leader', p: foe };
    if (killable.length) return { type: 'unit', u: best(killable) };
  } else {
    if (killable.length) {
      const b = best(killable);
      if (threat(b) >= 7 || !faceOk) return { type: 'unit', u: b };
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

function reviveFromGrave(g, p, maxCost, opts) {
  opts = opts || {};
  let bestIdx = -1, bestVal = -1;
  for (let i = 0; i < p.grave.length; i++) {
    const d = CARD_DB[p.grave[i]];
    if (d.kind !== 'unit' || d.cost > maxCost) continue;
    if (opts.exclude && p.grave[i] === opts.exclude) continue;
    const v = d.atk + d.hp;
    if (v > bestVal) { bestVal = v; bestIdx = i; }
  }
  if (bestIdx < 0 || E.boardFull(p)) return null;
  const name = p.grave.splice(bestIdx, 1)[0];
  const u = E.putUnit(g, p, name, { trigger: false });
  if (u && opts.hpOne) u.hp = 1;
  return u;
}

// 「聖徒」タグ持ちをサーチするときの優先度（アルベル）
const SEITO_PRIORITY = { '聖騎士ザキエル': 100, '祈る巡礼者': 80, '老司祭ドラン': 70, '修道女キーラ': 30 };

// ---- 召喚時 ----
function onSummon(g, p, u) {
  const foe = g.opp(p);
  switch (u.name) {
    // ---- アグロリーゼ ----
    case '火の子':
      E.dealTo(g, chooseDamageTarget(g, p, 1), 1, p, u.name);
      break;
    case '学舎の見習い':
      if (afterburn(p)) u.atk += 1;
      break;
    case 'ギズモ':
      if (afterburn(p)) u.kw.add('速攻');
      break;
    case 'ドロテ':
      if (afterburn(p)) { u.atk += 2; u.kw.add('速攻'); }
      break;
    case 'ポルカ':
      if (p.board.some((x) => x.name === 'マルカ')) u.kw.add('速攻');
      break;
    case '教授ハルド':
      E.raiseTension(g, p, 1);
      break;
    case '火口の洞守り': {
      const cand = foe.board.filter((x) => !x.frozen);
      if (cand.length) {
        const t = best(cand);
        t.frozen = true;
        p.frozenPending.push(t);
      }
      break;
    }
    case 'ヴェルド': {
      const taunts = foe.board.filter((x) => x.kw.has('守護'));
      if (taunts.length) {
        const t = best(taunts);
        t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
      }
      break;
    }
    case '師ベルゼ':
      for (const x of foe.board.slice()) E.damageUnit(g, x, 3, p, u.name);
      break;

    // ---- ミッドレンジ奇数エルナ ----
    case '凶兆のまたたき':
      E.dealTo(g, chooseDamageTarget(g, p, 1), 1, p, u.name);
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
      E.raiseTension(g, p, 1);
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
    case '双つの未来':
      if (lookOdd(p) && !u.token) E.putUnit(g, p, '双つの未来', { trigger: false, token: true });
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
    case '傷ついた巡礼者':
      E.damageUnit(g, u, 2, p, u.name);
      break;
    case '聖騎士ザキエル': {
      if (foe.board.length) {
        const t = best(foe.board);
        t.hp = 0; t._killer = u.name; t._killerOwner = p.idx;
      }
      break;
    }
    case '老司祭ドラン': {
      const idx = searchDeck(p, (n) => CARD_DB[n].tag === '聖徒' && CARD_DB[n].cost <= 3,
        (n) => SEITO_PRIORITY[n] || 0);
      if (idx >= 0 && !E.boardFull(p)) {
        const name = p.deck.splice(idx, 1)[0];
        const nu = E.putUnit(g, p, name, { trigger: true });
        if (nu) { nu.atk += 1; nu.maxhp += 1; nu.hp += 1; }
      }
      p.deck = E.shuffle(p.deck, g.rng);
      break;
    }
    case '祈る巡礼者':
      for (const x of foe.board.slice()) E.damageUnit(g, x, 2, p, u.name);
      for (const x of p.board) E.healUnit(g, x, 2, p, u.name);
      break;
    case '偽善のミゼリア':
      for (const x of foe.board.slice()) E.damageUnit(g, x, 4, p, u.name);
      E.damageLeader(g, foe, 4, p, u.name);
      break;
    case '継承の大鐘': {
      const idx = searchDeck(p, (n) => CARD_DB[n].tag === '聖徒' && CARD_DB[n].cost <= 5,
        (n) => SEITO_PRIORITY[n] || 0);
      if (idx >= 0 && !E.boardFull(p)) {
        const name = p.deck.splice(idx, 1)[0];
        E.putUnit(g, p, name, { trigger: true });
      }
      p.deck = E.shuffle(p.deck, g.rng);
      break;
    }
    default:
      break;
  }
}

// ---- 死亡時 ----
function onDeath(g, p, u) {
  if (u.name === '相棒ヴァルザ' && !u.token) {
    const idx = p.deck.indexOf('識りすぎたヴァルザ');
    if (idx >= 0) {
      p.hand.push(p.deck.splice(idx, 1)[0]);
      p.deck = E.shuffle(p.deck, g.rng);
    }
  } else if (u.name === '師ベルゼ' && !u.token) {
    for (const x of p.board) x.atk += 1;
  }
}

// ---- ターン開始／終了 ----
function onTurnStart(g, p) { /* 該当カードなし */ }

function onTurnEnd(g, p) {
  for (const u of p.board.slice()) {
    if (g.over) return;
    if (u.name === '癒しの人形ホミ') E.healLeader(g, p, 1, p, u.name);
    else if (u.name === '長屋の病人') E.healUnit(g, u, 1, p, u.name);
    else if (u.name === '修道女キーラ') {
      for (const x of p.board) E.healUnit(g, x, 1, p, u.name);
      E.healLeader(g, p, 1, p, u.name);
    }
  }
}

// ---- テンションリンク ----
function onTensionLink(g, p, u) {
  if (u.name === 'マルカ') {
    const idx = p.hand.indexOf('ポルカ');
    if (idx >= 0 && !E.boardFull(p)) {
      p.hand.splice(idx, 1);
      E.recPlay(g, p, 'ポルカ');
      E.putUnit(g, p, 'ポルカ', { trigger: true });
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
function onLeaderHealed(g, p) {
  const chimera = p.board.filter((u) => u.name === '聖獣キメラ');
  if (!chimera.length) return;
  for (const b of chimera) {
    const t = chooseDamageTarget(g, p, 2);
    E.dealTo(g, t, 2, p, b.name);
  }
  E.cleanup(g);
}

// ---- スペル ----
function castSpell(g, p, name, target) {
  const foe = g.opp(p);
  switch (name) {
    // ---- アグロリーゼ ----
    case '火の粉': E.dealTo(g, target || chooseDamageTarget(g, p, 1), 1, p, name); break;
    case '焔弾': E.dealTo(g, target || chooseDamageTarget(g, p, 3), 3, p, name); break;
    case '焼き払い':
      for (const x of foe.board.slice()) E.damageUnit(g, x, 2, p, name);
      E.cleanup(g);
      break;
    case '消えぬ焔':
      for (const x of p.board) { x.atk += 1; x.kw.add('速攻'); }
      break;

    // ---- ミッドレンジ奇数エルナ ----
    case '一手先を読む': {
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
      if (target && target.type === 'unit') E.healUnit(g, target.u, 2, p, name);
      else E.healLeader(g, p, 2, p, name);
      E.draw(g, p, 1);
      break;
    }
    case '間に合わせの蘇生':
      reviveFromGrave(g, p, 2, { hpOne: true });
      break;
    case '記録を繰る':
      E.draw(g, p, 2);
      break;
    case '継ぐ者の儀': {
      let sacked = null;
      if (p.board.length) {
        const worst = p.board.slice().sort((a, b) => threat(a) - threat(b))[0];
        sacked = worst.name;
        worst.hp = 0;
        E.cleanup(g);
      }
      reviveFromGrave(g, p, 3, { exclude: sacked });
      reviveFromGrave(g, p, 3, { exclude: sacked });
      break;
    }
    default: break;
  }
}

// ---- テンションスキル ----
function useTensionSkill(g, p) {
  const foe = g.opp(p);
  E.recPlay(g, p, 'テンションスキル');
  if (p.leader === 'リーゼ') {
    E.dealTo(g, chooseDamageTarget(g, p, 2), 2, p, 'テンションスキル');
  } else if (p.leader === 'アルベル') {
    for (const x of p.board) E.healUnit(g, x, 3, p, 'テンションスキル');
    E.healLeader(g, p, 3, p, 'テンションスキル');
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
  p.tension = 0;
  E.cleanup(g);
}

module.exports = {
  onSummon, onDeath, onTurnStart, onTurnEnd, onTensionLink, onLeaderHealed,
  castSpell, useTensionSkill, chooseDamageTarget, threat, best, lookOdd, lookEven, topCost, afterburn,
};
