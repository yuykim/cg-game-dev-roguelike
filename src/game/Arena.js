import * as THREE from 'three'
import { InputManager } from './InputManager.js'
import { Player, overlaps } from './Player.js'
import { Enemy } from './Enemy.js'
import { Camera } from './Camera.js'
import { HitSparks } from './HitSpark.js'
import { Projectile } from './Projectile.js'
import { AudioManager } from './AudioManager.js'
import { Platform } from '../obstacles/Platform.js'

const ARENA_HALF_WIDTH = 14
const GROUND_Y = -1
const MAX_ENEMY_ATTACKERS = 2
const RANGED_ENEMIES = new Set(['shooter', 'sniper'])
const HEAVY_ENEMIES = new Set(['tank', 'warden'])

const ARENA_LAYOUTS = {
  ring: [
    { x: -6, y: 1.6, w: 3, h: 0.6 },
    { x: 6, y: 1.6, w: 3, h: 0.6 },
    { x: 0, y: 3.6, w: 3.2, h: 0.6 },
  ],
  split: [
    { x: -8, y: 1.35, w: 2.6, h: 0.6 },
    { x: 8, y: 1.35, w: 2.6, h: 0.6 },
    { x: -3.2, y: 2.45, w: 2.8, h: 0.6 },
    { x: 3.2, y: 2.45, w: 2.8, h: 0.6 },
  ],
  crossfire: [
    { x: -7.2, y: 2.1, w: 3, h: 0.6 },
    { x: 7.2, y: 2.1, w: 3, h: 0.6 },
    { x: 0, y: 1.15, w: 3.4, h: 0.6 },
    { x: 0, y: 3.45, w: 3.2, h: 0.6 },
  ],
  tower: [
    { x: -7.4, y: 1.3, w: 2.6, h: 0.6 },
    { x: 7.4, y: 1.3, w: 2.6, h: 0.6 },
    { x: -3.8, y: 2.45, w: 2.4, h: 0.6 },
    { x: 3.8, y: 2.45, w: 2.4, h: 0.6 },
    { x: 0, y: 3.65, w: 2.8, h: 0.6 },
  ],
  pit: [
    { x: -9, y: 1.65, w: 2.4, h: 0.6 },
    { x: 9, y: 1.65, w: 2.4, h: 0.6 },
    { x: -4.4, y: 2.8, w: 2.8, h: 0.6 },
    { x: 4.4, y: 2.8, w: 2.8, h: 0.6 },
    { x: 0, y: 0.65, w: 3.2, h: 0.6 },
  ],
  finale: [
    { x: -9.2, y: 1.2, w: 2.4, h: 0.6 },
    { x: 9.2, y: 1.2, w: 2.4, h: 0.6 },
    { x: -5.2, y: 2.35, w: 2.6, h: 0.6 },
    { x: 5.2, y: 2.35, w: 2.6, h: 0.6 },
    { x: 0, y: 3.45, w: 3.2, h: 0.6 },
    { x: 0, y: 1.35, w: 2.6, h: 0.6 },
  ],
}

