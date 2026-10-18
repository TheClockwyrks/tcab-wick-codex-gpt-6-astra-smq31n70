import * as C from "./constants";
import type { WickState, RunState, WeaponId, OfferId, EnemyId } from "./types";
export const timer = (n: number): number =>
  n - C.TICK_DT < C.TICK_DT / 2 ? 0 : n - C.TICK_DT;
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => Math.hypot(a.x - b.x, a.y - b.y);
export const unit = (x: number, y: number) => {
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : { x: 1, y: 0 };
};
export const xpNext = (level: number) => C.XP_BASE + C.XP_STEP * (level - 1);
export function idle(): RunState {
  return {
    tick: 0,
    level: 1,
    xp: 0,
    kills: 0,
    player: { x: 0, y: 0, hp: C.BASE_MAX_HP, facing: "right" },
    hurtFlash: 0,
    weapons: [],
    passives: [],
    enemies: [],
    projectiles: [],
    zones: [],
    gems: [],
    pickups: [],
    offers: [],
    nextOffers: null,
    pendingLevelUps: 0,
    chestResult: null,
    spawnTimer: 0,
    firedEvents: [],
    nextId: 0,
    nextSpawnAngle: null,
    nextSwarmAngle: null,
    nextSpawnType: null,
    nextPuddleOffset: null,
    nextStrikeTarget: null,
    nextChestItem: null,
    nextDrop: null,
  };
}
export function initial(): WickState {
  return {
    visual: { orbits: {}, moved: 0, moving: false, puffs: [] },
    pointerArm: null,
    screen: "title",
    menuIndex: 0,
    almanacTab: 0,
    almanacScroll: 0,
    run: idle(),
    accumulator: 0,
    simTime: 0,
    muted: false,
    spawning: true,
    events: true,
    despawning: true,
    enemyMotion: true,
    enemyContact: true,
    weaponFire: true,
    effectMotion: true,
    drops: true,
    progression: true,
  };
}
export function stats(r: RunState) {
  const p = (id: C.PassiveId) =>
    r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * p("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * p("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * p("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * p("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * p("mirror"),
    moveSpeed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * p("bellows")),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * p("tallow"),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * p("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * p("soot"),
    pickupRadius: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * p("lure")),
  };
}
export function pool(r: RunState): OfferId[] {
  return [
    ...C.BASE_WEAPON_IDS.filter((id) => {
      const w = r.weapons.find((w) => w.id === id);
      return w
        ? w.level < C.MAX_WEAPON_LEVEL
        : r.weapons.length < C.WEAPON_SLOTS &&
            !C.EVOLUTION_IDS.some(
              (e) =>
                C.EVOLUTIONS[e].from === id &&
                r.weapons.some((w) => w.id === e),
            );
    }),
    ...C.PASSIVE_IDS.filter((id) => {
      const p = r.passives.find((p) => p.id === id);
      return p
        ? p.level < C.PASSIVES[id].maxLevel
        : r.passives.length < C.PASSIVE_SLOTS;
    }),
  ];
}
export function openLevel(s: WickState): WickState {
  const p = pool(s.run),
    n = Math.min(C.OFFER_COUNT, p.length);
  let offers = s.run.nextOffers ? [...s.run.nextOffers] : null;
  if (
    offers &&
    offers.some((o) => (p.length ? !p.includes(o) : o !== C.LAMP_OIL_ID))
  )
    offers = null;
  if (!offers) {
    offers = [];
    const left = [...p];
    while (offers.length < n)
      offers.push(left.splice(Math.floor(Math.random() * left.length), 1)[0]);
    if (!n) offers = [C.LAMP_OIL_ID];
  }
  return {
    ...s,
    screen: "levelup",
    menuIndex: 0,
    accumulator: 0,
    run: { ...s.run, offers, nextOffers: null },
  };
}
export function gain(r: RunState, id: OfferId): RunState {
  if (id === C.LAMP_OIL_ID)
    return {
      ...r,
      player: {
        ...r.player,
        hp: Math.min(stats(r).maxHp, r.player.hp + C.LAMP_OIL_HEAL),
      },
    };
  if (id in C.PASSIVES) {
    const pid = id as C.PassiveId;
    const old = r.passives.find((p) => p.id === id);
    return {
      ...r,
      passives: old
        ? r.passives.map((p) =>
            p.id === id ? { ...p, level: p.level + 1 } : p,
          )
        : [...r.passives, { id: pid, level: 1 }],
      player: {
        ...r.player,
        hp: r.player.hp + (id === "tallow" ? C.TALLOW_HP_PER_LEVEL : 0),
      },
    };
  }
  const old = r.weapons.find((w) => w.id === id);
  return {
    ...r,
    weapons: old
      ? r.weapons.map((w) => (w.id === id ? { ...w, level: w.level + 1 } : w))
      : [...r.weapons, { id: id as WeaponId, level: 1, cooldown: 0 }],
  };
}
export function choose(s: WickState, index: number): WickState {
  if (!Number.isInteger(index) || !s.run.offers[index])
    throw Error("Invalid offer");
  let r = gain(s.run, s.run.offers[index]);
  r = { ...r, pendingLevelUps: Math.max(0, r.pendingLevelUps - 1), offers: [] };
  const next = { ...s, screen: "playing" as const, menuIndex: 0, run: r };
  return r.pendingLevelUps ? openLevel(next) : next;
}
export function chest(r: RunState): RunState {
  const posed = r.nextChestItem;
  r = { ...r, nextChestItem: null };
  for (const w of r.weapons) {
    const evo = C.EVOLUTION_IDS.find(
      (e) =>
        C.EVOLUTIONS[e].from === w.id &&
        w.level === C.MAX_WEAPON_LEVEL &&
        r.passives.some((p) => p.id === C.EVOLUTIONS[e].passive),
    );
    if (evo)
      return {
        ...r,
        weapons: r.weapons.map((v) =>
          v === w ? { id: evo, level: 1, cooldown: 0 } : v,
        ),
        chestResult: { kind: "evolve", weapon: evo },
      };
  }
  const candidates = pool(r).filter((id) =>
    [...r.weapons, ...r.passives].some((w) => w.id === id),
  );
  if (candidates.length) {
    const id =
      posed && candidates.includes(posed)
        ? posed
        : candidates[Math.floor(Math.random() * candidates.length)];
    const next = gain(r, id);
    return {
      ...next,
      nextChestItem: null,
      chestResult: {
        kind: "level",
        item: id as C.WeaponId | C.PassiveId,
        level: [...next.weapons, ...next.passives].find((w) => w.id === id)!
          .level,
      },
    };
  }
  return {
    ...r,
    player: {
      ...r.player,
      hp: Math.min(stats(r).maxHp, r.player.hp + C.CHEST_HEAL),
    },
    chestResult: { kind: "heal" },
  };
}
export interface Row {
  damage: number;
  cooldown: number;
  radius: number;
  amount: number;
  speed: number;
  duration: number;
  pierce: number;
  width: number;
  height: number;
  orbit: number;
  area: number;
}
export function row(r: RunState, id: WeaponId): Row {
  const level = r.weapons.find((w) => w.id === id)?.level ?? 1;
  const evolved = {
    pyre: C.PYRE_STATS,
    beacon: C.BEACON_STATS,
    hail: C.HAIL_STATS,
    chandelier: C.CHANDELIER_STATS,
    corona: C.CORONA_STATS,
    blaze: C.BLAZE_STATS,
  };
  const raw =
    id in evolved
      ? evolved[id as C.EvolutionId]
      : C.WEAPON_LEVELS[id as C.BaseWeaponId][level - 1];
  const d = stats(r);
  const v = {
    cooldown: 0,
    radius: 0,
    amount: 1,
    speed: 0,
    duration: 0,
    pierce: C.INFINITE_PIERCE,
    width: 0,
    height: 0,
    orbit: 0,
    area: 0,
    ...raw,
  };
  return {
    ...v,
    damage: v.damage * d.damageMul,
    cooldown: Math.max(C.MIN_COOLDOWN, v.cooldown * d.cooldownMul),
    amount: v.amount + d.amountBonus,
    radius: v.radius * d.areaMul,
    width: v.width * d.areaMul,
    height: v.height * d.areaMul,
    orbit: v.orbit * d.areaMul,
    area: v.area * d.areaMul,
  };
}
export function spawnEnemy(
  r: RunState,
  type: EnemyId,
  x: number,
  y: number,
): RunState {
  const e = C.ENEMIES[type];
  const hp =
    e.hp *
    (e.rank === "common"
      ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
      : 1);
  return {
    ...r,
    nextId: r.nextId + 1,
    enemies: [
      ...r.enemies,
      {
        id: r.nextId,
        type,
        x,
        y,
        hp,
        maxHp: hp,
        heading: unit(r.player.x - x, r.player.y - y),
        age: 0,
        contactCooldown: 0,
      },
    ],
  };
}
export const drop = (r: RunState) =>
  r.nextDrop ??
  (Math.random() < C.BREAD_CHANCE
    ? "bread"
    : Math.random() < C.DRAFT_CHANCE
      ? "draft"
      : "none");
export const windowIndex = (r: RunState) =>
  Math.min(
    C.SPAWN_WINDOWS.length - 1,
    Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW),
  );
export const commons = (r: RunState) =>
  r.enemies.filter(
    (e) => e.type !== "gnat" && C.ENEMIES[e.type].rank === "common",
  ).length;
