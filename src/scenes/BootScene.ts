import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, CSS, COLORS, FONT } from '../config/GameConfig'
import { YandexSDK } from '../yandex/YandexSDK'
import { SaveManager } from '../core/SaveManager'
import { detectLang, setLang, t } from '../i18n/i18n'

const IMAGES: Array<[string, string]> = [
  ['player_core', 'player_core.png'],
  ['enemy_glitch_bug', 'enemy_glitch_bug.png'],
  ['enemy_virus_blob', 'enemy_virus_blob.png'],
  ['enemy_pixel_moth', 'enemy_pixel_moth.png'],
  ['enemy_spike_mite', 'enemy_spike_mite.png'],
  ['enemy_energy_drone', 'enemy_energy_drone.png'],
  ['enemy_data_wasp', 'enemy_data_wasp.png'],
  ['enemy_byte_crab', 'enemy_byte_crab.png'],
  ['enemy_spark_eel', 'enemy_spark_eel.png'],
  ['enemy_phantom_ray', 'enemy_phantom_ray.png'],
  ['enemy_dark_cube', 'enemy_dark_cube.png'],
  ['enemy_null_shard', 'enemy_null_shard.png'],
  ['boss_firewall_golem', 'boss_firewall_golem.png'],
  ['boss_trojan_knight', 'boss_trojan_knight.png'],
  ['boss_hive_mind', 'boss_hive_mind.png'],
  ['boss_void_serpent', 'boss_void_serpent.png'],
  ['boss_omega_core', 'boss_omega_core.png'],
  ['icon_energy', 'icon_energy.png'],
  ['icon_crystal', 'icon_crystal.png'],
  ['icon_heart', 'icon_heart.png'],
  ['pickup_energy_orb', 'pickup_energy_orb.png'],
  ['logo', 'logo.png'],
  ['bg_stage_01', 'background_stage_01.webp'],
  ['bg_stage_02', 'background_stage_02.webp'],
  ['bg_menu', 'background_menu.webp'],
]

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    const w = GAME_WIDTH
    const h = GAME_HEIGHT

    this.cameras.main.setBackgroundColor(COLORS.bg)
    const barBg = this.add.rectangle(w / 2, h / 2 + 40, 420, 14, COLORS.panelLight).setOrigin(0.5)
    const bar = this.add.rectangle(w / 2 - 208, h / 2 + 40, 4, 10, COLORS.cyan).setOrigin(0, 0.5)
    const label = this.add
      .text(w / 2, h / 2 - 20, 'NEON SURVIVOR', {
        fontFamily: FONT,
        fontSize: '42px',
        fontStyle: 'bold',
        color: CSS.cyan,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, CSS.cyan, 16, true, true)
    this.add
      .text(w / 2, h / 2 + 80, '...', {
        fontFamily: FONT,
        fontSize: '16px',
        color: CSS.dim,
      })
      .setOrigin(0.5)
      .setName('loading-label')

    this.load.on('progress', (v: number) => {
      bar.width = Math.max(4, 416 * v)
    })

    for (const [key, file] of IMAGES) {
      this.load.image(key, `assets/images/${file}`)
    }

    void label
    void barBg
  }

  async create(): Promise<void> {
    // Init platform SDK, then load the save (cloud first).
    await YandexSDK.init()
    // ?lang=ru|en query override (useful for store screenshots / QA).
    const forced = new URLSearchParams(location.search).get('lang')
    setLang(forced === 'ru' || forced === 'en' ? forced : detectLang(YandexSDK.lang))
    const lbl = this.children.getByName('loading-label') as Phaser.GameObjects.Text | null
    lbl?.setText(t('common.loading'))
    await SaveManager.load()

    // Consume purchases that were paid but never processed.
    await YandexSDK.consumePending((productId) => {
      this.grantProduct(productId)
    })

    this.scene.start('Menu', { firstLaunch: true })
  }

  private grantProduct(productId: string): void {
    // Mirrors ShopPanel.grant - kept here for crash-recovery consumption.
    const d = SaveManager.data
    if (productId === 'starter_pack') {
      SaveManager.addCrystals(500)
      d.starterSkin = true
    } else if (productId === 'energy_pack') {
      SaveManager.addEnergy(100)
    } else if (productId === 'premium_core') {
      d.premiumCore = true
      d.legendaryModule = true
    }
    SaveManager.markDirty()
  }
}
