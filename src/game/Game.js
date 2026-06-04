import * as THREE from 'three'
import { InputManager } from './InputManager.js'
import { Player, overlaps } from './Player.js'
import { Camera } from './Camera.js'
import { LEVELS } from './levels.js'
import { buildLevel } from './LevelBuilder.js'
import { RecordStore } from './RecordStore.js'
import { UI } from './UI.js'

const MAX_REWIND_SECONDS = 5
const REWIND_REFILL_RATE = 0.55

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    document.body.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d0d14)
    this.scene.fog = new THREE.Fog(0x0d0d14, 20, 60)

    this.threeCamera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    )
    this.followCamera = new Camera(this.threeCamera)

    this._setupLights()
    this._setupBackground()

    this.input = new InputManager()
    this.records = new RecordStore()
    this.ui = new UI({
      onStart: (playerName) => this.startRun(playerName),
      onRestart: (playerName) => this.startRun(playerName),
      onResetRecords: () => {
        this.records.reset()
        this.ui.showStart()
      },
    })

    this.player = new Player(this.scene, this.input)
    this.levelObjects = null
    this.currentLevelIndex = 0
    this.playerName = 'PLAYER'
    this.state = 'start'
    this.runTime = 0
    this.levelTime = 0
    this.history = []
    this.rewindEnergy = MAX_REWIND_SECONDS
    this.elapsed = 0

    this._loadLevel(0)
    this.ui.showStart()

    this._lastTime = performance.now()
    window.addEventListener('resize', () => this._onResize())
  }

  start() {
    requestAnimationFrame((time) => this._loop(time))
  }

  startRun(playerName = 'PLAYER') {
    document.body.classList.remove('is-rewinding')
    this.playerName = playerName.trim().slice(0, 12) || 'PLAYER'
    this.state = 'playing'
    this.currentLevelIndex = 0
    this.runTime = 0
    this.levelTime = 0
    this.history = []
    this.rewindEnergy = MAX_REWIND_SECONDS
    this.player.hp = this.player.maxHp
    this._loadLevel(0)
    this.ui.showPlaying(this.playerName)
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55))

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 10, 8)
    this.scene.add(dir)

    const rim = new THREE.DirectionalLight(0x3366ff, 0.5)
    rim.position.set(-4, 2, -6)
    this.scene.add(rim)
  }

  _setupBackground() {
    const grid = new THREE.GridHelper(80, 80, 0x293044, 0x151a27)
    grid.rotation.x = Math.PI / 2
    grid.position.z = -1.2
    grid.position.y = 4
    this.scene.add(grid)

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(90, 24, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.32 }),
    )
    back.position.set(0, 5, -3)
    this.scene.add(back)
  }

  _loadLevel(index) {
    this._disposeLevel()

    this.currentLevelIndex = index
    const level = LEVELS[index]
    this.levelObjects = buildLevel(this.scene, level)
    this.levelTime = 0
    this.history = []
    this.rewindEnergy = MAX_REWIND_SECONDS
    this.player.setSpawn(this.levelObjects.spawn.x, this.levelObjects.spawn.y)
  }

  _disposeLevel() {
    if (!this.levelObjects) return

    for (const platform of this.levelObjects.platforms) platform.dispose()
    for (const hazard of this.levelObjects.hazards) hazard.dispose()
    this.levelObjects.exit?.dispose()
    this.levelObjects = null
  }

  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05)
    this._lastTime = timestamp
    this.elapsed += dt

    this.input.flush()

    if (this.state === 'playing') {
      this._updatePlaying(dt)
    } else {
      document.body.classList.remove('is-rewinding')
    }

    this.followCamera.update(this.player.x, this.player.y, dt)
    this.renderer.render(this.scene, this.threeCamera)
    requestAnimationFrame((time) => this._loop(time))
  }

  _updatePlaying(dt) {
    if (this.input.restart) {
      this._restartLevel()
      return
    }

    const isRewinding =
      this.input.rewind && this.history.length > 0 && this.rewindEnergy > 0

    if (isRewinding) {
      document.body.classList.add('is-rewinding')
      this.followCamera.shake(0.025, 0.05)
      this._rewind(dt)
    } else {
      document.body.classList.remove('is-rewinding')
      this._recordSnapshot()
      this._simulate(dt)
      this.rewindEnergy = Math.min(
        MAX_REWIND_SECONDS,
        this.rewindEnergy + dt * REWIND_REFILL_RATE,
      )
    }

    this._updateHud()
  }

  _simulate(dt) {
    this.runTime += dt
    this.levelTime += dt

    for (const platform of this.levelObjects.platforms) platform.update(this.elapsed)
    for (const hazard of this.levelObjects.hazards) hazard.update(this.elapsed)
    this.levelObjects.exit?.update(this.elapsed)

    this._carryPlayerWithMovingPlatforms()
    this.player.update(dt, this.levelObjects.platforms)
    this._breakWallsFromAttack()
    this._checkHazards()
    this._checkDeathPlane()
    this._checkExit()
    this._handlePlayerEvents()
  }

  _recordSnapshot() {
    this.history.push({
      player: this.player.captureSnapshot(),
      runTime: this.runTime,
      levelTime: this.levelTime,
      platforms: this.levelObjects.platforms.map((platform) => platform.captureSnapshot()),
      hazards: this.levelObjects.hazards.map((hazard) => hazard.captureSnapshot()),
    })

    const maxFrames = Math.ceil(MAX_REWIND_SECONDS * 60)
    if (this.history.length > maxFrames) this.history.shift()
  }

  _rewind(dt) {
    const snapshot = this.history.pop()
    if (!snapshot) return

    this.rewindEnergy = Math.max(0, this.rewindEnergy - dt)
    this.runTime = snapshot.runTime
    this.levelTime = snapshot.levelTime
    this.player.applySnapshot(snapshot.player)

    snapshot.platforms.forEach((platformSnapshot, index) => {
      this.levelObjects.platforms[index]?.applySnapshot(platformSnapshot)
    })
    snapshot.hazards.forEach((hazardSnapshot, index) => {
      this.levelObjects.hazards[index]?.applySnapshot(hazardSnapshot)
    })
  }

  _breakWallsFromAttack() {
    if (!this.player.isAttacking || !this.player.consumeAttackHit()) return

    for (const block of this.levelObjects.breakables) {
      if (block.destroyed) continue
      if (overlaps(this.player.attackBounds, block.bounds)) {
        block.destroy()
        this.followCamera.shake(0.16, 0.16)
        return
      }
    }
  }

  _checkHazards() {
    for (const hazard of this.levelObjects.hazards) {
      if (!hazard.active) continue
      if (!overlaps(this.player.bounds, hazard.bounds)) continue

      if (this.player.takeDamage()) {
        this._respawnAfterHit()
      }
      return
    }
  }

  _checkDeathPlane() {
    if (this.player.y > this.levelObjects.deathY) return

    this.player.takeDamage()
    this._respawnAfterHit()
  }

  _respawnAfterHit() {
    this.history = []

    if (this.player.hp <= 0) {
      this._restartLevel()
      return
    }

    this.player.resetToSpawn({ restoreHp: false })
  }

  _restartLevel() {
    this._loadLevel(this.currentLevelIndex)
  }

  _checkExit() {
    if (!this.levelObjects.exit) return
    if (!overlaps(this.player.bounds, this.levelObjects.exit.bounds)) return

    const level = LEVELS[this.currentLevelIndex]
    this.records.saveLevelBest(level.id, this.levelTime, this.playerName)

    if (this.currentLevelIndex < LEVELS.length - 1) {
      this._loadLevel(this.currentLevelIndex + 1)
      return
    }

    this._completeRun()
  }

  _completeRun() {
    document.body.classList.remove('is-rewinding')
    this.records.saveTotalBest(this.runTime, this.playerName)
    this.state = 'end'
    this.ui.showEnd({
      playerName: this.playerName,
      totalTime: this.runTime,
      totalBest: this.records.getTotalBest(),
      levels: LEVELS.map((level) => ({
        id: level.id,
        name: level.name,
        best: this.records.getLevelBest(level.id),
      })),
    })
  }

  _carryPlayerWithMovingPlatforms() {
    const playerBounds = this.player.bounds

    for (const platform of this.levelObjects.platforms) {
      if (platform.destroyed || (!platform.dx && !platform.dy)) continue

      const previousBounds = {
        left: platform.prevX - platform.w / 2,
        right: platform.prevX + platform.w / 2,
        bottom: platform.prevY - platform.h / 2,
        top: platform.prevY + platform.h / 2,
      }
      const standingOnPlatform =
        playerBounds.right > previousBounds.left &&
        playerBounds.left < previousBounds.right &&
        Math.abs(playerBounds.bottom - previousBounds.top) < 0.12 &&
        this.player.vy <= 0.1

      if (!standingOnPlatform) continue

      this.player.x += platform.dx
      this.player.y += platform.dy
      return
    }
  }

  _handlePlayerEvents() {
    for (const event of this.player.consumeEvents()) {
      if (event.type === 'roll') this.followCamera.shake(0.055, 0.1)
      if (event.type === 'jump') this.followCamera.shake(0.035, 0.08)
      if (event.type === 'wallJump') this.followCamera.shake(0.09, 0.12)
      if (event.type === 'land') this.followCamera.shake(0.05 + event.impact * 0.08, 0.12)
      if (event.type === 'attack') this.followCamera.shake(0.035, 0.08)
      if (event.type === 'damage') this.followCamera.shake(0.28, 0.22)
    }
  }

  _updateHud() {
    const level = LEVELS[this.currentLevelIndex]
    this.ui.updateHud({
      playerName: this.playerName,
      mapsLeft: LEVELS.length - this.currentLevelIndex,
      runTime: this.runTime,
      mapTime: this.levelTime,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      rewindRatio: this.rewindEnergy / MAX_REWIND_SECONDS,
    })
  }

  _onResize() {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight
    this.threeCamera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
