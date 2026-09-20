// ゲームエンジン：状態、ダメージ、戦闘、ターン進行、パワー
const { CARD_DB, DECKS, LEADERS, buildDeck } = require('./cards.js');

const BOARD_MAX = 5;      // ルール/03_カードとキャラクター（場は5体まで）
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
    this.attacked = false; // 攻撃または強化で行動済みになったら true
    this.frozen = false;
    this.token = false;
  }
  get value() { return this.atk + this.hp; }
}

// ステージ：場に永続的に残るカード（ルール/03_カードとキャラクター）。5体制限に数えない
class Stage {
  constructor(name, ownerIdx) {
    this.name = name;
    this.owner = ownerIdx;
    this.resting = false;
  }
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
    const ld = LEADERS[def.leader] || { atk: 0, def: 0 };
    this.leaderAtk = ld.atk;   // リーダーの攻撃力（強化・カード効果で変動）
    this.leaderDef = ld.def;   // リーダーの防御力
    this.strengthenCount = 0;  // キャラをレストにしてリーダーを強化した回数（パワースキルの段階に使う）
    this.maxMp = 0;
    this.mp = 0;
    this.power = 0;
    this.deck = shuffle(buildDeck(deckName), rng);
    this.hand = [];
    this.board = [];
    this.stages = [];
    this.grave = [];
    this.spellsInGrave = 0;
    this.spellDiscount = 0;
    this.spellsThisTurn = 0;
    this.afterburnAlways = false;
    this.powerChargedThisTurn = false;
    this.holy = 0;
    this.holyUsedThisTurn = false;
    this.frozenPending = [];
    this.fatigueLoss = false;
    this.weapon = null;          // { name, atk, token }
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
  // 受けるダメージの軽減と無効化（兄ゲイン、砦の古参兵）
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

// ---- リーダーの攻撃力／防御力 ----
function boostLeader(g, p, datk, ddef) {
  p.leaderAtk = Math.max(0, p.leaderAtk + (datk || 0));
  p.leaderDef = Math.max(0, p.leaderDef + (ddef || 0));
}

// パワースキルの段階：2回強化で第2段階、5回で第3段階（ルール/05_パワー）
function powerSkillStage(p) {
  if (p.strengthenCount >= 5) return 3;
  if (p.strengthenCount >= 2) return 2;
  return 1;
}

// ---- 戦闘（キャラクター同士）----
function canAttackUnit(u) {
  return !u.attacked && !u.frozen && u.atk > 0 && (!u.sick || u.kw.has('突進') || u.kw.has('速攻'));
}

// キャラクターをレストにしてリーダーを強化できるか（召喚酔い中・行動済みは不可）
function canStrengthen(u) {
  return !u.attacked && !u.frozen && !u.sick;
}

function strengthen(g, p, u, statName) {
  if (!canStrengthen(u)) return false;
  u.attacked = true;
  strengthenDirect(g, p, statName);
  return true;
}

// カード効果が「強化を1回行う」と明示するトリガー用。キャラクターの行動状態は問わない
function strengthenDirect(g, p, statName) {
  if (statName === 'def') p.leaderDef = Math.max(0, p.leaderDef + 1);
  else p.leaderAtk = Math.max(0, p.leaderAtk + 1);
  p.strengthenCount++;
}

function attackUnit(g, p, u, target) {
  const foe = g.opp(p);
  u.attacked = true;
  EFFECTS.onAttacked(g, p, target);
  const dmgOut = u.atk;
  const dmgIn = target.atk;
  damageUnit(g, target, dmgOut, p, u.name);
  damageUnit(g, u, dmgIn, foe, target.name);
  // 必殺：戦闘でダメージを与えたキャラクターを破壊する。防御側も含む
  if (u.kw.has('必殺') && dmgOut > 0) target.hp = Math.min(target.hp, 0);
  if (target.kw.has('必殺') && dmgIn > 0) u.hp = Math.min(u.hp, 0);
  cleanup(g);
}

// ---- 武器（ルール/03・04。耐久力は廃止。装備者の攻撃力に+する値）----
function weaponAtk(p) {
  if (!p.weapon) return 0;
  const mod = EFFECTS && EFFECTS.weaponAtkMod ? EFFECTS.weaponAtkMod(p) : 0;
  return Math.max(0, p.weapon.atk + mod);
}

// 装備する。装備中の武器は破壊して墓地へ置く
function equipWeapon(g, p, name) {
  if (p.weapon) breakWeapon(g, p);
  const d = CARD_DB[name];
  p.weapon = { name, atk: d.atk, token: !!d.token };
  if (EFFECTS && EFFECTS.onWeaponEquip) EFFECTS.onWeaponEquip(g, p, name);
  cleanup(g);
}

function breakWeapon(g, p) {
  const w = p.weapon;
  if (!w) return;
  p.weapon = null;
  if (!w.token) p.grave.push(w.name);
  if (EFFECTS && EFFECTS.onWeaponBreak) EFFECTS.onWeaponBreak(g, p, w);
}

// リーダーの合計攻撃力／防御力（武器を含む。0未満にならない）
function leaderAtkTotal(p) { return Math.max(0, p.leaderAtk + weaponAtk(p)); }
function leaderDefTotal(p) { return Math.max(0, p.leaderDef); }

// ---- ステージ（ルール/03_カードとキャラクター）----
function putStage(p, name) {
  const st = new Stage(name, p.idx);
  p.stages.push(st);
  return st;
}

function activateStage(g, p, st) {
  if (st.resting) return false;
  st.resting = true;
  if (EFFECTS && EFFECTS.onStageActivate) EFFECTS.onStageActivate(g, p, st);
  cleanup(g);
  return true;
}

// ---- ターン進行 ----
function startPhase(g, p) {
  p.maxMp = Math.min(MAX_MP_CAP, p.maxMp + 1);
  p.mp = p.maxMp;
  p.powerChargedThisTurn = false;
  p.holyUsedThisTurn = false;
  p.spellsThisTurn = 0;
  p.spellDiscount = 0;
  p.cardsThisTurn = 0;
  p.chainBonus = 0;
  p.discardedThisTurn = false;
  p.poisonHerbs = false;
  for (const u of p.frozenPending) u.frozen = false;
  p.frozenPending = [];
  for (const u of p.board) { u.sick = false; u.attacked = false; }
  for (const st of p.stages) st.resting = false;
  if (g.turn > 1) draw(g, p, 1); // 先攻の最初のターンはドローしない（ルール/02_ターンの流れ）
  if (g.over) return;
  EFFECTS.onTurnStart(g, p);
  cleanup(g);
}

// リーダー同士の戦闘：終了フェイズに自動で発動する（ルール/04_戦闘）
// 防御力が攻撃力以上ならダメージは0（下限保証なし）
function leaderAutoAttack(g, p) {
  if (g.over) return;
  if (g.turn === 1) return; // 先攻1ターン目のみ行わない
  const foe = g.opp(p);
  const dmg = Math.max(0, leaderAtkTotal(p) - leaderDefTotal(foe));
  damageLeader(g, foe, dmg, p, 'リーダー攻撃');
}

function endPhase(g, p) {
  EFFECTS.onTurnEnd(g, p);
  cleanup(g);
  if (g.over) return;
  leaderAutoAttack(g, p);
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
  } else if (d.kind === 'stage') {
    putStage(p, name);
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
  Unit, Stage, Player, Game, shuffle, mulberry32,
  setEffects, draw, endGame, checkLeaders, damageLeader, damageUnit, dealTo,
  healLeader, healUnit, cleanup, boardFull, putUnit, gainMaxMp, hasTaunt, chargePower,
  boostLeader, powerSkillStage,
  canAttackUnit, canStrengthen, strengthen, strengthenDirect, attackUnit,
  weaponAtk, equipWeapon, breakWeapon, leaderAtkTotal, leaderDefTotal,
  putStage, activateStage,
  startPhase, endPhase, leaderAutoAttack, cardCost, payAndPlay,
  recPlay, recFace, recKill, recHeal, stat,
};
