/**
 * All game balance data: enemies, bosses, waves, in-run upgrades
 * and account (meta) upgrades.
 */

export interface EnemyDef {
  key: string
  texture: string
  hp: number
  speed: number
  damage: number
  xp: number
  energy: number
  scale: number
  minWave: number
}

export const ENEMIES: EnemyDef[] = [
  { key: 'glitch_bug', texture: 'enemy_glitch_bug', hp: 10, speed: 70, damage: 6, xp: 2, energy: 1, scale: 0.5, minWave: 1 },
  { key: 'virus_blob', texture: 'enemy_virus_blob', hp: 16, speed: 55, damage: 8, xp: 3, energy: 1, scale: 0.55, minWave: 1 },
  { key: 'pixel_moth', texture: 'enemy_pixel_moth', hp: 8, speed: 95, damage: 5, xp: 2, energy: 1, scale: 0.5, minWave: 2 },
  { key: 'spike_mite', texture: 'enemy_spike_mite', hp: 14, speed: 80, damage: 9, xp: 3, energy: 1, scale: 0.5, minWave: 3 },
  { key: 'energy_drone', texture: 'enemy_energy_drone', hp: 22, speed: 88, damage: 10, xp: 4, energy: 2, scale: 0.55, minWave: 4 },
  { key: 'data_wasp', texture: 'enemy_data_wasp', hp: 18, speed: 115, damage: 8, xp: 4, energy: 2, scale: 0.5, minWave: 5 },
  { key: 'byte_crab', texture: 'enemy_byte_crab', hp: 40, speed: 45, damage: 14, xp: 6, energy: 3, scale: 0.65, minWave: 6 },
  { key: 'spark_eel', texture: 'enemy_spark_eel', hp: 26, speed: 105, damage: 11, xp: 5, energy: 2, scale: 0.55, minWave: 7 },
  { key: 'phantom_ray', texture: 'enemy_phantom_ray', hp: 34, speed: 120, damage: 12, xp: 6, energy: 3, scale: 0.6, minWave: 8 },
  { key: 'dark_cube', texture: 'enemy_dark_cube', hp: 60, speed: 40, damage: 18, xp: 8, energy: 4, scale: 0.7, minWave: 9 },
  { key: 'null_shard', texture: 'enemy_null_shard', hp: 50, speed: 90, damage: 16, xp: 8, energy: 4, scale: 0.6, minWave: 10 },
]

export interface BossDef {
  key: string
  texture: string
  hp: number
  speed: number
  damage: number
  xp: number
  energy: number
  crystals: number
  scale: number
}

export const BOSSES: BossDef[] = [
  { key: 'firewall_golem', texture: 'boss_firewall_golem', hp: 900, speed: 42, damage: 25, xp: 80, energy: 40, crystals: 5, scale: 0.5 },
  { key: 'trojan_knight', texture: 'boss_trojan_knight', hp: 1600, speed: 50, damage: 30, xp: 120, energy: 60, crystals: 8, scale: 0.5 },
  { key: 'hive_mind', texture: 'boss_hive_mind', hp: 2600, speed: 38, damage: 35, xp: 180, energy: 90, crystals: 12, scale: 0.55 },
  { key: 'void_serpent', texture: 'boss_void_serpent', hp: 4200, speed: 56, damage: 42, xp: 260, energy: 130, crystals: 16, scale: 0.55 },
  { key: 'omega_core', texture: 'boss_omega_core', hp: 7000, speed: 48, damage: 50, xp: 400, energy: 200, crystals: 25, scale: 0.6 },
]

/** Wave 1 ~ 10 enemies, Wave 10 ~ 200 enemies (spawned over the wave). */
export function enemiesForWave(wave: number): number {
  if (wave <= 1) return 10
  if (wave >= 10) return Math.min(200 + (wave - 10) * 20, 320)
  // smooth ramp 10 -> 200
  return Math.round(10 + (wave - 1) * (190 / 9))
}

export function enemyHpScale(wave: number): number {
  return 1 + (wave - 1) * 0.22
}

export function enemyDamageScale(wave: number): number {
  return 1 + (wave - 1) * 0.08
}

/** XP needed for in-run level N -> N+1 */
export function runXpForLevel(level: number): number {
  return Math.round(10 + level * 8 + level * level * 1.6)
}

/** Account XP needed for account level N -> N+1 (levels 1..100) */
export function accountXpForLevel(level: number): number {
  return Math.round(100 + level * 55 + level * level * 4)
}

export const ACCOUNT_LEVEL_MAX = 100

/* ------------------------------------------------------------------ */
/* In-run upgrades (chosen on level-up during a run)                    */
/* ------------------------------------------------------------------ */

export interface RunUpgradeDef {
  id: string
  icon: string // texture key used in the card
  maxStacks: number
}

