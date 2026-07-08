/**
 * Yandex Games SDK wrapper.
 *
 * Wraps YaGames (loaded from https://sdk.games.s3.yandex.net/sdk.js in index.html).
 * Every call degrades gracefully when the SDK is unavailable (local dev),
 * so the game is fully playable outside of Yandex Games as well.
 */

declare global {
  interface Window {
    YaGames?: {
      init: () => Promise<YSDK>
    }
  }
}

interface YSDK {
  environment: {
    i18n: { lang: string }
    app: { id: string }
  }
  features: {
    LoadingAPI?: { ready: () => void }
    GameplayAPI?: { start: () => void; stop: () => void }
  }
  serverTime: () => number
  adv: {
    showFullscreenAdv: (opts: {
      callbacks: {
        onOpen?: () => void
        onClose?: (wasShown: boolean) => void
        onError?: (e: unknown) => void
        onOffline?: () => void
      }
    }) => void
    showRewardedVideo: (opts: {
      callbacks: {
        onOpen?: () => void
        onRewarded?: () => void
        onClose?: () => void
        onError?: (e: unknown) => void
      }
    }) => void
  }
  getPlayer: (opts?: { scopes?: boolean }) => Promise<YPlayer>
  getPayments: (opts?: { signed?: boolean }) => Promise<YPayments>
  getLeaderboards: () => Promise<YLeaderboards>
  feedback: {
    canReview: () => Promise<{ value: boolean; reason?: string }>
    requestReview: () => Promise<{ feedbackSent: boolean }>
  }
  shortcut: {
    canShowPrompt: () => Promise<{ canShow: boolean }>
    showPrompt: () => Promise<{ outcome: string }>
  }
  onEvent?: (name: string, cb: () => void) => () => void
  dispatchEvent?: (name: string) => void
}

interface YPlayer {
  getMode: () => string
  getName: () => string
  getData: (keys?: string[]) => Promise<Record<string, unknown>>
  setData: (data: Record<string, unknown>, flush?: boolean) => Promise<void>
}

export interface YProduct {
  id: string
  title: string
  description: string
  price: string
  priceValue: string
  priceCurrencyCode: string
  getPriceCurrencyImage?: (size: string) => string
}

interface YPurchase {
  productID: string
  purchaseToken: string
}

interface YPayments {
  getCatalog: () => Promise<YProduct[]>
  purchase: (opts: { id: string; developerPayload?: string }) => Promise<YPurchase>
  getPurchases: () => Promise<YPurchase[]>
  consumePurchase: (token: string) => Promise<void>
}

export interface LeaderboardEntry {
  rank: number
  score: number
  name: string
  isPlayer: boolean
}

interface YLeaderboards {
  setLeaderboardScore: (name: string, score: number) => Promise<void>
  getLeaderboardEntries: (
    name: string,
    opts?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number }
  ) => Promise<{
    userRank: number
    entries: Array<{
      rank: number
      score: number
      player: { publicName: string; uniqueID: string }
    }>
  }>
}

class YandexSDKWrapper {
  private ysdk: YSDK | null = null
  private player: YPlayer | null = null
  private payments: YPayments | null = null
  private leaderboards: YLeaderboards | null = null
  private gameplayRunning = false
  private pauseCallbacks: Array<(paused: boolean) => void> = []

  get available(): boolean {
    return this.ysdk !== null
  }

  get lang(): string {
    return this.ysdk?.environment.i18n.lang ?? navigator.language.slice(0, 2)
  }

