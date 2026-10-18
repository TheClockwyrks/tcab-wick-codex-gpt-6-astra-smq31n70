import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState, WickDebugApi } from "./types";
import { initial, idle, choose, stats, xpNext } from "./model";
import { debug, menuRects, tabRects, entries } from "./debug";
import { tick } from "./simulation";
import { images, assetPaths, render } from "./render";
export type * from "./types";
export const BACKGROUND = "#0b151d";
function start(s: WickState): WickState {
  return {
    ...s,
    visual: { orbits: {}, moved: 0, moving: false, puffs: [] },
    pointerArm: null,
    screen: "playing",
    menuIndex: 0,
    almanacTab: 0,
    almanacScroll: 0,
    accumulator: 0,
    run: { ...idle(), weapons: [{ id: "taper", level: 1, cooldown: 0 }] },
  };
}
function accept(s: WickState): WickState {
  switch (s.screen) {
    case "title":
      return s.menuIndex === 0
        ? start(s)
        : {
            ...s,
            screen: s.menuIndex === 1 ? "almanac" : "howto",
            menuIndex: 0,
          };
    case "levelup":
      return choose(s, s.menuIndex);
    case "chest":
      return { ...s, screen: "playing", run: { ...s.run, chestResult: null } };
    case "howto":
      return { ...s, screen: "title", menuIndex: 2 };
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: "playing", menuIndex: 0 }
        : { ...s, screen: "title", menuIndex: 0, run: idle() };
    case "fallen":
    case "dawn":
      return s.menuIndex === 0
        ? start(s)
        : { ...s, screen: "title", menuIndex: 0, run: idle() };
    default:
      return s;
  }
}
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    await Promise.all([
      ...assetPaths.map(async (path) => {
        images[path] = await api.assets.loadImage(path);
      }),
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
    ]);
    const sources: Record<string, (s: WickState) => string | number | boolean> =
      {
        screen: (s) => s.screen,
        time: (s) => s.run.tick / C.TICK_HZ,
        level: (s) => `${s.run.level} / ${s.run.xp} of ${xpNext(s.run.level)}`,
        health: (s) => `${s.run.player.hp} / ${stats(s.run).maxHp}`,
        kills: (s) => s.run.kills,
        position: (s) =>
          `${s.run.player.x.toFixed(1)}, ${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
        enemies: (s) =>
          `${s.run.enemies.length} / window ${debug.snapshot(s).run.spawnWindow}`,
        effects: (s) =>
          `${s.run.projectiles.length} bolts / ${s.run.zones.length} zones`,
        gems: (s) => s.run.gems.length,
        weapons: (s) =>
          s.run.weapons
            .map((w) => `${w.id} ${w.level} ${w.cooldown.toFixed(2)}`)
            .join(", "),
        passives: (s) =>
          s.run.passives.map((p) => `${p.id} ${p.level}`).join(", "),
        pendingLevelUps: (s) => s.run.pendingLevelUps,
      };
    for (const [name, source] of Object.entries(sources))
      api.diagnostics.register(name, source);
    for (const name of [
      "spawning",
      "events",
      "despawning",
      "enemyMotion",
      "enemyContact",
      "weaponFire",
      "effectMotion",
      "drops",
      "progression",
    ] as const)
      api.diagnostics.register(name, (s) => s[name]);
    return [initial(), debug];
  },
  update(state, api, dt) {
    let s: WickState = { ...state, simTime: state.simTime + dt };
    const pressed = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    );
    if (pressed.mute) api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted() };
    const beginning = s.screen;
    const play = (cue: C.CueName) => api.audio.play(cue);
    if (beginning === "playing") {
      if (pressed.pause || pressed.back)
        s = { ...s, screen: "paused", menuIndex: 0, accumulator: 0 };
    } else if (beginning === "paused" && (pressed.pause || pressed.back))
      s = { ...s, screen: "playing", menuIndex: 0 };
    else if (
      pressed.back &&
      ["howto", "almanac", "fallen", "dawn"].includes(beginning)
    )
      s = {
        ...s,
        screen: "title",
        menuIndex: beginning === "howto" ? 2 : beginning === "almanac" ? 1 : 0,
        almanacTab: 0,
        almanacScroll: 0,
        run: idle(),
      };
    else {
      if (beginning === "almanac" && (pressed.left || pressed.right)) {
        s = {
          ...s,
          almanacTab: (s.almanacTab + (pressed.right ? 1 : 3)) % 4,
          menuIndex: 0,
          almanacScroll: 0,
        };
        play(C.CUES.menuMove);
      }
      const n =
        beginning === "almanac"
          ? entries(s.almanacTab).length
          : menuRects(s).length;
      if (
        n &&
        (pressed.up || pressed.down) &&
        !["howto", "chest"].includes(beginning)
      ) {
        s = { ...s, menuIndex: (s.menuIndex + (pressed.down ? 1 : n - 1)) % n };
        if (beginning === "almanac")
          s = {
            ...s,
            almanacScroll: Math.max(
              0,
              Math.min(
                s.menuIndex,
                Math.max(s.almanacScroll, s.menuIndex - C.ALMANAC_ROWS + 1),
              ),
            ),
          };
        play(C.CUES.menuMove);
      }
      if (pressed.confirm) {
        const next = accept(s);
        if (
          next !== s &&
          ["title", "paused", "fallen", "dawn", "levelup"].includes(beginning)
        )
          play(beginning === "levelup" ? C.CUES.choose : C.CUES.menuConfirm);
        s = next;
      }
    }
    // Samples keep a press/release pair self-contained, including touch taps.
    const samples = api.input.pointerSamples();
    const pointer = api.input.pointer();
    const rects = menuRects(s),
      tabs = tabRects(s);
    const contains = (
      b: { x: number; y: number; width: number; height: number },
      x: number,
      y: number,
    ) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
    if (s.screen === beginning) {
      for (const sample of samples) {
        if (!sample.primary) continue;
        const i = rects.findIndex((b) => contains(b, sample.x, sample.y)),
          t = tabs.findIndex((b) => contains(b, sample.x, sample.y));
        const key = i >= 0 ? `item:${i}` : t >= 0 ? `tab:${t}` : null;
        if (sample.type === "down") s = { ...s, pointerArm: key };
        if (
          i >= 0 &&
          (sample.type === "down" || (sample.type === "move" && !pointer.down))
        ) {
          const index = s.screen === "almanac" ? s.almanacScroll + i : i;
          if (index !== s.menuIndex) play(C.CUES.menuMove);
          s = { ...s, menuIndex: index };
        }
        if (sample.type === "up") {
          const armed = s.pointerArm;
          s = { ...s, pointerArm: null };
          if (armed && armed === key) {
            if (i >= 0) {
              const next = accept(s);
              if (
                next !== s &&
                ["title", "paused", "fallen", "dawn", "levelup"].includes(
                  beginning,
                )
              )
                play(
                  beginning === "levelup" ? C.CUES.choose : C.CUES.menuConfirm,
                );
              s = next;
            } else if (t >= 0 && t !== s.almanacTab) {
              s = { ...s, almanacTab: t, menuIndex: 0, almanacScroll: 0 };
              play(C.CUES.menuMove);
            }
          }
        }
      }
      if (s.screen === "almanac")
        s = {
          ...s,
          almanacScroll: Math.max(
            0,
            Math.min(
              Math.max(0, entries(s.almanacTab).length - C.ALMANAC_ROWS),
              s.almanacScroll + Math.trunc(api.input.wheel().y / C.WHEEL_ROW),
            ),
          ),
        };
    }
    if (s.screen === "playing") {
      s = { ...s, accumulator: s.accumulator + dt };
      const dx = api.input.value("right") - api.input.value("left"),
        dy = api.input.value("down") - api.input.value("up");
      while (
        s.screen === "playing" &&
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON
      ) {
        s = { ...s, accumulator: Math.max(0, s.accumulator - C.TICK_DT) };
        s = tick(s, dx, dy, play);
      }
      if (Math.abs(s.accumulator) < C.TICK_EPSILON)
        s = { ...s, accumulator: 0 };
    } else s = { ...s, accumulator: 0 };
    const active = ["playing", "levelup", "chest", "paused"].includes(s.screen);
    if (active && !api.audio.looping(C.CUES.music))
      api.audio.loop(C.CUES.music);
    if (!active) api.audio.stop(C.CUES.music);
    const hum =
      s.screen === "playing" &&
      s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
    if (hum && !api.audio.looping(C.CUES.hum)) api.audio.loop(C.CUES.hum);
    if (!hum) api.audio.stop(C.CUES.hum);
    return s;
  },
  render(s, api) {
    render(s, api.ctx);
  },
};
