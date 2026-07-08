import { en } from './locales/en'
import { ru } from './locales/ru'
import { EventBus, Events } from '../core/EventBus'

export type Lang = 'ru' | 'en'

const LOCALES: Record<Lang, Record<string, string>> = { ru, en }

let current: Lang = 'ru'

export function setLang(lang: Lang): void {
  if (lang !== current) {
    current = lang
    EventBus.emit(Events.LocaleChanged, lang)
  }
}

export function getLang(): Lang {
  return current
}

/** Detect language from Yandex SDK environment value ("ru", "en", ...). */
export function detectLang(sdkLang: string | undefined): Lang {
  const l = (sdkLang || '').toLowerCase()
  // Russian is shown for RU / BY / KZ / UK and similar CIS locales.
  const cis = ['ru', 'be', 'kk', 'uk', 'uz', 'ky', 'hy', 'az', 'tg']
  return cis.includes(l) ? 'ru' : 'en'
}

/** Translate a key with {placeholder} substitution. */
export function t(key: string, params?: Record<string, string | number>): string {
  let str = LOCALES[current][key] ?? LOCALES.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v))
    }
  }
  return str
}
