import * as C from "./constants";
import type { WickState, OfferId } from "./types";
import { stats, xpNext, row } from "./model";
import { menuRects, tabRects, entries } from "./debug";
export const images: Record<string, ImageBitmap> = {};
export const assetPaths = [
  C.LAMPLIGHTER_IDLE_PATH,
  ...Array.from(
    { length: C.LAMPLIGHTER_WALK_SHEET.frames },
    (_, i) => `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
  ),
  ...C.ENEMY_IDS.flatMap((id) =>
    Array.from(
      { length: C.ENEMY_FRAMES },
      (_, i) => `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
    ),
  ),
  ...Array.from(
    { length: C.PUFF_SHEET.frames },
    (_, i) => `${C.PUFF_SHEET.dir}/${i}.png`,
  ),
  ...Object.values(C.GEM_PATHS),
  ...Object.values(C.PICKUP_PATHS),
  C.GROUND_TILE_PATH,
  ...Object.values(C.ICON_PATHS),
  ...Object.values(C.EFFECT_SPRITES).flatMap((e) =>
    e.frames === 1
      ? [e.path]
      : Array.from({ length: e.frames }, (_, i) => `${e.path}/${i}.png`),
  ),
];
const ivory = "#eee2c6",
  gold = "#d4ad6f",
  dim = "#89928e",
  line = "#48514d";
