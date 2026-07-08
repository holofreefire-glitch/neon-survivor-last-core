import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config/GameConfig'
import { BootScene } from './scenes/BootScene'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { GameOverScene } from './scenes/GameOverScene'
import { SaveManager } from './core/SaveManager'
import { AudioManager } from './core/AudioManager'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: COLORS.bg,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
})

// Flush the save when the tab is hidden/closed (Yandex requirement: no data loss).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void SaveManager.flush()
    game.sound.pauseAll()
    AudioManager.pauseAll(true)
  } else {
    game.sound.resumeAll()
    AudioManager.pauseAll(false)
  }
})
window.addEventListener('pagehide', () => {
  void SaveManager.flush()
})
