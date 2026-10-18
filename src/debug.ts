import * as C from "./constants";
import type {
  WickDebugApi,
  WickState,
  RunState,
  EnemyState,
  WickRect,
} from "./types";
import {
  initial,
  stats,
  pool,
  choose,
  spawnEnemy,
  drop,
  xpNext,
  windowIndex,
  commons,
} from "./model";
import { projectile, zone } from "./simulation";
export const entries = (tab: number): readonly string[] =>
  [
    [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
    C.PASSIVE_IDS,
    C.ENEMY_IDS,
    [...C.GEM_TIERS, ...C.PICKUP_KINDS],
  ][tab];
export function menuRects(s: WickState): WickRect[] {
  const count =
    s.screen === "title"
      ? 3
      : s.screen === "levelup"
        ? s.run.offers.length
        : s.screen === "almanac"
          ? Math.min(
              C.ALMANAC_ROWS,
              entries(s.almanacTab).length - s.almanacScroll,
            )
          : ["paused", "fallen", "dawn"].includes(s.screen)
            ? 2
            : ["howto", "chest"].includes(s.screen)
              ? 1
              : 0;
  return Array.from({ length: count }, (_, i) =>
    s.screen === "almanac"
      ? { x: 96, y: 185 + i * 42, width: 370, height: 38 }
      : s.screen === "levelup"
        ? { x: 320, y: 255 + i * 90, width: 640, height: 76 }
        : s.screen === "title"
          ? { x: 145, y: 390 + i * 62, width: 360, height: 50 }
          : {
              x: 440,
              y:
                (s.screen === "howto" || s.screen === "chest" ? 570 : 410) +
                i * 65,
              width: 400,
              height: 52,
            },
  );
}
export const tabRects = (s: WickState): WickRect[] =>
  s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 96 + i * 272,
        y: 112,
        width: 250,
        height: 48,
      }))
    : [];
const valid = (ok: boolean) => {
  if (!ok) throw Error("Invalid debug argument");
};
const number = (n: number, min = -Infinity, integer = false) =>
  valid(Number.isFinite(n) && n >= min && (!integer || Number.isInteger(n)));
