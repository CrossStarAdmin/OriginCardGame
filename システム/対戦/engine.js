// ゲームエンジン：状態、ダメージ、戦闘、ターン進行、パワー
const { CARD_DB, DECKS, buildDeck } = require('./cards.js');

const BOARD_MAX = 6;
const LEADER_HP = 25;
const MAX_MP_CAP = 10;
const TURN_CAP = 100; // 両者合計ターン数の上限（引き分け判定用）

let EFFECTS = null;
function setEffects(e) { EFFECTS = e; }

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Unit {
  constructor(name, ownerIdx) {
    const d = CARD_DB[name];
    this.name = name;
    this.atk = d.atk;
    this.hp = d.hp;
    this.maxhp = d.hp;
    this.kw = new Set(d.kw || []);
    this.tag = d.tag || null;
    this.owner = ownerIdx;
    this.sick = true;
    this.attacked = false;
    this.frozen = false;
    this.token = false;
  }
  get value() { return this.atk + this.hp; }
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

class Player {
  constructor(idx, deckName, rng) {
    const def = DECKS[deckName];
    this.idx = idx;
    this.deckName = deckName;
    this.style = def.style;
    this.knobs = null; // AIの打ち方のつまみ（knobs.js）。null なら既定値
    this.leader = def.leader;
    this.leaderHp = LEADER_HP;
    this.maxMp = 0;
    this.mp = 0;
    this.power = 0;
    this.deck = shuffle(buildDeck(deckName), rng);
    this.hand = [];
    this.board = [];
    this.grave = [];
    this.spellsInGrave = 0;
    this.spellDiscount = 0;
    this.spellsThisTurn = 0;
    this.afterburnAlways = false;
    this.afterburnTurn = false;
    this.powerChargedThisTurn = false;
    this.holy = 0;
    this.holyUsedThisTurn = false;
    this.frozenPending = [];
    this.fatigueLoss = false;
    this.weapon = null;          // { name, atk, dur, kw, token }
    this.leaderAttacked = false;
    this.side = '白';            // 表裏（ヴェイン）
    this.cardsThisTurn = 0;      // 連携：このターンに手札から使ったカードの枚数
    this.chainBonus = 0;         // 連携：練気で足したぶん
    this.discardedThisTurn = false;
    this.poisonHerbs = false;    // 捨て値の毒：このターン中、薬草はダメージを与える
    this.preventNext = false;    // 砦の古参兵：次に受けるダメージを0にする
  }
}

class Game {
  constructor(deckA, deckB, seed, stats, gameId) {
    this.rng = mulberry32(seed);
    this.players = [new Player(0, deckA, this.rng), new Player(1, deckB, this.rng)];
    this.turn = 0;
    this.turnPlayer = 0;
    this.over = false;
    this.winner = null;
    this.stats = stats;
    this.gameId = gameId;
  }
  opp(p) { return this.players[1 - p.idx]; }
}

// ---- 統計 ----
function stat(g, p, cardName) {
  const byDeck = g.stats[p.deckName] || (g.stats[p.deckName] = {});
  return byDeck[cardName] || (byDeck[cardName] = {
    played: 0, faceDmg: 0, kills: 0, heal: 0, games: 0, wins: 0, seen: false,
  });
}
function recPlay(g, p, name) {
  const s = stat(g, p, name);
  s.played++;
  if (!s.seen) { s.seen = true; g.playedThisGame.push([p.deckName, name]); }
}
function recFace(g, p, name, dmg) { stat(g, p, name).faceDmg += dmg; }
function recKill(g, p, name, n) { stat(g, p, name).kills += n; }
function recHeal(g, p, name, n) { stat(g, p, name).heal += n; }

// ---- 基本操作 ----
function draw(g, p, n) {
  n = n || 1;
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) { p.fatigueLoss = true; endGame(g, 1 - p.idx); return; }
    p.hand.push(p.deck.shift());
  }
}

function endGame(g, winnerIdx) {
  if (g.over) return;
  g.over = true;
  g.winner = winnerIdx;
}

function checkLeaders(g) {
  const a = g.players[0], b = g.players[1];
  if (a.leaderHp <= 0 && b.leaderHp <= 0) { g.over = true; g.winner = 'draw'; }
  else if (a.leaderHp <= 0) endGame(g, 1);
  else if (b.leaderHp <= 0) endGame(g, 0);
}

function damageLeader(g, target, amt, srcPlayer, srcName) {
  if (amt <= 0 || g.over) return;
  // 受けるダメージの軽減と無効化（ドヴァルの遺作、砦の古参兵）
  if (EFFECTS && EFFECTS.modifyLeaderDamage) amt = EFFECTS.modifyLeaderDamage(g, target, amt);
  if (amt <= 0) return;
  target.leaderHp -= amt;
  if (srcPlayer && srcName) recFace(g, srcPlayer, srcName, amt);
  checkLeaders(g);
}

