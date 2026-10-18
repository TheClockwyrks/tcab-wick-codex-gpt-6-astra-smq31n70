import type { DeepReadonly } from "ts-essentials";

import type {
  EnemyId,
  GemTier,
  OfferId,
  PassiveId,
  PickupKind,
  WeaponId,
} from "./constants";

export type { EnemyId, GemTier, OfferId, PassiveId, PickupKind, WeaponId };

export type Screen =
  | "title"
  | "howto"
  | "almanac"
  | "playing"
  | "levelup"
  | "chest"
  | "paused"
  | "fallen"
  | "dawn";

export type Facing = "left" | "right";

export type ZoneKind =
  "puddle" | "lantern" | "aura" | "slash" | "strike" | "burst";

export type ChestResult =
  | { readonly kind: "evolve"; readonly weapon: WeaponId }
  | {
      readonly kind: "level";
      readonly item: WeaponId | PassiveId;
      readonly level: number;
    }
  | { readonly kind: "heal" };

export interface PlayerState {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly hp: number;
}

export interface WeaponSlot {
  readonly id: WeaponId;
  readonly level: number;
  readonly cooldown: number;
}

export interface PassiveSlot {
  readonly id: PassiveId;
  readonly level: number;
}

export interface EnemyState {
  readonly id: number;
  readonly type: EnemyId;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly heading: { readonly x: number; readonly y: number };
  readonly age: number;
  readonly contactCooldown: number;
}

export interface EnemyHit {
  readonly enemy: number;
  readonly cooldown: number;
}

export interface ProjectileState {
  readonly id: number;
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly ax: number;
  readonly ay: number;
  readonly radius: number;
  readonly damage: number;
  readonly ttl: number;
  readonly pierce: number;
  readonly hits: readonly EnemyHit[];
}

export interface ZoneState {
  readonly firstPulse?: number;
  readonly id: number;
  readonly weapon: WeaponId;
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly width?: number;
  readonly height?: number;
  readonly damage: number;
  readonly ttl: number | null;
  readonly hits: readonly EnemyHit[];
}

export interface GemState {
  readonly id: number;
  readonly tier: GemTier;
  readonly x: number;
  readonly y: number;
  readonly attracted: boolean;
}

export interface PickupState {
  readonly id: number;
  readonly kind: PickupKind;
  readonly x: number;
  readonly y: number;
}

export interface RunState {
  readonly tick: number;
  readonly level: number;
  readonly xp: number;
  readonly kills: number;
  readonly player: PlayerState;
  readonly hurtFlash: number;
  readonly weapons: readonly WeaponSlot[];
  readonly passives: readonly PassiveSlot[];
  readonly enemies: readonly EnemyState[];
  readonly projectiles: readonly ProjectileState[];
  readonly zones: readonly ZoneState[];
  readonly gems: readonly GemState[];
  readonly pickups: readonly PickupState[];
  readonly offers: readonly OfferId[];
  readonly nextOffers: readonly OfferId[] | null;
  readonly pendingLevelUps: number;
  readonly chestResult: ChestResult | null;
  readonly spawnTimer: number;
  readonly firedEvents: readonly number[];
  readonly nextId: number;
  readonly nextSpawnAngle: number | null;
  readonly nextSwarmAngle: number | null;
  readonly nextSpawnType: EnemyId | null;
  readonly nextPuddleOffset: { readonly x: number; readonly y: number } | null;
  readonly nextStrikeTarget: number | null;
  readonly nextChestItem: WeaponId | PassiveId | null;
  readonly nextDrop: "bread" | "draft" | "none" | null;
}

export interface WickState {
  readonly visual: {
    readonly orbits: Readonly<
      Record<number, { readonly angle: number; readonly orbit: number }>
    >;
    readonly moved: number;
    readonly moving: boolean;
    readonly puffs: readonly {
      readonly x: number;
      readonly y: number;
      readonly ttl: number;
    }[];
  };
  readonly pointerArm: string | null;
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly almanacTab: number;
  readonly almanacScroll: number;
  readonly run: RunState;
  readonly accumulator: number;
  readonly simTime: number;
  readonly muted: boolean;
  readonly spawning: boolean;
  readonly events: boolean;
  readonly despawning: boolean;
  readonly enemyMotion: boolean;
  readonly enemyContact: boolean;
  readonly weaponFire: boolean;
  readonly effectMotion: boolean;
  readonly drops: boolean;
  readonly progression: boolean;
}

export interface WickRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type NextDrop = "bread" | "draft" | "none";

