/// <reference types="node" />
import { afterEach, describe, it, expect } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game } from "./game";
import type { WickState, WickDebugApi } from "./game";
import * as C from "./constants";
import { stats, pool } from "./model";
const engines: Engine<WickState, WickDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup(ms = 1000 / 60) {
  const target = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(1280, 720) as unknown as HTMLCanvasElement,
    width: 1280,
    height: 720,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => target,
    },
    game: {
      ...game,
      initialize: (api) =>
        game.initialize({
          ...api,
          assets: {
            ...api.assets,
            loadImage: async (path) =>
              (await loadImage(
                await readFile(`assets/${path}`),
              )) as unknown as ImageBitmap,
          },
          audio: {
            ...api.audio,
            load: async (cue, path) => {
              const bytes = await readFile(`assets/${path}`);
              expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
              api.audio.define(cue, { freq: 440, durationMs: 10 });
            },
          },
        }),
    },
  });
  engines.push(engine);
  await engine.initialize();
  const debug = engine.debug;
  engine.apply((s) => debug.setScreen(s, "playing"));
  engine.apply((s) => debug.setSpawning(s, false));
  engine.apply((s) => debug.setEvents(s, false));
  return {
    engine,
    debug,
    key: (code: string, down = true) => {
      const event = new Event(down ? "keydown" : "keyup");
      Object.defineProperties(event, {
        code: { value: code },
        repeat: { value: false },
      });
      target.dispatchEvent(event);
    },
  };
}
describe("fixed clock and immutable engine state", () => {
  it("consumes thirty ticks in half a second and leaves previous state intact", async () => {
    const { engine } = await setup(500);
    const before = engine.state;
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(30);
    expect(engine.state.accumulator).toBe(0);
    expect(before.run.tick).toBe(0);
  });
  it("accumulates half ticks and freezes paused time", async () => {
    const { engine, debug } = await setup(1000 / 120);
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(0);
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(1);
    engine.apply((s) => debug.setScreen(s, "paused"));
    await engine.advance(10);
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.accumulator).toBe(0);
    expect(engine.state.simTime).toBeCloseTo(0.1);
  });
  it("normalizes diagonal movement and preserves vertical facing", async () => {
    const { engine, key } = await setup();
    key("KeyW");
    key("KeyA");
    await engine.advance(60);
    expect(
      Math.hypot(engine.state.run.player.x, engine.state.run.player.y),
    ).toBeCloseTo(C.MOVE_SPEED);
    expect(engine.state.run.player.facing).toBe("left");
    key("KeyA", false);
    await engine.advance(1);
    expect(engine.state.run.player.facing).toBe("left");
  });
  it("dawn takes precedence over fallen", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setTick(s, 35999));
    engine.apply((s) => debug.setHp(s, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("dawn");
  });
  it("contact cooldowns hurt independently and respect armor", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setEnemyMotion(s, false));
    engine.apply((s) => debug.setPassive(s, 0, "brass", 3));
    engine.apply((s) => debug.spawnEnemy(s, "moth", 0, 0));
    await engine.advance(1);
    const hp = engine.state.run.player.hp;
    expect(hp).toBe(100 - Math.max(1, C.ENEMIES.moth.damage - 3));
    await engine.advance(29);
    expect(engine.state.run.player.hp).toBe(hp);
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBeLessThan(hp);
  });
});
describe("weapons and encounters", () => {
  it.each([...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS])(
    "%s creates its real effect",
    async (id) => {
      const { engine, debug } = await setup();
      engine.apply((s) => debug.setEnemyMotion(s, false));
      engine.apply((s) => debug.setEnemyContact(s, false));
      engine.apply((s) => debug.setWeapon(s, 0, id, 1));
      engine.apply((s) => debug.spawnEnemy(s, "shade", 60, 0));
      await engine.advance(1);
      expect(
        engine.state.run.projectiles.length + engine.state.run.zones.length,
      ).toBeGreaterThan(0);
    },
  );
  it("finite pierce hits by id and removes the projectile", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setWeapon(s, 0, "ember", 1));
    engine.apply((s) => debug.setWeaponFire(s, false));
    engine.apply((s) => debug.setEnemyMotion(s, false));
    engine.apply((s) => debug.setEnemyContact(s, false));
    engine.apply((s) => debug.spawnEnemy(s, "shade", 20, 0));
    engine.apply((s) => debug.spawnEnemy(s, "shade", 20, 0));
    engine.apply((s) => debug.spawnProjectile(s, "ember", 20, 0, 0, 0, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(
      C.ENEMIES.shade.hp - C.EMBER_LEVELS[0].damage,
    );
    expect(engine.state.run.enemies[1].hp).toBe(C.ENEMIES.shade.hp);
    expect(engine.state.run.projectiles).toHaveLength(0);
  });
  it("a kill drops a gem and a posed pickup, then removes hit references", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setWeapon(s, 0, "taper", 8));
    engine.apply((s) => debug.setEnemyMotion(s, false));
    engine.apply((s) => debug.spawnEnemy(s, "moth", 70, 0));
    engine.apply((s) => debug.setNextDrop(s, "bread"));
    await engine.advance(1);
    expect(engine.state.run.kills).toBe(1);
    expect(engine.state.run.gems).toHaveLength(1);
    expect(engine.state.run.pickups[0].kind).toBe("bread");
    expect(engine.state.run.nextDrop).toBeNull();
  });
  it("scripted swarm appears on its exact tick", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setEvents(s, true));
    engine.apply((s) => debug.setNextSwarmAngle(s, 0));
    engine.apply((s) => debug.setTick(s, 3599));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(C.SWARM_SIZE);
    expect(engine.state.run.enemies[0].x).toBe(C.SPAWN_DISTANCE);
    expect(engine.state.run.firedEvents).toEqual([60]);
  });
  it("spawn cap holds a due timer until room opens", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setSpawning(s, true));
    engine.apply((s) => debug.setEnemyMotion(s, false));
    for (let i = 0; i < 20; i++)
      engine.apply((s) => debug.spawnEnemy(s, "moth", 500, i * 20));
    await engine.advance(2);
    expect(engine.state.run.spawnTimer).toBe(0);
    engine.apply((s) => debug.removeEnemy(s, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(20);
    expect(engine.state.run.spawnTimer).toBe(1);
  });
});
describe("progression and debug contracts", () => {
  it("collects experience, consumes a posed offer and resumes", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setNextOffers(s, ["ember"]));
    engine.apply((s) => debug.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run.xp).toBe(5);
    expect(engine.state.run.offers).toEqual(["ember"]);
    engine.apply((s) => debug.choose(s, 0));
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.weapons[0].id).toBe("ember");
  });
  it.each(C.EVOLUTION_IDS)(
    "evolves %s through actual chest collection",
    async (id) => {
      const { engine, debug } = await setup();
      const recipe = C.EVOLUTIONS[id];
      engine.apply((s) => debug.setWeapon(s, 0, recipe.from, 8));
      engine.apply((s) => debug.setPassive(s, 0, recipe.passive, 1));
      engine.apply((s) => debug.spawnPickup(s, "chest", 0, 0));
      await engine.advance(1);
      expect(engine.state.screen).toBe("chest");
      expect(engine.state.run.weapons[0].id).toBe(id);
      expect(engine.state.run.chestResult).toEqual({
        kind: "evolve",
        weapon: id,
      });
      expect(pool(engine.state.run)).not.toContain(recipe.from);
    },
  );
  it("poses do not heal or advance clocks; reset clears the run", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setPassive(s, 0, "tallow", 5));
    expect(engine.state.run.player.hp).toBe(100);
    expect(stats(engine.state.run).maxHp).toBe(175);
    const before = engine.state;
    engine.apply((s) => debug.reconcile(s));
    expect(engine.state).toEqual(before);
    engine.apply((s) => debug.reset(s));
    expect(engine.state.run.weapons).toHaveLength(0);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.run.tick).toBe(0);
  });
  it("rejects invalid poses", async () => {
    const { engine, debug } = await setup();
    expect(() => debug.setHp(engine.state, NaN)).toThrow();
    expect(() => debug.setWeapon(engine.state, 4, "taper", 1)).toThrow();
    expect(() => debug.setEnemyHp(engine.state, 999, 0)).toThrow();
    expect(() => debug.setNextPuddleOffset(engine.state, 401, 0)).toThrow();
  });
  it("renders every screen with no state mutation", async () => {
    const { engine, debug } = await setup();
    for (const screen of [
      "title",
      "howto",
      "almanac",
      "paused",
      "fallen",
      "dawn",
      "chest",
    ] as const) {
      engine.apply((s) => debug.setScreen(s, screen));
      const tick = engine.state.run.tick;
      await engine.advance(1);
      expect(engine.state.run.tick).toBe(tick);
    }
    expect(engine.diagnostics().length).toBeGreaterThan(15);
  });
});