export const RUN_UPGRADES: RunUpgradeDef[] = [
  { id: 'laser_power', icon: 'icon_energy', maxStacks: 8 },
  { id: 'fire_rate', icon: 'icon_energy', maxStacks: 8 },
  { id: 'multishot', icon: 'icon_energy', maxStacks: 4 },
  { id: 'pierce', icon: 'icon_energy', maxStacks: 4 },
  { id: 'move_speed', icon: 'icon_energy', maxStacks: 5 },
  { id: 'magnet', icon: 'pickup_energy_orb', maxStacks: 5 },
  { id: 'shield', icon: 'icon_heart', maxStacks: 3 },
  { id: 'regen', icon: 'icon_heart', maxStacks: 5 },
  { id: 'max_hp', icon: 'icon_heart', maxStacks: 6 },
  { id: 'crit', icon: 'icon_crystal', maxStacks: 5 },
  { id: 'orbital', icon: 'player_core', maxStacks: 3 },
  { id: 'xp_gain', icon: 'pickup_energy_orb', maxStacks: 5 },
]

/* ------------------------------------------------------------------ */
/* Meta (account) upgrades - 5 categories x 10 tiers = 50 upgrades      */
/* ------------------------------------------------------------------ */

export type MetaCategory = 'damage' | 'speed' | 'defense' | 'abilities' | 'energy'

export interface MetaUpgradeDef {
  id: string
  category: MetaCategory
  tier: number
  cost: number // soft currency (energy)
  /** bonus value applied per tier owned; interpreted by category */
  value: number
}

export const META_CATEGORIES: MetaCategory[] = ['damage', 'speed', 'defense', 'abilities', 'energy']

function buildMeta(): MetaUpgradeDef[] {
  const list: MetaUpgradeDef[] = []
  const valuePer: Record<MetaCategory, number> = {
    damage: 0.05, // +5% damage per tier
    speed: 0.03, // +3% move & fire speed per tier
    defense: 0.04, // +4% max hp per tier
    abilities: 0.04, // +4% ability power (crit, orbital dmg) per tier
    energy: 0.06, // +6% energy & xp pickup per tier
  }
  for (const cat of META_CATEGORIES) {
    for (let tier = 1; tier <= 10; tier++) {
      list.push({
        id: `${cat}_${tier}`,
        category: cat,
        tier,
        cost: Math.round(60 * tier * (1 + tier * 0.55)),
        value: valuePer[cat],
      })
    }
  }
  return list
}

export const META_UPGRADES: MetaUpgradeDef[] = buildMeta()

/* ------------------------------------------------------------------ */
/* Daily rewards - 7 day cycle                                          */
/* ------------------------------------------------------------------ */

export interface DailyRewardDef {
  day: number
  energy: number
  crystals: number
  legendary?: boolean
}

export const DAILY_REWARDS: DailyRewardDef[] = [
  { day: 1, energy: 100, crystals: 0 },
  { day: 2, energy: 150, crystals: 0 },
  { day: 3, energy: 200, crystals: 5 },
  { day: 4, energy: 300, crystals: 5 },
  { day: 5, energy: 400, crystals: 10 },
  { day: 6, energy: 600, crystals: 15 },
  { day: 7, energy: 1000, crystals: 30, legendary: true },
]

/* ------------------------------------------------------------------ */
/* Daily missions                                                       */
/* ------------------------------------------------------------------ */

export interface MissionDef {
  id: string
  type: 'kills' | 'runs' | 'collect' | 'survive' | 'levelups'
  target: number
  rewardEnergy: number
  rewardCrystals: number
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'kills_200', type: 'kills', target: 200, rewardEnergy: 100, rewardCrystals: 0 },
  { id: 'kills_500', type: 'kills', target: 500, rewardEnergy: 250, rewardCrystals: 5 },
  { id: 'runs_3', type: 'runs', target: 3, rewardEnergy: 120, rewardCrystals: 0 },
  { id: 'runs_5', type: 'runs', target: 5, rewardEnergy: 220, rewardCrystals: 5 },
  { id: 'collect_100', type: 'collect', target: 100, rewardEnergy: 100, rewardCrystals: 0 },
  { id: 'collect_300', type: 'collect', target: 300, rewardEnergy: 200, rewardCrystals: 5 },
  { id: 'survive_180', type: 'survive', target: 180, rewardEnergy: 150, rewardCrystals: 0 },
  { id: 'survive_300', type: 'survive', target: 300, rewardEnergy: 300, rewardCrystals: 8 },
  { id: 'levelups_10', type: 'levelups', target: 10, rewardEnergy: 120, rewardCrystals: 0 },
  { id: 'levelups_20', type: 'levelups', target: 20, rewardEnergy: 240, rewardCrystals: 5 },
]

export const MISSIONS_PER_DAY = 5

/* ------------------------------------------------------------------ */
/* Shop products (Yandex in-app purchases)                              */
/* ------------------------------------------------------------------ */

export interface ProductDef {
  id: string
  price: number // YAN
  crystals: number
  energy: number
  skin?: string
  legendaryModule?: boolean
}

export const PRODUCTS: ProductDef[] = [
  { id: 'starter_pack', price: 99, crystals: 500, energy: 0, skin: 'starter_skin' },
  { id: 'energy_pack', price: 49, crystals: 0, energy: 100 },
  { id: 'premium_core', price: 199, crystals: 0, energy: 0, legendaryModule: true },
]

/** Crystal exchange: buy run energy with crystals when out of fuel */
export const CRYSTAL_ENERGY_REFILL_COST = 10
