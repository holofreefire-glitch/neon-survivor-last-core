# Neon Survivor: Last Core

Production-ready HTML5 roguelite survival game for **Yandex Games**, built with Phaser 3, TypeScript, and Vite.

You are the last energy core. Auto-fire at endless waves of digital creatures, collect energy orbs, level up, and pick from randomized upgrades mid-run. Survive as long as you can, defeat bosses every 5 waves, and climb the leaderboard.

## Features

### Gameplay
- **Auto-firing survival combat** — move with WASD / arrows / touch drag, aiming is automatic
- **10 enemy types + 5 unique bosses** (a boss every 5 waves, endless scaling)
- **12 in-run upgrades** — multishot, pierce, crit, orbital drones, regen, magnet, and more (each with 5 levels)
- **In-run leveling** — collect energy orbs, pick 1 of 3 randomized upgrade cards
- **Two stage backgrounds** that alternate as waves progress

### Meta progression
- **5 permanent upgrade tracks** (damage, speed, defense, abilities, energy) purchased with Energy
- **Energy system** — runs cost energy; it regenerates over time (server-time based, cheat-resistant)
- **Daily rewards** — 7-day streak calendar with escalating rewards
- **Missions** — daily tasks (kills, waves, bosses) with crystal rewards
- **Crystal shop** — premium currency for energy refills, revives, and permanent boosts

### Yandex Games integration (`src/yandex/YandexSDK.ts`)
- Cloud saves via player data (falls back to localStorage outside the platform)
- Rewarded ads (revive, bonus rewards) and interstitials (between runs, rate-limited)
- Leaderboard (`neonsurvivor_score`)
- In-app purchases (crystal packs)
- Server time for energy/daily-reward calculations
- `LoadingAPI.ready()` signal, RU/EN auto-detection from SDK environment
- Graceful degradation: everything works in dev/preview without the SDK

### Localization
- Full **Russian + English** support (`src/i18n/`), auto-detected from the Yandex SDK or browser

### Audio
- Fully synthesized WebAudio SFX + ambient music (`src/core/AudioManager.ts`) — zero audio file downloads

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build to dist/
npm run check    # typecheck
```

## Project structure

```
src/
  main.ts               # Phaser game bootstrap
  config/               # Game constants + all balance data (enemies, waves, upgrades, economy)
  core/                 # SaveManager, AudioManager, AdManager, EventBus, stats
  i18n/                 # RU/EN localization
  scenes/               # Boot, Menu, Game, GameOver
  ui/                   # UI factory + menu panels (upgrades, shop, daily, missions, leaderboard)
  yandex/               # Yandex Games SDK wrapper (safe fallbacks outside the platform)
tools/
  process-assets.mjs    # Trims/resizes raw AI art into optimized sprites
public/assets/images/   # Optimized game art (~4MB)
```

## Publishing to Yandex Games

1. `npm run build`
2. Zip the contents of `dist/`
3. Upload to the [Yandex Games developer console](https://games.yandex.ru/console/)
4. The game already calls `YaGames.init()`, `LoadingAPI.ready()`, and handles ads/purchases/leaderboards per Yandex requirements