  async init(): Promise<void> {
    if (!window.YaGames) {
      console.warn('Yandex SDK not available - running in standalone mode')
      return
    }
    try {
      // Outside the Yandex Games iframe init() may hang forever - cap it.
      this.ysdk = await Promise.race([
        window.YaGames.init(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('YaGames.init timeout')), 5000)),
      ])
      try {
        this.player = await this.ysdk.getPlayer({ scopes: false })
      } catch {
        this.player = null
      }
      // SDK pause/resume events (ad overlays, tab switches on platform side)
      this.ysdk.onEvent?.('game_api_pause', () => this.emitPause(true))
      this.ysdk.onEvent?.('game_api_resume', () => this.emitPause(false))
    } catch (e) {
      console.warn('Yandex SDK init failed', e)
      this.ysdk = null
    }
  }

  onPauseChange(cb: (paused: boolean) => void): void {
    this.pauseCallbacks.push(cb)
  }

  private emitPause(paused: boolean): void {
    for (const cb of this.pauseCallbacks) cb(paused)
  }

  /** Must be called exactly once, when the game is fully loaded and interactive. */
  loadingReady(): void {
    try {
      this.ysdk?.features.LoadingAPI?.ready()
    } catch {
      /* noop */
    }
  }

  gameplayStart(): void {
    if (this.gameplayRunning) return
    this.gameplayRunning = true
    try {
      this.ysdk?.features.GameplayAPI?.start()
    } catch {
      /* noop */
    }
  }

  gameplayStop(): void {
    if (!this.gameplayRunning) return
    this.gameplayRunning = false
    try {
      this.ysdk?.features.GameplayAPI?.stop()
    } catch {
      /* noop */
    }
  }

  /** Trusted server time; falls back to client time in standalone mode. */
  serverTime(): number {
    try {
      const t = this.ysdk?.serverTime()
      if (t && Number.isFinite(t)) return t
    } catch {
      /* noop */
    }
    return Date.now()
  }

  /* ---------------- Ads ---------------- */

  showInterstitial(onDone: () => void): void {
    if (!this.ysdk) {
      onDone()
      return
    }
    this.emitPause(true)
    this.ysdk.adv.showFullscreenAdv({
      callbacks: {
        onClose: () => {
          this.emitPause(false)
          onDone()
        },
        onError: () => {
          this.emitPause(false)
          onDone()
        },
        onOffline: () => {
          this.emitPause(false)
          onDone()
        },
      },
    })
  }

  showRewarded(onResult: (rewarded: boolean) => void): void {
    if (!this.ysdk) {
      // Standalone dev mode: grant the reward so the flow can be tested.
      onResult(true)
      return
    }
    let rewarded = false
    this.emitPause(true)
    this.ysdk.adv.showRewardedVideo({
      callbacks: {
        onRewarded: () => {
          rewarded = true
        },
        onClose: () => {
          this.emitPause(false)
          onResult(rewarded)
        },
        onError: () => {
          this.emitPause(false)
          onResult(false)
        },
      },
    })
  }

  /* ---------------- Cloud saves ---------------- */

  async loadData(): Promise<Record<string, unknown> | null> {
    if (!this.player) return null
    try {
      const data = await this.player.getData(['save'])
      return (data?.save as Record<string, unknown>) ?? null
    } catch {
      return null
    }
  }

  async saveData(save: Record<string, unknown>): Promise<boolean> {
    if (!this.player) return false
    try {
      await this.player.setData({ save }, true)
      return true
    } catch {
      return false
    }
  }

  /* ---------------- Payments ---------------- */

  private async getPaymentsLazy(): Promise<YPayments | null> {
    if (this.payments) return this.payments
    if (!this.ysdk) return null
    try {
      this.payments = await this.ysdk.getPayments({ signed: true })
      return this.payments
    } catch {
      return null
    }
  }

  async getCatalog(): Promise<YProduct[]> {
    const p = await this.getPaymentsLazy()
    if (!p) return []
    try {
      return await p.getCatalog()
    } catch {
      return []
    }
  }

  /**
   * Purchase a product and consume it. Returns true when the purchase
   * succeeded and was consumed (rewards may be granted).
   */
  async purchase(productId: string): Promise<boolean> {
    const p = await this.getPaymentsLazy()
    if (!p) return false
    try {
      const purchase = await p.purchase({ id: productId })
      await p.consumePurchase(purchase.purchaseToken)
      return true
    } catch {
      return false
    }
  }

  /** Consume purchases that were paid but not processed (e.g. page closed). */
  async consumePending(onProduct: (productId: string) => void): Promise<void> {
    const p = await this.getPaymentsLazy()
    if (!p) return
    try {
      const purchases = await p.getPurchases()
      for (const pur of purchases) {
        onProduct(pur.productID)
        await p.consumePurchase(pur.purchaseToken)
      }
    } catch {
      /* noop */
    }
  }

  /* ---------------- Leaderboard ---------------- */

  private async getLeaderboardsLazy(): Promise<YLeaderboards | null> {
    if (this.leaderboards) return this.leaderboards
    if (!this.ysdk) return null
    try {
      this.leaderboards = await this.ysdk.getLeaderboards()
      return this.leaderboards
    } catch {
      return null
    }
  }

  async submitScore(board: string, score: number): Promise<void> {
    const lb = await this.getLeaderboardsLazy()
    if (!lb) return
    try {
      await lb.setLeaderboardScore(board, Math.round(score))
    } catch {
      /* noop */
    }
  }

  async getLeaderboard(board: string): Promise<LeaderboardEntry[]> {
    const lb = await this.getLeaderboardsLazy()
    if (!lb) return []
    try {
      const res = await lb.getLeaderboardEntries(board, {
        includeUser: true,
        quantityTop: 10,
        quantityAround: 3,
      })
      return res.entries.map((e) => ({
        rank: e.rank,
        score: e.score,
        name: e.player.publicName || 'Player',
        isPlayer: e.rank === res.userRank,
      }))
    } catch {
      return []
    }
  }

  /* ---------------- Review ---------------- */

  async canReview(): Promise<boolean> {
    if (!this.ysdk) return false
    try {
      const r = await this.ysdk.feedback.canReview()
      return r.value
    } catch {
      return false
    }
  }

  async requestReview(): Promise<boolean> {
    if (!this.ysdk) return false
    try {
      const r = await this.ysdk.feedback.requestReview()
      return r.feedbackSent
    } catch {
      return false
    }
  }

  /* ---------------- Shortcut ---------------- */

  async canShowShortcut(): Promise<boolean> {
    if (!this.ysdk) return false
    try {
      const r = await this.ysdk.shortcut.canShowPrompt()
      return r.canShow
    } catch {
      return false
    }
  }

  async showShortcutPrompt(): Promise<boolean> {
    if (!this.ysdk) return false
    try {
      const r = await this.ysdk.shortcut.showPrompt()
      return r.outcome === 'accepted'
    } catch {
      return false
    }
  }
}

export const YandexSDK = new YandexSDKWrapper()
