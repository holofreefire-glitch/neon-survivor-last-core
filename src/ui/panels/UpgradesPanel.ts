import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, FONT } from '../../config/GameConfig'
import { META_CATEGORIES, META_UPGRADES } from '../../config/Balance'
import { metaTiersOwned, nextMetaTier, buyMetaTier } from '../../core/Stats'
import { t } from '../../i18n/i18n'
import { makeButton, makePanel, makeDim, makeTitle, makeText } from '../UiFactory'
import { SaveManager } from '../../core/SaveManager'
import { AudioManager } from '../../core/AudioManager'

/** Meta upgrades modal: 5 categories x 10 tiers, paid with energy. */
export function openUpgradesPanel(scene: Phaser.Scene, onClose: () => void): void {
  const root = scene.add.container(0, 0).setDepth(500)
  root.add(makeDim(scene))
  root.add(makePanel(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 980, 620, COLORS.cyan))
  root.add(makeTitle(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 264, t('meta.title'), 32))

  const refresh = (): void => {
    rows.removeAll(true)
    META_CATEGORIES.forEach((cat, i) => {
      const y = -180 + i * 92
      const owned = metaTiersOwned(cat)
      const next = nextMetaTier(cat)

      const rowBg = scene.add.graphics()
      rowBg.fillStyle(COLORS.panelLight, 0.5)
      rowBg.fillRoundedRect(-440, y - 38, 880, 78, 14)
      rows.add(rowBg)

      const name = scene.add
        .text(-410, y - 20, t(`meta.${cat}`), { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: CSS.cyan })
        .setOrigin(0, 0.5)
      const desc = scene.add
        .text(-410, y + 10, t(`meta.${cat}.desc`), { fontFamily: FONT, fontSize: '15px', color: CSS.dim })
        .setOrigin(0, 0.5)
      rows.add([name, desc])

      // Tier pips
      const total = META_UPGRADES.filter((u) => u.category === cat).length
      for (let tier = 1; tier <= total; tier++) {
        const px = -60 + (tier - 1) * 26
        const pip = scene.add.graphics()
        if (tier <= owned) {
          pip.fillStyle(COLORS.cyan, 1)
        } else {
          pip.fillStyle(COLORS.panel, 1)
          pip.lineStyle(1, COLORS.panelLight, 1)
        }
        pip.fillRoundedRect(px, y - 8, 18, 16, 4)
        if (tier > owned) pip.strokeRoundedRect(px, y - 8, 18, 16, 4)
        rows.add(pip)
      }

      if (next) {
        const afford = SaveManager.data.energy >= next.cost
        const btn = makeButton(
          scene,
          360,
          y,
          `${t('meta.buy')}\n⚡ ${next.cost}`,
          () => {
            if (buyMetaTier(cat)) {
              AudioManager.reward()
              refresh()
            }
          },
          { width: 150, height: 66, fontSize: 17, color: afford ? COLORS.cyan : COLORS.panelLight, disabled: !afford }
        )
        rows.add(btn)
      } else {
        rows.add(makeText(scene, 360, y, t('meta.max'), 20, CSS.gold))
      }
    })

    energyText.setText(`⚡ ${SaveManager.data.energy}`)
  }

  const rows = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
  root.add(rows)

  const energyText = scene.add
    .text(GAME_WIDTH / 2 + 380, GAME_HEIGHT / 2 - 264, '', {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: CSS.gold,
    })
    .setOrigin(1, 0.5)
  root.add(energyText)

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
