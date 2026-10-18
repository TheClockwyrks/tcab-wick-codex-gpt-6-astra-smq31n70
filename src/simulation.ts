import * as C from "./constants";
import type {
  WickState,
  RunState,
  ProjectileState,
  ZoneState,
  WeaponId,
  EnemyState,
} from "./types";
import {
  timer,
  distance,
  unit,
  stats,
  row,
  spawnEnemy,
  drop,
  chest,
  openLevel,
  xpNext,
  windowIndex,
  commons,
} from "./model";
export type Sound = (cue: C.CueName) => void;
export function projectile(
  r: RunState,
  weapon: WeaponId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce?: number,
): RunState {
  const q = row(r, weapon),
    u = unit(vx, vy);
  return {
    ...r,
    nextId: r.nextId + 1,
    projectiles: [
      ...r.projectiles,
      {
        id: r.nextId,
        weapon,
        x,
        y,
        vx,
        vy,
        ax: weapon === "sconce" ? -u.x * C.SCONCE_DECEL : 0,
        ay: weapon === "sconce" ? -u.y * C.SCONCE_DECEL : 0,
        radius: q.radius,
        damage: q.damage,
        ttl: q.duration,
        pierce: pierce ?? q.pierce,
        hits: [],
      },
    ],
  };
}
export function zone(
  r: RunState,
  weapon: WeaponId,
  kind: ZoneState["kind"],
  x: number,
  y: number,
): RunState {
  const q = row(r, weapon);
  const ttl =
    kind === "aura" || weapon === "chandelier"
      ? null
      : kind === "slash"
        ? C.SLASH_FLASH
        : kind === "strike"
          ? C.SPARK_FLASH
          : kind === "burst"
            ? C.FLARE_FLASH
            : q.duration;
  const z: ZoneState = {
    id: r.nextId,
    firstPulse: r.tick,
    weapon,
    kind,
    x,
    y,
    radius: kind === "strike" ? q.area : q.radius,
    damage: q.damage,
    ttl,
    hits: [],
    ...(kind === "slash" ? { width: q.width, height: q.height } : {}),
  };
  return { ...r, nextId: r.nextId + 1, zones: [...r.zones, z] };
}
function fire(r: RunState, id: WeaponId): RunState {
  const q = row(r, id),
    p = r.player,
    f = p.facing === "right" ? 1 : -1;
  const near = [...r.enemies].sort(
    (a, b) => distance(a, p) - distance(b, p) || a.id - b.id,
  );
  if (id === "taper" || id === "pyre") {
    for (let i = 0; i < Math.min(C.TAPER_MAX_AMOUNT, q.amount); i++)
      r = zone(r, id, "slash", p.x + (q.width / 2) * f * (i ? -1 : 1), p.y);
  } else if (id === "halo" || id === "corona") {
    if (!r.zones.some((z) => z.weapon === id))
      r = zone(r, id, "aura", p.x, p.y);
  } else if (id === "flare") r = zone(r, id, "burst", p.x, p.y);
  else if (id === "lantern" || id === "chandelier") {
    for (let i = 0; i < q.amount; i++) {
      const a = (i * Math.PI * 2) / q.amount;
      r = zone(
        r,
        id,
        "lantern",
        p.x + Math.cos(a) * q.orbit,
        p.y + Math.sin(a) * q.orbit,
      );
    }
  } else if (id === "oil-splash" || id === "blaze") {
    for (let i = 0; i < q.amount; i++) {
      const a = Math.random() * Math.PI * 2,
        d = Math.sqrt(Math.random()) * C.OIL_SCATTER;
      const off = r.nextPuddleOffset ?? {
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
      };
      r = zone(
        { ...r, nextPuddleOffset: null },
        id,
        "puddle",
        p.x + off.x,
        p.y + off.y,
      );
    }
  } else if (id === "spark") {
    const targets = near.filter((e) => distance(e, p) <= C.SPARK_RANGE);
    const count = Math.min(q.amount, targets.length);
    for (let i = 0; i < count; i++) {
      const ix =
        r.nextStrikeTarget === null
          ? Math.floor(Math.random() * targets.length)
          : targets.findIndex((e) => e.id === r.nextStrikeTarget);
      const target = targets.splice(
        ix < 0 ? Math.floor(Math.random() * targets.length) : ix,
        1,
      )[0];
      r = zone(
        { ...r, nextStrikeTarget: null },
        id,
        "strike",
        target.x,
        target.y,
      );
    }
  } else {
    const n =
      id === "ember" || id === "beacon"
        ? Math.min(q.amount, near.length)
        : q.amount;
    if (id === "sconce" && !near.length) return r;
    for (let i = 0; i < n; i++) {
      const target = near[id === "ember" || id === "beacon" ? i : 0];
      let u = target ? unit(target.x - p.x, target.y - p.y) : { x: f, y: 0 };
      if (id === "pin" || id === "hail") u = { x: f, y: 0 };
      let a = Math.atan2(u.y, u.x);
      if (id === "shard" || id === "sconce")
        a +=
          ((i - (n - 1) / 2) *
            (id === "shard" ? C.SHARD_SPREAD : C.SCONCE_SPREAD) *
            Math.PI) /
          180;
      r = projectile(
        r,
        id,
        p.x,
        p.y +
          (id === "pin" || id === "hail"
            ? (i - (n - 1) / 2) * C.PIN_SPREAD
            : 0),
        Math.cos(a) * q.speed,
        Math.sin(a) * q.speed,
      );
    }
  }
  return r;
}
const overlap = (z: ZoneState, e: EnemyState) =>
  z.kind === "slash"
    ? Math.hypot(
        Math.max(0, Math.abs(e.x - z.x) - (z.width ?? 0) / 2),
        Math.max(0, Math.abs(e.y - z.y) - (z.height ?? 0) / 2),
      ) < C.ENEMIES[e.type].radius
    : distance(z, e) < z.radius + C.ENEMIES[e.type].radius;
