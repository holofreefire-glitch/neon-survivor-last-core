import Phaser from 'phaser'

/** Global event bus decoupling systems from scenes. */
export const EventBus = new Phaser.Events.EventEmitter()

export const Events = {
  EnergyChanged: 'energy-changed',
  CurrencyChanged: 'currency-changed',
  AccountLevelUp: 'account-level-up',
  SaveRequested: 'save-requested',
  GamePaused: 'game-paused',
  GameResumed: 'game-resumed',
  LocaleChanged: 'locale-changed',
} as const
