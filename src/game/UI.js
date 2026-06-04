import { formatTime } from './RecordStore.js'

export class UI {
  constructor({ onStart, onRestart, onResetRecords }) {
    this.onStart = onStart
    this.onRestart = onRestart
    this.onResetRecords = onResetRecords

    this.root = document.createElement('div')
    this.root.id = 'ui'
    document.body.appendChild(this.root)

    this.root.innerHTML = `
      <div class="hud hidden" data-hud>
        <div class="hud-card wide">
          <span class="label">PLAYER</span>
          <strong data-player-name>PLAYER</strong>
        </div>
        <div class="hud-card">
          <span class="label">MAPS LEFT</span>
          <strong data-maps-left>15</strong>
        </div>
        <div class="hud-card">
          <span class="label">RUN TIME</span>
          <strong data-run-time>00:00.00</strong>
        </div>
        <div class="hud-card">
          <span class="label">MAP TIME</span>
          <strong data-map-time>00:00.00</strong>
        </div>
        <div class="hud-card wide">
          <span class="label">HP</span>
          <div class="hp" data-hp></div>
        </div>
        <div class="hud-card meter">
          <span class="label">ECHO</span>
          <strong data-echo-status>RECORDING</strong>
        </div>
        <div class="hud-card">
          <span class="label">DELAY</span>
          <strong data-echo-delay>2.5s</strong>
        </div>
        <div class="hud-card">
          <span class="label">HITS</span>
          <strong data-hit-count>0</strong>
        </div>
      </div>

      <section class="screen" data-start-screen>
        <div class="panel">
          <p class="eyebrow">2.5D ECHO PLATFORMER</p>
          <h1>TIME ECHO RUNNER</h1>
          <p class="summary">
            A 2D sprite runner inside ASCII-built 3D test chambers.
            Your echo repeats what you did 2.5 seconds ago. Use it to hold buttons,
            open doors, and land follow-up attacks.
          </p>
          <label class="name-field">
            <span>Runner name</span>
            <input data-name-input maxlength="12" value="PLAYER" autocomplete="off" />
          </label>
          <div class="controls">
            <span>A/D Move</span>
            <span>Space Jump</span>
            <span>Shift Roll</span>
            <span>Ctrl/S Roll</span>
            <span>J Attack</span>
            <span>R Restart</span>
          </div>
          <div class="actions">
            <button data-start>Start Run</button>
            <button class="ghost" data-reset-records>Reset Records</button>
          </div>
        </div>
      </section>

      <section class="screen hidden" data-end-screen>
        <div class="panel">
          <p class="eyebrow">RUN COMPLETE</p>
          <h1>ALL CHAMBERS CLEARED</h1>
          <div class="result-grid">
            <div>
              <span class="label">RUNNER</span>
              <strong data-final-name>PLAYER</strong>
            </div>
            <div>
              <span class="label">TOTAL</span>
              <strong data-final-time>00:00.00</strong>
            </div>
            <div>
              <span class="label">BEST TOTAL</span>
              <strong data-final-best>--:--.--</strong>
            </div>
          </div>
          <ol class="records" data-records></ol>
          <div class="actions">
            <button data-restart>Run Again</button>
          </div>
        </div>
      </section>
    `

    this.hud = this.root.querySelector('[data-hud]')
    this.startScreen = this.root.querySelector('[data-start-screen]')
    this.endScreen = this.root.querySelector('[data-end-screen]')
    this.nameInput = this.root.querySelector('[data-name-input]')
    this.playerName = this.root.querySelector('[data-player-name]')
    this.mapsLeft = this.root.querySelector('[data-maps-left]')
    this.runTime = this.root.querySelector('[data-run-time]')
    this.mapTime = this.root.querySelector('[data-map-time]')
    this.hp = this.root.querySelector('[data-hp]')
    this.echoStatus = this.root.querySelector('[data-echo-status]')
    this.echoDelay = this.root.querySelector('[data-echo-delay]')
    this.hitCount = this.root.querySelector('[data-hit-count]')
    this.finalName = this.root.querySelector('[data-final-name]')
    this.finalTime = this.root.querySelector('[data-final-time]')
    this.finalBest = this.root.querySelector('[data-final-best]')
    this.records = this.root.querySelector('[data-records]')

    this.root.querySelector('[data-start]').addEventListener('click', () => {
      this.onStart(this.getPlayerName())
    })
    this.root.querySelector('[data-restart]').addEventListener('click', () => {
      this.onRestart(this.getPlayerName())
    })
    this.root
      .querySelector('[data-reset-records]')
      .addEventListener('click', () => this.onResetRecords())

    this.nameInput.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.code === 'Enter') this.onStart(this.getPlayerName())
    })
  }

  getPlayerName() {
    const name = this.nameInput.value.trim().slice(0, 12)
    return name || 'PLAYER'
  }

  showStart() {
    this.hud.classList.add('hidden')
    this.startScreen.classList.remove('hidden')
    this.endScreen.classList.add('hidden')
  }

  showPlaying(playerName) {
    this.hud.classList.remove('hidden')
    this.startScreen.classList.add('hidden')
    this.endScreen.classList.add('hidden')
    this.playerName.textContent = playerName
  }

  showEnd({ playerName, totalTime, totalBest, levels }) {
    this.hud.classList.add('hidden')
    this.startScreen.classList.add('hidden')
    this.endScreen.classList.remove('hidden')
    this.finalName.textContent = playerName
    this.finalTime.textContent = formatTime(totalTime)
    this.finalBest.textContent = formatRecord(totalBest)
    this.records.innerHTML = levels
      .map(
        (level) => `
          <li>
            <span>${level.id}. ${level.name}</span>
            <strong>${formatRecord(level.best)}</strong>
          </li>
        `,
      )
      .join('')
  }

  updateHud({ playerName, mapsLeft, runTime, mapTime, hp, maxHp, echoStatus, echoDelay, hitCount }) {
    this.playerName.textContent = playerName
    this.mapsLeft.textContent = String(mapsLeft)
    this.runTime.textContent = formatTime(runTime)
    this.mapTime.textContent = formatTime(mapTime)
    this.echoStatus.textContent = echoStatus
    this.echoDelay.textContent = `${echoDelay.toFixed(1)}s`
    this.hitCount.textContent = String(hitCount)
    this._renderHp(hp, maxHp)
  }

  _renderHp(hp, maxHp) {
    const ratio = maxHp <= 0 ? 0 : hp / maxHp
    const tone = ratio > 0.66 ? 'high' : ratio > 0.33 ? 'mid' : 'low'

    this.hp.className = `hp ${tone}`
    this.hp.innerHTML = Array.from({ length: maxHp }, (_, index) => {
      const filled = index < hp ? 'filled' : ''
      return `<i class="${filled}"></i>`
    }).join('')
  }
}

function formatRecord(record) {
  if (!record) return '--:--.--'
  return `${formatTime(record.time)} ${record.name} ${record.hits ?? 0}H`
}