export function tick(
  s: WickState,
  dx: number,
  dy: number,
  emit: Sound,
): WickState {
  const heard = new Set<C.CueName>();
  const sound: Sound = (cue) => {
    if (!heard.has(cue)) {
      heard.add(cue);
      emit(cue);
    }
  };
  s = {
    ...s,
    visual: {
      orbits: s.visual.orbits,
      moved: s.visual.moved + (dx || dy ? 1 : 0),
      moving: !!(dx || dy),
      puffs: s.visual.puffs
        .map((p) => ({ ...p, ttl: timer(p.ttl) }))
        .filter((p) => p.ttl > 0),
    },
  };
  let r = s.run;
  const oldId = r.nextId,
    oldWindow = windowIndex(r);
  const d = stats(r),
    len = Math.hypot(dx, dy);
  r = {
    ...r,
    tick: r.tick + 1,
    player: {
      ...r.player,
      x: r.player.x + (len ? dx / len : 0) * d.moveSpeed * C.TICK_DT,
      y: r.player.y + (len ? dy / len : 0) * d.moveSpeed * C.TICK_DT,
      facing: dx ? (dx < 0 ? "left" : "right") : r.player.facing,
      hp: Math.min(d.maxHp, r.player.hp + d.recovery * C.TICK_DT),
    },
  };
  r = {
    ...r,
    enemies: r.enemies.map((e) => {
      const def = C.ENEMIES[e.type],
        age = e.age + C.TICK_DT;
      if (!s.enemyMotion) return { ...e, age };
      let x = e.x,
        y = e.y;
      const weave = def.behavior === "weave";
      if (weave) {
        const off =
          C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
        x += e.heading.y * off;
        y -= e.heading.x * off;
      }
      const h =
        def.behavior === "drift"
          ? e.heading
          : unit(r.player.x - x, r.player.y - y);
      x += h.x * def.speed * C.TICK_DT;
      y += h.y * def.speed * C.TICK_DT;
      if (weave) {
        const off =
          C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * age) / C.WISP_PERIOD);
        x -= h.y * off;
        y += h.x * off;
      }
      return { ...e, x, y, heading: h, age };
    }),
  };
  // Firing uses this tick’s positions; placement remains active when firing is held.
  const pulses = new Set<WeaponId>();
  if (s.weaponFire) {
    const slots = [];
    for (const w of r.weapons) {
      let cooldown = timer(w.cooldown);
      if (!cooldown && w.id !== "chandelier") {
        r = fire(r, w.id);
        pulses.add(w.id);
        const q = row(r, w.id);
        cooldown = q.cooldown + (w.id === "lantern" ? q.duration : 0);
      }
      slots.push({ ...w, cooldown: w.id === "chandelier" ? 0 : cooldown });
    }
    r = { ...r, weapons: slots };
  }
  r = {
    ...r,
    zones: r.zones.filter(
      (z) =>
        !["aura", "lantern"].includes(z.kind) ||
        r.weapons.some((w) => w.id === z.weapon),
    ),
  };
  for (const w of r.weapons) {
    const existing = r.zones.filter((z) => z.weapon === w.id);
    if (w.id === "chandelier" && existing.length !== row(r, w.id).amount) {
      const angle = existing.length
        ? (s.visual.orbits[existing[0].id]?.angle ?? 0)
        : 0;
      r = { ...r, zones: r.zones.filter((z) => z.weapon !== "chandelier") };
      const firstId = r.nextId;
      r = fire(r, w.id);
      const q = row(r, w.id);
      r = {
        ...r,
        zones: r.zones.map((z) =>
          z.id >= firstId
            ? {
                ...z,
                x:
                  r.player.x +
                  Math.cos(
                    angle + ((z.id - firstId) * Math.PI * 2) / q.amount,
                  ) *
                    q.orbit,
                y:
                  r.player.y +
                  Math.sin(
                    angle + ((z.id - firstId) * Math.PI * 2) / q.amount,
                  ) *
                    q.orbit,
              }
            : z,
        ),
      };
    } else if (["halo", "corona"].includes(w.id) && !existing.length)
      r = fire(r, w.id);
  }
  const orbits: Record<number, { angle: number; orbit: number }> = {};
  r = {
    ...r,
    zones: r.zones.map((z) => {
      if (z.kind === "aura") {
        const q = row(r, z.weapon);
        return {
          ...z,
          x: r.player.x,
          y: r.player.y,
          radius: q.radius,
          damage: q.damage,
        };
      }
      if (z.kind === "lantern") {
        const q = row(r, z.weapon);
        const isNew = z.id >= oldId;
        const previous = s.visual.orbits[z.id];
        let a =
          previous?.angle ?? Math.atan2(z.y - r.player.y, z.x - r.player.x);
        if (!isNew && s.effectMotion)
          a += ((C.LANTERN_ANGULAR_SPEED * Math.PI) / 180) * C.TICK_DT;
        const orbit =
          z.weapon === "chandelier" ? q.orbit : (previous?.orbit ?? q.orbit);
        orbits[z.id] = { angle: a, orbit };
        return {
          ...z,
          x: r.player.x + Math.cos(a) * orbit,
          y: r.player.y + Math.sin(a) * orbit,
          ...(z.weapon === "chandelier"
            ? { radius: q.radius, damage: q.damage }
            : {}),
        };
      }
      return z;
    }),
  };
  s = { ...s, visual: { ...s.visual, orbits } };
  const hitsDown = (hits: ProjectileState["hits"]) =>
    hits
      .map((h) => ({ ...h, cooldown: timer(h.cooldown) }))
      .filter((h) => h.cooldown > 0);
  r = {
    ...r,
    projectiles: r.projectiles
      .map((p) => {
        if (p.id >= oldId) return p;
        const ttl = timer(p.ttl);
        let { x, y, vx, vy } = p;
        if (s.effectMotion) {
          x += vx * C.TICK_DT;
          y += vy * C.TICK_DT;
          vx += p.ax * C.TICK_DT;
          vy += p.ay * C.TICK_DT;
          if (p.weapon === "shard") {
            const lx = r.player.x - C.STAGE_CX + p.radius,
              rx = r.player.x + C.STAGE_CX - p.radius,
              ty = r.player.y - C.STAGE_CY + p.radius,
              by = r.player.y + C.STAGE_CY - p.radius;
            if (x < lx || x > rx) {
              x = Math.max(lx, Math.min(rx, x));
              vx = -vx;
            }
            if (y < ty || y > by) {
              y = Math.max(ty, Math.min(by, y));
              vy = -vy;
            }
          }
        }
        return { ...p, x, y, vx, vy, ttl, hits: hitsDown(p.hits) };
      })
      .filter((p) => p.ttl > 0),
    zones: r.zones
      .map((z) =>
        z.id >= oldId
          ? z
          : {
              ...z,
              ttl: z.ttl === null ? null : timer(z.ttl),
              hits: hitsDown(z.hits),
            },
      )
      .filter((z) => z.ttl === null || z.ttl > 0),
  };
  // Resolve every hit before removing any enemy, in stable entity order.
  let enemies = [...r.enemies];
  let hp = r.player.hp;
  function hit(id: number, damage: number, weapon: WeaponId) {
    enemies = enemies.map((e) => {
      if (e.id !== id) return e;
      sound(C.CUES.hit);
      if (weapon === "pyre") hp = Math.min(d.maxHp, hp + C.PYRE_HEAL);
      if (weapon === "corona" && e.hp > 0 && e.hp <= damage)
        hp = Math.min(d.maxHp, hp + C.CORONA_HEAL);
      return { ...e, hp: e.hp - damage };
    });
  }
  const projectiles: ProjectileState[] = [];
  for (const source of r.projectiles) {
    let p = source,
      dead = false;
    for (const e of enemies) {
      if (
        distance(p, e) >= p.radius + C.ENEMIES[e.type].radius ||
        p.hits.some((h) => h.enemy === e.id)
      )
        continue;
      hit(e.id, p.damage, p.weapon);
      if (p.pierce === 0) {
        dead = true;
        break;
      }
      p = {
        ...p,
        pierce: p.pierce < 0 ? p.pierce : p.pierce - 1,
        hits: [
          ...p.hits,
          {
            enemy: e.id,
            cooldown:
              p.pierce < 0
                ? p.weapon === "sconce"
                  ? C.SCONCE_REHIT
                  : C.SHARD_REHIT
                : p.ttl,
          },
        ],
      };
    }
    if (!dead) projectiles.push(p);
  }
  const zones: ZoneState[] = [];
  for (const source of r.zones) {
    let z = source;
    let active = z.id >= oldId || z.kind === "lantern";
    if (z.kind === "aura") active = pulses.has(z.weapon);
    if (z.kind === "puddle") {
      const q = row(r, z.weapon),
        interval = z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE;
      active =
        (z.firstPulse === undefined
          ? Math.round((q.duration - (z.ttl ?? 0)) * C.TICK_HZ)
          : r.tick - z.firstPulse) %
          Math.round(interval * C.TICK_HZ) ===
        0;
    }
    if (active)
      for (const e of enemies) {
        if (
          z.kind === "burst"
            ? distance(z, e) > z.radius || C.FLARE_IMMUNE.includes(e.type)
            : !overlap(z, e)
        )
          continue;
        if (z.hits.some((h) => h.enemy === e.id)) continue;
        hit(e.id, z.damage, z.weapon);
        if (z.kind === "lantern")
          z = {
            ...z,
            hits: [...z.hits, { enemy: e.id, cooldown: C.LANTERN_REHIT }],
          };
      }
    zones.push(z);
  }
  r = { ...r, projectiles, zones, player: { ...r.player, hp }, enemies };
  for (const e of enemies.filter((e) => e.hp <= 0)) {
    sound(C.CUES.kill);
    s = {
      ...s,
      visual: {
        ...s.visual,
        puffs: [...s.visual.puffs, { x: e.x, y: e.y, ttl: C.PUFF_TIME }],
      },
    };
    r = { ...r, kills: r.kills + 1 };
    if (s.drops) {
      const def = C.ENEMIES[e.type];
      if (def.drop === "chest")
        r = {
          ...r,
          nextId: r.nextId + 1,
          pickups: [
            ...r.pickups,
            { id: r.nextId, kind: "chest", x: e.x, y: e.y },
          ],
        };
      else if (def.drop) {
        r = {
          ...r,
          nextId: r.nextId + 1,
          gems: [
            ...r.gems,
            { id: r.nextId, tier: def.drop, x: e.x, y: e.y, attracted: false },
          ],
        };
        const kind = drop(r);
        r = { ...r, nextDrop: null };
        if (kind !== "none")
          r = {
            ...r,
            nextId: r.nextId + 1,
            pickups: [...r.pickups, { id: r.nextId, kind, x: e.x, y: e.y }],
          };
      }
    }
  }
  r = {
    ...r,
    enemies: r.enemies.filter((e) => e.hp > 0),
    hurtFlash: timer(r.hurtFlash),
  };
  let contactHp = r.player.hp,
    hurtFlash = r.hurtFlash;
  const contactEnemies = r.enemies.map((e) => {
    let cooldown = timer(e.contactCooldown);
    if (
      s.enemyContact &&
      !cooldown &&
      distance(e, r.player) < C.ENEMIES[e.type].radius + C.PLAYER_RADIUS
    ) {
      contactHp -= Math.max(
        C.MIN_DAMAGE_TAKEN,
        C.ENEMIES[e.type].damage - d.armor,
      );
      hurtFlash = C.HURT_FLASH;
      cooldown = C.CONTACT_COOLDOWN;
      sound(C.CUES.hurt);
    }
    return { ...e, contactCooldown: cooldown };
  });
  r = {
    ...r,
    enemies: contactEnemies,
    player: { ...r.player, hp: contactHp },
    hurtFlash,
  };
  // Collection follows contact, with one chest taking precedence over level-ups.
  let collectedChest = false;
  const pickups = [];
  for (const p of r.pickups) {
    if (
      distance(p, r.player) >= C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS ||
      (p.kind === "chest" && collectedChest)
    ) {
      pickups.push(p);
      continue;
    }
    if (p.kind === "chest") {
      r = chest(r);
      collectedChest = true;

      if (r.chestResult?.kind === "evolve") sound(C.CUES.evolve);
    } else {
      sound(C.CUES.pickup);
      if (p.kind === "bread")
        r = {
          ...r,
          player: {
            ...r.player,
            hp: Math.min(d.maxHp, r.player.hp + C.BREAD_HEAL),
          },
        };
      else r = { ...r, gems: r.gems.map((g) => ({ ...g, attracted: true })) };
    }
  }
  r = { ...r, pickups };
  const gems = [];
  for (let g of r.gems) {
    const dist = distance(g, r.player);
    g = { ...g, attracted: g.attracted || dist <= d.pickupRadius };
    if (g.attracted && g.id < oldId && dist) {
      const amount = Math.min(dist, C.GEM_SPEED * C.TICK_DT);
      g = {
        ...g,
        x: g.x + ((r.player.x - g.x) / dist) * amount,
        y: g.y + ((r.player.y - g.y) / dist) * amount,
      };
    }
    if (distance(g, r.player) <= C.COLLECT_RADIUS) {
      sound(C.CUES.gem);
      r = { ...r, xp: r.xp + C.GEM_VALUES[g.tier] * d.xpMul };
      if (s.progression)
        while (r.xp >= xpNext(r.level))
          r = {
            ...r,
            xp: r.xp - xpNext(r.level),
            level: r.level + 1,
            pendingLevelUps: r.pendingLevelUps + 1,
          };
    } else gems.push(g);
  }
  r = { ...r, gems };
  if (s.despawning)
    r = {
      ...r,
      enemies: r.enemies.filter(
        (e) =>
          C.ENEMIES[e.type].rank !== "common" ||
          distance(e, r.player) <= C.DESPAWN_DISTANCE,
      ),
    };
  function ring(type: C.EnemyId, swarm = false) {
    const a =
      (((swarm ? r.nextSwarmAngle : r.nextSpawnAngle) ?? Math.random() * 360) *
        Math.PI) /
      180;
    const x = r.player.x + Math.cos(a) * C.SPAWN_DISTANCE,
      y = r.player.y + Math.sin(a) * C.SPAWN_DISTANCE;
    r = {
      ...r,
      ...(swarm ? { nextSwarmAngle: null } : { nextSpawnAngle: null }),
    };
    for (let i = 0; i < (swarm ? C.SWARM_SIZE : 1); i++) {
      const off = swarm ? (i / (C.SWARM_SIZE - 1) - 0.5) * C.SWARM_LINE : 0;
      r = spawnEnemy(r, type, x - Math.sin(a) * off, y + Math.cos(a) * off);
      if (swarm)
        r = {
          ...r,
          enemies: r.enemies.map((e) =>
            e.id === r.nextId - 1
              ? { ...e, heading: { x: -Math.cos(a), y: -Math.sin(a) } }
              : e,
          ),
        };
    }
  }
  if (s.events)
    for (const event of C.EVENTS)
      if (
        r.tick === event.time * C.TICK_HZ &&
        !r.firedEvents.includes(event.time)
      ) {
        ring(event.type, event.kind === "swarm");
        r = {
          ...r,
          firedEvents: [...r.firedEvents, event.time].sort((a, b) => a - b),
        };
      }
  if (s.spawning) {
    const w = C.SPAWN_WINDOWS[windowIndex(r)];
    r = {
      ...r,
      spawnTimer: oldWindow !== windowIndex(r) ? 0 : timer(r.spawnTimer),
    };
    if (!r.spawnTimer) {
      if (commons(r) < w.cap) {
        const type =
          r.nextSpawnType && w.types.includes(r.nextSpawnType)
            ? r.nextSpawnType
            : w.types[Math.floor(Math.random() * w.types.length)];
        ring(type);
        r = { ...r, nextSpawnType: null, spawnTimer: w.interval };
      }
    }
  }
  const alive = new Set(r.enemies.map((e) => e.id));
  r = {
    ...r,
    projectiles: r.projectiles.map((p) => ({
      ...p,
      hits: p.hits.filter((h) => alive.has(h.enemy)),
    })),
    zones: r.zones.map((z) => ({
      ...z,
      hits: z.hits.filter((h) => alive.has(h.enemy)),
    })),
  };
  s = { ...s, run: r };
  if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    sound(C.CUES.dawn);
    return { ...s, screen: "dawn", menuIndex: 0, accumulator: 0 };
  }
  if (r.player.hp <= 0) {
    sound(C.CUES.fallen);
    return { ...s, screen: "fallen", menuIndex: 0, accumulator: 0 };
  }
  if (collectedChest) sound(C.CUES.chest);
  if (collectedChest)
    return { ...s, screen: "chest", menuIndex: 0, accumulator: 0 };
  if (r.pendingLevelUps) {
    sound(C.CUES.levelUp);
    return openLevel(s);
  }
  return s;
}
