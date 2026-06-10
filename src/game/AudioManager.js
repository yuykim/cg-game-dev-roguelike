// 합성 사운드 매니저. 외부 오디오 파일 없이 Web Audio API로 효과음을 즉석 생성한다.
// 브라우저 정책상 첫 사용자 입력 전까지 AudioContext가 잠겨 있으므로 unlock()으로 깨운다.
// public/sound/ 에 놓인 실제 효과음 샘플. 핵심 타격/발사/스킬음에 사용한다.
const SAMPLE_URLS = {
  punch: '/sound/punch.mp3',
  laser: '/sound/laser.mp3',
  skill: '/sound/skill.mp3',
}

export class AudioManager {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
    this._unlocked = false
    this._buffers = {}
    this._buffersLoading = false
  }

  _ensure() {
    if (this.ctx) return this.ctx

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) {
      this.enabled = false
      return null
    }

    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.6
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  // 첫 키 입력/클릭 시 호출해 오디오 컨텍스트를 활성화하고 샘플을 로드한다.
  unlock() {
    const ctx = this._ensure()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    this._unlocked = true
    this._loadSamples()
  }

  async _loadSamples() {
    if (this._buffersLoading || !this.ctx) return
    this._buffersLoading = true

    await Promise.all(
      Object.entries(SAMPLE_URLS).map(async ([name, url]) => {
        try {
          const res = await fetch(url)
          const data = await res.arrayBuffer()
          this._buffers[name] = await this.ctx.decodeAudioData(data)
        } catch {
          // 샘플 로드 실패 시 합성 사운드로 대체된다.
        }
      }),
    )
  }

  // 디코딩된 샘플 재생. rate로 음정, gain으로 볼륨 조절.
  _playSample(name, { gain = 0.8, rate = 1, offset = 0 } = {}) {
    if (!this.enabled) return false
    const ctx = this._ensure()
    if (!ctx || ctx.state !== 'running') return false

    const buffer = this._buffers[name]
    if (!buffer) return false

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate

    const env = ctx.createGain()
    env.gain.value = gain

    src.connect(env)
    env.connect(this.master)
    src.start(this._now(), offset)
    return true
  }

  setEnabled(value) {
    this.enabled = value
    if (this.master) this.master.gain.value = value ? 0.6 : 0
  }

  _now() {
    return this.ctx.currentTime
  }

  // 단일 오실레이터 톤. 주파수 글라이드 + 게인 엔벨로프.
  _tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.12, gain = 0.3, attack = 0.004, decay = null, detune = 0 }) {
    if (!this.enabled) return
    const ctx = this._ensure()
    if (!ctx || ctx.state !== 'running') return

    const t = this._now()
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (detune) osc.detune.setValueAtTime(detune, t)
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur)

    const peak = gain
    const rel = decay ?? dur
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, t + rel)

    osc.connect(env)
    env.connect(this.master)
    osc.start(t)
    osc.stop(t + rel + 0.02)
  }

  // 짧은 노이즈 버스트 (타격/착지/임팩트의 '퍽' 감).
  _noise({ dur = 0.12, gain = 0.3, type = 'lowpass', freq = 1200, freqEnd = null }) {
    if (!this.enabled) return
    const ctx = this._ensure()
    if (!ctx || ctx.state !== 'running') return

    const t = this._now()
    const frames = Math.floor(ctx.sampleRate * dur)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, t)
    if (freqEnd != null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  // --- 게임 이벤트별 효과음 ---

  hit(intensity = 1) {
    const i = Math.min(2, Math.max(0.6, intensity))
    if (this._playSample('punch', { gain: 0.5 * i, rate: 1.05 + (i - 1) * 0.12 })) return

    this._noise({ dur: 0.07 * i, gain: 0.22 * i, freq: 2600, freqEnd: 500 })
    this._tone({ type: 'square', freq: 180, freqEnd: 70, dur: 0.09 * i, gain: 0.16 * i })
  }

  heavyHit(intensity = 1.4) {
    const i = Math.min(2.2, intensity)
    if (this._playSample('punch', { gain: 0.75, rate: 0.82 })) {
      this._tone({ type: 'sine', freq: 80, freqEnd: 38, dur: 0.22, gain: 0.2 })
      return
    }

    this._noise({ dur: 0.12 * i, gain: 0.3, freq: 1800, freqEnd: 220 })
    this._tone({ type: 'sawtooth', freq: 150, freqEnd: 48, dur: 0.16 * i, gain: 0.24 })
    this._tone({ type: 'sine', freq: 90, freqEnd: 40, dur: 0.2, gain: 0.2 })
  }

  jump() {
    this._tone({ type: 'square', freq: 320, freqEnd: 620, dur: 0.12, gain: 0.12 })
  }

  land(impact = 0.5) {
    this._noise({ dur: 0.09, gain: 0.1 + impact * 0.16, freq: 900, freqEnd: 160 })
  }

  roll() {
    this._noise({ dur: 0.14, gain: 0.12, type: 'bandpass', freq: 1400, freqEnd: 400 })
  }

  bolt() {
    if (this._playSample('laser', { gain: 0.55, rate: 1.0 })) return

    this._tone({ type: 'triangle', freq: 880, freqEnd: 1500, dur: 0.16, gain: 0.16 })
    this._tone({ type: 'sine', freq: 440, freqEnd: 760, dur: 0.14, gain: 0.1 })
  }

  shock() {
    if (this._playSample('skill', { gain: 0.6, rate: 0.92 })) {
      this._tone({ type: 'sawtooth', freq: 90, freqEnd: 40, dur: 0.22, gain: 0.18 })
      return
    }

    this._tone({ type: 'sawtooth', freq: 110, freqEnd: 540, dur: 0.26, gain: 0.22 })
    this._noise({ dur: 0.24, gain: 0.2, freq: 2400, freqEnd: 300 })
  }

  // 공중 아래찍기 착지 폭발음
  slam() {
    this._tone({ type: 'sawtooth', freq: 220, freqEnd: 36, dur: 0.3, gain: 0.3 })
    this._noise({ dur: 0.26, gain: 0.32, freq: 1600, freqEnd: 120 })
    this._tone({ type: 'sine', freq: 70, freqEnd: 32, dur: 0.34, gain: 0.26 })
  }

  // 시프트 헤비 스매시 (런처)
  smash() {
    if (this._playSample('punch', { gain: 0.8, rate: 0.7 })) {
      this._tone({ type: 'sine', freq: 90, freqEnd: 40, dur: 0.2, gain: 0.2 })
      return
    }

    this._tone({ type: 'square', freq: 240, freqEnd: 90, dur: 0.18, gain: 0.22 })
    this._noise({ dur: 0.14, gain: 0.24, freq: 2200, freqEnd: 300 })
  }

  damage(amount = 1) {
    this._tone({ type: 'sawtooth', freq: 300, freqEnd: 90, dur: 0.18, gain: 0.2 + amount * 0.03 })
    this._noise({ dur: 0.1, gain: 0.18, freq: 1200, freqEnd: 200 })
  }

  death() {
    this._tone({ type: 'sawtooth', freq: 260, freqEnd: 40, dur: 0.6, gain: 0.3 })
    this._tone({ type: 'square', freq: 130, freqEnd: 30, dur: 0.7, gain: 0.2 })
  }

  unlockJingle() {
    if (this._playSample('skill', { gain: 0.7 })) return

    this._tone({ type: 'triangle', freq: 520, dur: 0.1, gain: 0.16 })
    this._tone({ type: 'triangle', freq: 660, dur: 0.12, gain: 0.16, attack: 0.06 })
    this._tone({ type: 'triangle', freq: 880, dur: 0.18, gain: 0.16, attack: 0.12 })
  }

  waveClear() {
    this._tone({ type: 'sine', freq: 600, freqEnd: 900, dur: 0.16, gain: 0.16 })
  }

  uiClick() {
    this._tone({ type: 'square', freq: 440, freqEnd: 660, dur: 0.07, gain: 0.12 })
  }

  enemyShoot() {
    this._tone({ type: 'sawtooth', freq: 420, freqEnd: 200, dur: 0.12, gain: 0.09 })
  }

  enemyAttack() {
    this._noise({ dur: 0.1, gain: 0.12, freq: 800, freqEnd: 200 })
  }
}