// 모든 방은 등장한 적을 전부 처치하면 다음 방으로 넘어간다. 마지막은 보스전.
const WAVES = [
  { act: 1, name: 'ACT 1-1 / FIRST CONTACT', layout: 'ring', enemies: ['grunt', 'kicker', 'grunt'] },
  { act: 1, name: 'ACT 1-2 / RUSH LESSON', layout: 'split', enemies: ['grunt', 'fast', 'kicker', 'grunt'] },
  { act: 1, name: 'ACT 1-3 / CROSSFIRE', layout: 'crossfire', enemies: ['shooter', 'grunt', 'fast', 'kicker'] },
  { act: 1, name: 'ACT 1-4 / TOWER ASSAULT', layout: 'tower', enemies: ['guarder', 'fast', 'shooter', 'grunt', 'kicker'] },
  { act: 1, name: 'ACT 1-5 / SHOCK LESSON', layout: 'pit', enemies: ['tank', 'guarder', 'fast', 'shooter'] },
  { act: 2, name: 'ACT 2-1 / DOUBLE CROSSFIRE', layout: 'crossfire', enemies: ['shooter', 'sniper', 'fast', 'kicker', 'guarder', 'grunt'] },
  { act: 2, name: 'ACT 2-2 / BREAKER ROOM', layout: 'split', enemies: ['guarder', 'guarder', 'fast', 'sniper', 'grunt'] },
  { act: 2, name: 'ACT 2-3 / THE PIT', layout: 'pit', enemies: ['tank', 'fast', 'fast', 'shooter', 'guarder'] },
  { act: 2, name: 'ACT 2-4 / TANK PAIR', layout: 'tower', enemies: ['tank', 'tank', 'shooter', 'kicker', 'fast', 'guarder', 'grunt'] },
  { act: 2, name: 'ACT 2-5 / WARDEN', layout: 'finale', enemies: ['warden', 'sniper', 'shooter', 'fast', 'guarder'] },
  { act: 3, name: 'ACT 3-1 / SNIPER NEST', layout: 'crossfire', enemies: ['sniper', 'sniper', 'shooter', 'fast', 'kicker', 'grunt'] },
  { act: 3, name: 'ACT 3-2 / LAST STAND', layout: 'tower', enemies: ['tank', 'sniper', 'fast', 'fast', 'guarder', 'shooter'] },
  { act: 3, name: 'ACT 3-3 / HEAVY ROOM', layout: 'pit', enemies: ['tank', 'tank', 'guarder', 'guarder', 'shooter', 'fast'] },
  { act: 3, name: 'ACT 3-4 / WARDEN GUARD', layout: 'split', enemies: ['warden', 'tank', 'sniper', 'guarder', 'fast', 'kicker'] },
  { act: 3, name: 'ACT 3-5 / FINAL BOSS', layout: 'finale', boss: true, enemies: ['boss'] },
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

const SKILL_DISPLAY = [
  {
    id: 'punch',
    name: 'Punch',
    command: 'J',
    detail: 'basic combo',
    isUnlocked: () => true,
  },
  {
    id: 'uppercut',
    name: 'Uppercut',
    command: 'Roll → J',
    detail: 'launch enemies up',
    isUnlocked: () => true,
  },
  {
    id: 'airdash',
    name: 'Air Dash',
    command: 'Air + Shift',
    detail: 'dash through the air',
    isUnlocked: () => true,
  },
  {
    id: 'slam',
    name: 'Air Slam',
    command: 'Air + S + J',
    detail: 'dive slam',
    isUnlocked: () => true,
    cooldown: (player) => player.slamCooldown,
  },
  {
    id: 'kick',
    name: 'Kick',
    command: 'K',
    detail: 'defeat Kicker',
    isUnlocked: (player) => player.skills.kick,
  },
  {
    id: 'lunge',
    name: 'Rush Strike',
    command: 'J K K',
    detail: 'defeat Fast',
    isUnlocked: (player) => player.skills.lunge,
    cooldown: (player) => player.lungeCooldown,
  },
  {
    id: 'breaker',
    name: 'Breaker',
    command: 'K K J',
    detail: 'defeat Guarder',
    isUnlocked: (player) => player.skills.breaker,
    cooldown: (player) => player.breakerCooldown,
  },
  {
    id: 'bolt',
    name: 'Echo Bolt',
    command: 'K J K',
    detail: 'defeat Shooter',
    isUnlocked: (player) => player.skills.bolt,
    cooldown: (player) => player.boltCooldown,
  },
  {
    id: 'shock-heavy',
    name: 'Shock Heavy',
    command: 'J J K',
    detail: 'defeat Tank',
    isUnlocked: (player) => player.skills.shock,
    cooldown: (player) => player.shockCooldown,
  },
  {
    id: 'shock-line',
    name: 'Shock Line',
    command: 'J K J',
    detail: 'defeat Tank',
    isUnlocked: (player) => player.skills.shock,
    cooldown: (player) => player.shockCooldown,
  },
]

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
    this.audio = new AudioManager()

    // 브라우저 정책상 첫 사용자 입력에서 오디오 컨텍스트를 깨운다.
    const unlockAudio = () => this.audio.unlock()
    window.addEventListener('keydown', unlockAudio, { once: true })
    window.addEventListener('pointerdown', unlockAudio, { once: true })

    this.platforms = []
    this.enemies = []
    this.projectiles = []
    this.telegraphs = []
    this.hitstop = 0
    this.elapsed = 0
    this.roomTimer = 0
    this.state = 'start'
    this.introStep = 'title'
    this.waveIndex = 0
    this.killCount = 0
    this.enemyAttackSlots = MAX_ENEMY_ATTACKERS
    this.roomUnlocks = []

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
    this.roomTimer = 0
    this.hitstop = 0
    this.roomUnlocks = []
    this.state = pauseAtStart ? 'start' : 'playing'
    this.introStep = pauseAtStart ? 'title' : 'hidden'
    this.player.setSpawn(0, 1)
    this.player.resetSkills()
    this.player.hp = this.player.maxHp
    this._spawnWave(0)
    this._updateHud()
    this._syncIntroOverlay()
    this._setMessage('')
  }

  _spawnWave(index) {
    const wave = WAVES[index]
    if (!wave) return null

    for (const projectile of this.projectiles) projectile.dispose()
    this.projectiles = []
    this._clearTelegraphs()
    this._buildArena(wave.layout)
    this.roomTimer = 0
    this.roomUnlocks = []

    wave.enemies.forEach((typeKey, i) => {
      const spawn = this._chooseEnemySpawn(typeKey, i, wave.layout)
      const enemy = new Enemy(this.scene, spawn.x, spawn.y, typeKey)
      this.enemies.push(enemy)
    })

    return wave
  }

  _chooseEnemySpawn(typeKey, index, layoutKey) {
    // 보스는 항상 아레나 중앙에서 등장한다.
    if (typeKey === 'boss') return { x: 0, y: 2 }

    const spawnSets = this._spawnSetsForLayout(layoutKey)
    let pool = spawnSets.ground

    if (RANGED_ENEMIES.has(typeKey)) {
      pool = spawnSets.high.length ? spawnSets.high : spawnSets.platforms
    } else if (!HEAVY_ENEMIES.has(typeKey) && index % 3 === 1 && spawnSets.platforms.length) {
      pool = spawnSets.platforms
    }

    const point = pool[index % pool.length] ?? spawnSets.ground[0]
    const jitter = HEAVY_ENEMIES.has(typeKey) ? 0 : (Math.random() - 0.5) * 0.45
    return { x: point.x + jitter, y: point.y }
  }

  _spawnSetsForLayout(layoutKey) {
    const layout = ARENA_LAYOUTS[layoutKey] ?? ARENA_LAYOUTS.ring
    const ground = [
      { x: -10.5, y: 1.5 },
      { x: 10.5, y: 1.5 },
      { x: -5.5, y: 1.5 },
      { x: 5.5, y: 1.5 },
    ]
    const platforms = layout.map((platform) => ({
      x: platform.x,
      y: platform.y + platform.h / 2 + 0.85,
      high: platform.y >= 2.1,
    }))
    const high = platforms.filter((point) => point.high)

    return { ground, platforms, high }
  }

  _loop(timestamp) {
    const realDt = Math.min((timestamp - this._lastTime) / 1000, 0.05)
    this._lastTime = timestamp

    this.input.flush()

    if (this.input.fullscreen) this._toggleFullscreen()

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
    // ESC: 전투 중에만 일시정지/재개를 토글한다.
    if (this.input.pause && (this.state === 'playing' || this.state === 'paused')) {
      this._togglePause()
    }

    if (this.state === 'paused') {
      // 일시정지 중에는 시뮬레이션을 멈추되, R 재시작은 받는다.
      if (this.input.restart) {
        this._syncPauseOverlay(false)
        this._resetRun()
      }
      return
    }

    if (this.state === 'start') {
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
    this.roomTimer += dt
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
    const damageBonus = style === 'kick'
      ? this.player.upgrades.kickDamageBonus
      : this.player.upgrades.punchDamageBonus
    const damage = combo.damage + damageBonus
    const atkBounds = this.player.attackBounds
    const atkId = this.player.attackId
    let hitSomething = false

    for (const e of this.enemies) {
      if (!e.isAlive) continue
      if (e._lastHitId === atkId) continue
      if (!overlaps(atkBounds, e.bounds)) continue

      e._lastHitId = atkId
      e.takeHit(damage, this.player.facingDir, combo.knockback)

      const hx = (atkBounds.left + atkBounds.right) / 2
      const hy = e.y + 0.2
      this.hitSparks.burst(hx, hy, this.player.facingDir, combo.sparks)
      hitSomething = true
    }

    if (hitSomething) {
      const heavy = this.player.attackComboStep >= 3
      this.hitstop = Math.max(this.hitstop, combo.hitstop)
      this.followCamera.impact({
        shake: combo.shake,
        duration: 0.18,
        dirX: this.player.facingDir,
        kick: 0.12 + combo.sparks * 0.06,
        fov: heavy ? 3.4 : 1.3,
      })
      if (heavy) this.audio.heavyHit(combo.sparks)
      else this.audio.hit(combo.sparks)
    }

    for (const projectile of this.projectiles) {
      if (projectile.destroyed) continue
      if (!overlaps(atkBounds, projectile.bounds)) continue

      projectile.destroy()
      this.hitSparks.burst(projectile.x, projectile.y, this.player.facingDir, 0.9, 0xffffff)
      this.hitstop = Math.max(this.hitstop, 0.025)
      this.followCamera.shake(0.08, 0.1)
      this.audio.hit(0.7)
    }
  }

  _handleEnemyEvents() {
    for (const enemy of this.enemies) {
      for (const event of enemy.consumeEvents()) {
        if (event.type === 'attackTelegraph') {
          this._spawnTelegraph(event)
          continue
        }

        if (event.type === 'attackImpact') {
          this._spawnAttackImpact(event)
          continue
        }

        if (event.type === 'warpFlash') {
          this.hitSparks.ring(event.x, event.y, 0xff5db1)
          this.hitSparks.burst(event.x, event.y, 1, 1.0, 0xff5db1)
          this.audio.enemyShoot()
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
        this.audio.enemyShoot()
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

  _resolvePlayerSkillRect(event) {
    const bounds = this._skillRectBounds(event)
    const color = event.move === 'breaker' ? 0xffb23f : 0x35ff88
    const damage = event.damage + (this.player.upgrades.skillDamageBonus ?? 0)
    let hitSomething = false

    this._spawnRectTelegraph(bounds, color, event.duration ?? 0.28, 0.3)

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue
      if (!overlaps(bounds, enemy.bounds)) continue

      enemy.takeHit(damage, event.dir, event.force)
      this.hitSparks.burst(enemy.x, enemy.y + 0.2, event.dir, 1.2, color)
      hitSomething = true
    }

    for (const projectile of this.projectiles) {
      if (projectile.destroyed) continue
      if (!overlaps(bounds, projectile.bounds)) continue

      projectile.destroy()
      this.hitSparks.burst(projectile.x, projectile.y, event.dir, 0.9, color)
      hitSomething = true
    }

    this.hitSparks.ring(event.x + event.dir * 1.0, event.y + 0.35, color)
    this.hitstop = Math.max(this.hitstop, hitSomething ? 0.07 : 0.03)
    this.followCamera.shake(hitSomething ? 0.24 : 0.1, 0.18)
  }

  _skillRectBounds(event) {
    const range = event.range ?? 2.2
    const vertical = event.vertical ?? 1
    const centerX = event.x + event.dir * (this.player.width / 2 + range / 2)
    const centerY = event.y + 0.2

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
        const enemy = this.enemies[i]
        this._countEnemyKill(enemy)
        this._grantEnemySkill(enemy)
        enemy.dispose()
        this.enemies.splice(i, 1)
      }
    }
  }

  _countEnemyKill(enemy) {
    if (enemy.killCounted) return

    enemy.killCounted = true
    this.killCount += 1
  }

  _grantEnemySkill(enemy) {
    if (!enemy.grantSkill || enemy.skillRewardGranted) return

    enemy.skillRewardGranted = true
    if (this.player.unlockSkill(enemy.grantSkill)) {
      this.roomUnlocks.push(enemy.grantSkill)
      this._announceUnlock(enemy.grantSkill)
    }
  }

  _checkProgress() {
    if (this.player.hp <= 0) {
      this.state = 'dead'
      this._setMessage('YOU DIED\n\nR : RESTART')
      return
    }

    if (!this._isObjectiveComplete()) return

    if (this.waveIndex < WAVES.length - 1) {
      this._advanceToNextRoom()
    } else {
      this._clearRoomThreats()
      this.state = 'cleared'
      this._setMessage(`CLEAR!\n\nTIME ${this._formatTime(this.elapsed)} / KO ${this.killCount}\nR : RESTART`)
    }
  }

  _currentRoom() {
    return WAVES[this.waveIndex]
  }

  // 모든 방의 목표는 동일: 등장한 적을 전부 처치.
  _isObjectiveComplete() {
    return this.enemies.filter((enemy) => enemy.isAlive).length === 0
  }

  _objectiveProgress(room = this._currentRoom()) {
    const remaining = this.enemies.filter((enemy) => enemy.isAlive).length
    if (room?.boss) return remaining > 0 ? 'BOSS' : 'CLEAR'
    return `${remaining} LEFT`
  }

  _clearRoomThreats() {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) {
        this._countEnemyKill(enemy)
        this._grantEnemySkill(enemy)
      }
      enemy.dispose()
    }
    for (const projectile of this.projectiles) projectile.dispose()
    this._clearTelegraphs()
    this.enemies = []
    this.projectiles = []
  }

  _advanceToNextRoom() {
    const healed = this._grantClearHeal()

    this._clearRoomThreats()
    const unlocks = [...this.roomUnlocks]
    this.waveIndex += 1

    const wave = this._spawnWave(this.waveIndex)
    this.state = 'playing'
    this.audio.waveClear()

    if (wave?.boss) {
      this._showToast(`⚠  FINAL BOSS  ⚠\n${wave.name}\nDodge the slams — strike in the gaps`, 3200)
      this.followCamera.shake(0.3, 0.4)
    } else {
      this._showToast(this._formatRoomTransition(wave, healed, unlocks), 2400)
    }
  }

  _formatRoomTransition(room, healed, unlocks) {
    const lines = [room.name]

    if (unlocks.length > 0) lines.push(`▲ NEW TECH: ${unlocks.map((skill) => this._skillLabel(skill)).join(' / ')}`)
    if (healed > 0) lines.push(`+${healed} HP`)

    return lines.join('\n')
  }

  // 보상 버프는 없다. 방을 비우면 40% 확률로 회복: 그 중 60%는 3, 40%는 2 회복.
  _grantClearHeal() {
    const missing = this.player.maxHp - this.player.hp
    if (missing <= 0 || Math.random() >= 0.4) return 0

    const amount = Math.random() < 0.6 ? 2 : 1
    const healed = Math.min(amount, missing)
    this.player.hp += healed
    this._spawnDamageText(`+${healed}`, this.player.x, this.player.y + 1.1, 'block')
    return healed
  }

  _handlePlayerEvents() {
    for (const event of this.player.consumeEvents()) {
      if (event.type === 'roll') {
        this.followCamera.shake(0.055, 0.1)
        this.audio.roll()
      }
      if (event.type === 'airDash') {
        this.followCamera.shake(0.06, 0.1)
        this.audio.roll()
      }
      if (event.type === 'uppercut') {
        this._resolveUppercut(event)
      }
      if (event.type === 'jump') {
        this.followCamera.shake(0.03, 0.08)
        this.audio.jump()
      }
      if (event.type === 'wallJump') {
        this.followCamera.shake(0.09, 0.12)
        this.audio.jump()
      }
      if (event.type === 'land') {
        this.followCamera.shake(0.05 + event.impact * 0.08, 0.12)
        if (event.impact > 0.25) this.audio.land(event.impact)
      }
      if (event.type === 'slam') {
        this._resolveSlam(event)
      }
      if (event.type === 'damage') {
        const amount = event.amount ?? 1
        this.hitstop = Math.max(this.hitstop, 0.045 + amount * 0.025)
        this.followCamera.impact({
          shake: 0.34 + amount * 0.16,
          duration: 0.22 + amount * 0.035,
          dirX: event.dir ?? 1,
          kick: 0.18 + amount * 0.05,
          fov: amount >= 3 ? 4 : 2,
        })
        this.audio.damage(amount)
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
        this.audio.shock()
        this._spawnDamageText(event.label ?? 'SHOCK', this.player.x, this.player.y + 1.0, 'block')
      }
      if (event.type === 'bolt') {
        this._spawnPlayerBolt(event)
        this.audio.bolt()
      }
      if (event.type === 'skillRect') {
        this._resolvePlayerSkillRect(event)
        if (event.move === 'smash') this.audio.smash()
        else this.audio.heavyHit(1.3)
        this._spawnDamageText(event.label ?? 'TECH', this.player.x, this.player.y + 1.0, 'block')
      }
      if (event.type === 'death') {
        this.hitstop = Math.max(this.hitstop, 0.12)
        this.followCamera.impact({ shake: 0.75, duration: 0.36, fov: 5 })
        this.audio.death()
        this._flashDamage(true)
      }
    }
  }

  // 어퍼컷: 앞쪽 적을 강하게 위로 띄운다.
  _resolveUppercut(event) {
    const bounds = this._skillRectBounds(event)
    const color = 0x8cff6b
    const damage = event.damage
    let hitSomething = false

    this._spawnRectTelegraph(bounds, color, 0.26, 0.3)

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue
      if (!overlaps(bounds, enemy.bounds)) continue

      enemy.takeHit(damage, event.dir, event.force)
      // 위로 띄우기
      enemy.vy = event.launch
      enemy.isGrounded = false
      this.hitSparks.burst(enemy.x, enemy.y + 0.3, event.dir, 1.2, color)
      hitSomething = true
    }

    this.hitSparks.ring(event.x + event.dir * 0.6, event.y + 0.6, color)
    this.hitstop = Math.max(this.hitstop, hitSomething ? 0.08 : 0.03)
    this.followCamera.impact({
      shake: hitSomething ? 0.24 : 0.1,
      duration: 0.18,
      dirY: 1,
      kick: hitSomething ? 0.2 : 0.08,
      fov: hitSomething ? 3 : 0,
    })
    if (hitSomething) this.audio.heavyHit(1.2)
    else this.audio.hit(0.7)
    this._spawnDamageText('UPPER', event.x, event.y + 1.2, 'block')
  }

  // 공중 아래찍기 착지: 착지 지점 주변 적을 띄우고 투사체를 지운다.
  _resolveSlam(event) {
    const { x, y, dir, impact = 0.6 } = event
    const radius = 3.0 + impact * 1.2
    const damage = 2 + (this.player.upgrades.skillDamageBonus ?? 0)
    const color = 0xffd166

    this._spawnCircleTelegraph(x, y + 0.1, radius, color, 0.42, 0.26)
    this.hitSparks.ring(x, y + 0.2, color)

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue
      const dist = Math.hypot(enemy.x - x, enemy.y - y)
      if (dist > radius) continue

      const hitDir = Math.sign(enemy.x - x) || dir
      const falloff = 1 - (dist / radius) * 0.35
      enemy.takeHit(damage, hitDir, 16 * falloff)
      this.hitSparks.burst(enemy.x, enemy.y + 0.2, hitDir, 1.25, color)
    }

    for (const projectile of this.projectiles) {
      if (projectile.destroyed) continue
      if (Math.hypot(projectile.x - x, projectile.y - y) > radius) continue
      projectile.destroy()
    }

    this.hitstop = Math.max(this.hitstop, 0.07 + impact * 0.04)
    this.followCamera.impact({
      shake: 0.32 + impact * 0.22,
      duration: 0.26,
      dirY: -1,
      kick: 0.22 + impact * 0.12,
      fov: 4.5,
    })
    this.audio.slam()
    this._spawnDamageText('SLAM', x, y + 1.2, 'block')
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

  _spawnAttackImpact(event) {
    if (event.shape !== 'circle') return

    this._spawnCircleTelegraph(event.x, event.y, event.radius, event.color, 0.18, 0.34)
    this.hitSparks.ring(event.x, event.y, event.color)
    this.audio.enemyAttack()
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
          <span class="arena-label">ROOM</span>
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
      <aside class="arena-skill-panel">
        <div class="arena-skill-head">
          <span>Tech</span>
          <strong data-skill-ready>0/0</strong>
        </div>
        <div data-skill-list class="arena-skill-list"></div>
      </aside>
      <section class="arena-intro" data-intro>
        <div class="arena-intro-panel title-panel" data-title-screen>
          <span class="arena-eyebrow">ROGUELITE&nbsp;&nbsp;BRAWLER</span>
          <h1 class="arena-title">MIMIC</h1>
          <p class="arena-tagline">Steal every move. Climb fifteen rooms. Break the boss.</p>
          <p class="arena-intro-copy">
            You start with bare fists. Each specialist you defeat hands you their
            technique — kicks, rushes, bolts, shockwaves. Adapt fast and survive.
          </p>
          <div class="arena-intro-actions">
            <button type="button" data-open-howto class="ghost">How to Play</button>
            <button type="button" data-fullscreen class="ghost">Fullscreen</button>
            <button type="button" data-begin-run>Enter Arena</button>
          </div>
        </div>
        <div class="arena-intro-panel hidden" data-howto-screen>
          <h2 class="arena-howto-title">HOW TO PLAY</h2>
          <div class="arena-howto-grid">
            <div class="arena-howto-row"><kbd>A / D</kbd><span>Move left / right</span></div>
            <div class="arena-howto-row"><kbd>Space</kbd><span>Jump · wall-jump off walls</span></div>
            <div class="arena-howto-row"><kbd>Shift / Ctrl</kbd><span>Roll on ground · Air Dash in the air (i-frames)</span></div>
            <div class="arena-howto-row"><kbd>J</kbd><span>Punch combo</span></div>
            <div class="arena-howto-row"><kbd>K</kbd><span>Kick / skill inputs (once unlocked)</span></div>
            <div class="arena-howto-row accent"><kbd>Roll → J</kbd><span>Uppercut — launch enemies into the air</span></div>
            <div class="arena-howto-row accent"><kbd>Air + S + J</kbd><span>Air Slam — dive &amp; shockwave (cooldown)</span></div>
            <div class="arena-howto-row"><kbd>Esc</kbd><span>Pause — review your unlocked tech</span></div>
            <div class="arena-howto-row"><kbd>F</kbd><span>Toggle fullscreen</span></div>
            <div class="arena-howto-row"><kbd>R</kbd><span>Restart the run</span></div>
          </div>
          <p class="arena-howto-note">
            Steal combos from specialists — Rush <b>J K K</b> · Breaker <b>K K J</b> ·
            Bolt <b>K J K</b> · Shock <b>J J K</b> / <b>J K J</b>
          </p>
          <div class="arena-intro-actions">
            <button type="button" class="ghost" data-back-title>Back</button>
            <button type="button" data-begin-run>Enter Arena</button>
          </div>
        </div>
      </section>
      <section class="arena-pause hidden" data-pause>
        <div class="arena-pause-panel">
          <span class="arena-eyebrow">PAUSED</span>
          <h2 class="arena-pause-title">AVAILABLE TECH</h2>
          <div data-pause-list class="arena-skill-list arena-pause-list"></div>
          <p class="arena-pause-note">Esc Resume · F Fullscreen · R Restart</p>
          <div class="arena-intro-actions">
            <button type="button" data-toggle-fullscreen class="ghost">Fullscreen</button>
            <button type="button" data-resume>Resume</button>
          </div>
        </div>
      </section>
      <div data-msg class="arena-message"></div>
      <div data-toast class="arena-toast"></div>
      <div class="arena-help">A/D Move · Space Jump · Shift/Ctrl/S Roll · J Combo · R Restart</div>
    `
    document.body.appendChild(this.hud)
    this.hud.querySelector('.arena-help').textContent =
      'A/D Move | Space Jump | Shift Roll/Air-Dash | Roll→J Uppercut | Air+S+J Slam | J/K Combo | R Restart'
    this.hpEl = this.hud.querySelector('[data-hp]')
    this.timeEl = this.hud.querySelector('[data-time]')
    this.waveEl = this.hud.querySelector('[data-wave]')
    this.koEl = this.hud.querySelector('[data-ko]')
    this.skillsEl = this.hud.querySelector('[data-skills]')
    this.skillReadyEl = this.hud.querySelector('[data-skill-ready]')
    this.skillListEl = this.hud.querySelector('[data-skill-list]')
    this.helpEl = this.hud.querySelector('.arena-help')
    this.msgEl = this.hud.querySelector('[data-msg]')
    this.toastEl = this.hud.querySelector('[data-toast]')
    this.introEl = this.hud.querySelector('[data-intro]')
    this.titleScreenEl = this.hud.querySelector('[data-title-screen]')
    this.howToScreenEl = this.hud.querySelector('[data-howto-screen]')
    this.hudEl = this.hud.querySelector('.arena-hud')
    this.skillPanelEl = this.hud.querySelector('.arena-skill-panel')
    this.pauseEl = this.hud.querySelector('[data-pause]')
    this.pauseListEl = this.hud.querySelector('[data-pause-list]')

    this.hud.querySelector('[data-open-howto]').addEventListener('click', () => {
      this.audio.unlock()
      this.audio.uiClick()
      this.introStep = 'howto'
      this._syncIntroOverlay()
    })
    this.hud.querySelector('[data-back-title]').addEventListener('click', () => {
      this.audio.uiClick()
      this.introStep = 'title'
      this._syncIntroOverlay()
    })
    this.hud.querySelectorAll('[data-begin-run]').forEach((button) => {
      button.addEventListener('click', () => {
        this.audio.unlock()
        this.audio.uiClick()
        this.state = 'playing'
        this.introStep = 'hidden'
        this._syncIntroOverlay()
      })
    })
    this.hud.querySelectorAll('[data-fullscreen], [data-toggle-fullscreen]').forEach((button) => {
      button.addEventListener('click', () => {
        this.audio.uiClick()
        this._toggleFullscreen()
      })
    })
    this.hud.querySelector('[data-resume]').addEventListener('click', () => {
      this.audio.uiClick()
      if (this.state === 'paused') this._togglePause()
    })
  }

  _toggleFullscreen() {
    const target = document.documentElement
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.()
    }
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused'
      this._renderPauseSkills()
      this._syncPauseOverlay(true)
      this.audio.uiClick()
    } else if (this.state === 'paused') {
      this.state = 'playing'
      this._syncPauseOverlay(false)
      this.audio.uiClick()
    }
  }

  _syncPauseOverlay(visible = this.state === 'paused') {
    if (!this.pauseEl) return
    this.pauseEl.classList.toggle('hidden', !visible)
  }

  // 일시정지 화면: 현재 해금된 스킬만 커맨드/쿨다운과 함께 나열한다.
  _renderPauseSkills() {
    if (!this.pauseListEl) return

    const unlocked = SKILL_DISPLAY.filter((skill) => skill.isUnlocked(this.player))
    this.pauseListEl.innerHTML = unlocked.map((skill) => {
      const cooldown = skill.cooldown?.(this.player) ?? 0
      const cooling = cooldown > 0.05
      const status = cooling ? `${cooldown.toFixed(1)}s` : 'READY'
      const className = ['arena-skill', 'unlocked', cooling ? 'cooling' : 'ready'].join(' ')

      return `
        <div class="${className}">
          <div class="arena-skill-main">
            <b>${skill.name}</b>
            <kbd>${skill.command}</kbd>
          </div>
          <div class="arena-skill-sub">
            <span>${skill.detail}</span>
            <strong>${status}</strong>
          </div>
        </div>
      `
    }).join('')
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

    const progress = this.state === 'cleared' ? 'CLEAR' : this._objectiveProgress()
    this.timeEl.textContent = this._formatTime(this.elapsed)
    this.waveEl.textContent = `${this.waveIndex + 1}/${WAVES.length} / ${progress}`
    this.koEl.textContent = String(this.killCount)
    this.skillsEl.textContent = this._formatSkills()
    this._renderSkillPanel()
    this.helpEl.textContent = this._formatHelp()
    this._syncIntroOverlay()
  }

  _syncIntroOverlay() {
    if (!this.introEl) return

    const introVisible = this.state === 'start' && this.introStep !== 'hidden'
    this.introEl.classList.toggle('hidden', !introVisible)
    this.titleScreenEl.classList.toggle('hidden', this.introStep !== 'title')
    this.howToScreenEl.classList.toggle('hidden', this.introStep !== 'howto')
    this.msgEl.classList.toggle('hidden', introVisible)
    this.helpEl.classList.toggle('hidden', introVisible)
    this.hudEl.classList.toggle('hidden', introVisible)
    this.skillPanelEl.classList.toggle('hidden', introVisible)
  }

  _renderSkillPanel() {
    if (!this.skillListEl) return

    let readyCount = 0
    let unlockedCount = 0

    const rows = SKILL_DISPLAY.map((skill) => {
      const unlocked = skill.isUnlocked(this.player)
      const cooldown = unlocked ? skill.cooldown?.(this.player) ?? 0 : 0
      const cooling = unlocked && cooldown > 0.05
      const ready = unlocked && !cooling

      if (unlocked) unlockedCount += 1
      if (ready) readyCount += 1

      // 잠긴 스킬은 해금 조건(detail)을, 풀린 스킬은 쿨다운/READY 상태를 보여준다.
      const status = !unlocked ? 'LOCKED' : cooling ? `${cooldown.toFixed(1)}s` : 'READY'
      const sub = unlocked ? skill.detail : skill.detail
      const className = [
        'arena-skill',
        unlocked ? 'unlocked' : 'locked',
        ready ? 'ready' : '',
        cooling ? 'cooling' : '',
      ].filter(Boolean).join(' ')

      return `
        <div class="${className}">
          <div class="arena-skill-main">
            <b>${skill.name}</b>
            <kbd>${skill.command}</kbd>
          </div>
          <div class="arena-skill-sub">
            <span>${sub}</span>
            <strong>${status}</strong>
          </div>
        </div>
      `
    }).join('')

    this.skillListEl.innerHTML = rows
    if (this.skillReadyEl) this.skillReadyEl.textContent = `${readyCount}/${unlockedCount} READY`
  }

  _setMessage(text) {
    if (this.msgEl) this.msgEl.textContent = text
  }

  // 화면을 가리지 않는 상단 토스트. 해금/방 전환 안내용.
  _showToast(text, duration = 1800) {
    if (!this.toastEl) return

    this.toastEl.textContent = text
    this.toastEl.classList.remove('show')
    void this.toastEl.offsetWidth
    this.toastEl.classList.add('show')

    window.clearTimeout(this._toastTimer)
    this._toastTimer = window.setTimeout(() => {
      this.toastEl?.classList.remove('show')
    }, duration)
  }

  _skillLabel(skill) {
    return {
      kick: 'KICK',
      lunge: 'RUSH STRIKE',
      breaker: 'BREAKER',
      bolt: 'ECHO BOLT',
      shock: 'SHOCK',
    }[skill] ?? skill.toUpperCase()
  }

  _announceUnlock(skill) {
    const info = {
      kick: { label: 'KICK', how: 'K / K,K,K combo' },
      lunge: { label: 'RUSH STRIKE', how: 'J,K,K forward tech' },
      breaker: { label: 'BREAKER', how: 'K,K,J guard breaker' },
      bolt: { label: 'ECHO BOLT', how: 'K,J,K projectile' },
      shock: { label: 'SHOCK', how: 'J,J,K heavy / J,K,J line' },
    }[skill] ?? { label: skill.toUpperCase(), how: 'NEW J/K COMBO' }

    this._showToast(`▲ NEW TECH  ${info.label}   ${info.how}`, 2200)
    this.followCamera.shake(0.18, 0.22)
    this.audio.unlockJingle()
  }

  _formatSkills() {
    const skills = ['PUNCH']
    if (this.player.skills.kick) skills.push('KICK')
    if (this.player.skills.lunge) skills.push('RUSH')
    if (this.player.skills.breaker) skills.push('BREAK')
    if (this.player.skills.bolt) skills.push('BOLT')
    if (this.player.skills.shock) skills.push('SHOCK')
    return skills.join(' / ')
  }

  _formatHelp() {
    return 'A/D Move | Space Jump | Shift Roll/Air-Dash | Roll→J Uppercut | Air+S+J Slam | J/K Combo | R Restart'
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