export const names: Record<string, string> = {
  ...C.WEAPON_NAMES,
  ...Object.fromEntries(C.PASSIVE_IDS.map((id) => [id, C.PASSIVES[id].name])),
  ...Object.fromEntries(C.ENEMY_IDS.map((id) => [id, C.ENEMIES[id].name])),
  ...C.GEM_NAMES,
  ...C.PICKUP_NAMES,
  [C.LAMP_OIL_ID]: C.LAMP_OIL_NAME,
};
export const descriptions: Record<string, string> = {
  ...C.WEAPON_DESCRIPTIONS,
  ...C.PASSIVE_DESCRIPTIONS,
  ...C.ENEMY_DESCRIPTIONS,
  ...C.GEM_DESCRIPTIONS,
  ...C.PICKUP_DESCRIPTIONS,
  [C.LAMP_OIL_ID]: C.LAMP_OIL_DESCRIPTION,
};
export function render(s: WickState, ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = false;
  const text = (
    t: string,
    x: number,
    y: number,
    size = 18,
    color = ivory,
    align: CanvasTextAlign = "left",
    serif = false,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${serif ? "Georgia, serif" : "monospace"}`;
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
  };
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill = "#101c23",
    stroke = line,
  ) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };
  const sprite = (
    path: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    flip = false,
  ) => {
    const img = images[path];
    if (!img) return;
    const iw = w ?? img.width,
      ih = h ?? img.height;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  };
  const icon = (id: string, x: number, y: number, size = 32) => {
    let path = C.ICON_PATHS[id as OfferId];
    if (!path && id in C.ENEMIES)
      path = `${C.ENEMY_SHEET_DIR}/${id}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`;
    if (!path)
      path = C.GEM_PATHS[id as C.GemTier] ?? C.PICKUP_PATHS[id as C.PickupKind];
    sprite(path, x, y, size, size);
  };
  const heading = (title: string, subtitle: string) => {
    text(subtitle, 640, 71, 12, gold, "center");
    text(title, 640, 109, 32, ivory, "center", true);
  };
  const wrap = (
    str: string,
    x: number,
    y: number,
    width: number,
    size = 18,
  ) => {
    const words = str.split(" ");
    let l = "";
    for (const word of words) {
      if ((l + word).length > width) {
        text(l, x, y, size, dim);
        y += size * 1.65;
        l = "";
      }
      l += word + " ";
    }
    text(l, x, y, size, dim);
  };
  const r = s.run,
    p = r.player;
  const world = !["title", "howto", "almanac"].includes(s.screen);
  if (world) {
    const ground = images[C.GROUND_TILE_PATH];
    if (ground) {
      for (
        let y = -((p.y + C.STAGE_CY) % C.GROUND_TILE_SIZE) - C.GROUND_TILE_SIZE;
        y < C.STAGE_H;
        y += C.GROUND_TILE_SIZE
      )
        for (
          let x =
            -((p.x + C.STAGE_CX) % C.GROUND_TILE_SIZE) - C.GROUND_TILE_SIZE;
          x < C.STAGE_W;
          x += C.GROUND_TILE_SIZE
        )
          ctx.drawImage(ground, x, y);
    }
    const glow = ctx.createRadialGradient(
      C.STAGE_CX,
      C.STAGE_CY,
      20,
      C.STAGE_CX,
      C.STAGE_CY,
      450,
    );
    glow.addColorStop(0, "#c6a45e19");
    glow.addColorStop(1, "#030b15bb");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    ctx.save();
    ctx.translate(C.STAGE_CX - p.x, C.STAGE_CY - p.y);
    for (const g of r.gems) sprite(C.GEM_PATHS[g.tier], g.x, g.y);
    for (const v of r.pickups) sprite(C.PICKUP_PATHS[v.kind], v.x, v.y);
    for (const z of r.zones) {
      const e = C.EFFECT_SPRITES[z.weapon];
      let frame = 0;
      if (z.kind === "strike")
        frame = Math.min(
          e.frames - 1,
          Math.floor(
            ((C.SPARK_FLASH - (z.ttl ?? 0)) / C.SPARK_FLASH) * e.frames,
          ),
        );
      if (z.kind === "burst")
        frame = Math.min(
          e.frames - 1,
          Math.floor(
            ((C.FLARE_FLASH - (z.ttl ?? 0)) / C.FLARE_FLASH) * e.frames,
          ),
        );
      sprite(
        e.frames === 1 ? e.path : `${e.path}/${frame}.png`,
        z.x,
        z.y,
        z.width ?? z.radius * 2,
        z.height ?? z.radius * 2,
      );
    }
    for (const e of r.enemies) {
      sprite(
        `${C.ENEMY_SHEET_DIR}/${e.type}/${Math.floor(e.age / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
        e.x,
        e.y,
      );
      if (C.ENEMIES[e.type].rank !== "common") {
        box(
          e.x - 30,
          e.y - C.ENEMIES[e.type].radius - 10,
          60,
          4,
          "#252b30",
          "#252b30",
        );
        ctx.fillStyle = gold;
        ctx.fillRect(
          e.x - 30,
          e.y - C.ENEMIES[e.type].radius - 10,
          60 * Math.max(0, e.hp / e.maxHp),
          4,
        );
      }
    }
    for (const v of r.projectiles) {
      const e = C.EFFECT_SPRITES[v.weapon];
      sprite(
        e.frames === 1
          ? e.path
          : `${e.path}/${Math.floor((row(r, v.weapon).duration - v.ttl) / C.WALK_FRAME_TIME) % e.frames}.png`,
        v.x,
        v.y,
        v.radius * 2,
        v.radius * 2,
      );
    }
    for (const puff of s.visual.puffs)
      sprite(
        `${C.PUFF_SHEET.dir}/${Math.min(3, Math.floor((C.PUFF_TIME - puff.ttl) / (C.PUFF_TIME / 4)))}.png`,
        puff.x,
        puff.y,
      );
    if (r.hurtFlash === 0 || r.tick % 4 < 2)
      sprite(
        s.visual.moving
          ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${Math.floor((s.visual.moved * C.TICK_DT) / C.WALK_FRAME_TIME) % C.LAMPLIGHTER_WALK_SHEET.frames}.png`
          : C.LAMPLIGHTER_IDLE_PATH,
        p.x,
        p.y,
        24,
        32,
        p.facing === "left",
      );
    ctx.restore();
    // Minimal brass instrument panel, kept clear of the center of play.
    box(24, 20, 318, 72, "#0a141be8", "#394740");
    text("VITAL FLAME", 40, 42, 11, gold);
    text(
      `${Math.ceil(Math.max(0, p.hp))} / ${stats(r).maxHp}`,
      324,
      42,
      12,
      ivory,
      "right",
    );
    box(40, 53, 286, 14, "#30332e", "#30332e");
    ctx.fillStyle = "#c39458";
    ctx.fillRect(42, 55, 282 * Math.max(0, p.hp / stats(r).maxHp), 10);
    text(
      `${Math.floor(r.tick / C.TICK_HZ / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor((r.tick / C.TICK_HZ) % 60)
        .toString()
        .padStart(2, "0")}`,
      640,
      53,
      32,
      ivory,
      "center",
      true,
    );
    text("UNTIL DAWN  /  10:00", 640, 75, 10, dim, "center");
    text(`${r.kills}  EXTINGUISHED`, 1246, 44, 14, gold, "right");
    text("P  PAUSE    M  SOUND", 1246, 68, 10, dim, "right");
    box(24, 682, 1232, 14, "#111e26", "#34413f");
    ctx.fillStyle = "#73b7b2";
    ctx.fillRect(26, 684, 1228 * Math.min(1, r.xp / xpNext(r.level)), 10);
    text(`${C.LEVEL_LABEL} ${r.level}`, 30, 671, 12, ivory);
    text(
      `${Math.floor(r.xp)} / ${xpNext(r.level)}`,
      1250,
      671,
      11,
      dim,
      "right",
    );
    [r.weapons, r.passives].forEach((slots, k) => {
      text(k ? "TRINKETS" : "TOOLS", k ? 986 : 30, 594, 10, dim);
      for (let i = 0; i < 6; i++) {
        const x = (k ? 986 : 30) + i * 43,
          y = 606,
          w = slots[i];
        box(x, y, 37, 43, "#0b161ee8", "#46504a");
        if (w) {
          icon(w.id, x + 18, y + 17, 24);
          for (let j = 0; j < w.level; j++) {
            ctx.fillStyle = gold;
            ctx.fillRect(x + 3 + j * 4, y + 34, 2, 3);
          }
          if ("cooldown" in w && w.cooldown > 0) {
            ctx.fillStyle = "#050e1988";
            ctx.fillRect(
              x + 2,
              y + 2,
              33,
              30 * Math.min(1, w.cooldown / row(r, w.id).cooldown),
            );
          }
        }
      }
    });
  }
  if (s.screen === "playing") return;
  if (world) {
    ctx.fillStyle = "#030a12d9";
    ctx.fillRect(0, 0, 1280, 720);
  } else {
    ctx.fillStyle = "#0b151d";
    ctx.fillRect(0, 0, 1280, 720);
    const g = ctx.createRadialGradient(950, 340, 10, 900, 360, 600);
    g.addColorStop(0, "#67563955");
    g.addColorStop(1, "#0b151d00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
  }
  ctx.strokeStyle = "#3c443d";
  ctx.strokeRect(24.5, 24.5, 1231, 671);
  text("W  /  THE NIGHT WATCH", 48, 57, 11, gold);
  text(
    s.muted ? "SOUND OFF  /  M" : "SOUND ON  /  M",
    1232,
    57,
    11,
    dim,
    "right",
  );
  if (s.screen === "title") {
    text("A LAMPLIGHTER’S VIGIL", 148, 174, 12, gold);
    text(C.TITLE_TEXT, 139, 305, 132, ivory, "left", true);
    text(C.TAGLINE_TEXT, 149, 343, 18, gold);
    ctx.strokeStyle = gold;
    ctx.beginPath();
    ctx.moveTo(148, 365);
    ctx.lineTo(506, 365);
    ctx.stroke();
    // Architectural title ornament framing the actual lamplighter sprite.
    ctx.strokeStyle = "#695b41";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(920, 328, 189, Math.PI, 0);
    ctx.lineTo(1109, 570);
    ctx.moveTo(731, 328);
    ctx.lineTo(731, 570);
    ctx.stroke();
    ctx.strokeStyle = "#373e36";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(920, 328, 169 - i * 12, Math.PI, 0);
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const y = 525 + i * 11;
      ctx.strokeStyle = "#303a36";
      ctx.beginPath();
      ctx.moveTo(730 - i * 15, y);
      ctx.lineTo(1110 + i * 15, y);
      ctx.stroke();
    }
    const lg = ctx.createRadialGradient(963, 380, 2, 963, 380, 190);
    lg.addColorStop(0, "#e8b75b40");
    lg.addColorStop(1, "#e8b75b00");
    ctx.fillStyle = lg;
    ctx.fillRect(720, 150, 440, 450);
    sprite(C.LAMPLIGHTER_IDLE_PATH, 910, 412, 144, 192);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.3;
      sprite(
        `${C.ENEMY_SHEET_DIR}/moth/${i % 4}.png`,
        920 + Math.cos(a) * 150,
        300 + Math.sin(a) * 125,
        24,
        24,
      );
    }
    text(
      "ONE LAMP. TEN MINUTES. THE WHOLE NIGHT.",
      920,
      624,
      10,
      gold,
      "center",
    );
    text("WASD / ARROWS   MOVE     ENTER   SELECT", 148, 636, 11, dim);
  } else if (s.screen === "howto") {
    heading("HOW TO KEEP THE LIGHT", "FIELD NOTES / 01");
    const notes = [
      [
        "01",
        "WALK INTO THE NIGHT",
        "WASD / arrows move. Tools fire themselves. Enemies hurt on touch.",
      ],
      [
        "02",
        "FEED THE FLAME",
        "Gather gems. Each level lets you choose one of three gifts.",
      ],
      [
        "03",
        "TRANSFORM YOUR TOOLS",
        "Elites drop chests. A level 8 tool + its trinket can transform.",
      ],
      [
        "04",
        "LAST UNTIL DAWN",
        "Survive ten minutes. Keep moving when the Dark arrives.",
      ],
    ];
    notes.forEach((n, i) => {
      text(n[0], 155, 207 + i * 83, 23, gold);
      text(n[1], 220, 201 + i * 83, 18, ivory);
      text(n[2], 220, 230 + i * 83, 15, dim);
    });
    text(
      "SIX TOOLS + SIX TRINKETS  /  EXPLORE THEM ALL IN THE ALMANAC",
      640,
      548,
      12,
      gold,
      "center",
    );
    text(
      "ENTER / SPACE  CHOOSE   ESC / P  PAUSE   M  MUTE   MOUSE / TOUCH  MENUS",
      640,
      655,
      11,
      dim,
      "center",
    );
  } else if (s.screen === "almanac") {
    text(C.ALMANAC_TEXT, 96, 93, 28, ivory, "left", true);
    tabRects(s).forEach((b, i) => {
      box(
        b.x,
        b.y,
        b.width,
        b.height,
        i === s.almanacTab ? "#35362a" : "#102029",
        i === s.almanacTab ? gold : line,
      );
      text(
        C.ALMANAC_TABS[i],
        b.x + 125,
        b.y + 30,
        14,
        i === s.almanacTab ? gold : dim,
        "center",
      );
    });
    const id = entries(s.almanacTab)[s.menuIndex];
    box(505, 185, 679, 420, "#0e1b23", "#3b4742");
    icon(id, 845, 300, 112);
    text(names[id], 845, 407, 35, ivory, "center", true);
    wrap(descriptions[id], 555, 454, 51, 17);
    if (id in C.EVOLUTIONS) {
      const e = C.EVOLUTIONS[id as C.EvolutionId];
      text(
        `${names[e.from]} VIII + ${names[e.passive]}`,
        845,
        555,
        15,
        gold,
        "center",
      );
    }
    text("← →  TABS     ↑ ↓  ENTRIES     ESC  RETURN", 96, 653, 12, dim);
  } else if (s.screen === "levelup") {
    heading(C.LEVEL_UP_TEXT, "A SMALL MERCY IN THE DARK");
    text(
      `CHOOSE A GIFT  /  ${C.LEVEL_LABEL} ${r.level}`,
      640,
      192,
      12,
      gold,
      "center",
    );
    wrap(descriptions[r.offers[s.menuIndex]] ?? "", 320, 571, 64, 16);
  } else if (s.screen === "chest") {
    heading(C.CHEST_TEXT, "SOMETHING THE NIGHT LEFT BEHIND");
    const result = r.chestResult;
    const id =
      result?.kind === "evolve"
        ? result.weapon
        : result?.kind === "level"
          ? result.item
          : "lamp-oil";
    icon(id, 640, 296, 96);
    text(
      result?.kind === "evolve"
        ? "TRANSFORMED"
        : result?.kind === "level"
          ? `${C.LEVEL_LABEL} ${result.level}`
          : "HEALTH RESTORED",
      640,
      402,
      12,
      gold,
      "center",
    );
    text(names[id], 640, 451, 40, ivory, "center", true);
    wrap(descriptions[id], 320, 504, 63, 16);
  } else {
    heading(
      s.screen === "paused"
        ? C.PAUSED_TEXT
        : s.screen === "dawn"
          ? C.DAWN_TEXT
          : C.FALLEN_TEXT,
      s.screen === "paused"
        ? "THE NIGHT CAN WAIT"
        : s.screen === "dawn"
          ? "YOU KEPT THE LIGHT"
          : "EVERY FLAME LEAVES A TRACE",
    );
    text(
      `${Math.floor(r.tick / C.TICK_HZ / 60)}m ${Math.floor((r.tick / C.TICK_HZ) % 60)}s    /    LEVEL ${r.level}    /    ${r.kills} KILLS`,
      640,
      280,
      18,
      gold,
      "center",
    );
  }
  const labels =
    s.screen === "title"
      ? C.TITLE_ITEMS
      : s.screen === "paused"
        ? C.PAUSE_ITEMS
        : ["dawn", "fallen"].includes(s.screen)
          ? C.END_ITEMS
          : s.screen === "howto"
            ? ["RETURN TO TITLE"]
            : s.screen === "chest"
              ? ["CONTINUE"]
              : s.screen === "almanac"
                ? entries(s.almanacTab)
                    .slice(s.almanacScroll, s.almanacScroll + C.ALMANAC_ROWS)
                    .map((id) => names[id])
                : r.offers.map((id) => names[id]);
  menuRects(s).forEach((b, i) => {
    const selected =
      (s.screen === "almanac" ? i + s.almanacScroll : i) === s.menuIndex;
    box(
      b.x,
      b.y,
      b.width,
      b.height,
      selected ? "#37382b" : "#102029",
      selected ? gold : "#34423f",
    );
    if (selected) {
      ctx.fillStyle = gold;
      ctx.fillRect(b.x, b.y, 3, b.height);
    }
    const item =
      s.screen === "levelup"
        ? r.offers[i]
        : s.screen === "almanac"
          ? entries(s.almanacTab)[s.almanacScroll + i]
          : null;
    if (item) icon(item, b.x + 32, b.y + b.height / 2, 28);
    text(
      labels[i] ?? "",
      b.x + (item ? 60 : 23),
      b.y + b.height / 2 + 6,
      s.screen === "almanac" ? 15 : 18,
      selected ? ivory : dim,
    );
    if (s.screen === "levelup" && item) {
      const held = [...r.weapons, ...r.passives].find((w) => w.id === item);
      text(
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
        b.x + b.width - 22,
        b.y + b.height / 2 + 5,
        12,
        gold,
        "right",
      );
    } else if (selected && s.screen !== "almanac")
      text("↗", b.x + b.width - 22, b.y + b.height / 2 + 6, 20, gold, "right");
  });
}
