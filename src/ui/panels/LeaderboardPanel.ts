import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, FONT, LEADERBOARD_NAME } from '../../config/GameConfig'
import { YandexSDK } from '../../yandex/YandexSDK'
import { t } from '../../i18n/i18n'
import { makeButton, makePanel, makeDim, makeTitle, makeText } from '../UiFactory'

/** Leaderboard modal fed by Yandex Games leaderboards. */
export function openLeaderboardPanel(scene: Phaser.Scene, onClose: () => void): void {
  const root = scene.add.container(0, 0).setDepth(500)
  root.add(makeDim(scene))
  root.add(makePanel(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 620, COLORS.gold))
  root.add(makeTitle(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 264, t('lb.title'), 32, CSS.gold))

  const list = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
  root.add(list)
  const loading = makeText(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, t('common.loading'), 20, CSS.dim)
  root.add(loading)

  void YandexSDK.getLeaderboard(LEADERBOARD_NAME).then((entries) => {
    if (!root.active) return
    loading.destroy()
    if (entries.length === 0) {
      list.add(
        scene.add
          .text(0, 0, YandexSDK.available ? t('lb.empty') : t('lb.auth'), {
            fontFamily: FONT,
            fontSize: '20px',
            color: CSS.dim,
            align: 'center',
            wordWrap: { width: 560 },
          })
          .setOrigin(0.5)
      )
      return
    }
    entries.slice(0, 10).forEach((e, i) => {
      const y = -190 + i * 44
      const isYou = e.isPlayer
      const rowBg = scene.add.graphics()
      rowBg.fillStyle(isYou ? COLORS.panelLight : COLORS.panel, isYou ? 0.9 : 0.5)
      rowBg.fillRoundedRect(-320, y - 18, 640, 38, 10)
      if (isYou) {
        rowBg.lineStyle(1.5, COLORS.gold, 0.9)
        rowBg.strokeRoundedRect(-320, y - 18, 640, 38, 10)
      }
      const rankColor = e.rank === 1 ? CSS.gold : e.rank === 2 ? CSS.white : e.rank === 3 ? '#d08a4a' : CSS.dim
      const rank = scene.add
        .text(-292, y, `#${e.rank}`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: rankColor })
        .setOrigin(0, 0.5)
      const name = scene.add
        .text(-210, y, isYou ? `${e.name} (${t('lb.you')})` : e.name, {
          fontFamily: FONT,
          fontSize: '18px',
          color: isYou ? CSS.gold : CSS.white,
        })
        .setOrigin(0, 0.5)
      const score = scene.add
        .text(292, y, String(e.score), { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: CSS.cyan })
        .setOrigin(1, 0.5)
      list.add([rowBg, rank, name, score])
    })
  })

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
}
