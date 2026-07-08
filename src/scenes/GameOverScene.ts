import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, ENERGY_PER_RUN } from '../config/GameConfig'
import { t } from '../i18n/i18n'
import { makeButton, makePanel, makeTitle, makeText } from '../ui/UiFactory'
import { AdManager } from '../core/AdManager'
import { SaveManager } from '../core/SaveManager'
import { AudioManager } from '../core/AudioManager'

interface GameOverData {
  score: number
  kills: number
  wave: number
  survivedSec: number
  energyGain: number
  isRecord: boolean
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create(data: GameOverData): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bg_menu').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.45)
    this.cameras.main.setBackgroundColor(COLORS.bg)

    const panel = makePanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 560, data.isRecord ? COLORS.gold : COLORS.magenta)
    void panel

    makeTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 220, t('over.title'), 40, CSS.danger)
    if (data.isRecord) {
      const rec = makeTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 168, t('over.record'), 26, CSS.gold)
      this.tweens.add({ targets: rec, scale: { from: 1, to: 1.12 }, duration: 500, yoyo: true, repeat: -1 })
    }

    const mins = Math.floor(data.survivedSec / 60)
    const secs = data.survivedSec % 60
    const rows: Array<[string, string]> = [
      [t('over.score'), String(data.score)],
      [t('over.wave'), String(data.wave)],
      [t('over.kills'), String(data.kills)],
      [t('over.survived'), `${mins}:${String(secs).padStart(2, '0')}`],
      [t('over.earned'), `+${data.energyGain} ⚡`],
    ]
    rows.forEach(([label, value], i) => {
      const y = GAME_HEIGHT / 2 - 110 + i * 44
      makeText(this, GAME_WIDTH / 2 - 130, y, label, 20, CSS.dim).setOrigin(0, 0.5)
      makeText(this, GAME_WIDTH / 2 + 130, y, value, 22, CSS.white).setOrigin(1, 0.5)
    })

    const canRetry = SaveManager.data.energy >= ENERGY_PER_RUN
    makeButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 150,
      t('over.retry'),
      () => {
        AdManager.maybeShowInterstitial(() => {
          if (SaveManager.spendEnergy(ENERGY_PER_RUN)) {
            this.scene.start('Game')
          } else {
            this.scene.start('Menu', {})
          }
        })
      },
      { width: 420, color: COLORS.cyan, disabled: !canRetry }
    )
    makeButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 228,
      t('over.menu'),
      () => {
        AdManager.maybeShowInterstitial(() => this.scene.start('Menu', {}))
      },
      { width: 420, color: COLORS.panelLight, textColor: CSS.dim }
    )

    AudioManager.reward()
  }
}
