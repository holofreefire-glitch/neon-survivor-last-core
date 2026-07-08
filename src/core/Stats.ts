import { META_UPGRADES, MetaCategory } from '../config/Balance'
import { SaveManager } from './SaveManager'

export interface MetaBonuses {
  damage: number
  speed: number
  defense: number
  abilities: number
  energy: number
}

/** Aggregate account upgrade bonuses (multipliers above 1.0 base). */
export function getMetaBonuses(): MetaBonuses {
  const bonuses: MetaBonuses = { damage: 0, speed: 0, defense: 0, abilities: 0, energy: 0 }
  const owned = SaveManager.data.meta
  for (const up of META_UPGRADES) {
    const tiers = owned[up.category] ?? 0
    if (up.tier <= tiers) bonuses[up.category] += up.value
  }
  // Premium core: +10% to everything
  if (SaveManager.data.premiumCore || SaveManager.data.legendaryModule) {
    for (const k of Object.keys(bonuses) as MetaCategory[]) bonuses[k] += 0.1
  }
  // Account level: +0.5% damage and hp per level
  const lvl = SaveManager.data.accountLevel - 1
  bonuses.damage += lvl * 0.005
  bonuses.defense += lvl * 0.005
  return bonuses
}

export function metaTiersOwned(category: MetaCategory): number {
  return SaveManager.data.meta[category] ?? 0
}

export function nextMetaTier(category: MetaCategory) {
  const owned = metaTiersOwned(category)
  return META_UPGRADES.find((u) => u.category === category && u.tier === owned + 1) ?? null
}

export function buyMetaTier(category: MetaCategory): boolean {
  const next = nextMetaTier(category)
  if (!next) return false
  if (!SaveManager.spendEnergy(next.cost)) return false
  SaveManager.data.meta[category] = metaTiersOwned(category) + 1
  SaveManager.markDirty()
  return true
}
