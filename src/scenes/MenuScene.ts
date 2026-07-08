import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, FONT, LEADERBOARD_NAME } from '../config/GameConfig'
import { SaveManager } from '../core/SaveManager'
import { YandexSDK } from '../yandex/YandexSDK'
import { AudioManager } from '../core/AudioManager'
import { t } from '../i18n/i18n'
import { makeButton, makeCurrencyChip, makeText } from '../ui/UiFactory'
import { openUpgradesPanel } from '../ui/panels/UpgradesPanel'
import { openDailyPanel } from '../ui/panels/DailyPanel'
import { openMissionsPanel } from '../ui/panels/MissionsPanel'
import { openShopPanel } from '../ui/panels/ShopPanel'
import { openLeaderboardPanel } from '../ui/panels/LeaderboardPanel'

export class MenuScene extends Phaser.Scene {
  private energyChip!: { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text }
  private crystalChip!: { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text }
  private energyTimerText!: Phaser.GameObjects.Text
  private bestText!: Phaser.GameObjects.Text
  private modalOpen = false

  constructor() {
    super('Menu')
  }

  create(data: { firstLaunch?: boolean } = {}): void {
    const w = GAME_WIDTH
    const h = GAME_HEIGHT

    // Remove the HTML pre-loader and tell the platform we're interactive.
    const bootLoader = document.getElementById('boot-loader')
    if (bootLoader) {
      bootLoader.classList.add('hidden')
      setTimeout(() => bootLoader.remove(), 500)
    }
    if (data.firstLaunch) YandexSDK.loadingReady()

    // Background
    const bg = this.add.image(w / 2, h / 2, 'bg_menu')
    const scale = Math.max(w / bg.width, h / bg.height)
    bg.setScale(scale).setAlpha(0.85)
    this.add.rectangle(w / 2, h / 2, w, h, 0x05070f, 0.45)

    // Logo + title
    const logo = this.add.image(w / 2, h / 2 - 235, 'logo').setDisplaySize(190, 190)
    this.tweens.add({ targets: logo, y: '+=10', duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    this.add
      .text(w / 2, h / 2 - 105, t('game.title'), {
        fontFamily: FONT,
        fontSize: '58px',
        fontStyle: 'bold',
        color: CSS.cyan,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, CSS.cyan, 18, true, true)
    this.add
      .text(w / 2, h / 2 - 58, t('game.subtitle'), { fontFamily: FONT, fontSize: '19px', color: CSS.dim })
      .setOrigin(0.5)

    // Currency HUD
    this.energyChip = makeCurrencyChip(this, 96, 40, 'icon_energy', String(SaveManager.data.energy))
    this.crystalChip = makeCurrencyChip(this, 246, 40, 'icon_crystal', String(SaveManager.data.crystals))
    this.energyTimerText = this.add
      .text(96, 74, '', { fontFamily: FONT, fontSize: '13px', color: CSS.dim })
      .setOrigin(0.5)

    // Best score
    this.bestText = makeText(
      this,
      w / 2,
      h / 2 - 14,
      t('menu.best', { score: SaveManager.data.bestScore, wave: SaveManager.data.bestWave }),
      17,
      CSS.gold
    )

    // Play button
    const play = makeButton(this, w / 2, h / 2 + 62, t('menu.play'), () => this.startRun(), {
      width: 340,
      height: 76,
      fontSize: 30,
      color: COLORS.cyan,
    })
    this.tweens.add({ targets: play, scale: { from: 1, to: 1.03 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' })

    // Meta buttons row
    const row = [
      { label: t('menu.upgrades'), color: COLORS.cyan, fn: () => this.openModal(openUpgradesPanel) },
      { label: t('menu.daily'), color: COLORS.gold, fn: () => this.openModal(openDailyPanel) },
      { label: t('menu.missions'), color: COLORS.magenta, fn: () => this.openModal(openMissionsPanel) },
      { label: t('menu.shop'), color: COLORS.violet, fn: () => this.openModal(openShopPanel) },
      { label: t('menu.leaderboard'), color: COLORS.gold, fn: () => this.openModal(openLeaderboardPanel) },
    ]
    const bw = 218
    const gap = 16
    const totalW = row.length * bw + (row.length - 1) * gap
    row.forEach((b, i) => {
      const x = w / 2 - totalW / 2 + bw / 2 + i * (bw + gap)
      makeButton(this, x, h - 74, b.label, b.fn, { width: bw, height: 60, fontSize: 19, color: b.color })
    })

    // Sound toggle (text-based; emoji glyphs are not reliable cross-platform)
    const soundLabel = () =>
      (SaveManager.data.soundOn ? t('menu.sound_on') : t('menu.sound_off'))
    const sound = this.add
      .text(w - 44, 40, soundLabel(), {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: SaveManager.data.soundOn ? CSS.cyan : CSS.dim,
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
    sound.on('pointerup', () => {
      const on = !(SaveManager.data.soundOn || SaveManager.data.musicOn)
      SaveManager.data.soundOn = on
      SaveManager.data.musicOn = on
      SaveManager.markDirty()
      AudioManager.applySettings()
      sound.setText(soundLabel())
      sound.setColor(on ? CSS.cyan : CSS.dim)
    })

    // WebAudio requires a user gesture before it can start.
    this.input.once('pointerdown', () => AudioManager.unlock())

    // Daily reward badge — auto-open on first launch if claimable
    if (SaveManager.canClaimDaily()) {
      const badge = this.add.circle(w / 2 - totalW / 2 + bw / 2 + (bw + gap) + bw / 2 - 14, h - 102, 8, COLORS.gold)
      this.tweens.add({ targets: badge, alpha: { from: 1, to: 0.3 }, duration: 500, yoyo: true, repeat: -1 })
      if (data.firstLaunch) {
        this.time.delayedCall(400, () => {
          if (!this.modalOpen) this.openModal(openDailyPanel)
        })
      }
    }

    // Regen ticker
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickHud() })
    this.tickHud()

    AudioManager.applySettings()
  }

  private tickHud(): void {
    SaveManager.tickEnergyRegen()
    this.energyChip.text.setText(String(SaveManager.data.energy))
    this.crystalChip.text.setText(String(SaveManager.data.crystals))
    const secs = Math.ceil(SaveManager.msUntilNextEnergy() / 1000)
    this.energyTimerText.setText(
      secs > 0 ? t('menu.energy_in', { time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` }) : ''
    )
    this.bestText.setText(t('menu.best', { score: SaveManager.data.bestScore, wave: SaveManager.data.bestWave }))
  }

  private openModal(open: (scene: Phaser.Scene, onClose: () => void) => void): void {
    if (this.modalOpen) return
    this.modalOpen = true
    open(this, () => {
      this.modalOpen = false
      this.tickHud()
    })
  }

  private startRun(): void {
    if (this.modalOpen) return
    void YandexSDK.gameplayStart()
    this.scene.start('Game')
    void LEADERBOARD_NAME
  }
}
