import * as THREE from 'three'
import { InputManager } from './InputManager.js'
import { Player, overlaps } from './Player.js'
import { Enemy } from './Enemy.js'
import { Camera } from './Camera.js'
import { HitSparks } from './HitSpark.js'
import { Projectile } from './Projectile.js'
import { Platform } from '../obstacles/Platform.js'

const ARENA_HALF_WIDTH = 14
const GROUND_Y = -1
const MAX_ENEMY_ATTACKERS = 2
const WAVE_CLEAR_HEAL = 2

const ARENA_LAYOUTS = {
  ring: [
    { x: -6, y: 1.6, w: 3, h: 0.6 },
    { x: 6, y: 1.6, w: 3, h: 0.6 },
    { x: 0, y: 3.6, w: 3.2, h: 0.6 },
  ],
  split: [
    { x: -8, y: 1.35, w: 2.6, h: 0.6 },
    { x: 8, y: 1.35, w: 2.6, h: 0.6 },
    { x: -3.2, y: 2.9, w: 2.8, h: 0.6 },
    { x: 3.2, y: 2.9, w: 2.8, h: 0.6 },
  ],
  crossfire: [
    { x: -7.2, y: 2.35, w: 3, h: 0.6 },
    { x: 7.2, y: 2.35, w: 3, h: 0.6 },
    { x: 0, y: 1.15, w: 3.4, h: 0.6 },
    { x: 0, y: 4.2, w: 3.2, h: 0.6 },
  ],
  tower: [
    { x: -7.4, y: 1.3, w: 2.6, h: 0.6 },
    { x: 7.4, y: 1.3, w: 2.6, h: 0.6 },
    { x: -3.8, y: 2.8, w: 2.4, h: 0.6 },
    { x: 3.8, y: 2.8, w: 2.4, h: 0.6 },
    { x: 0, y: 4.45, w: 2.8, h: 0.6 },
  ],
  pit: [
    { x: -9, y: 1.65, w: 2.4, h: 0.6 },
    { x: 9, y: 1.65, w: 2.4, h: 0.6 },
    { x: -4.4, y: 3.15, w: 2.8, h: 0.6 },
    { x: 4.4, y: 3.15, w: 2.8, h: 0.6 },
    { x: 0, y: 0.65, w: 3.2, h: 0.6 },
  ],
  finale: [
    { x: -9.2, y: 1.2, w: 2.4, h: 0.6 },
    { x: 9.2, y: 1.2, w: 2.4, h: 0.6 },
    { x: -5.2, y: 2.7, w: 2.6, h: 0.6 },
    { x: 5.2, y: 2.7, w: 2.6, h: 0.6 },
    { x: 0, y: 3.95, w: 3.2, h: 0.6 },
    { x: 0, y: 1.35, w: 2.6, h: 0.6 },
  ],
}

const WAVES = [
  { name: 'WAVE 1 / FIRST CONTACT', layout: 'ring', enemies: ['grunt', 'kicker', 'grunt'] },
  { name: 'WAVE 2 / SPLIT LANES', layout: 'split', enemies: ['grunt', 'fast', 'kicker', 'grunt'] },
  { name: 'WAVE 3 / CROSSFIRE', layout: 'crossfire', enemies: ['shooter', 'grunt', 'fast', 'kicker'] },
  { name: 'WAVE 4 / PLATFORM HUNT', layout: 'tower', enemies: ['guarder', 'fast', 'shooter', 'grunt', 'kicker'] },
  { name: 'WAVE 5 / SHOCK LESSON', layout: 'pit', enemies: ['tank', 'guarder', 'fast', 'shooter'] },
  { name: 'WAVE 6 / DOUBLE CROSSFIRE', layout: 'crossfire', enemies: ['shooter', 'sniper', 'fast', 'kicker', 'guarder', 'grunt'] },
  { name: 'WAVE 7 / VERTICAL PRESSURE', layout: 'tower', enemies: ['tank', 'fast', 'fast', 'guarder', 'sniper'] },
  { name: 'WAVE 8 / ENDURANCE MIX', layout: 'split', enemies: ['tank', 'tank', 'shooter', 'kicker', 'fast', 'guarder', 'grunt'] },
  { name: 'WAVE 9 / WARDEN', layout: 'finale', enemies: ['warden', 'tank', 'sniper', 'shooter', 'fast', 'kicker', 'guarder'] },
]

