import Phaser from 'phaser'
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  CSS,
  FONT,
  RUN_MAX_MS,
  WAVE_INTERVAL_MS,
  BOSS_EVERY_N_WAVES,
  MAX_ALIVE_ENEMIES,
  LEADERBOARD_NAME,
} from '../config/GameConfig'
import {
  ENEMIES,
  BOSSES,
  EnemyDef,
  enemiesForWave,
  enemyHpScale,
  enemyDamageScale,
  runXpForLevel,
  RUN_UPGRADES,
} from '../config/Balance'
import { SaveManager } from '../core/SaveManager'
import { getMetaBonuses } from '../core/Stats'
import { AudioManager } from '../core/AudioManager'
import { YandexSDK } from '../yandex/YandexSDK'
import { t } from '../i18n/i18n'
import { makeButton, makePanel, makeDim, makeTitle, makeText } from '../ui/UiFactory'

interface RunStats {
  laserPower: number
  fireRate: number
  multishot: number
  pierce: number
  moveSpeed: number
  magnet: number
  shield: number
  regen: number
  maxHp: number
  crit: number
  orbital: number
  xpGain: number
}

const WORLD_W = 2400
const WORLD_H = 1800

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private orbs!: Phaser.Physics.Arcade.Group
  private orbitals: Phaser.GameObjects.Image[] = []

  private hud!: Phaser.GameObjects.Container
  private hpBar!: Phaser.GameObjects.Graphics
  private xpBar!: Phaser.GameObjects.Graphics
  private waveText!: Phaser.GameObjects.Text
  private timeText!: Phaser.GameObjects.Text
  private killText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text
  private bossBar: Phaser.GameObjects.Graphics | null = null
  private boss: Phaser.Physics.Arcade.Image | null = null

  // run state
  private stats!: RunStats
  private upgradeStacks: Record<string, number> = {}
  private hp = 100
  private maxHp = 100
  private shieldCharged = false
  private shieldCooldown = 0
  private level = 1
  private xp = 0
  private kills = 0
  private energyCollected = 0
  private levelUps = 0
  private wave = 1
  private runStartTime = 0
  private elapsedMs = 0
  private spawnQueue = 0
  private spawnAccumulator = 0
  private waveTimer = 0
  private fireTimer = 0
  private regenTimer = 0
  private gameEnded = false
  private paused = false
  private reviveUsed = false
  private modalOpen = false
  private targetPos = new Phaser.Math.Vector2()
  private hasTarget = false
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private meta = getMetaBonuses()

  constructor() {
    super('Game')
  }

  create(): void {
    this.resetState()
    this.meta = getMetaBonuses()

    // World & background
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    const bgKey = Math.random() < 0.5 ? 'bg_stage_01' : 'bg_stage_02'
    for (let x = 0; x < WORLD_W; x += 1200) {
      for (let y = 0; y < WORLD_H; y += 675) {
        this.add.image(x, y, bgKey).setOrigin(0).setDisplaySize(1200, 675).setAlpha(0.9)
      }
    }

    // Player
    this.player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'player_core')
    this.player.setDisplaySize(72, 72).setCollideWorldBounds(true).setDepth(10)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setCircle(
      this.player.width * 0.36,
      this.player.width * 0.14,
      this.player.height * 0.14
    )

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09)
    this.cameras.main.setBackgroundColor(COLORS.bg)

    // Groups
    this.enemies = this.physics.add.group()
    this.bullets = this.physics.add.group({ maxSize: 220 })
    this.orbs = this.physics.add.group({ maxSize: 260 })

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) =>
      this.onBulletHit(b as Phaser.Physics.Arcade.Image, e as Phaser.Physics.Arcade.Image)
    )
    this.physics.add.overlap(this.player, this.enemies, (_p, e) =>
      this.onPlayerHit(e as Phaser.Physics.Arcade.Image)
    )
    this.physics.add.overlap(this.player, this.orbs, (_p, o) =>
      this.onOrbPickup(o as Phaser.Physics.Arcade.Image)
    )

    // Input: pointer drag + WASD/arrows
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.setTarget(p))
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.setTarget(p)
    })
    this.input.on('pointerup', () => {
      this.hasTarget = false
    })
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,ESC,P') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >
    this.keys.ESC.on('down', () => this.togglePause())
    this.keys.P.on('down', () => this.togglePause())

    this.buildHud()

    // First wave
    this.runStartTime = this.time.now
    this.startWave(1)

    YandexSDK.gameplayStart()

    // Platform pause events (ads / tab hidden)
    YandexSDK.onPauseChange((paused) => {
      if (paused && !this.paused && !this.gameEnded) this.setPaused(true, false)
    })

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      YandexSDK.gameplayStop()
    })
  }

  private resetState(): void {
    this.stats = {
      laserPower: 0,
      fireRate: 0,
      multishot: 0,
      pierce: 0,
      moveSpeed: 0,
      magnet: 0,
      shield: 0,
      regen: 0,
      maxHp: 0,
      crit: 0,
      orbital: 0,
      xpGain: 0,
    }
    this.upgradeStacks = {}
    this.orbitals = []
    this.hp = 100
    this.maxHp = 100
    this.shieldCharged = false
    this.shieldCooldown = 0
    this.level = 1
    this.xp = 0
    this.kills = 0
    this.energyCollected = 0
    this.levelUps = 0
    this.wave = 1
    this.elapsedMs = 0
    this.spawnQueue = 0
    this.spawnAccumulator = 0
    this.waveTimer = 0
    this.fireTimer = 0
    this.regenTimer = 0
    this.gameEnded = false
    this.paused = false
    this.reviveUsed = false
    this.modalOpen = false
    this.hasTarget = false
    this.boss = null
    this.bossBar = null
    this.maxHp = Math.round(100 * (1 + this.meta.defense))
    this.hp = this.maxHp
  }

  private setTarget(p: Phaser.Input.Pointer): void {
    if (this.paused || this.modalOpen || this.gameEnded) return
    this.targetPos.set(p.worldX, p.worldY)
    this.hasTarget = true
  }

  /* ------------------------------------------------------------ */
  /* HUD                                                           */
  /* ------------------------------------------------------------ */

  private buildHud(): void {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(100)

    const barsBg = this.add.graphics().setScrollFactor(0)
    barsBg.fillStyle(COLORS.panel, 0.75)
    barsBg.fillRoundedRect(16, 14, 320, 58, 12)
    this.hud.add(barsBg)

    this.hpBar = this.add.graphics().setScrollFactor(0)
    this.xpBar = this.add.graphics().setScrollFactor(0)
    this.hud.add(this.hpBar)
    this.hud.add(this.xpBar)

    this.levelText = this.add
      .text(28, 22, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: CSS.white })
      .setScrollFactor(0)
    this.hud.add(this.levelText)

    this.waveText = this.add
      .text(GAME_WIDTH / 2, 26, '', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: CSS.cyan,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setShadow(0, 0, CSS.cyan, 10, true, true)
    this.hud.add(this.waveText)

    this.timeText = this.add
      .text(GAME_WIDTH / 2, 58, '', { fontFamily: FONT, fontSize: '17px', color: CSS.white })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
    this.hud.add(this.timeText)

    this.killText = this.add
      .text(GAME_WIDTH - 24, 24, '', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: CSS.magenta,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
    this.hud.add(this.killText)

    // Pause button
    const pauseBtn = this.add
      .text(GAME_WIDTH - 28, 64, '❚❚', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: CSS.dim,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
    pauseBtn.on('pointerup', () => this.togglePause())
    this.hud.add(pauseBtn)

    this.updateHud()
  }

  private updateHud(): void {
    this.hpBar.clear()
    this.hpBar.fillStyle(0x232946, 1)
    this.hpBar.fillRoundedRect(28, 40, 296, 12, 6)
    const hpFrac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1)
    if (hpFrac > 0) {
      this.hpBar.fillStyle(hpFrac > 0.35 ? 0x27e08b : COLORS.danger, 1)
      this.hpBar.fillRoundedRect(28, 40, Math.max(8, 296 * hpFrac), 12, 6)
    }
    if (this.shieldCharged) {
      this.hpBar.lineStyle(2, COLORS.cyan, 1)
      this.hpBar.strokeRoundedRect(26, 38, 300, 16, 8)
    }

    this.xpBar.clear()
    this.xpBar.fillStyle(0x232946, 1)
    this.xpBar.fillRoundedRect(28, 56, 296, 8, 4)
    const need = runXpForLevel(this.level)
    const xpFrac = Phaser.Math.Clamp(this.xp / need, 0, 1)
    if (xpFrac > 0) {
      this.xpBar.fillStyle(COLORS.cyan, 1)
      this.xpBar.fillRoundedRect(28, 56, Math.max(6, 296 * xpFrac), 8, 4)
    }

    this.levelText.setText(`${t('hud.level')} ${this.level}`)
    this.waveText.setText(`${t('hud.wave')} ${this.wave}`)
    const secs = Math.floor(this.elapsedMs / 1000)
    this.timeText.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`)
    this.killText.setText(`✕ ${this.kills}`)
  }

  /* ------------------------------------------------------------ */
  /* Waves & spawning                                              */
  /* ------------------------------------------------------------ */

  private startWave(n: number): void {
    this.wave = n
    this.waveTimer = 0
    if (n % BOSS_EVERY_N_WAVES === 0) {
      this.spawnBoss(n)
      this.spawnQueue = Math.round(enemiesForWave(n) * 0.4)
    } else {
      this.spawnQueue = enemiesForWave(n)
    }
    // Wave banner
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, `${t('hud.wave')} ${n}`, {
        fontFamily: FONT,
        fontSize: '54px',
        fontStyle: 'bold',
        color: n % BOSS_EVERY_N_WAVES === 0 ? CSS.danger : CSS.cyan,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(0)
      .setShadow(0, 0, n % BOSS_EVERY_N_WAVES === 0 ? CSS.danger : CSS.cyan, 18, true, true)
    this.tweens.add({
      targets: banner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.7, to: 1 },
      duration: 300,
      yoyo: true,
      hold: 900,
      onComplete: () => banner.destroy(),
    })
  }

  private pickEnemyDef(): EnemyDef {
    const avail = ENEMIES.filter((e) => e.minWave <= this.wave)
    // Weight recent unlocks higher
    const weights = avail.map((e) => 1 + e.minWave / 3)
    let total = 0
    for (const w of weights) total += w
    let r = Math.random() * total
    for (let i = 0; i < avail.length; i++) {
      r -= weights[i]
      if (r <= 0) return avail[i]
    }
    return avail[avail.length - 1]
  }

  private spawnEnemy(): void {
    if (this.enemies.countActive(true) >= MAX_ALIVE_ENEMIES) return
    const def = this.pickEnemyDef()
    // Spawn just outside the camera view
    const cam = this.cameras.main
    const margin = 90
    const side = Phaser.Math.Between(0, 3)
    let x = 0
    let y = 0
    if (side === 0) {
      x = cam.worldView.x - margin
      y = Phaser.Math.Between(cam.worldView.y, cam.worldView.bottom)
    } else if (side === 1) {
      x = cam.worldView.right + margin
      y = Phaser.Math.Between(cam.worldView.y, cam.worldView.bottom)
    } else if (side === 2) {
      x = Phaser.Math.Between(cam.worldView.x, cam.worldView.right)
      y = cam.worldView.y - margin
    } else {
      x = Phaser.Math.Between(cam.worldView.x, cam.worldView.right)
      y = cam.worldView.bottom + margin
    }
    x = Phaser.Math.Clamp(x, 20, WORLD_W - 20)
    y = Phaser.Math.Clamp(y, 20, WORLD_H - 20)

    const e = this.enemies.get(x, y, def.texture) as Phaser.Physics.Arcade.Image | null
    if (!e) return
    const size = 110 * def.scale
    e.setActive(true).setVisible(true).setTexture(def.texture).setDisplaySize(size, size).setDepth(5)
    const body = e.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setCircle(e.width * 0.34, e.width * 0.16, e.height * 0.16)
    e.setData('hp', def.hp * enemyHpScale(this.wave))
    e.setData('maxhp', def.hp * enemyHpScale(this.wave))
    e.setData('damage', def.damage * enemyDamageScale(this.wave))
    e.setData('speed', def.speed * (1 + this.wave * 0.012))
    e.setData('xp', def.xp)
    e.setData('energy', def.energy)
    e.setData('isBoss', false)
  }

  private spawnBoss(waveN: number): void {
    const idx = Math.min(Math.floor(waveN / BOSS_EVERY_N_WAVES) - 1, BOSSES.length - 1)
    const def = BOSSES[idx]
    const cam = this.cameras.main
    const x = Phaser.Math.Clamp(cam.worldView.centerX, 200, WORLD_W - 200)
    const y = Phaser.Math.Clamp(cam.worldView.y - 160, 100, WORLD_H - 100)

    const hpMult = 1 + Math.max(0, waveN - BOSS_EVERY_N_WAVES * (idx + 1)) * 0.3
    const b = this.enemies.get(x, y, def.texture) as Phaser.Physics.Arcade.Image | null
    if (!b) return
    const size = 420 * def.scale
    b.setActive(true).setVisible(true).setTexture(def.texture).setDisplaySize(size, size).setDepth(6)
    const body = b.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setCircle(b.width * 0.36, b.width * 0.14, b.height * 0.14)
    b.setData('hp', def.hp * hpMult)
    b.setData('maxhp', def.hp * hpMult)
    b.setData('damage', def.damage)
    b.setData('speed', def.speed)
    b.setData('xp', def.xp)
    b.setData('energy', def.energy)
    b.setData('crystals', def.crystals)
    b.setData('isBoss', true)
    this.boss = b

    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(100)
    AudioManager.bossSpawn()
    this.cameras.main.shake(400, 0.004)
  }

  /* ------------------------------------------------------------ */
  /* Combat                                                        */
  /* ------------------------------------------------------------ */

  private fireInterval(): number {
    const base = 520
    const rate = (1 + this.stats.fireRate * 0.12) * (1 + this.meta.speed)
    return base / rate
  }

  private bulletDamage(): number {
    let dmg = 8 * (1 + this.stats.laserPower * 0.15) * (1 + this.meta.damage)
    const critChance = this.stats.crit * 0.08 * (1 + this.meta.abilities)
    if (Math.random() < critChance) dmg *= 2
    return dmg
  }

  private shoot(): void {
    // Nearest enemy targeting
    let nearest: Phaser.Physics.Arcade.Image | null = null
    let bestD = 620 * 620
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Image
      if (!e.active) continue
      const d = Phaser.Math.Distance.Squared(this.player.x, this.player.y, e.x, e.y)
      if (d < bestD) {
        bestD = d
        nearest = e
      }
    }
    if (!nearest) return

    const baseAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y)
    const count = 1 + this.stats.multishot
    const spread = 0.16
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread
      this.spawnBullet(baseAngle + offset)
    }
    AudioManager.shoot()
  }

  private spawnBullet(angle: number): void {
    const b = this.bullets.get(this.player.x, this.player.y, 'pickup_energy_orb') as
      | Phaser.Physics.Arcade.Image
      | null
    if (!b) return
    b.setActive(true).setVisible(true).setDisplaySize(22, 22).setDepth(8).setTint(0x7df9ff)
    const body = b.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.setCircle(b.width * 0.4, b.width * 0.1, b.height * 0.1)
    const speed = 640
    body.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed)
    b.setData('damage', this.bulletDamage())
    b.setData('pierce', this.stats.pierce)
    b.setData('born', this.time.now)
  }

  private onBulletHit(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active || !enemy.active) return
    const dmg = bullet.getData('damage') as number
    const pierce = bullet.getData('pierce') as number
    if (pierce > 0) {
      bullet.setData('pierce', pierce - 1)
    } else {
      this.recycleBullet(bullet)
    }
    this.damageEnemy(enemy, dmg)
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Image, dmg: number): void {
    const hp = (enemy.getData('hp') as number) - dmg
    enemy.setData('hp', hp)
    enemy.setTintFill(0xffffff)
    this.time.delayedCall(60, () => {
      if (enemy.active) enemy.clearTint()
    })
    AudioManager.hit()
    if (hp <= 0) this.killEnemy(enemy)
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Image): void {
    const isBoss = enemy.getData('isBoss') as boolean
    const xp = enemy.getData('xp') as number
    const energy = enemy.getData('energy') as number

    this.kills++
    // Death burst
    const burst = this.add
      .image(enemy.x, enemy.y, enemy.texture.key)
      .setDisplaySize(enemy.displayWidth, enemy.displayHeight)
      .setDepth(6)
      .setTintFill(0xffffff)
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: burst.scale * 1.5,
      duration: 180,
      onComplete: () => burst.destroy(),
    })

    // Drop orbs
    const orbCount = isBoss ? 10 : 1
    for (let i = 0; i < orbCount; i++) {
      const o = this.orbs.get(
        enemy.x + Phaser.Math.Between(-40, 40),
        enemy.y + Phaser.Math.Between(-40, 40),
        'pickup_energy_orb'
      ) as Phaser.Physics.Arcade.Image | null
      if (!o) break
      o.setActive(true).setVisible(true).setDisplaySize(30, 30).setDepth(4).clearTint()
      const body = o.body as Phaser.Physics.Arcade.Body
      body.enable = true
      body.velocity.set(0, 0)
      o.setData('xp', Math.ceil(xp / orbCount))
      o.setData('energy', Math.ceil(energy / orbCount))
    }

    if (isBoss) {
      const crystals = (enemy.getData('crystals') as number) ?? 0
      if (crystals > 0) SaveManager.addCrystals(crystals)
      this.boss = null
      this.bossBar?.destroy()
      this.bossBar = null
      this.cameras.main.shake(500, 0.006)
    }

    AudioManager.enemyDie()
    this.recycleEnemy(enemy)
    SaveManager.addMissionProgress('kills', 1)
  }

  private recycleEnemy(e: Phaser.Physics.Arcade.Image): void {
    e.setActive(false).setVisible(false)
    ;(e.body as Phaser.Physics.Arcade.Body).enable = false
  }

  private recycleBullet(b: Phaser.Physics.Arcade.Image): void {
    b.setActive(false).setVisible(false)
    ;(b.body as Phaser.Physics.Arcade.Body).enable = false
  }

  private recycleOrb(o: Phaser.Physics.Arcade.Image): void {
    o.setActive(false).setVisible(false)
    ;(o.body as Phaser.Physics.Arcade.Body).enable = false
  }

  private onPlayerHit(enemy: Phaser.Physics.Arcade.Image): void {
    if (!enemy.active || this.gameEnded) return
    const now = this.time.now
    const lastHit = (enemy.getData('lastHit') as number) ?? 0
    if (now - lastHit < 600) return
    enemy.setData('lastHit', now)

    const dmg = enemy.getData('damage') as number
    if (this.shieldCharged) {
      this.shieldCharged = false
      this.shieldCooldown = 9000 - this.stats.shield * 1500
      this.flashPlayer(0x00e5ff)
      return
    }
    this.hp -= dmg
    AudioManager.playerHurt()
    this.flashPlayer(0xff4d6d)
    this.cameras.main.shake(150, 0.004)
    if (this.hp <= 0) this.onDeath()
  }

  private flashPlayer(color: number): void {
    this.player.setTintFill(color)
    this.time.delayedCall(120, () => {
      if (this.player.active) this.player.clearTint()
    })
  }

  private onOrbPickup(orb: Phaser.Physics.Arcade.Image): void {
    if (!orb.active) return
    const xp = orb.getData('xp') as number
    const energy = orb.getData('energy') as number
    this.recycleOrb(orb)
    AudioManager.pickup()

    this.energyCollected += energy
    this.addXp(xp)
  }

  private addXp(xp: number): void {
    const mult = (1 + this.stats.xpGain * 0.15) * (1 + this.meta.energy)
    this.xp += xp * mult
    while (this.xp >= runXpForLevel(this.level)) {
      this.xp -= runXpForLevel(this.level)
      this.level++
      this.levelUps++
      this.openLevelUp()
    }
  }

  /* ------------------------------------------------------------ */
  /* Level-up choice overlay                                       */
  /* ------------------------------------------------------------ */

  private openLevelUp(): void {
    if (this.modalOpen || this.gameEnded) return
    this.modalOpen = true
    this.physics.pause()
    this.tweens.pauseAll()
    AudioManager.levelUp()

    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(200)
    overlay.add(makeDim(this))
    overlay.add(makeTitle(this, GAME_WIDTH / 2, 140, t('levelup.title'), 44, CSS.gold))
    overlay.add(makeText(this, GAME_WIDTH / 2, 190, t('levelup.pick'), 20, CSS.dim))

    // Pick 3 distinct available upgrades
    const available = RUN_UPGRADES.filter(
      (u) => (this.upgradeStacks[u.id] ?? 0) < u.maxStacks
    )
    Phaser.Utils.Array.Shuffle(available)
    const choices = available.slice(0, 3)

    const cardW = 300
    const gap = 40
    const totalW = choices.length * cardW + (choices.length - 1) * gap
    choices.forEach((up, i) => {
      const x = GAME_WIDTH / 2 - totalW / 2 + cardW / 2 + i * (cardW + gap)
      const y = GAME_HEIGHT / 2 + 40
      const card = makePanel(this, x, y, cardW, 320, COLORS.cyan)
      const icon = this.add.image(0, -90, up.icon).setDisplaySize(84, 84)
      const stacks = this.upgradeStacks[up.id] ?? 0
      const name = this.add
        .text(0, -18, t(`up.${up.id}.name`), {
          fontFamily: FONT,
          fontSize: '23px',
          fontStyle: 'bold',
          color: CSS.cyan,
          align: 'center',
        })
        .setOrigin(0.5)
      const desc = this.add
        .text(0, 30, t(`up.${up.id}.desc`), {
          fontFamily: FONT,
          fontSize: '18px',
          color: CSS.white,
          align: 'center',
          wordWrap: { width: cardW - 40 },
        })
        .setOrigin(0.5)
      const stackTxt = this.add
        .text(0, 110, `${stacks}/${up.maxStacks}`, {
          fontFamily: FONT,
          fontSize: '16px',
          color: CSS.dim,
        })
        .setOrigin(0.5)
      card.add([icon, name, desc, stackTxt])
      card.setInteractive({ useHandCursor: true })
      card.on('pointerover', () => card.setScale(1.05))
      card.on('pointerout', () => card.setScale(1))
      card.on('pointerup', () => {
        AudioManager.uiClick()
        this.applyUpgrade(up.id)
        overlay.destroy()
        this.modalOpen = false
        this.physics.resume()
        this.tweens.resumeAll()
        this.updateHud()
      })
      overlay.add(card)
      card.setScale(0.8)
      this.tweens.add({ targets: card, scale: 1, duration: 200, delay: i * 70, ease: 'Back.Out' })
    })
  }

  private applyUpgrade(id: string): void {
    this.upgradeStacks[id] = (this.upgradeStacks[id] ?? 0) + 1
    const s = this.stats
    switch (id) {
      case 'laser_power':
        s.laserPower++
        break
      case 'fire_rate':
        s.fireRate++
        break
      case 'multishot':
        s.multishot++
        break
      case 'pierce':
        s.pierce++
        break
      case 'move_speed':
        s.moveSpeed++
        break
      case 'magnet':
        s.magnet++
        break
      case 'shield':
        s.shield++
        this.shieldCharged = true
        break
      case 'regen':
        s.regen++
        break
      case 'max_hp': {
        s.maxHp++
        const bonus = Math.round(20 * (1 + this.meta.defense))
        this.maxHp += bonus
        this.hp = Math.min(this.maxHp, this.hp + bonus)
        break
      }
      case 'crit':
        s.crit++
        break
      case 'orbital':
        s.orbital++
        this.addOrbital()
        break
      case 'xp_gain':
        s.xpGain++
        break
    }
  }

  private addOrbital(): void {
    const blade = this.add.image(this.player.x, this.player.y, 'null_shard_orbital')
    // fallback texture: reuse enemy_null_shard tinted cyan
    blade.setTexture('enemy_null_shard').setDisplaySize(42, 42).setDepth(9).setTint(0x7df9ff)
    this.orbitals.push(blade)
  }

  /* ------------------------------------------------------------ */
  /* Death / revive / game over                                    */
  /* ------------------------------------------------------------ */

  private onDeath(): void {
    if (this.gameEnded) return
    this.gameEnded = true
    this.physics.pause()
    AudioManager.gameOver()
    this.cameras.main.shake(400, 0.008)
    YandexSDK.gameplayStop()

    if (!this.reviveUsed) {
      this.showReviveOffer()
    } else {
      this.finishRun()
    }
  }

  private showReviveOffer(): void {
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(300)
    overlay.add(makeDim(this))
    const panel = makePanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 320, COLORS.danger)
    overlay.add(panel)
    overlay.add(makeTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, t('over.title'), 36, CSS.danger))
    overlay.add(
      makeButton(
        this,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 4,
        `▶ ${t('over.revive')}`,
        () => {
          import('../core/AdManager').then(({ AdManager }) => {
            AdManager.showRewarded((rewarded) => {
              overlay.destroy()
              if (rewarded) {
                this.revive()
              } else {
                this.finishRun()
              }
            })
          })
        },
        { width: 380, color: COLORS.gold, textColor: CSS.gold }
      )
    )
    overlay.add(
      makeButton(
        this,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 90,
        t('over.menu'),
        () => {
          overlay.destroy()
          this.finishRun()
        },
        { width: 380, color: COLORS.panelLight, textColor: CSS.dim }
      )
    )
  }

  private revive(): void {
    this.reviveUsed = true
    this.gameEnded = false
    this.hp = this.maxHp
    // Clear enemies near the player
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Image
      if (!e.active) continue
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < 420 && !(e.getData('isBoss') as boolean)) {
        this.recycleEnemy(e)
      }
    }
    this.physics.resume()
    YandexSDK.gameplayStart()
    this.updateHud()
  }

  private finishRun(): void {
    const survivedSec = Math.floor(this.elapsedMs / 1000)
    const score = Math.round(this.kills * 10 + survivedSec * 5 + this.wave * 100 + this.levelUps * 25)

    // Rewards: collected energy + account xp
    const energyGain = Math.round(this.energyCollected * (1 + this.meta.energy))
    SaveManager.addEnergy(energyGain)
    SaveManager.addAccountXp(Math.round(score / 10))

    const d = SaveManager.data
    d.totalKills += this.kills
    d.totalRuns += 1
    d.totalPlayMs += this.elapsedMs
    const isRecord = score > d.bestScore
    if (isRecord) d.bestScore = score
    if (this.wave > d.bestWave) d.bestWave = this.wave
    SaveManager.markDirty()
    void SaveManager.flush()

    SaveManager.addMissionProgress('runs', 1)
    SaveManager.addMissionProgress('collect', this.energyCollected)
    SaveManager.addMissionProgress('survive', survivedSec)
    SaveManager.addMissionProgress('levelups', this.levelUps)

    void YandexSDK.submitScore(LEADERBOARD_NAME, score)

    this.scene.start('GameOver', {
      score,
      kills: this.kills,
      wave: this.wave,
      survivedSec,
      energyGain,
      isRecord,
    })
  }

  /* ------------------------------------------------------------ */
  /* Pause                                                         */
  /* ------------------------------------------------------------ */

  private pauseOverlay: Phaser.GameObjects.Container | null = null

  private togglePause(): void {
    if (this.gameEnded || this.modalOpen) return
    this.setPaused(!this.paused, true)
  }

  private setPaused(paused: boolean, manual: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) {
      this.physics.pause()
      this.tweens.pauseAll()
      AudioManager.pauseAll(true)
      YandexSDK.gameplayStop()
      this.pauseOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(300)
      this.pauseOverlay.add(makeDim(this))
      this.pauseOverlay.add(makeTitle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 110, t('common.paused'), 42))
      this.pauseOverlay.add(
        makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, t('common.resume'), () => this.setPaused(false, true), {
          width: 320,
        })
      )
      this.pauseOverlay.add(
        makeButton(
          this,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 + 86,
          t('common.exit'),
          () => {
            this.setPaused(false, true)
            this.finishRun()
          },
          { width: 320, color: COLORS.panelLight, textColor: CSS.dim }
        )
      )
      void manual
    } else {
      this.physics.resume()
      this.tweens.resumeAll()
      AudioManager.pauseAll(false)
      YandexSDK.gameplayStart()
      this.pauseOverlay?.destroy()
      this.pauseOverlay = null
    }
  }

  /* ------------------------------------------------------------ */
  /* Update loop                                                   */
  /* ------------------------------------------------------------ */

  update(_time: number, delta: number): void {
    if (this.paused || this.gameEnded || this.modalOpen) return

    this.elapsedMs += delta

    // Hard run cap
    if (this.elapsedMs >= RUN_MAX_MS) {
      this.finishRun()
      return
    }

    this.movePlayer(delta)
    this.moveEnemies()
    this.magnetOrbs()
    this.updateOrbitals(delta)

    // Firing
    this.fireTimer += delta
    if (this.fireTimer >= this.fireInterval()) {
      this.fireTimer = 0
      this.shoot()
    }

    // Regen
    if (this.stats.regen > 0) {
      this.regenTimer += delta
      if (this.regenTimer >= 1000) {
        this.regenTimer = 0
        this.hp = Math.min(this.maxHp, this.hp + this.stats.regen)
      }
    }

    // Shield recharge
    if (this.stats.shield > 0 && !this.shieldCharged) {
      this.shieldCooldown -= delta
      if (this.shieldCooldown <= 0) this.shieldCharged = true
    }

    // Wave progression
    this.waveTimer += delta
    if (this.waveTimer >= WAVE_INTERVAL_MS) {
      this.startWave(this.wave + 1)
    }

    // Spawning: distribute queue across the wave
    if (this.spawnQueue > 0) {
      this.spawnAccumulator += delta
      const perSpawn = WAVE_INTERVAL_MS / Math.max(1, enemiesForWave(this.wave))
      while (this.spawnAccumulator >= perSpawn && this.spawnQueue > 0) {
        this.spawnAccumulator -= perSpawn
        this.spawnQueue--
        this.spawnEnemy()
      }
    }

    // Cull far-away bullets
    for (const obj of this.bullets.getChildren()) {
      const b = obj as Phaser.Physics.Arcade.Image
      if (!b.active) continue
      if (this.time.now - (b.getData('born') as number) > 1600) this.recycleBullet(b)
    }

    // Boss HP bar
    if (this.boss?.active && this.bossBar) {
      const frac = Phaser.Math.Clamp(
        (this.boss.getData('hp') as number) / (this.boss.getData('maxhp') as number),
        0,
        1
      )
      this.bossBar.clear()
      this.bossBar.fillStyle(COLORS.panel, 0.85)
      this.bossBar.fillRoundedRect(GAME_WIDTH / 2 - 260, GAME_HEIGHT - 52, 520, 26, 12)
      this.bossBar.fillStyle(COLORS.danger, 1)
      if (frac > 0) this.bossBar.fillRoundedRect(GAME_WIDTH / 2 - 254, GAME_HEIGHT - 47, Math.max(10, 508 * frac), 16, 8)
    }

    this.updateHud()
  }

  private movePlayer(delta: number): void {
    const speed = 260 * (1 + this.stats.moveSpeed * 0.1) * (1 + this.meta.speed)
    const body = this.player.body as Phaser.Physics.Arcade.Body

    // Keyboard input
    let kx = 0
    let ky = 0
    if (this.keys.A.isDown || this.keys.LEFT.isDown) kx -= 1
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) kx += 1
    if (this.keys.W.isDown || this.keys.UP.isDown) ky -= 1
    if (this.keys.S.isDown || this.keys.DOWN.isDown) ky += 1

    if (kx !== 0 || ky !== 0) {
      this.hasTarget = false
      const len = Math.hypot(kx, ky)
      body.velocity.set((kx / len) * speed, (ky / len) * speed)
    } else if (this.hasTarget) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetPos.x, this.targetPos.y)
      if (dist > 12) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.targetPos.x, this.targetPos.y)
        body.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed)
      } else {
        body.velocity.set(0, 0)
      }
    } else {
      body.velocity.set(0, 0)
    }
    void delta

    // Gentle idle pulse
    const pulse = 1 + Math.sin(this.time.now / 300) * 0.03
    this.player.setScale((72 / this.player.width) * pulse)
  }

  private moveEnemies(): void {
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Image
      if (!e.active) continue
      const speed = e.getData('speed') as number
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y)
      const body = e.body as Phaser.Physics.Arcade.Body
      body.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed)
      e.setFlipX(this.player.x < e.x)
    }
  }

  private magnetOrbs(): void {
    const radius = 120 * (1 + this.stats.magnet * 0.2) * (1 + this.meta.energy * 0.5)
    const r2 = radius * radius
    for (const obj of this.orbs.getChildren()) {
      const o = obj as Phaser.Physics.Arcade.Image
      if (!o.active) continue
      const d2 = Phaser.Math.Distance.Squared(this.player.x, this.player.y, o.x, o.y)
      const body = o.body as Phaser.Physics.Arcade.Body
      if (d2 < r2) {
        const angle = Phaser.Math.Angle.Between(o.x, o.y, this.player.x, this.player.y)
        const pull = 340
        body.velocity.set(Math.cos(angle) * pull, Math.sin(angle) * pull)
      } else {
        body.velocity.scale(0.9)
      }
    }
  }

  private updateOrbitals(_delta: number): void {
    const n = this.orbitals.length
    if (n === 0) return
    const radius = 100
    const speed = this.time.now / 500
    const dmg = 12 * (1 + this.meta.damage) * (1 + this.meta.abilities)
    for (let i = 0; i < n; i++) {
      const blade = this.orbitals[i]
      const angle = speed + (i * Math.PI * 2) / n
      blade.x = this.player.x + Math.cos(angle) * radius
      blade.y = this.player.y + Math.sin(angle) * radius
      blade.rotation = angle + Math.PI / 2

      // Damage enemies touching the blade
      for (const obj of this.enemies.getChildren()) {
        const e = obj as Phaser.Physics.Arcade.Image
        if (!e.active) continue
        const lastOrbHit = (e.getData('lastOrbHit') as number) ?? 0
        if (this.time.now - lastOrbHit < 400) continue
        if (Phaser.Math.Distance.Between(blade.x, blade.y, e.x, e.y) < 46) {
          e.setData('lastOrbHit', this.time.now)
          this.damageEnemy(e, dmg)
        }
      }
    }
  }
}