describe("persistent effects and menu transitions", () => {
  it("a posed puddle pulses first on the next tick", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setWeapon(s, 0, "oil-splash", 1));
    engine.apply((s) => debug.setWeaponFire(s, false));
    engine.apply((s) => debug.setEnemyMotion(s, false));
    engine.apply((s) => debug.spawnEnemy(s, "shade", 90, 0));
    engine.apply((s) => debug.spawnPuddle(s, "oil-splash", 90, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(
      C.ENEMIES.shade.hp - C.OIL_SPLASH_LEVELS[0].damage,
    );
    await engine.advance(17);
    expect(engine.state.run.enemies[0].hp).toBe(
      C.ENEMIES.shade.hp - C.OIL_SPLASH_LEVELS[0].damage,
    );
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(
      C.ENEMIES.shade.hp - 2 * C.OIL_SPLASH_LEVELS[0].damage,
    );
  });
  it("lantern placement follows a posed player without changing its held angle", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setWeapon(s, 0, "lantern", 1));
    await engine.advance(1);
    engine.apply((s) => debug.setEffectMotion(s, false));
    engine.apply((s) => debug.setPlayerPosition(s, 300, 200));
    await engine.advance(1);
    const z = engine.state.run.zones[0];
    expect(z.x).toBe(300 + C.LANTERN_LEVELS[0].orbit);
    expect(z.y).toBe(200);
  });
  it("chandelier rebuilds its set when amount changes", async () => {
    const { engine, debug } = await setup();
    engine.apply((s) => debug.setWeapon(s, 0, "chandelier", 1));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(4);
    engine.apply((s) => debug.setPassive(s, 0, "mirror", 2));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(6);
    expect(engine.state.run.zones.every((z) => z.ttl === null)).toBe(true);
  });
  it("starts a fresh run from the title and pauses without consuming time", async () => {
    const { engine, debug, key } = await setup();
    engine.apply((s) => debug.reset(s));
    key("Enter");
    await engine.advance(1);
    key("Enter", false);
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.run.weapons[0].id).toBe("taper");
    key("KeyP");
    await engine.advance(1);
    key("KeyP", false);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.run.tick).toBe(1);
    await engine.advance(1);
    key("KeyP");
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(2);
  });
});
