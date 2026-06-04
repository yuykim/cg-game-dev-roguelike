import * as THREE from 'three'
import { InputManager } from './InputManager.js'
import { Player, overlaps } from './Player.js'
import { Ghost } from './Ghost.js'
import { Camera } from './Camera.js'
import { ECHO_DELAY_SECONDS, LEVELS } from './levels.js'
import { buildLevel } from './LevelBuilder.js'
import { RecordStore } from './RecordStore.js'
import { UI } from './UI.js'

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
    this.ghost = new Ghost(this.scene)
    this.levelObjects = null
    this.currentLevelIndex = 0
    this.playerName = 'PLAYER'
    this.state = 'start'
    this.runTime = 0
    this.levelTime = 0
    this.hitCount = 0
    this.levelHitCount = 0
    this.echoBuffer = []
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
    this.playerName = playerName.trim().slice(0, 12) || 'PLAYER'
    this.state = 'playing'
    this.currentLevelIndex = 0
    this.runTime = 0
    this.levelTime = 0
    this.hitCount = 0
    this.levelHitCount = 0
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
    this.levelObjects = buildLevel(this.scene, LEVELS[index])
    this.levelTime = 0
    this.levelHitCount = 0
    this.echoBuffer = []
    this.ghost.reset()
    this.player.setSpawn(this.levelObjects.spawn.x, this.levelObjects.spawn.y)
  }

  _disposeLevel() {
    if (!this.levelObjects) return

    for (const platform of this.levelObjects.platforms) platform.dispose()
    for (const hazard of this.levelObjects.hazards) hazard.dispose()
    for (const button of this.levelObjects.buttons) button.dispose()
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

    this._simulate(dt)
    this._updateHud()
  }

  _simulate(dt) {
    this.runTime += dt
    this.levelTime += dt

    for (const platform of this.levelObjects.platforms) platform.update(this.elapsed)
    for (const hazard of this.levelObjects.hazards) hazard.update(this.elapsed)
    this.levelObjects.exit?.update(this.elapsed)

    const delayedSnapshot = this._getDelayedSnapshot()
    this.ghost.update(dt, delayedSnapshot, this.levelObjects.hazards)

    this._carryPlayerWithMovingPlatforms()
    this.player.update(dt, this.levelObjects.platforms)
    this._recordEchoSnapshot()

    this._updateButtonsAndDoors()
    this._breakWallsFromActor(this.player)
    this._breakWallsFromActor(this.ghost)
    this._checkHazards()
    this._checkDeathPlane()
    this._checkExit()
    this._handlePlayerEvents()
  }

  _recordEchoSnapshot() {
    this.echoBuffer.push({
      time: this.runTime,
      player: this.player.captureSnapshot(),
    })

    const maxAge = ECHO_DELAY_SECONDS + 0.35
    while (this.echoBuffer.length > 0 && this.runTime - this.echoBuffer[0].time > maxAge) {
      this.echoBuffer.shift()
    }
  }

  _getDelayedSnapshot() {
    const targetTime = this.runTime - ECHO_DELAY_SECONDS
    if (targetTime <= 0 || this.echoBuffer.length === 0) return null

    let best = this.echoBuffer[0]
    for (const sample of this.echoBuffer) {
      if (sample.time > targetTime) break
      best = sample
    }

    return best.player
  }

  _updateButtonsAndDoors() {
    for (const button of this.levelObjects.buttons) {
      button.update(this.player, this.ghost)
    }

    const anyPressed = this.levelObjects.buttons.some((button) => button.pressed)
    for (const door of this.levelObjects.doors) {
      door.setOpen(anyPressed)
    }
  }

  _breakWallsFromActor(actor) {
    if (!actor.isAttacking || !actor.consumeAttackHit()) return

    for (const block of this.levelObjects.breakables) {
      if (block.destroyed) continue
      if (!overlaps(actor.attackBounds, block.bounds)) continue

      const destroyed = block.hit()
      this.followCamera.shake(destroyed ? 0.16 : 0.08, 0.16)
      return
    }
  }

  _checkHazards() {
    for (const hazard of this.levelObjects.hazards) {
      if (!hazard.active) continue
      if (!overlaps(this.player.bounds, hazard.bounds)) continue

      if (this.player.takeDamage()) {
        this.hitCount += 1
        this.levelHitCount += 1
        this._respawnAfterHit()
      }
      return
    }
  }

  _checkDeathPlane() {
    if (this.player.y > this.levelObjects.deathY) return

    if (this.player.takeDamage()) {
      this.hitCount += 1
      this.levelHitCount += 1
    }
    this._respawnAfterHit()
  }

  _respawnAfterHit() {
    this.echoBuffer = []
    this.ghost.reset()

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
    this.records.saveLevelBest(level.id, this.levelTime, this.playerName, this.levelHitCount)

    if (this.currentLevelIndex < LEVELS.length - 1) {
      this._loadLevel(this.currentLevelIndex + 1)
      return
    }

    this._completeRun()
  }

  _completeRun() {
    this.records.saveTotalBest(this.runTime, this.playerName, this.hitCount)
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
    this.ui.updateHud({
      playerName: this.playerName,
      mapsLeft: LEVELS.length - this.currentLevelIndex,
      runTime: this.runTime,
      mapTime: this.levelTime,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      echoStatus: this.ghost.status,
      echoDelay: ECHO_DELAY_SECONDS,
      hitCount: this.hitCount,
    })
  }

  _onResize() {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight
    this.threeCamera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}