function damageUnit(g, u, amt, srcPlayer, srcName) {
  if (amt <= 0) return;
  u.hp -= amt;
  if (srcName) { u._killer = srcName; u._killerOwner = srcPlayer ? srcPlayer.idx : null; }
}

// target = {type:'leader', p} または {type:'unit', u}
function dealTo(g, target, amt, srcPlayer, srcName) {
  if (!target || g.over) return;
  if (target.type === 'leader') damageLeader(g, target.p, amt, srcPlayer, srcName);
  else damageUnit(g, target.u, amt, srcPlayer, srcName);
}

function healLeader(g, p, amt, srcPlayer, srcName) {
  const before = p.leaderHp;
  p.leaderHp = Math.min(LEADER_HP, p.leaderHp + amt);
  const gained = p.leaderHp - before;
  if (gained > 0) {
    if (srcName) recHeal(g, srcPlayer || p, srcName, gained);
    EFFECTS.onLeaderHealed(g, p);
  }
  return gained;
}

function healUnit(g, u, amt, srcPlayer, srcName) {
  const before = u.hp;
  u.hp = Math.min(u.maxhp, u.hp + amt);
  const gained = u.hp - before;
  if (gained > 0 && srcName) recHeal(g, srcPlayer, srcName, gained);
  return gained;
}

// HP0以下のユニットをまとめて破壊し、死亡時を処理する
function cleanup(g) {
  for (let round = 0; round < 8; round++) {
    const dying = [];
    for (const p of g.players) {
      for (const u of p.board) if (u.hp <= 0) dying.push(u);
    }
    if (dying.length === 0) break;
    for (const p of g.players) p.board = p.board.filter((u) => u.hp > 0);
    for (const u of dying) {
      const owner = g.players[u.owner];
      if (!u.token) owner.grave.push(u.name);
      if (u._killer && u._killerOwner !== null && u._killerOwner !== undefined) {
        recKill(g, g.players[u._killerOwner], u._killer, 1);
      }
      EFFECTS.onDeath(g, owner, u);
    }
  }
  checkLeaders(g);
}

function boardFull(p) { return p.board.length >= BOARD_MAX; }

// 効果で場に出す。召喚時は手札から使ったときだけなので、ここでは「場に出たとき」だけ発動する
function putUnit(g, p, name, opts) {
  opts = opts || {};
  if (boardFull(p)) return null;
  const u = new Unit(name, p.idx);
  u.token = !!opts.token;
  u.sick = opts.sick !== false;
  p.board.push(u);
  EFFECTS.onEnter(g, p, u);
  return u;
}

// 最大MPを増やす。上限10を超えたぶんは何も起こさない（ルール/02）
function gainMaxMp(p, n) {
  p.maxMp = Math.min(MAX_MP_CAP, p.maxMp + n);
}

function hasTaunt(p) { return p.board.some((u) => u.kw.has('守護')); }

function chargePower(g, p, amt) {
  amt = amt || 1;
  if (p.power >= 3) return false;
  p.power = Math.min(3, p.power + amt);
  for (const u of p.board.slice()) EFFECTS.onPowerLink(g, p, u);
  cleanup(g);
  return true;
}

// ---- 戦闘 ----
function canAttackUnit(u) {
  return !u.attacked && !u.frozen && u.atk > 0 && (!u.sick || u.kw.has('突進') || u.kw.has('速攻'));
}
function canAttackLeader(u) {
  return !u.attacked && !u.frozen && u.atk > 0 && (!u.sick || u.kw.has('速攻'));
}

function attackLeader(g, p, u) {
  const foe = g.opp(p);
  u.attacked = true;
  damageLeader(g, foe, u.atk, p, u.name);
}

function attackUnit(g, p, u, target) {
  const foe = g.opp(p);
  u.attacked = true;
  EFFECTS.onAttacked(g, p, target);
  const dmgOut = u.atk;
  const dmgIn = target.atk;
  const targetHp = target.hp;
  damageUnit(g, target, dmgOut, p, u.name);
  damageUnit(g, u, dmgIn, foe, target.name);
  // 必殺：戦闘でダメージを与えたキャラクターを破壊する。防御側も含む
  if (u.kw.has('必殺') && dmgOut > 0) target.hp = Math.min(target.hp, 0);
  if (target.kw.has('必殺') && dmgIn > 0) u.hp = Math.min(u.hp, 0);
  // 貫通：相手の残りHPを超えたぶんをリーダーに与える（ルール/06_キーワード能力）
  if (u.kw.has('貫通')) {
    const through = dmgOut - targetHp;
    if (through > 0) damageLeader(g, foe, through, p, u.name);
  }
  cleanup(g);
}

// ---- 武器（ルール/03・04）----
function weaponAtk(p) {
  if (!p.weapon) return 0;
  const mod = EFFECTS && EFFECTS.weaponAtkMod ? EFFECTS.weaponAtkMod(p) : 0;
  return Math.max(0, p.weapon.atk + mod);
}

// 装備する。装備中の武器は破壊して墓地へ置く
function equipWeapon(g, p, name) {
  if (p.weapon) breakWeapon(g, p);
  const d = CARD_DB[name];
  p.weapon = { name, atk: d.atk, dur: d.dur, kw: new Set(d.kw || []), token: !!d.token };
}

