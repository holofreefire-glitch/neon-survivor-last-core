import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, FONT } from '../../config/GameConfig'
import { DAILY_REWARDS } from '../../config/Balance'
import { SaveManager } from '../../core/SaveManager'
import { t } from '../../i18n/i18n'
import { makeButton, makePanel, makeDim, makeTitle, makeText } from '../UiFactory'
import { AudioManager } from '../../core/AudioManager'

/** 7-day streak daily rewards modal. */
export function openDailyPanel(scene: Phaser.Scene, onClose: () => void): void {
  const root = scene.add.container(0, 0).setDepth(500)
  root.add(makeDim(scene))
  root.add(makePanel(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 960, 560, COLORS.gold))
  root.add(makeTitle(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 232, t('daily.title'), 32, CSS.gold))
  root.add(
    makeText(
      scene,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 188,
      t('daily.streak', { days: SaveManager.data.dailyStreak }),
      18,
      CSS.dim
    )
  )

  const canClaim = SaveManager.canClaimDaily()
  const nextSlot = (SaveManager.data.dailyStreak % 7) + 1

  const cardW = 118
  const gap = 12
  DAILY_REWARDS.forEach((r, i) => {
    const x = GAME_WIDTH / 2 - ((cardW + gap) * 7 - gap) / 2 + cardW / 2 + i * (cardW + gap)
    const y = GAME_HEIGHT / 2 - 20
    const isPast = r.day < nextSlot || (!canClaim && r.day === ((SaveManager.data.dailyStreak - 1) % 7) + 1)
    const isNext = canClaim && r.day === nextSlot
    const color = r.legendary ? COLORS.gold : isNext ? COLORS.cyan : COLORS.panelLight

    const card = makePanel(scene, x, y, cardW, 210, color)
    const day = scene.add
      .text(0, -80, `${t('daily.day')} ${r.day}`, { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: r.legendary ? CSS.gold : CSS.white })
      .setOrigin(0.5)
    const icon = scene.add.image(0, -28, r.crystals > 0 ? 'icon_crystal' : 'icon_energy').setDisplaySize(52, 52)
    const rewardLines: string[] = []
    if (r.energy > 0) rewardLines.push(`⚡ ${r.energy}`)
    if (r.crystals > 0) rewardLines.push(`💎 ${r.crystals}`)
    const txt = scene.add
      .text(0, 34, rewardLines.join('\n'), { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: CSS.white, align: 'center' })
      .setOrigin(0.5)
    card.add([day, icon, txt])
    if (r.legendary) {
      const leg = scene.add
        .text(0, 82, t('daily.legendary'), { fontFamily: FONT, fontSize: '11px', color: CSS.gold, align: 'center', wordWrap: { width: cardW - 12 } })
        .setOrigin(0.5)
      card.add(leg)
    }
    if (isPast) card.setAlpha(0.45)
    if (isNext) {
      scene.tweens.add({ targets: card, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: -1 })
    }
    root.add(card)
  })

  if (canClaim) {
    root.add(
      makeButton(
        scene,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 190,
        t('daily.claim'),
        () => {
          const slot = SaveManager.claimDaily()
          if (slot > 0) {
            const r = DAILY_REWARDS[slot - 1]
            SaveManager.addEnergy(r.energy)
            if (r.crystals > 0) SaveManager.addCrystals(r.crystals)
            if (r.legendary) {
              SaveManager.data.legendaryModule = true
              SaveManager.markDirty()
            }
            AudioManager.reward()
          }
          root.destroy()
          onClose()
        },
        { width: 320, color: COLORS.gold, textColor: CSS.gold }
      )
    )
  } else {
    root.add(makeText(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 170, t('daily.come_back'), 20, CSS.dim))
    root.add(
      makeButton(
        scene,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 224,
        t('common.close'),
        () => {
          root.destroy()
          onClose()
        },
        { width: 260, color: COLORS.panelLight, textColor: CSS.dim }
      )
    )
  }
}
