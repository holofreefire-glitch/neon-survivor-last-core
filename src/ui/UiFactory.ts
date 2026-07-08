import Phaser from 'phaser'
import { COLORS, CSS, FONT } from '../config/GameConfig'
import { AudioManager } from '../core/AudioManager'

export interface ButtonOptions {
  width?: number
  height?: number
  fontSize?: number
  color?: number
  textColor?: string
  disabled?: boolean
}

/** Neon-styled rounded button. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {}
): Phaser.GameObjects.Container {
  const w = opts.width ?? 260
  const h = opts.height ?? 64
  const color = opts.color ?? COLORS.cyan
  const g = scene.add.graphics()
  g.fillStyle(COLORS.panel, 0.92)
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 14)
  g.lineStyle(2, color, opts.disabled ? 0.25 : 0.9)
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14)

  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 24}px`,
      fontStyle: 'bold',
      color: opts.disabled ? CSS.dim : (opts.textColor ?? CSS.white),
      align: 'center',
    })
    .setOrigin(0.5)

  const container = scene.add.container(x, y, [g, txt])
  container.setSize(w, h)
  if (!opts.disabled) {
    container.setInteractive({ useHandCursor: true })
    container.on('pointerover', () => container.setScale(1.04))
    container.on('pointerout', () => container.setScale(1))
    container.on('pointerdown', () => container.setScale(0.96))
    container.on('pointerup', () => {
      container.setScale(1)
      AudioManager.uiClick()
      onClick()
    })
  }
  return container
}

/** Panel background with neon border. */
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: number = COLORS.cyan
): Phaser.GameObjects.Container {
  const g = scene.add.graphics()
  g.fillStyle(COLORS.panel, 0.96)
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 20)
  g.lineStyle(2, borderColor, 0.7)
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 20)
  const container = scene.add.container(x, y, [g])
  container.setSize(w, h)
  return container
}

/** Full-screen dim behind modals; blocks input to the scene below. */
export function makeDim(scene: Phaser.Scene, alpha = 0.72): Phaser.GameObjects.Rectangle {
  const cam = scene.cameras.main
  const r = scene.add
    .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, alpha)
    .setInteractive() // swallow clicks
  return r
}

export function makeTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 34,
  color: string = CSS.cyan
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      align: 'center',
    })
    .setOrigin(0.5)
    .setShadow(0, 0, color, 12, true, true)
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 18,
  color: string = CSS.white
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      align: 'center',
    })
    .setOrigin(0.5)
}

/** Small icon + value chip (energy / crystals HUD). */
export function makeCurrencyChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: string,
  value: string
): { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text } {
  const g = scene.add.graphics()
  g.fillStyle(COLORS.panel, 0.85)
  g.fillRoundedRect(-64, -20, 128, 40, 20)
  g.lineStyle(1.5, COLORS.panelLight, 1)
  g.strokeRoundedRect(-64, -20, 128, 40, 20)
  const img = scene.add.image(-40, 0, icon).setDisplaySize(30, 30)
  const text = scene.add
    .text(8, 0, value, {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: CSS.white,
    })
    .setOrigin(0.5)
  const container = scene.add.container(x, y, [g, img, text])
  container.setSize(128, 40)
  return { container, text }
}