const patch = (s: WickState, r: Partial<RunState>): WickState => ({
  ...s,
  run: { ...s.run, ...r },
});
const enemy = (s: WickState, id: number, p: Partial<EnemyState>) => {
  valid(s.run.enemies.some((e) => e.id === id));
  return patch(s, {
    enemies: s.run.enemies.map((e) => (e.id === id ? { ...e, ...p } : e)),
  });
};
const clean = (s: WickState): WickState => {
  const ids = new Set(s.run.enemies.map((e) => e.id));
  return patch(s, {
    projectiles: s.run.projectiles.map((p) => ({
      ...p,
      hits: p.hits.filter((h) => ids.has(h.enemy)),
    })),
    zones: s.run.zones.map((z) => ({
      ...z,
      hits: z.hits.filter((h) => ids.has(h.enemy)),
    })),
  });
};
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  reconcile: (s) => ({ ...s }),
  snapshot: (s) => {
    const d = stats(s.run);
    const { visual: _visual, pointerArm: _arm, ...declared } = s;
    return {
      ...declared,
      version: C.WICK_DEBUG_VERSION,
      run: {
        ...s.run,
        zones: s.run.zones.map(({ firstPulse: _firstPulse, ...z }) => z),
        time: s.run.tick / C.TICK_HZ,
        xpToNext: xpNext(s.run.level),
        maxHp: d.maxHp,
        armor: d.armor,
        moveSpeed: d.moveSpeed,
        pickupRadius: d.pickupRadius,
        spawnWindow: windowIndex(s.run),
        aliveCommons: commons(s.run),
        pool: s.screen === "levelup" ? pool(s.run) : [],
      },
    };
  },
  menuRects,
  tabRects,
  setScreen: (s, screen) => {
    valid(
      [
        "title",
        "howto",
        "almanac",
        "playing",
        "levelup",
        "chest",
        "paused",
        "fallen",
        "dawn",
      ].includes(screen),
    );
    return {
      ...s,
      screen,
      menuIndex: 0,
      almanacTab: 0,
      almanacScroll: 0,
      accumulator: screen === "playing" ? s.accumulator : 0,
    };
  },
  choose,
  setSpawning: (s, on) => ({ ...s, spawning: on }),
  setEvents: (s, on) => ({ ...s, events: on }),
  setDespawning: (s, on) => ({ ...s, despawning: on }),
  setEnemyMotion: (s, on) => ({ ...s, enemyMotion: on }),
  setEnemyContact: (s, on) => ({ ...s, enemyContact: on }),
  setWeaponFire: (s, on) => ({ ...s, weaponFire: on }),
  setEffectMotion: (s, on) => ({ ...s, effectMotion: on }),
  setDrops: (s, on) => ({ ...s, drops: on }),
  setProgression: (s, on) => ({ ...s, progression: on }),
  setTick: (s, tick) => {
    number(tick, 0, true);
    valid(tick < C.DAWN_TIME * C.TICK_HZ);
    return patch(s, { tick });
  },
  setSpawnTimer: (s, spawnTimer) => {
    number(spawnTimer, 0);
    return patch(s, { spawnTimer });
  },
  setNextSpawnAngle: (s, nextSpawnAngle) => {
    number(nextSpawnAngle, 0);
    valid(nextSpawnAngle < 360);
    return patch(s, { nextSpawnAngle });
  },
  setNextSwarmAngle: (s, nextSwarmAngle) => {
    number(nextSwarmAngle, 0);
    valid(nextSwarmAngle < 360);
    return patch(s, { nextSwarmAngle });
  },
  setNextSpawnType: (s, nextSpawnType) => {
    valid(C.ENEMY_IDS.includes(nextSpawnType));
    return patch(s, { nextSpawnType });
  },
  setNextPuddleOffset: (s, x, y) => {
    number(x);
    number(y);
    valid(Math.hypot(x, y) <= C.OIL_SCATTER);
    return patch(s, { nextPuddleOffset: { x, y } });
  },
  setNextStrikeTarget: (s, nextStrikeTarget) => {
    number(nextStrikeTarget, 0, true);
    valid(s.run.enemies.some((e) => e.id === nextStrikeTarget));
    return patch(s, { nextStrikeTarget });
  },
  setNextChestItem: (s, nextChestItem) => {
    valid(
      [...C.BASE_WEAPON_IDS, ...C.PASSIVE_IDS].includes(
        nextChestItem as C.BaseWeaponId,
      ),
    );
    return patch(s, { nextChestItem });
  },
  setNextDrop: (s, nextDrop) => {
    valid(["bread", "draft", "none"].includes(nextDrop));
    return patch(s, { nextDrop });
  },
  rollDrop: (s) => drop({ ...s.run, nextDrop: null }),
  setPlayerPosition: (s, x, y) => {
    number(x);
    number(y);
    return patch(s, { player: { ...s.run.player, x, y } });
  },
  setFacing: (s, facing) => {
    valid(["left", "right"].includes(facing));
    return patch(s, { player: { ...s.run.player, facing } });
  },
  setHp: (s, hp) => {
    number(hp);
    return patch(s, { player: { ...s.run.player, hp } });
  },
  setLevel: (s, level) => {
    number(level, 1, true);
    return patch(s, { level });
  },
  setXp: (s, xp) => {
    number(xp, 0);
    return patch(s, { xp });
  },
  setKills: (s, kills) => {
    number(kills, 0, true);
    return patch(s, { kills });
  },
  setPendingLevelUps: (s, pendingLevelUps) => {
    number(pendingLevelUps, 0, true);
    return patch(s, { pendingLevelUps });
  },
  setNextOffers: (s, nextOffers) => {
    valid(
      nextOffers.length > 0 &&
        nextOffers.length <= C.OFFER_COUNT &&
        new Set(nextOffers).size === nextOffers.length &&
        nextOffers.every((id) => id in C.ICON_PATHS),
    );
    return patch(s, { nextOffers: [...nextOffers] });
  },
  setWeapon: (s, slot, id, level) => {
    number(slot, 0, true);
    number(level, 1, true);
    valid(
      slot <= s.run.weapons.length &&
        slot < C.WEAPON_SLOTS &&
        id in C.WEAPON_NAMES &&
        level <=
          (C.EVOLUTION_IDS.includes(id as C.EvolutionId)
            ? 1
            : C.MAX_WEAPON_LEVEL) &&
        !s.run.weapons.some((w, i) => i !== slot && w.id === id),
    );
    valid(
      !s.run.weapons.some(
        (w, i) =>
          i !== slot &&
          C.EVOLUTION_IDS.some(
            (e) =>
              (e === id && C.EVOLUTIONS[e].from === w.id) ||
              (e === w.id && C.EVOLUTIONS[e].from === id),
          ),
      ),
    );
    const weapons = [...s.run.weapons];
    weapons[slot] = {
      id,
      level,
      cooldown: weapons[slot]?.id === id ? weapons[slot].cooldown : 0,
    };
    return patch(s, { weapons });
  },
  setWeaponCooldown: (s, slot, cooldown) => {
    number(cooldown, 0);
    valid(!!s.run.weapons[slot]);
    return patch(s, {
      weapons: s.run.weapons.map((w, i) =>
        i === slot ? { ...w, cooldown } : w,
      ),
    });
  },
  removeWeapon: (s, slot) => {
    valid(!!s.run.weapons[slot]);
    return patch(s, { weapons: s.run.weapons.filter((_, i) => i !== slot) });
  },
  setPassive: (s, slot, id, level) => {
    number(slot, 0, true);
    number(level, 1, true);
    valid(
      id in C.PASSIVES &&
        level <= C.PASSIVES[id].maxLevel &&
        slot <= s.run.passives.length &&
        slot < C.PASSIVE_SLOTS &&
        !s.run.passives.some((p, i) => i !== slot && p.id === id),
    );
    const passives = [...s.run.passives];
    passives[slot] = { id, level };
    return patch(s, { passives });
  },
  removePassive: (s, slot) => {
    valid(!!s.run.passives[slot]);
    return patch(s, { passives: s.run.passives.filter((_, i) => i !== slot) });
  },
  spawnEnemy: (s, type, x, y) => {
    valid(type in C.ENEMIES);
    number(x);
    number(y);
    return { ...s, run: spawnEnemy(s.run, type, x, y) };
  },
  setEnemyPosition: (s, id, x, y) => {
    number(x);
    number(y);
    return enemy(s, id, { x, y });
  },
  setEnemyHp: (s, id, hp) => {
    number(hp);
    return enemy(s, id, { hp });
  },
  setEnemyHeading: (s, id, x, y) => {
    number(x);
    number(y);
    valid(Math.abs(Math.hypot(x, y) - 1) < C.TICK_EPSILON);
    return enemy(s, id, { heading: { x, y } });
  },
  setEnemyAge: (s, id, age) => {
    number(age, 0);
    return enemy(s, id, { age });
  },
  setEnemyContactCooldown: (s, id, contactCooldown) => {
    number(contactCooldown, 0);
    return enemy(s, id, { contactCooldown });
  },
  removeEnemy: (s, id) => {
    valid(s.run.enemies.some((e) => e.id === id));
    return clean(
      patch(s, { enemies: s.run.enemies.filter((e) => e.id !== id) }),
    );
  },
  clearEnemies: (s) => clean(patch(s, { enemies: [] })),
  spawnProjectile: (s, w, x, y, vx, vy, pierce) => {
    [x, y, vx, vy].forEach((n) => number(n));
    number(pierce, -1, true);
    valid(s.run.weapons.some((v) => v.id === w));
    return { ...s, run: projectile(s.run, w, x, y, vx, vy, pierce) };
  },
  clearProjectiles: (s) => patch(s, { projectiles: [] }),
  spawnPuddle: (s, w, x, y) => {
    number(x);
    number(y);
    valid(s.run.weapons.some((v) => v.id === w));
    const r = zone(s.run, w, "puddle", x, y);
    return {
      ...s,
      run: {
        ...r,
        zones: r.zones.map((z) =>
          z.id === r.nextId - 1 ? { ...z, firstPulse: r.tick + 1 } : z,
        ),
      },
    };
  },
  clearZones: (s) => patch(s, { zones: [] }),
  spawnGem: (s, tier, x, y) => {
    valid(C.GEM_TIERS.includes(tier));
    number(x);
    number(y);
    return patch(s, {
      nextId: s.run.nextId + 1,
      gems: [...s.run.gems, { id: s.run.nextId, tier, x, y, attracted: false }],
    });
  },
  setGemAttracted: (s, id, attracted) => {
    valid(s.run.gems.some((g) => g.id === id));
    return patch(s, {
      gems: s.run.gems.map((g) => (g.id === id ? { ...g, attracted } : g)),
    });
  },
  clearGems: (s) => patch(s, { gems: [] }),
  spawnPickup: (s, kind, x, y) => {
    valid(C.PICKUP_KINDS.includes(kind));
    number(x);
    number(y);
    return patch(s, {
      nextId: s.run.nextId + 1,
      pickups: [...s.run.pickups, { id: s.run.nextId, kind, x, y }],
    });
  },
  clearPickups: (s) => patch(s, { pickups: [] }),
};
