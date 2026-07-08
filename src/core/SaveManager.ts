import {
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  SAVE_VERSION,
  OFFLINE_CAP_MS,
  OFFLINE_ENERGY_PER_MIN,
  OFFLINE_MIN_AWAY_MS,
} from '../config/GameConfig'
import { accountXpForLevel, ACCOUNT_LEVEL_MAX, MISSION_POOL, MISSIONS_PER_DAY } from '../config/Balance'
import { YandexSDK } from '../yandex/YandexSDK'
import { EventBus, Events } from './EventBus'

export interface MissionState {
  id: string
  progress: number
  claimed: boolean
}

export interface SaveData {
  version: number
  // Account progression
  accountLevel: number
  accountXp: number
  // Currencies
  energy: number
  crystals: number
  lastEnergyTs: number
  // Meta upgrades: category -> owned tiers
  meta: Record<string, number>
  // Records
  bestScore: number
  bestWave: number
  totalKills: number
  totalRuns: number
  totalPlayMs: number
  // Daily reward
  dailyStreak: number
  lastDailyClaimDay: number
  // Missions
  missionsDay: number
  missions: MissionState[]
  // Flags
  reviewDone: boolean
  reviewRewarded: boolean
  shortcutDone: boolean
  starterSkin: boolean
  premiumCore: boolean
  legendaryModule: boolean
  tutorialDone: boolean
  activeDays: number
  lastActiveDay: number
  lastSeenTs: number
  // Settings
  musicOn: boolean
  soundOn: boolean
  // Ads bookkeeping
  interstitialDay: number
  interstitialCount: number
}

function defaultSave(now: number): SaveData {
  return {
    version: SAVE_VERSION,
    accountLevel: 1,
    accountXp: 0,
    energy: ENERGY_MAX,
    crystals: 0,
    lastEnergyTs: now,
    meta: {},
    bestScore: 0,
    bestWave: 0,
    totalKills: 0,
    totalRuns: 0,
    totalPlayMs: 0,
    dailyStreak: 0,
    lastDailyClaimDay: 0,
    missionsDay: 0,
    missions: [],
    reviewDone: false,
    reviewRewarded: false,
    shortcutDone: false,
    starterSkin: false,
    premiumCore: false,
    legendaryModule: false,
    tutorialDone: false,
    activeDays: 0,
    lastActiveDay: 0,
    lastSeenTs: now,
    musicOn: true,
    soundOn: true,
    interstitialDay: 0,
    interstitialCount: 0,
  }
}

const LOCAL_KEY = 'neon-survivor-save'

/** Day index from a timestamp (UTC days since epoch). */
export function dayIndex(ts: number): number {
  return Math.floor(ts / 86_400_000)
}

class SaveManagerImpl {
  data: SaveData = defaultSave(Date.now())
  private dirty = false
  private saveTimer: ReturnType<typeof setInterval> | null = null

  now(): number {
    return YandexSDK.serverTime()
  }