function breakWeapon(g, p) {
  const w = p.weapon;
  if (!w) return;
  p.weapon = null;
  if (!w.token) p.grave.push(w.name);
  EFFECTS.onWeaponBreak(g, p, w);
}

function wearWeapon(g, p) {
  if (!p.weapon) return;
  p.weapon.dur -= 1;
  if (p.weapon.dur <= 0) breakWeapon(g, p);
}

function canLeaderAttack(p) {
  return !!p.weapon && !p.leaderAttacked && weaponAtk(p) > 0;
}

function leaderAttackLeader(g, p) {
  const w = p.weapon;
  p.leaderAttacked = true;
  damageLeader(g, g.opp(p), weaponAtk(p), p, w.name);
  EFFECTS.onLeaderAttacked(g, p, w);
  wearWeapon(g, p);
  cleanup(g);
}

// 敵キャラクターを攻撃したリーダーは、そのキャラクターの攻撃力ぶんダメージを受ける
function leaderAttackUnit(g, p, target) {
  const foe = g.opp(p);
  const w = p.weapon;
  const atk = weaponAtk(p);
  p.leaderAttacked = true;
  EFFECTS.onAttacked(g, p, target);
  const targetHp = target.hp;
  damageUnit(g, target, atk, p, w.name);
  damageLeader(g, p, target.atk, foe, target.name);
  if (w.kw.has('貫通')) {
    const through = atk - targetHp;
    if (through > 0) damageLeader(g, foe, through, p, w.name);
  }
  EFFECTS.onLeaderAttacked(g, p, w);
  wearWeapon(g, p);
  cleanup(g);
}

// ---- ターン進行 ----
function startPhase(g, p) {
  p.maxMp = Math.min(MAX_MP_CAP, p.maxMp + 1);
  p.mp = p.maxMp;
  p.powerChargedThisTurn = false;
  p.holyUsedThisTurn = false;
  p.spellsThisTurn = 0;
  p.afterburnTurn = false;
  p.spellDiscount = 0;
  p.leaderAttacked = false;
  p.cardsThisTurn = 0;
  p.chainBonus = 0;
  p.discardedThisTurn = false;
  p.poisonHerbs = false;
  for (const u of p.frozenPending) u.frozen = false;
  p.frozenPending = [];
  for (const u of p.board) { u.sick = false; u.attacked = false; }
  if (g.turn > 1) draw(g, p, 1); // 先攻の最初のターンはドローしない（ルール/02_ターンの流れ）
  if (g.over) return;
  EFFECTS.onTurnStart(g, p);
  cleanup(g);
}

function endPhase(g, p) {
  EFFECTS.onTurnEnd(g, p);
  cleanup(g);
}

function cardCost(p, name) {
  const d = CARD_DB[name];
  let c = d.cost;
  if (d.kind === 'spell') c = Math.max(0, c - p.spellDiscount);
  // 手札にある間に働く効果（ギズモ）
  if (EFFECTS && EFFECTS.handCostMod) c = Math.max(0, c - EFFECTS.handCostMod(p, name));
  return c;
}

function payAndPlay(g, p, handIdx, target) {
  const name = p.hand[handIdx];
  const d = CARD_DB[name];
  const cost = cardCost(p, name);
  if (cost > p.mp) return false;
  if (d.kind === 'unit' && boardFull(p)) return false;
  p.mp -= cost;
  p.hand.splice(handIdx, 1);
  recPlay(g, p, name);
  if (d.kind === 'spell') {
    p.spellDiscount = 0;
    p.spellsThisTurn++;
    if (!d.token) {
      p.grave.push(name);
      p.spellsInGrave++;
    }
    EFFECTS.castSpell(g, p, name, target);
    cleanup(g);
  } else if (d.kind === 'weapon') {
    equipWeapon(g, p, name);
    cleanup(g);
  } else {
    const u = new Unit(name, p.idx);
    p.board.push(u);
    EFFECTS.onEnter(g, p, u);
    EFFECTS.onSummon(g, p, u);
    cleanup(g);
  }
  // 連携は「このカードより前に使った枚数」なので、効果を解決してから数える
  p.cardsThisTurn++;
  return true;
}

module.exports = {
  BOARD_MAX, LEADER_HP, MAX_MP_CAP, TURN_CAP,
  Unit, Player, Game, shuffle, mulberry32,
  setEffects, draw, endGame, checkLeaders, damageLeader, damageUnit, dealTo,
  healLeader, healUnit, cleanup, boardFull, putUnit, gainMaxMp, hasTaunt, chargePower,
  canAttackUnit, canAttackLeader, attackLeader, attackUnit,
  weaponAtk, equipWeapon, breakWeapon, canLeaderAttack, leaderAttackLeader, leaderAttackUnit,
  startPhase, endPhase, cardCost, payAndPlay,
  recPlay, recFace, recKill, recHeal, stat,
};