export interface WickDebugApi {
  readonly version: number;
  reset(state: DeepReadonly<WickState>): WickState;
  snapshot(state: DeepReadonly<WickState>): WickSnapshot;
  reconcile(state: DeepReadonly<WickState>): WickState;
  menuRects(state: DeepReadonly<WickState>): readonly WickRect[];
  tabRects(state: DeepReadonly<WickState>): readonly WickRect[];
  setScreen(state: DeepReadonly<WickState>, name: Screen): WickState;
  choose(state: DeepReadonly<WickState>, index: number): WickState;
  setSpawning(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEvents(state: DeepReadonly<WickState>, on: boolean): WickState;
  setDespawning(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEnemyMotion(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEnemyContact(state: DeepReadonly<WickState>, on: boolean): WickState;
  setWeaponFire(state: DeepReadonly<WickState>, on: boolean): WickState;
  setEffectMotion(state: DeepReadonly<WickState>, on: boolean): WickState;
  setDrops(state: DeepReadonly<WickState>, on: boolean): WickState;
  setProgression(state: DeepReadonly<WickState>, on: boolean): WickState;
  setTick(state: DeepReadonly<WickState>, tick: number): WickState;
  setSpawnTimer(state: DeepReadonly<WickState>, seconds: number): WickState;
  setNextSpawnAngle(state: DeepReadonly<WickState>, degrees: number): WickState;
  setNextSwarmAngle(state: DeepReadonly<WickState>, degrees: number): WickState;
  setNextSpawnType(state: DeepReadonly<WickState>, id: EnemyId): WickState;
  setNextPuddleOffset(
    state: DeepReadonly<WickState>,
    dx: number,
    dy: number,
  ): WickState;
  setNextStrikeTarget(state: DeepReadonly<WickState>, id: number): WickState;
  setNextChestItem(
    state: DeepReadonly<WickState>,
    id: WeaponId | PassiveId,
  ): WickState;
  setNextDrop(state: DeepReadonly<WickState>, kind: NextDrop): WickState;
  rollDrop(state: DeepReadonly<WickState>): NextDrop;
  setPlayerPosition(
    state: DeepReadonly<WickState>,
    x: number,
    y: number,
  ): WickState;
  setFacing(state: DeepReadonly<WickState>, facing: Facing): WickState;
  setHp(state: DeepReadonly<WickState>, hp: number): WickState;
  setLevel(state: DeepReadonly<WickState>, level: number): WickState;
  setXp(state: DeepReadonly<WickState>, xp: number): WickState;
  setKills(state: DeepReadonly<WickState>, kills: number): WickState;
  setPendingLevelUps(state: DeepReadonly<WickState>, count: number): WickState;
  setNextOffers(
    state: DeepReadonly<WickState>,
    ids: readonly OfferId[],
  ): WickState;
  setWeapon(
    state: DeepReadonly<WickState>,
    slot: number,
    id: WeaponId,
    level: number,
  ): WickState;
  setWeaponCooldown(
    state: DeepReadonly<WickState>,
    slot: number,
    seconds: number,
  ): WickState;
  removeWeapon(state: DeepReadonly<WickState>, slot: number): WickState;
  setPassive(
    state: DeepReadonly<WickState>,
    slot: number,
    id: PassiveId,
    level: number,
  ): WickState;
  removePassive(state: DeepReadonly<WickState>, slot: number): WickState;
  spawnEnemy(
    state: DeepReadonly<WickState>,
    type: EnemyId,
    x: number,
    y: number,
  ): WickState;
  setEnemyPosition(
    state: DeepReadonly<WickState>,
    id: number,
    x: number,
    y: number,
  ): WickState;
  setEnemyHp(state: DeepReadonly<WickState>, id: number, hp: number): WickState;
  setEnemyHeading(
    state: DeepReadonly<WickState>,
    id: number,
    hx: number,
    hy: number,
  ): WickState;
  setEnemyAge(
    state: DeepReadonly<WickState>,
    id: number,
    seconds: number,
  ): WickState;
  setEnemyContactCooldown(
    state: DeepReadonly<WickState>,
    id: number,
    seconds: number,
  ): WickState;
  removeEnemy(state: DeepReadonly<WickState>, id: number): WickState;
  clearEnemies(state: DeepReadonly<WickState>): WickState;
  spawnProjectile(
    state: DeepReadonly<WickState>,
    weapon: "ember" | "pin" | "shard" | "sconce" | "beacon" | "hail",
    x: number,
    y: number,
    vx: number,
    vy: number,
    pierce: number,
  ): WickState;
  clearProjectiles(state: DeepReadonly<WickState>): WickState;
  spawnPuddle(
    state: DeepReadonly<WickState>,
    weapon: "oil-splash" | "blaze",
    x: number,
    y: number,
  ): WickState;
  clearZones(state: DeepReadonly<WickState>): WickState;
  spawnGem(
    state: DeepReadonly<WickState>,
    tier: GemTier,
    x: number,
    y: number,
  ): WickState;
  setGemAttracted(
    state: DeepReadonly<WickState>,
    id: number,
    attracted: boolean,
  ): WickState;
  clearGems(state: DeepReadonly<WickState>): WickState;
  spawnPickup(
    state: DeepReadonly<WickState>,
    kind: PickupKind,
    x: number,
    y: number,
  ): WickState;
  clearPickups(state: DeepReadonly<WickState>): WickState;
}

export type WickSnapshot = Omit<WickState, "visual" | "pointerArm"> & {
  readonly version: number;
  readonly run: RunState & {
    readonly time: number;
    readonly xpToNext: number;
    readonly maxHp: number;
    readonly armor: number;
    readonly moveSpeed: number;
    readonly pickupRadius: number;
    readonly spawnWindow: number;
    readonly aliveCommons: number;
    readonly pool: readonly OfferId[];
  };
};