  async load(): Promise<void> {
    const now = this.now()
    let cloud: Record<string, unknown> | null = null
    if (YandexSDK.available) cloud = await YandexSDK.loadData()

    let local: SaveData | null = null
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) local = JSON.parse(raw) as SaveData
    } catch {
      local = null
    }

    // Prefer whichever save has more progress (protects against stale cloud).
    const candidates = [cloud as SaveData | null, local].filter(Boolean) as SaveData[]
    let best: SaveData | null = null
    for (const c of candidates) {
      if (!best || this.progressScore(c) > this.progressScore(best)) best = c
    }

    this.data = best ? { ...defaultSave(now), ...best, version: SAVE_VERSION } : defaultSave(now)

    this.tickEnergyRegen()
    this.trackActiveDay()
    this.refreshMissionsIfNeeded()

    // Autosave loop
    this.saveTimer = setInterval(() => {
      this.tickEnergyRegen()
      if (this.dirty) void this.flush()
    }, 10_000)

    window.addEventListener('beforeunload', () => {
      this.data.lastSeenTs = this.now()
      this.flushLocal()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.data.lastSeenTs = this.now()
        this.flushLocal()
        void this.flush()
      }
    })
  }

  private progressScore(s: SaveData): number {
    return (
      (s.totalRuns ?? 0) * 1000 +
      (s.accountLevel ?? 1) * 100 +
      (s.crystals ?? 0) +
      (s.bestScore ?? 0) / 1000
    )
  }

  markDirty(): void {
    this.dirty = true
  }

  private flushLocal(): void {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this.data))
    } catch {
      /* storage may be unavailable */
    }
  }

  async flush(): Promise<void> {
    this.dirty = false
    this.flushLocal()
    if (YandexSDK.available) {
      await YandexSDK.saveData(this.data as unknown as Record<string, unknown>)
    }
  }

  /* ---------------- Energy (run fuel) ---------------- */

  tickEnergyRegen(): void {
    const now = this.now()
    if (this.data.energy >= ENERGY_MAX) {
      this.data.lastEnergyTs = now
      return
    }
    const elapsed = now - this.data.lastEnergyTs
    const gained = Math.floor(elapsed / ENERGY_REGEN_MS)
    if (gained > 0) {
      this.data.energy = Math.min(ENERGY_MAX, this.data.energy + gained)
      this.data.lastEnergyTs += gained * ENERGY_REGEN_MS
      if (this.data.energy >= ENERGY_MAX) this.data.lastEnergyTs = now
      this.markDirty()
      EventBus.emit(Events.EnergyChanged, this.data.energy)
    }
  }

  msUntilNextEnergy(): number {
    if (this.data.energy >= ENERGY_MAX) return 0
    return Math.max(0, ENERGY_REGEN_MS - (this.now() - this.data.lastEnergyTs))
  }

  spendEnergy(amount: number): boolean {
    this.tickEnergyRegen()
    if (this.data.energy < amount) return false
    if (this.data.energy >= ENERGY_MAX) this.data.lastEnergyTs = this.now()
    this.data.energy -= amount
    this.markDirty()
    EventBus.emit(Events.EnergyChanged, this.data.energy)
    return true
  }

  addEnergy(amount: number): void {
    this.data.energy = Math.min(999, this.data.energy + amount)
    this.markDirty()
    EventBus.emit(Events.EnergyChanged, this.data.energy)
  }

  /* ---------------- Crystals ---------------- */

  addCrystals(amount: number): void {
    this.data.crystals += amount
    this.markDirty()
    EventBus.emit(Events.CurrencyChanged)
  }

  spendCrystals(amount: number): boolean {
    if (this.data.crystals < amount) return false
    this.data.crystals -= amount
    this.markDirty()
    EventBus.emit(Events.CurrencyChanged)
    return true
  }

  /* ---------------- Account XP ---------------- */

  addAccountXp(xp: number): number {
    let levelsGained = 0
    this.data.accountXp += xp
    while (
      this.data.accountLevel < ACCOUNT_LEVEL_MAX &&
      this.data.accountXp >= accountXpForLevel(this.data.accountLevel)
    ) {
      this.data.accountXp -= accountXpForLevel(this.data.accountLevel)
      this.data.accountLevel++
      levelsGained++
    }
    if (levelsGained > 0) EventBus.emit(Events.AccountLevelUp, this.data.accountLevel)
    this.markDirty()
    return levelsGained
  }

  /* ---------------- Daily activity ---------------- */

  private trackActiveDay(): void {
    const today = dayIndex(this.now())
    if (this.data.lastActiveDay !== today) {
      this.data.lastActiveDay = today
      this.data.activeDays++
      this.markDirty()
    }
  }

  /** Offline energy reward. Returns energy gained (0 if not applicable). */
  claimOfflineReward(): number {
    const now = this.now()
    const away = Math.min(now - this.data.lastSeenTs, OFFLINE_CAP_MS)
    this.data.lastSeenTs = now
    if (away < OFFLINE_MIN_AWAY_MS) return 0
    const gained = Math.floor((away / 60_000) * OFFLINE_ENERGY_PER_MIN)
    return Math.max(0, gained)
  }

  /* ---------------- Daily rewards ---------------- */

  canClaimDaily(): boolean {
    return this.data.lastDailyClaimDay !== dayIndex(this.now())
  }

  claimDaily(): number {
    const today = dayIndex(this.now())
    if (this.data.lastDailyClaimDay === today) return -1
    // Streak continues when claimed yesterday, otherwise resets.
    if (this.data.lastDailyClaimDay === today - 1) {
      this.data.dailyStreak++
    } else {
      this.data.dailyStreak = 1
    }
    this.data.lastDailyClaimDay = today
    this.markDirty()
    return ((this.data.dailyStreak - 1) % 7) + 1 // 1..7 day slot
  }

  /* ---------------- Missions ---------------- */

  refreshMissionsIfNeeded(): void {
    const today = dayIndex(this.now())
    if (this.data.missionsDay === today && this.data.missions.length > 0) return
    // Deterministic daily selection seeded by day index.
    const pool = [...MISSION_POOL]
    const picked: MissionState[] = []
    let seed = today
    for (let i = 0; i < MISSIONS_PER_DAY && pool.length > 0; i++) {
      seed = (seed * 9301 + 49297) % 233280
      const idx = seed % pool.length
      picked.push({ id: pool[idx].id, progress: 0, claimed: false })
      pool.splice(idx, 1)
    }
    this.data.missionsDay = today
    this.data.missions = picked
    this.markDirty()
  }

  addMissionProgress(type: string, amount: number): void {
    this.refreshMissionsIfNeeded()
    let changed = false
    for (const m of this.data.missions) {
      const def = MISSION_POOL.find((d) => d.id === m.id)
      if (!def || def.type !== type || m.claimed) continue
      if (def.type === 'survive') {
        // survive is "best in one run", not cumulative
        if (amount > m.progress) {
          m.progress = Math.min(def.target, amount)
          changed = true
        }
      } else {
        m.progress = Math.min(def.target, m.progress + amount)
        changed = true
      }
    }
    if (changed) this.markDirty()
  }

  /* ---------------- Interstitial bookkeeping ---------------- */

  canShowInterstitial(dailyCap: number): boolean {
    const today = dayIndex(this.now())
    if (this.data.interstitialDay !== today) {
      this.data.interstitialDay = today
      this.data.interstitialCount = 0
      this.markDirty()
    }
    return this.data.interstitialCount < dailyCap
  }

  recordInterstitial(): void {
    const today = dayIndex(this.now())
    if (this.data.interstitialDay !== today) {
      this.data.interstitialDay = today
      this.data.interstitialCount = 0
    }
    this.data.interstitialCount++
    this.markDirty()
  }
}

export const SaveManager = new SaveManagerImpl()
