import { INTERSTITIAL_COOLDOWN_MS, INTERSTITIAL_DAILY_CAP } from '../config/GameConfig'
import { YandexSDK } from '../yandex/YandexSDK'
import { SaveManager } from './SaveManager'
import { AudioManager } from './AudioManager'

/**
 * Ad policy layer: interstitials respect a cooldown and a daily cap,
 * rewarded ads are always available on user action.
 * Sound is muted for the duration of every ad.
 */
class AdManagerImpl {
  private lastInterstitial = 0

  /**
   * Show an interstitial between game sessions if policy allows.
   * Always calls onDone (immediately when skipped).
   */
  maybeShowInterstitial(onDone: () => void): void {
    const now = Date.now()
    if (now - this.lastInterstitial < INTERSTITIAL_COOLDOWN_MS || !SaveManager.canShowInterstitial(INTERSTITIAL_DAILY_CAP)) {
      onDone()
      return
    }
    this.lastInterstitial = now
    SaveManager.recordInterstitial()
    AudioManager.muteForAd(true)
    YandexSDK.showInterstitial(() => {
      AudioManager.muteForAd(false)
      onDone()
    })
  }

  /** Rewarded ad on explicit user action. */
  showRewarded(onResult: (rewarded: boolean) => void): void {
    AudioManager.muteForAd(true)
    YandexSDK.showRewarded((rewarded) => {
      AudioManager.muteForAd(false)
      onResult(rewarded)
    })
  }
}

export const AdManager = new AdManagerImpl()
