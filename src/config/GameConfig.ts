/** Global game constants. */
export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720

export const COLORS = {
  bg: 0x05060f,
  cyan: 0x00e5ff,
  magenta: 0xff2ee6,
  violet: 0x8b5cf6,
  white: 0xf4faff,
  danger: 0xff4d6d,
  gold: 0xffd166,
  panel: 0x0c1022,
  panelLight: 0x161d3a,
} as const

export const CSS = {
  cyan: '#00e5ff',
  magenta: '#ff2ee6',
  violet: '#8b5cf6',
  white: '#f4faff',
  dim: '#7f8bb3',
  danger: '#ff4d6d',
  gold: '#ffd166',
} as const

export const FONT = 'Arial, Helvetica, sans-serif'

/** Energy (run fuel) */
export const ENERGY_MAX = 30
export const ENERGY_PER_RUN = 5
export const ENERGY_REGEN_MS = 5 * 60 * 1000 // 1 energy per 5 minutes
export const ENERGY_AD_REWARD = 5

/** Run rules */
export const RUN_MAX_MS = 15 * 60 * 1000
export const WAVE_INTERVAL_MS = 30 * 1000
export const BOSS_EVERY_N_WAVES = 5
export const MAX_ALIVE_ENEMIES = 120

/** Ads policy */
export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000
export const INTERSTITIAL_DAILY_CAP = 5

/** Offline reward */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
export const OFFLINE_ENERGY_PER_MIN = 2
export const OFFLINE_MIN_AWAY_MS = 10 * 60 * 1000

/** Review prompt gating */
export const REVIEW_MIN_RUNS = 5
export const REVIEW_MIN_PLAY_MS = 10 * 60 * 1000
export const REVIEW_REWARD_CRYSTALS = 100

/** Shortcut prompt gating */
export const SHORTCUT_MIN_ACTIVE_DAYS = 3

export const LEADERBOARD_NAME = 'survival_score'

export const SAVE_VERSION = 1
