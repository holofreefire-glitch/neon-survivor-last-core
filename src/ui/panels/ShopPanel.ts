import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS, CSS, FONT } from '../../config/GameConfig'
import { PRODUCTS } from '../../config/Balance'
import { SaveManager } from '../../core/SaveManager'
import { YandexSDK, YProduct } from '../../yandex/YandexSDK'
import { t } from '../../i18n/i18n'
import { makeButton, makePanel, makeDim, makeTitle, makeText } from '../UiFactory'
import { AudioManager } from '../../core/AudioManager'

function grantProduct(productId: string): void {
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
  void SaveManager.flush()
}

/** In-app purchase shop (Yandex Payments). */
export function openShopPanel(scene: Phaser.Scene, onClose: () => void): void {
  const root = scene.add.container(0, 0).setDepth(500)
  root.add(makeDim(scene))
  root.add(makePanel(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, 960, 580, COLORS.violet))
  root.add(makeTitle(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 244, t('shop.title'), 32, CSS.violet))
  root.add(
    makeText(scene, GAME_WIDTH / 2 + 360, GAME_HEIGHT / 2 - 244, `💎 ${SaveManager.data.crystals}`, 22, CSS.magenta).setOrigin(1, 0.5)
  )

  const statusText = makeText(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 196, '', 18, CSS.gold)
  root.add(statusText)

  // Load real catalog prices when available
  let catalog: YProduct[] = []
  void YandexSDK.getCatalog().then((c) => {
    catalog = c
    if (root.active) render()
  })

  const cards = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
  root.add(cards)

  const owned = (id: string): boolean => {
    if (id === 'starter_pack') return SaveManager.data.starterSkin
    if (id === 'premium_core') return SaveManager.data.premiumCore
    return false
  }

  const render = (): void => {
    cards.removeAll(true)
    const cardW = 280
    const gap = 30
    PRODUCTS.forEach((p, i) => {
      const x = -((cardW + gap) * 3 - gap) / 2 + cardW / 2 + i * (cardW + gap)
      const y = -20
      const isOwned = owned(p.id)
      const card = makePanel(scene, x, y, cardW, 340, p.id === 'premium_core' ? COLORS.gold : COLORS.violet)

      const icon = scene.add
        .image(0, -100, p.id === 'energy_pack' ? 'icon_energy' : p.id === 'starter_pack' ? 'icon_crystal' : 'player_core')
        .setDisplaySize(86, 86)
      const name = scene.add
        .text(0, -30, t(`shop.${p.id}.name`), { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: CSS.white, align: 'center' })
        .setOrigin(0.5)
      const desc = scene.add
        .text(0, 20, t(`shop.${p.id}.desc`), {
          fontFamily: FONT,
          fontSize: '16px',
          color: CSS.dim,
          align: 'center',
          wordWrap: { width: cardW - 36 },
        })
        .setOrigin(0.5)
      card.add([icon, name, desc])

      const catalogItem = catalog.find((c) => c.id === p.id)
      const priceLabel = catalogItem ? `${catalogItem.price}` : `${p.price} YAN`

      if (isOwned) {
        card.add(makeText(scene, 0, 110, t('shop.owned'), 20, CSS.gold))
      } else {
        const btn = makeButton(
          scene,
          0,
          110,
          `${t('shop.buy')} · ${priceLabel}`,
          () => {
            void YandexSDK.purchase(p.id).then((ok) => {
              if (ok) {
                grantProduct(p.id)
                AudioManager.reward()
                statusText.setText(t('shop.success'))
              } else if (!YandexSDK.available) {
                statusText.setText(t('shop.error'))
              } else {
                statusText.setText(t('shop.error'))
              }
              if (root.active) render()
            })
          },
          { width: 230, height: 56, fontSize: 18, color: COLORS.gold, textColor: CSS.gold }
        )
        card.add(btn)
      }
      cards.add(card)
    })
  }

  root.add(
    makeButton(
      scene,
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 248,
      t('common.back'),
      () => {
        root.destroy()
        onClose()
      },
      { width: 260, color: COLORS.panelLight, textColor: CSS.dim }
    )
  )

  render()
}
