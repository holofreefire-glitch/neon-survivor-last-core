import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, FONT } from '../../config/GameConfig'
import { MISSION_POOL } from '../../config/Balance'
import { SaveManager } from '../../core/SaveManager'
import { t } from '../../i18n/i18n'
import { makeButton, makePanel, makeDim, makeTitle, makeText } from '../UiFactory'
import { AudioManager } from '../../core/AudioManager'

/** Daily missions modal with claimable rewards. */
export function openMissionsPanel(scene: Phaser.Scene, onClose: () => void): void {
  SaveManager.refreshMissionsIfNeeded()

  const root = scene.add.container(0, 0).setDepth(500)
  root.add(makeDim(scene))
  root.add(makePanel(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 880, 620, COLORS.magenta))
  root.add(makeTitle(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 264, t('missions.title'), 32, CSS.magenta))

  const list = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
  root.add(list)

  const refresh = (): void => {
    list.removeAll(true)
    SaveManager.data.missions.forEach((m, i) => {
      const def = MISSION_POOL.find((d) => d.id === m.id)
      if (!def) return
      const y = -180 + i * 88

      const rowBg = scene.add.graphics()
      rowBg.fillStyle(COLORS.panelLight, 0.5)
      rowBg.fillRoundedRect(-400, y - 36, 800, 74, 14)
      list.add(rowBg)

      const label = scene.add
        .text(-372, y - 16, t(`mission.${def.type}`, { n: def.target }), {
          fontFamily: FONT,
          fontSize: '19px',
          fontStyle: 'bold',
          color: CSS.white,
        })
        .setOrigin(0, 0.5)
      list.add(label)

      // Progress bar
      const frac = Math.min(1, m.progress / def.target)
      const bar = scene.add.graphics()
      bar.fillStyle(COLORS.panel, 1)
      bar.fillRoundedRect(-372, y + 6, 420, 12, 6)
      if (frac > 0) {
        bar.fillStyle(COLORS.magenta, 1)
        bar.fillRoundedRect(-372, y + 6, Math.max(8, 420 * frac), 12, 6)
      }
      list.add(bar)
      const progress = scene.add
        .text(62, y + 12, `${Math.floor(m.progress)}/${def.target}`, { fontFamily: FONT, fontSize: '14px', color: CSS.dim })
        .setOrigin(0, 0.5)
      list.add(progress)

      // Reward + claim
      const rewardStr = def.rewardCrystals > 0 ? `⚡${def.rewardEnergy} 💎${def.rewardCrystals}` : `⚡${def.rewardEnergy}`
      if (m.claimed) {
        list.add(makeText(scene, 320, y, t('missions.done'), 18, CSS.dim))
      } else if (frac >= 1) {
        const btn = makeButton(
          scene,
          320,
          y,
          `${t('missions.claim')}\n${rewardStr}`,
          () => {
            m.claimed = true
            SaveManager.addEnergy(def.rewardEnergy)
            if (def.rewardCrystals > 0) SaveManager.addCrystals(def.rewardCrystals)
            SaveManager.markDirty()
            AudioManager.reward()
            refresh()
          },
          { width: 150, height: 64, fontSize: 15, color: COLORS.gold, textColor: CSS.gold }
        )
        list.add(btn)
      } else {
        list.add(makeText(scene, 320, y, rewardStr, 16, CSS.dim))
      }
    })
  }

  root.add(
    makeButton(
      scene,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 264,
      t('common.back'),
      () => {
        root.destroy()
        onClose()
      },
      { width: 260, color: COLORS.panelLight, textColor: CSS.dim }
    )
  )

  refresh()
}