const COMBO = {
  punch: {
    1: { damage: 1, knockback: 6, hitstop: 0.045, shake: 0.12, sparks: 1.0 },
    2: { damage: 1, knockback: 7, hitstop: 0.05, shake: 0.14, sparks: 1.05 },
    3: { damage: 2, knockback: 13, hitstop: 0.09, shake: 0.28, sparks: 1.4 },
  },
  kick: {
    1: { damage: 1, knockback: 8, hitstop: 0.05, shake: 0.15, sparks: 1.1 },
    2: { damage: 2, knockback: 10, hitstop: 0.065, shake: 0.2, sparks: 1.22 },
    3: { damage: 2, knockback: 16, hitstop: 0.1, shake: 0.34, sparks: 1.55 },
  },
}

export class Arena {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.body.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d0d14)
    this.scene.fog = new THREE.Fog(0x0d0d14, 24, 70)

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
    this.player = new Player(this.scene, this.input)
    this.hitSparks = new HitSparks(this.scene)

    this.platforms = []
    this.enemies = []
    this.projectiles = []
    this.telegraphs = []
    this.hitstop = 0
    this.elapsed = 0
    this.state = 'start'
    this.waveIndex = 0
    this.killCount = 0
    this.enemyAttackSlots = MAX_ENEMY_ATTACKERS

    this._buildArena()
    this._buildHud()
    this._resetRun({ pauseAtStart: true })

    this._lastTime = performance.now()
    window.addEventListener('resize', () => this._onResize())
  }

  start() {
    requestAnimationFrame((t) => this._loop(t))
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
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
  }

  _buildArena(layoutKey = 'ring') {
    this._clearPlatforms()

    this.platforms.push(new Platform(this.scene, 0, GROUND_Y - 0.5, ARENA_HALF_WIDTH * 2, 1, 0x3a4055))
    this.platforms.push(new Platform(this.scene, -ARENA_HALF_WIDTH, 4, 1, 12, 0x2c3146))
    this.platforms.push(new Platform(this.scene, ARENA_HALF_WIDTH, 4, 1, 12, 0x2c3146))

    const layout = ARENA_LAYOUTS[layoutKey] ?? ARENA_LAYOUTS.ring
    for (const platform of layout) {
      this.platforms.push(new Platform(
        this.scene,
        platform.x,
        platform.y,
        platform.w,
        platform.h,
        platform.color ?? 0x4a5168,
        { oneWay: platform.oneWay ?? true },
      ))
    }
  }

  _clearPlatforms() {
    if (!this.platforms) return

    for (const platform of this.platforms) platform.dispose()
    this.platforms = []
  }

  _resetRun({ pauseAtStart = false } = {}) {
    for (const e of this.enemies) e.dispose()
    for (const p of this.projectiles) p.dispose()
    this._clearTelegraphs()
    this.enemies = []
    this.projectiles = []
    this.waveIndex = 0
    this.killCount = 0
    this.elapsed = 0
    this.hitstop = 0
    this.state = pauseAtStart ? 'start' : 'playing'
    this.player.setSpawn(0, 1)
    this.player.resetSkills()
    this.player.hp = this.player.maxHp
    this._spawnWave(0)
    this._updateHud()
    this._setMessage(
      pauseAtStart
        ? `ECHO BRAWLER\n\nJ / SPACE : START\n${WAVES.length} WAVES  |  J/K COMBO UNLOCKS`
        : '',
    )
  }

  _spawnWave(index) {
    const wave = WAVES[index]
    if (!wave) return null

    for (const projectile of this.projectiles) projectile.dispose()
    this.projectiles = []
    this._clearTelegraphs()
    this._buildArena(wave.layout)

    wave.enemies.forEach((typeKey, i) => {
      const side = i % 2 === 0 ? -1 : 1
      const x = side * (8 + Math.random() * 4)
      this.enemies.push(new Enemy(this.scene, x, 1.5, typeKey))
    })

    return wave
  }

  _loop(timestamp) {
    const realDt = Math.min((timestamp - this._lastTime) / 1000, 0.05)
    this._lastTime = timestamp

    this.input.flush()

    let simDt = realDt
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - realDt)
      simDt = 0
    }

    if (simDt > 0) this._simulate(simDt)

    this.followCamera.update(this.player.x, this.player.y, realDt)
    this.hitSparks.update(realDt)
    this._updateTelegraphs(realDt)
    this.renderer.render(this.scene, this.threeCamera)
    requestAnimationFrame((t) => this._loop(t))
  }

  _simulate(dt) {
    if (this.state === 'start') {
      if (this.input.attack || this.input.jump || this.input.restart) {
        this.state = 'playing'
        this._setMessage('')
      }
      this.player.update(dt, this.platforms)
      this._updateHud()
      return
    }

    if (this.state === 'dead' || this.state === 'cleared') {
      if (this.input.restart) this._resetRun()
      for (const e of this.enemies) e.update(dt, this.player, this.platforms)
      this._handleEnemyEvents()
      this._cleanupDead()
      this._updateProjectiles(dt)
      this.player.update(dt, this.platforms)
      this._updateHud()
      return
    }

    if (this.input.restart) {
      this._resetRun()
      return
    }

    this.elapsed += dt
    const currentThreats = this.enemies.filter((e) => e.isThreatening).length
    this.enemyAttackSlots = Math.max(0, MAX_ENEMY_ATTACKERS - currentThreats)

    this.player.update(dt, this.platforms)
    this._clampPlayerToArena()

    const director = {
      tryUseAttackSlot: () => {
        if (this.enemyAttackSlots <= 0) return false
        this.enemyAttackSlots -= 1
        return true
      },
    }

    for (const e of this.enemies) e.update(dt, this.player, this.platforms, director)
    this._handleEnemyEvents()
    this._separateEnemies()

    this._resolvePlayerAttack()
    this._updateProjectiles(dt)
    this._cleanupDead()
    this._handlePlayerEvents()
    this._checkProgress()
    this._updateHud()
  }

  _clampPlayerToArena() {
    const limit = ARENA_HALF_WIDTH - 1
    if (this.player.x < -limit) {
      this.player.x = -limit
      this.player.vx = 0
    }
    if (this.player.x > limit) {
      this.player.x = limit
      this.player.vx = 0
    }
  }

  _resolvePlayerAttack() {
    if (!this.player.isAttacking) return

    const style = this.player.attackStyle ?? 'punch'
    const combo = COMBO[style]?.[this.player.attackComboStep] ?? COMBO.punch[1]
    const atkBounds = this.player.attackBounds
    const atkId = this.player.attackId
    let hitSomething = false

    for (const e of this.enemies) {
      if (!e.isAlive) continue
      if (e._lastHitId === atkId) continue
      if (!overlaps(atkBounds, e.bounds)) continue

      e._lastHitId = atkId
      e.takeHit(combo.damage, this.player.facingDir, combo.knockback)

      const hx = (atkBounds.left + atkBounds.right) / 2
      const hy = e.y + 0.2
      this.hitSparks.burst(hx, hy, this.player.facingDir, combo.sparks)
      hitSomething = true
    }

    if (hitSomething) {
      this.hitstop = Math.max(this.hitstop, combo.hitstop)
      this.followCamera.shake(combo.shake, 0.18)
    }

    for (const projectile of this.projectiles) {
      if (projectile.destroyed) continue
      if (!overlaps(atkBounds, projectile.bounds)) continue

      projectile.destroy()
      this.hitSparks.burst(projectile.x, projectile.y, this.player.facingDir, 0.9, 0xffffff)
      this.hitstop = Math.max(this.hitstop, 0.025)
      this.followCamera.shake(0.08, 0.1)
    }
  }

  _handleEnemyEvents() {
    for (const enemy of this.enemies) {
      for (const event of enemy.consumeEvents()) {
        if (event.type === 'attackTelegraph') {
          this._spawnTelegraph(event)
          continue
        }

        if (event.type !== 'shoot') continue

        this.projectiles.push(new Projectile(
          this.scene,
          event.x,
          event.y,
          event.dir,
          { speed: event.speed, damage: event.damage },
        ))
        this.hitSparks.burst(event.x, event.y, event.dir, 0.7, 0xff8c42)
      }
    }
  }

  _updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      if (projectile.destroyed) continue

      projectile.update(dt)
      if (this._projectileHitsSolid(projectile)) {
        projectile.destroy()
        continue
      }

      if (projectile.reflected) {
        this._resolveReflectedProjectile(projectile)
      } else {
        this._resolveHostileProjectile(projectile)
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (!this.projectiles[i].destroyed) continue

      this.projectiles[i].dispose()
      this.projectiles.splice(i, 1)
    }
  }

  _projectileHitsSolid(projectile) {
    return this.platforms.some((platform) => {
      if (platform.destroyed || platform.oneWay) return false
      return overlaps(projectile.bounds, platform.bounds)
    })
  }

  _resolveHostileProjectile(projectile) {
    if (!overlaps(projectile.bounds, this.player.bounds)) return

    this.player.takeDamage(projectile.damage, projectile.x)
    projectile.destroy()
  }

  // J,J,K 충격파: 주변 적 전체를 밀어내고 투사체를 지움 (포위 탈출 궁극기)
  _resolveShock(event) {
    const { x, y, force, damage } = event
    const color = event.shape === 'rect' ? 0x69e7ff : 0xb39cff

    if (event.shape === 'rect') {
      const bounds = this._shockRectBounds(event)
      this._spawnRectTelegraph(bounds, color, 0.34, 0.28)

      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue
        if (!overlaps(bounds, enemy.bounds)) continue

        enemy.takeHit(damage, event.dir, force)
        this.hitSparks.burst(enemy.x, enemy.y + 0.2, event.dir, 1.05, color)
      }

      for (const projectile of this.projectiles) {
        if (projectile.destroyed) continue
        if (!overlaps(bounds, projectile.bounds)) continue
        projectile.destroy()
      }

      this.hitSparks.ring(x + event.dir * 0.9, y + 0.35, color)
      this.hitstop = Math.max(this.hitstop, 0.055)
      this.followCamera.shake(0.22, 0.2)
      return
    }

    const radius = event.radius ?? 3.2
    this._spawnCircleTelegraph(x, y + 0.15, radius, color, 0.44, 0.22)

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue
      const dx = enemy.x - x
      const dy = enemy.y - y
      const dist = Math.hypot(dx, dy)
      if (dist > radius) continue

      const dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1)
      const falloff = 1 - (dist / radius) * 0.4
      enemy.takeHit(damage, dir, force * falloff)
      this.hitSparks.burst(enemy.x, enemy.y + 0.2, dir, 1.3, 0x9b8cff)
    }

    for (const projectile of this.projectiles) {
      if (projectile.destroyed) continue
      if (Math.hypot(projectile.x - x, projectile.y - y) > radius) continue
      projectile.destroy()
    }

    this.hitSparks.ring(x, y + 0.4, color)
    this.hitstop = Math.max(this.hitstop, 0.09)
    this.followCamera.shake(0.42, 0.32)
  }

  _shockRectBounds(event) {
    const range = event.range ?? 3.5
    const vertical = event.vertical ?? 1.1
    const centerX = event.x + event.dir * (this.player.width / 2 + range / 2)
    const centerY = event.y + 0.22

    return {
      left: centerX - range / 2,
      right: centerX + range / 2,
      bottom: centerY - vertical / 2,
      top: centerY + vertical / 2,
    }
  }

  _resolveReflectedProjectile(projectile) {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue
      if (!overlaps(projectile.bounds, enemy.bounds)) continue

      enemy.takeHit(projectile.damage, projectile.dir, 10)
      this.hitSparks.burst(projectile.x, projectile.y, projectile.dir, 1.2, 0x69e7ff)
      this.followCamera.shake(0.16, 0.14)
      projectile.destroy()
      return
    }
  }

  _separateEnemies() {
    for (let i = 0; i < this.enemies.length; i += 1) {
      const a = this.enemies[i]
      if (!a.isAlive || a.state === 'spawning') continue
      for (let j = i + 1; j < this.enemies.length; j += 1) {
        const b = this.enemies[j]
        if (!b.isAlive || b.state === 'spawning') continue

        const dx = b.x - a.x
        const minDist = (a.width + b.width) * 0.55
        const dist = Math.abs(dx)
        if (dist >= minDist || dist < 0.0001) continue

        const push = (minDist - dist) * 0.5
        const dir = dx >= 0 ? 1 : -1
        a.x -= dir * push
        b.x += dir * push
      }
    }
  }

  _cleanupDead() {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i].isDead) {
        const grantSkill = this.enemies[i].grantSkill
        this.enemies[i].dispose()
        this.enemies.splice(i, 1)
        this.killCount += 1
        if (grantSkill && this.player.unlockSkill(grantSkill)) {
          this._announceUnlock(grantSkill)
        }
      }
    }
  }

  _checkProgress() {
    if (this.player.hp <= 0) {
      this.state = 'dead'
      this._setMessage('YOU DIED\n\nR : RESTART')
      return
    }

    const remaining = this.enemies.filter((e) => e.isAlive).length
    if (remaining > 0) return

    if (this.waveIndex < WAVES.length - 1) {
      const healed = this._grantWaveClearReward()
      this.waveIndex += 1
      const wave = this._spawnWave(this.waveIndex)
      this._setMessage(`${wave.name}\n\n${healed > 0 ? `+${healed} HP` : 'NO HEAL NEEDED'}`)
      window.setTimeout(() => {
        if (this.state === 'playing') this._setMessage('')
      }, 1100)
    } else if (this.enemies.length === 0) {
      this.state = 'cleared'
      this._setMessage(`CLEAR!\n\nTIME ${this._formatTime(this.elapsed)} / KO ${this.killCount}\nR : RESTART`)
    }
  }

  _grantWaveClearReward() {
    const missing = this.player.maxHp - this.player.hp
    const healed = Math.min(WAVE_CLEAR_HEAL, Math.max(0, missing))

    if (healed <= 0) return 0

    this.player.hp += healed
    this._spawnDamageText(`+${healed}`, this.player.x, this.player.y + 1.1, 'block')
    return healed
  }

  _handlePlayerEvents() {
    for (const event of this.player.consumeEvents()) {
      if (event.type === 'roll') this.followCamera.shake(0.055, 0.1)
      if (event.type === 'jump') this.followCamera.shake(0.03, 0.08)
      if (event.type === 'wallJump') this.followCamera.shake(0.09, 0.12)
      if (event.type === 'land') this.followCamera.shake(0.05 + event.impact * 0.08, 0.12)
      if (event.type === 'damage') {
        const amount = event.amount ?? 1
        this.hitstop = Math.max(this.hitstop, 0.045 + amount * 0.025)
        this.followCamera.shake(0.34 + amount * 0.16, 0.22 + amount * 0.035)
        this.hitSparks.burst(
          this.player.x,
          this.player.y + 0.35,
          event.dir ?? 1,
          1.05 + amount * 0.22,
          0xff3344,
        )
        this._flashDamage(amount >= 3)
        this._spawnDamageText(`-${amount}`, this.player.x, this.player.y + 0.9)
      }
      if (event.type === 'shock') {
        this._resolveShock(event)
        this._spawnDamageText(event.label ?? 'SHOCK', this.player.x, this.player.y + 1.0, 'block')
      }
      if (event.type === 'bolt') {
        this._spawnPlayerBolt(event)
      }
      if (event.type === 'death') {
        this.hitstop = Math.max(this.hitstop, 0.12)
        this.followCamera.shake(0.75, 0.36)
        this._flashDamage(true)
      }
    }
  }

  _spawnPlayerBolt(event) {
    const projectile = new Projectile(
      this.scene,
      event.x,
      event.y,
      event.dir,
      { speed: event.speed, damage: event.damage, life: 2.4 },
    )

    projectile.reflected = true
    projectile.mesh.material.color.setHex(0x69e7ff)
    this.projectiles.push(projectile)
    this.hitSparks.burst(event.x, event.y, event.dir, 0.9, 0x69e7ff)
    this.followCamera.shake(0.12, 0.14)
    this._spawnDamageText(event.label ?? 'BOLT', this.player.x, this.player.y + 1.0, 'block')
  }

  _spawnTelegraph(event) {
    if (event.shape === 'circle') {
      this._spawnCircleTelegraph(event.x, event.y, event.radius, event.color, event.duration)
      return
    }

    if (event.shape === 'rect') {
      this._spawnRectTelegraph(event.bounds, event.color, event.duration)
    }
  }

  _spawnCircleTelegraph(x, y, radius, color = 0xffffff, duration = 0.35, opacity = 0.2) {
    if (!Number.isFinite(radius) || radius <= 0) return

    const fillGeo = new THREE.CircleGeometry(radius, 64)
    const ringGeo = new THREE.RingGeometry(radius * 0.92, radius, 64)
    const fillMat = this._telegraphMaterial(color, opacity)
    const ringMat = this._telegraphMaterial(color, Math.min(0.9, opacity * 3.2))
    const fill = new THREE.Mesh(fillGeo, fillMat)
    const ring = new THREE.Mesh(ringGeo, ringMat)
    fill.renderOrder = 16
    ring.renderOrder = 17

    const group = new THREE.Group()
    group.position.set(x, y, 1.03)
    group.add(fill, ring)
    this.scene.add(group)

    this.telegraphs.push({
      group,
      materials: [fillMat, ringMat],
      geometries: [fillGeo, ringGeo],
      life: duration,
      maxLife: duration,
      grow: 0.08,
    })
  }

  _spawnRectTelegraph(bounds, color = 0xffffff, duration = 0.35, opacity = 0.18) {
    if (!bounds) return

    const width = bounds.right - bounds.left
    const height = bounds.top - bounds.bottom
    if (width <= 0 || height <= 0) return

    const fillGeo = new THREE.PlaneGeometry(width, height)
    const edgeGeo = new THREE.EdgesGeometry(fillGeo)
    const fillMat = this._telegraphMaterial(color, opacity)
    const edgeMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(0.95, opacity * 3.6),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    edgeMat.userData.baseOpacity = edgeMat.opacity

    const fill = new THREE.Mesh(fillGeo, fillMat)
    const edge = new THREE.LineSegments(edgeGeo, edgeMat)
    fill.renderOrder = 16
    edge.renderOrder = 17

    const group = new THREE.Group()
    group.position.set(
      (bounds.left + bounds.right) / 2,
      (bounds.bottom + bounds.top) / 2,
      1.03,
    )
    group.add(fill, edge)
    this.scene.add(group)

    this.telegraphs.push({
      group,
      materials: [fillMat, edgeMat],
      geometries: [fillGeo, edgeGeo],
      life: duration,
      maxLife: duration,
      grow: 0.02,
    })
  }

  _telegraphMaterial(color, opacity) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    material.userData.baseOpacity = opacity
    return material
  }

  _updateTelegraphs(dt) {
    for (let i = this.telegraphs.length - 1; i >= 0; i -= 1) {
      const telegraph = this.telegraphs[i]
      telegraph.life -= dt
      const ratio = Math.max(0, telegraph.life / telegraph.maxLife)

      for (const material of telegraph.materials) {
        material.opacity = material.userData.baseOpacity * ratio
      }

      if (telegraph.grow) {
        const scale = 1 + (1 - ratio) * telegraph.grow
        telegraph.group.scale.setScalar(scale)
      }

      if (telegraph.life > 0) continue

      this._disposeTelegraph(telegraph)
      this.telegraphs.splice(i, 1)
    }
  }

  _clearTelegraphs() {
    for (const telegraph of this.telegraphs) this._disposeTelegraph(telegraph)
    this.telegraphs = []
  }

  _disposeTelegraph(telegraph) {
    this.scene.remove(telegraph.group)
    for (const geometry of telegraph.geometries) geometry.dispose()
    for (const material of telegraph.materials) material.dispose()
  }

  _buildHud() {
    this.hud = document.createElement('div')
    this.hud.className = 'arena-ui'
    this.hud.innerHTML = `
      <div class="arena-hud">
        <div class="arena-card">
          <span class="arena-label">HP</span>
          <div data-hp class="hp arena-hp"></div>
        </div>
        <div class="arena-card">
          <span class="arena-label">RUN</span>
          <strong data-time>00:00</strong>
        </div>
        <div class="arena-card">
          <span class="arena-label">WAVE</span>
          <strong data-wave>1/${WAVES.length}</strong>
        </div>
        <div class="arena-card">
          <span class="arena-label">KO</span>
          <strong data-ko>0</strong>
        </div>
        <div class="arena-card">
          <span class="arena-label">SKILLS</span>
          <strong data-skills>PUNCH</strong>
        </div>
      </div>
      <div data-msg class="arena-message"></div>
      <div class="arena-help">A/D Move · Space Jump · Shift/Ctrl/S Roll · J Combo · R Restart</div>
    `
    document.body.appendChild(this.hud)
    this.hud.querySelector('.arena-help').textContent =
      'A/D Move | Space Jump | Shift/Ctrl/S Roll | J Punch | R Restart'
    this.hpEl = this.hud.querySelector('[data-hp]')
    this.timeEl = this.hud.querySelector('[data-time]')
    this.waveEl = this.hud.querySelector('[data-wave]')
    this.koEl = this.hud.querySelector('[data-ko]')
    this.skillsEl = this.hud.querySelector('[data-skills]')
    this.helpEl = this.hud.querySelector('.arena-help')
    this.msgEl = this.hud.querySelector('[data-msg]')
  }

  _updateHud() {
    if (!this.hpEl) return

    const hp = Math.max(0, this.player.hp)
    const hpRatio = hp / Math.max(1, this.player.maxHp)
    const hpState = hpRatio <= 0.3 ? 'low' : hpRatio <= 0.6 ? 'mid' : 'high'
    this.hpEl.className = `hp arena-hp ${hpState}`
    this.hpEl.innerHTML = Array.from(
      { length: this.player.maxHp },
      (_, i) => `<i class="${i < hp ? 'filled' : ''}"></i>`,
    ).join('')

    const remaining = this.enemies.filter((e) => e.isAlive).length
    this.timeEl.textContent = this._formatTime(this.elapsed)
    this.waveEl.textContent = `${this.waveIndex + 1}/${WAVES.length} / ${remaining} left`
    this.koEl.textContent = String(this.killCount)
    this.skillsEl.textContent = this._formatSkills()
    this.helpEl.textContent = this._formatHelp()
  }

  _setMessage(text) {
    if (this.msgEl) this.msgEl.textContent = text
  }

  _announceUnlock(skill) {
    const info = {
      kick: { label: 'KICK', how: 'K / K,K,K combo' },
      bolt: { label: 'ECHO BOLT', how: 'K,J,K projectile' },
      shock: { label: 'SHOCK', how: 'J,J,K heavy / J,K,J line' },
    }[skill] ?? { label: skill.toUpperCase(), how: 'NEW J/K COMBO' }

    this._setMessage(`${info.label} UNLOCKED\n\n${info.how}`)
    this.followCamera.shake(0.18, 0.22)
    window.setTimeout(() => {
      if (this.state === 'playing') this._setMessage('')
    }, 1400)
  }

  _formatSkills() {
    const skills = ['PUNCH']
    if (this.player.skills.kick) skills.push('KICK')
    if (this.player.skills.bolt) skills.push('BOLT')
    if (this.player.skills.shock) skills.push('SHOCK')
    return skills.join(' / ')
  }

  _formatHelp() {
    const actions = ['A/D Move', 'Space Jump', 'Shift Roll', 'J Punch']
    if (this.player.skills.kick) actions.push('K Kick')
    if (this.player.skills.bolt) actions.push('K,J,K Bolt')
    if (this.player.skills.shock) actions.push('J,J,K Heavy')
    if (this.player.skills.shock) actions.push('J,K,J Line')
    actions.push('R Restart')
    return actions.join(' | ')
  }

  _flashDamage(strong = false) {
    if (!this.hud) return

    const className = strong ? 'damage-heavy' : 'damage-hit'
    this.hud.classList.remove('damage-hit', 'damage-heavy')
    void this.hud.offsetWidth
    this.hud.classList.add(className)
    window.setTimeout(() => {
      this.hud?.classList.remove(className)
    }, strong ? 360 : 220)
  }

  _spawnDamageText(text, x, y, type = 'damage') {
    if (!this.hud) return

    const pos = this._worldToScreen(x, y)
    const el = document.createElement('div')
    el.className = type === 'block' ? 'damage-pop block-pop' : 'damage-pop'
    el.textContent = text
    el.style.left = `${pos.x}px`
    el.style.top = `${pos.y}px`
    this.hud.appendChild(el)
    window.setTimeout(() => el.remove(), 620)
  }

  _worldToScreen(x, y) {
    const projected = new THREE.Vector3(x, y, 0.9).project(this.threeCamera)
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    }
  }

  _formatTime(seconds) {
    const safe = Math.max(0, seconds)
    const minutes = Math.floor(safe / 60)
    const secs = Math.floor(safe % 60)
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  _onResize() {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight
    this.threeCamera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
