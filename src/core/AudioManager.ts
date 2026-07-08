import { SaveManager } from './SaveManager'

/**
 * Procedural WebAudio sound engine - zero audio assets, tiny footprint.
 * Generates synthwave-style music and sound effects at runtime.
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private musicTimer: ReturnType<typeof setInterval> | null = null
  private musicStep = 0
  private adMuted = false
  private unlocked = false

  /** Must be called after a user gesture. */
  unlock(): void {
    if (this.unlocked) return
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.16
      this.musicGain.connect(this.masterGain)
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = 0.3
      this.sfxGain.connect(this.masterGain)
      this.unlocked = true
      this.applySettings()
      this.startMusic()
    } catch {
      /* audio unavailable */
    }
  }

  applySettings(): void {
    if (!this.musicGain || !this.sfxGain) return
    this.musicGain.gain.value = SaveManager.data.musicOn && !this.adMuted ? 0.16 : 0
    this.sfxGain.gain.value = SaveManager.data.soundOn && !this.adMuted ? 0.3 : 0
  }

  muteForAd(muted: boolean): void {
    this.adMuted = muted
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 1
    if (muted) {
      void this.ctx?.suspend()
    } else {
      void this.ctx?.resume()
    }
  }

  pauseAll(paused: boolean): void {
    if (paused) {
      void this.ctx?.suspend()
    } else if (!this.adMuted) {
      void this.ctx?.resume()
    }
  }

  /* ---------------- Music: generative synthwave loop ---------------- */

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return
    const bpm = 110
    const stepMs = (60_000 / bpm) / 2 // 8th notes
    // A minor pentatonic-ish bass progression
    const bassNotes = [55, 55, 65.4, 65.4, 49, 49, 58.3, 61.7]
    const arpNotes = [220, 261.6, 329.6, 440, 329.6, 261.6, 246.9, 220]

    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicGain) return
      if (this.ctx.state !== 'running') return
      const t = this.ctx.currentTime
      const bar = Math.floor(this.musicStep / 8) % 4
      const step = this.musicStep % 8

      // Bass
      if (step % 2 === 0) {
        this.tone(bassNotes[(step + bar * 2) % 8], t, stepMs * 0.9 / 1000, 'sawtooth', 0.5, this.musicGain, 300)
      }
      // Arp
      this.tone(arpNotes[(step + bar) % 8] * (bar === 3 ? 1.5 : 1), t, stepMs * 0.55 / 1000, 'square', 0.14, this.musicGain, 2200)
      // Kick every 4 steps
      if (step % 4 === 0) this.kick(t)
      // Hat off-beats
      if (step % 2 === 1) this.hat(t)

      this.musicStep++
    }, stepMs)
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
    filterFreq = 4000
  ): void {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  private kick(when: number): void {
    if (!this.ctx || !this.musicGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.frequency.setValueAtTime(120, when)
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.12)
    gain.gain.setValueAtTime(0.6, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.14)
    osc.connect(gain)
    gain.connect(this.musicGain)
    osc.start(when)
    osc.stop(when + 0.16)
  }

  private hat(when: number): void {
    if (!this.ctx || !this.musicGain) return
    const buf = this.noiseBuffer(0.04)
    if (!buf) return
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 7000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.12, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.musicGain)
    src.start(when)
  }

  private noiseCache: AudioBuffer | null = null
  private noiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null
    if (this.noiseCache && this.noiseCache.duration >= seconds) return this.noiseCache
    const len = Math.ceil(this.ctx.sampleRate * Math.max(seconds, 0.3))
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseCache = buf
    return buf
  }

  /* ---------------- SFX ---------------- */

  private sfx(fn: (t: number, dest: AudioNode) => void): void {
    if (!this.ctx || !this.sfxGain || !SaveManager.data.soundOn || this.adMuted) return
    if (this.ctx.state !== 'running') return
    fn(this.ctx.currentTime, this.sfxGain)
  }

  shoot(): void {
    this.sfx((t, d) => this.tone(880, t, 0.06, 'square', 0.06, d, 3000))
  }

  hit(): void {
    this.sfx((t, d) => this.tone(160, t, 0.08, 'sawtooth', 0.12, d, 900))
  }

  enemyDie(): void {
    this.sfx((t, d) => {
      this.tone(520, t, 0.05, 'square', 0.1, d)
      this.tone(260, t + 0.04, 0.08, 'square', 0.08, d)
    })
  }

  pickup(): void {
    this.sfx((t, d) => {
      this.tone(660, t, 0.05, 'sine', 0.12, d)
      this.tone(990, t + 0.04, 0.06, 'sine', 0.1, d)
    })
  }

  levelUp(): void {
    this.sfx((t, d) => {
      this.tone(440, t, 0.1, 'triangle', 0.2, d)
      this.tone(554, t + 0.09, 0.1, 'triangle', 0.2, d)
      this.tone(659, t + 0.18, 0.16, 'triangle', 0.22, d)
    })
  }

  playerHurt(): void {
    this.sfx((t, d) => {
      this.tone(220, t, 0.1, 'sawtooth', 0.2, d, 700)
      this.tone(110, t + 0.06, 0.14, 'sawtooth', 0.16, d, 500)
    })
  }

  bossSpawn(): void {
    this.sfx((t, d) => {
      this.tone(82, t, 0.4, 'sawtooth', 0.3, d, 400)
      this.tone(78, t + 0.2, 0.5, 'sawtooth', 0.3, d, 350)
    })
  }

  uiClick(): void {
    this.sfx((t, d) => this.tone(700, t, 0.04, 'sine', 0.12, d))
  }

  reward(): void {
    this.sfx((t, d) => {
      this.tone(523, t, 0.09, 'sine', 0.16, d)
      this.tone(659, t + 0.08, 0.09, 'sine', 0.16, d)
      this.tone(784, t + 0.16, 0.09, 'sine', 0.16, d)
      this.tone(1047, t + 0.24, 0.18, 'sine', 0.18, d)
    })
  }

  gameOver(): void {
    this.sfx((t, d) => {
      this.tone(330, t, 0.16, 'triangle', 0.2, d)
      this.tone(262, t + 0.15, 0.16, 'triangle', 0.2, d)
      this.tone(196, t + 0.3, 0.3, 'triangle', 0.22, d)
    })
  }
}

export const AudioManager = new AudioManagerImpl()
