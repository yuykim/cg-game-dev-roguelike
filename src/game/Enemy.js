import { SpriteAnimator } from './SpriteAnimator.js'
import { overlaps } from './Player.js'

const ENEMY_STATES = {
  idle: { sequence: 'Idle', fps: 7, loop: true },
  run: { sequence: 'Run', fps: 12, loop: true },
  jumpRise: { sequence: 'JumpRise', fps: 1, loop: true },
  jumpFall: { sequence: 'JumpFall', fps: 1, loop: true },
  attackLight: { sequence: 'Combat/PunchA', fps: 16, loop: false },
  attackFast: { sequence: 'Combat/PunchB', fps: 18, loop: false },
  attackKick: { sequence: 'Combat/KickA', fps: 17, loop: false },
  attackGuard: { sequence: 'Combat/GuardImpact', fps: 16, loop: false },
  attackHeavy: { sequence: 'Combat/ShockHeavy', fps: 7, loop: false },
  attackShoot: { sequence: 'Combat/ShockLight', fps: 14, loop: false },
  hurt: { sequence: 'Knockback', fps: 16, loop: false },
  die: { sequence: 'Die', fps: 14, loop: false },
}

const GRAVITY = -28
const MAX_FALL = -22
const HURT_DURATION = 0.28
const KNOCKBACK_DECAY = 6
const DEATH_DURATION = 0.7

const ATTACKS = {
  jab: {
    state: 'attackLight',
    damage: 1,
    windup: 0.28,
    active: 0.14,
    recovery: 0.34,
    cooldown: 0.92,
    range: 1.0,
    vertical: 0.9,
    lungeSpeed: 1.4,
  },
  lunge: {
    state: 'attackFast',
    damage: 2,
    windup: 0.2,
    active: 0.16,
    recovery: 0.42,
    cooldown: 1.05,
    range: 1.18,
    vertical: 0.82,
    lungeSpeed: 8.0,
  },
  kick: {
    state: 'attackKick',
    damage: 2,
    windup: 0.26,
    active: 0.18,
    recovery: 0.44,
    cooldown: 1.05,
    range: 1.32,
    vertical: 0.9,
    lungeSpeed: 4.2,
  },
  guardBash: {
    state: 'attackGuard',
    damage: 1,
    windup: 0.34,
    active: 0.16,
    recovery: 0.5,
    cooldown: 1.12,
    range: 1.05,
    vertical: 0.98,
    lungeSpeed: 2.2,
  },
  smash: {
    state: 'attackHeavy',
    damage: 3,
    windup: 0.38,
    active: 0.18,
    recovery: 0.56,
    cooldown: 1.35,
    shape: 'circle',
    radius: 2.25,
    range: 1.42,
    vertical: 1.1,
    lungeSpeed: 1.0,
  },
  shoot: {
    state: 'attackShoot',
    damage: 2,
    windup: 0.46,
    active: 0.12,
    recovery: 0.62,
    cooldown: 1.4,
    range: 8.5,
    vertical: 2.7,
    lungeSpeed: 0,
    projectile: true,
    projectileSpeed: 9.5,
  },
  snipe: {
    state: 'attackShoot',
    damage: 3,
    windup: 0.66,
    active: 0.12,
    recovery: 0.78,
    cooldown: 1.85,
    range: 10.5,
    vertical: 2.4,
    lungeSpeed: 0,
    projectile: true,
    projectileSpeed: 12.5,
  },
}

export const ENEMY_TYPES = {
  grunt: {
    tint: 0xff5555,
    hp: 3,
    speed: 3.5,
    scale: 1.0,
    jumpForce: 13.2,
    jumpCooldown: 0.72,
    preferredRange: 0.7,
    attack: ATTACKS.jab,
  },
  fast: {
    tint: 0xffd24a,
    hp: 2,
    speed: 6.2,
    scale: 0.95,
    jumpForce: 14.4,
    jumpCooldown: 0.52,
    preferredRange: 1.0,
    skirmisher: true,
    attack: ATTACKS.lunge,
  },
  kicker: {
    tint: 0x48e07d,
    hp: 3,
    speed: 4.25,
    scale: 1.0,
    jumpForce: 13.8,
    jumpCooldown: 0.6,
    preferredRange: 1.05,
    attack: ATTACKS.kick,
    grantSkill: 'kick',
  },
  guarder: {
    tint: 0x69e7ff,
    hp: 5,
    speed: 2.55,
    scale: 1.08,
    kbResist: 0.25,
    jumpForce: 12.1,
    jumpCooldown: 0.95,
    preferredRange: 0.82,
    attack: ATTACKS.guardBash,
  },
  shooter: {
    tint: 0xff8c42,
    hp: 3,
    speed: 2.9,
    scale: 1.0,
    jumpForce: 12.8,
    jumpCooldown: 0.85,
    preferredRange: 4.2,
    skirmisher: true,
    attack: ATTACKS.shoot,
    grantSkill: 'bolt',
  },
  sniper: {
    tint: 0xffbe63,
    hp: 3,
    speed: 2.25,
    scale: 1.02,
    jumpForce: 12.4,
    jumpCooldown: 1.05,
    preferredRange: 6.1,
    skirmisher: true,
    attack: ATTACKS.snipe,
  },
  tank: {
    tint: 0xb066ff,
    hp: 6,
    speed: 2.15,
    scale: 1.25,
    kbResist: 0.45,
    jumpForce: 11.6,
    jumpCooldown: 1.05,
    preferredRange: 0.9,
    attack: ATTACKS.smash,
    grantSkill: 'shock',
  },
  warden: {
    tint: 0xd8a2ff,
    hp: 11,
    speed: 1.8,
    scale: 1.48,
    kbResist: 0.58,
    jumpForce: 11.2,
    jumpCooldown: 1.15,
    preferredRange: 1.0,
    attack: ATTACKS.smash,
  },
}

export class Enemy {
  constructor(scene, x, y, typeKey = 'grunt') {
    const def = ENEMY_TYPES[typeKey] ?? ENEMY_TYPES.grunt
    this.type = typeKey
    this.tint = def.tint
    this.maxHp = def.hp
    this.hp = def.hp
    this.speed = def.speed
    this.kbResist = def.kbResist ?? 0
    this.jumpForce = def.jumpForce
    this.jumpCooldownBase = def.jumpCooldown
    this.preferredRange = def.preferredRange
    this.skirmisher = def.skirmisher ?? false
    this.attackDef = def.attack
    this.grantSkill = def.grantSkill ?? null

    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.width = 0.7 * def.scale
    this.height = 1.1 * def.scale
    this.facingDir = -1

    this.isGrounded = false
    this.state = 'spawning'
    this.spawnTimer = 0.45
    this.hurtTimer = 0
    this.deathTimer = 0
    this.flashTimer = 0
    this.jumpCooldown = Math.random() * 0.25
    this.attackCooldown = 0
    this.attackPhase = 'idle'
    this.attackTimer = 0
    this.attackDir = -1
    this.attackHasHit = false
    this.blockedDir = 0
    this.stuckTimer = 0
    this.sideBias = Math.random() < 0.5 ? -1 : 1
    this.events = []

    this.sprite = new SpriteAnimator(scene, {
      states: ENEMY_STATES,
      tint: this.tint,
      z: 0.7,
      renderOrder: 8,
    })
    this.scaleFactor = def.scale
  }

  get bounds() {
    const hw = this.width / 2
    const hh = this.height / 2
    return { left: this.x - hw, right: this.x + hw, bottom: this.y - hh, top: this.y + hh }
  }

  get attackBounds() {
    const def = this.attackDef

    if (def.shape === 'circle') {
      const radius = def.radius ?? def.range
      return {
        left: this.x - radius,
        right: this.x + radius,
        bottom: this.y - radius,
        top: this.y + radius,
      }
    }

    const centerX = this.x + this.attackDir * (this.width / 2 + def.range / 2)
    return {
      left: centerX - def.range / 2,
      right: centerX + def.range / 2,
      bottom: this.y - def.vertical / 2,
      top: this.y + def.vertical / 2,
    }
  }

  get isDead() {
    return this.state === 'dead'
  }

  get isAlive() {
    return (
      this.state === 'alive' ||
      this.state === 'attacking' ||
      this.state === 'hurt' ||
      this.state === 'spawning'
    )
  }

  get isThreatening() {
    return this.state === 'attacking' && this.attackPhase !== 'recovery'
  }

  consumeEvents() {
    const events = this.events
    this.events = []
    return events
  }

  update(dt, player, platforms, director = null) {
    this.flashTimer = Math.max(0, this.flashTimer - dt)
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)

    if (this.state === 'spawning') {
      this.spawnTimer -= dt
      this.vx = 0
      this._applyGravity(dt)
      const previousY = this.y
      this.y += this.vy * dt
      this._resolveY(platforms, previousY)
      if (this.spawnTimer <= 0) this.state = 'alive'
      this._syncVisual(dt)
      return
    }

    if (this.state === 'dying') {
      this._updateDying(dt, platforms)
      return
    }

    if (this.state === 'hurt') {
      this.hurtTimer -= dt
      this.vx *= 1 - Math.min(1, KNOCKBACK_DECAY * dt)
      if (this.hurtTimer <= 0) this.state = 'alive'
    } else if (this.state === 'attacking') {
      this._updateAttack(dt, player)
    } else {
      const intent = this._chooseIntent(player, platforms)
      this.facingDir = intent.faceDir

      if (this.isGrounded) {
        this.vx = intent.moveDir * this.speed * intent.speedScale
        if (intent.jump) this._jump(intent.leapVx)
        else this._tryStartAttack(player, director)
      } else {
        const targetVx = intent.moveDir * this.speed * intent.speedScale
        const airControl = Math.min(1, 2.8 * dt)
        this.vx += (targetVx - this.vx) * airControl
      }
    }

    this._applyGravity(dt)
    const previousX = this.x
    const intendedVx = this.vx
    this.blockedDir = 0

    this.x += this.vx * dt
    this._resolveX(platforms)

    if (this.isGrounded && Math.abs(intendedVx) > 0.1 && Math.abs(this.x - previousX) < 0.015) {
      this.stuckTimer += dt
    } else {
      this.stuckTimer = 0
    }

    const previousY = this.y
    this.y += this.vy * dt
    this._resolveY(platforms, previousY)
    this._syncVisual(dt)
  }

  takeHit(damage, knockbackDir, knockbackForce) {
    if (!this.isAlive) return false

    this.hp -= damage
    this.flashTimer = 0.1
    const kb = knockbackForce * (1 - this.kbResist)
    this.vx = knockbackDir * kb
    this.vy = Math.max(this.vy, kb * 0.35)

    if (this.hp <= 0) {
      this.state = 'dying'
      this.attackPhase = 'idle'
      this.deathTimer = DEATH_DURATION
    } else {
      this.state = 'hurt'
      this.attackPhase = 'idle'
      this.hurtTimer = HURT_DURATION
    }
    return true
  }

  _updateDying(dt, platforms) {
    this.deathTimer -= dt
    this._applyGravity(dt)
    const previousY = this.y
    this.y += this.vy * dt
    this._resolveY(platforms, previousY)
    this.vx *= 1 - Math.min(1, KNOCKBACK_DECAY * dt)
    this.x += this.vx * dt
    if (this.deathTimer <= 0) this.state = 'dead'
    this._syncVisual(dt)
  }

  _chooseIntent(player, platforms) {
    const dx = player.x - this.x
    const dy = player.y - this.y
    const absDx = Math.abs(dx)
    const dir = Math.sign(dx) || this.facingDir
    const chasePlatform = this._findChasePlatform(player, platforms, dir)
    let moveDir = dir
    let speedScale = 1

    if (this._isPlayerInAttackStartRange(player)) {
      moveDir = 0
      speedScale = 0
    } else if (chasePlatform) {
      moveDir = Math.sign(chasePlatform.x - this.x) || dir
      speedScale = 1
    } else if (absDx < this.preferredRange && Math.abs(dy) < 0.7) {
      moveDir = -dir
      speedScale = 0.55
    }

    if (this.skirmisher && this.attackCooldown > 0.28 && absDx < 2.0 && Math.abs(dy) < 1.2) {
      moveDir = this.sideBias
      speedScale = 0.8
    }

    const leapVx = chasePlatform
      ? this._targetLeapVelocity(chasePlatform.x - this.x, chasePlatform.y - this.y)
      : this._targetLeapVelocity(dx, dy)

    return {
      faceDir: dir,
      moveDir,
      speedScale,
      jump: this._shouldJump(player, platforms, dir, dx, dy, chasePlatform),
      leapVx,
    }
  }

  _tryStartAttack(player, director) {
    if (this.attackCooldown > 0) return
    if (!this._isPlayerInAttackStartRange(player)) return
    if (director && !director.tryUseAttackSlot()) return

    this.state = 'attacking'
    this.attackPhase = 'windup'
    this.attackTimer = this.attackDef.windup
    this.attackDir = Math.sign(player.x - this.x) || this.facingDir
    this.facingDir = this.attackDir
    this.attackHasHit = false
    this.vx = 0
    this._queueAttackTelegraph()
  }

  _isPlayerInAttackStartRange(player) {
    const dx = Math.abs(player.x - this.x)
    const dy = Math.abs(player.y - this.y)

    if (this.attackDef.shape === 'circle') {
      return Math.hypot(dx, dy) <= (this.attackDef.radius ?? this.attackDef.range) + 0.45
    }

    return dx <= this.attackDef.range + 0.38 && dy <= this.attackDef.vertical * 0.85
  }

  _queueAttackTelegraph() {
    const def = this.attackDef
    const duration = def.windup + def.active
    const color = def.projectile
      ? 0xff8c42
      : def.state === 'attackHeavy'
        ? 0xb066ff
        : 0xff4d57

    if (def.shape === 'circle') {
      this.events.push({
        type: 'attackTelegraph',
        shape: 'circle',
        x: this.x,
        y: this.y + 0.1,
        radius: def.radius ?? def.range,
        duration,
        color,
      })
      return
    }

    if (def.projectile) {
      const height = 0.34
      const centerX = this.x + this.attackDir * (this.width / 2 + def.range / 2)
      const centerY = this.y + 0.32
      this.events.push({
        type: 'attackTelegraph',
        shape: 'rect',
        bounds: {
          left: centerX - def.range / 2,
          right: centerX + def.range / 2,
          bottom: centerY - height / 2,
          top: centerY + height / 2,
        },
        duration,
        color,
      })
      return
    }

    this.events.push({
      type: 'attackTelegraph',
      shape: 'rect',
      bounds: { ...this.attackBounds },
      duration,
      color,
    })
  }

  _queueAttackImpact() {
    const def = this.attackDef
    if (def.state !== 'attackHeavy') return

    this.events.push({
      type: 'attackImpact',
      shape: def.shape ?? 'rect',
      x: this.x,
      y: this.y + 0.1,
      radius: def.radius ?? def.range,
      color: 0xb066ff,
    })
  }

  _updateAttack(dt, player) {
    this.attackTimer -= dt

    if (this.attackPhase === 'windup') {
      this.vx = 0
      if (this.attackTimer <= 0) {
        this.attackPhase = 'active'
        this.attackTimer = this.attackDef.active
        this.attackHasHit = false
        this._queueAttackImpact()
      }
      return
    }

    if (this.attackPhase === 'active') {
      this.vx = this.attackDir * this.attackDef.lungeSpeed
      if (this.attackDef.projectile) {
        this._tryFireProjectile()
      } else {
        this._tryApplyAttackHit(player)
      }
      if (this.attackTimer <= 0) {
        this.attackPhase = 'recovery'
        this.attackTimer = this.attackDef.recovery
        this.vx = 0
      }
      return
    }

    this.vx *= 1 - Math.min(1, 10 * dt)
    if (this.attackTimer <= 0) {
      this.state = 'alive'
      this.attackPhase = 'idle'
      this.attackCooldown = this.attackDef.cooldown
      this.vx = 0
    }
  }

  _tryApplyAttackHit(player) {
    if (this.attackHasHit) return
    if (!this._attackHitsPlayer(player)) return

    this.attackHasHit = true
    player.takeDamage(this.attackDef.damage, this.x)
  }

  _attackHitsPlayer(player) {
    if (this.attackDef.shape !== 'circle') {
      return overlaps(this.attackBounds, player.bounds)
    }

    const radius = this.attackDef.radius ?? this.attackDef.range
    const centerX = this.x
    const centerY = this.y + 0.1
    const b = player.bounds
    const closestX = clamp(centerX, b.left, b.right)
    const closestY = clamp(centerY, b.bottom, b.top)
    return Math.hypot(closestX - centerX, closestY - centerY) <= radius
  }

  _tryFireProjectile() {
    if (this.attackHasHit) return

    this.attackHasHit = true
    this.events.push({
      type: 'shoot',
      x: this.x + this.attackDir * (this.width / 2 + 0.38),
      y: this.y + 0.32,
      dir: this.attackDir,
      speed: this.attackDef.projectileSpeed,
      damage: this.attackDef.damage,
    })
  }

  _shouldJump(player, platforms, dir, dx, dy, chasePlatform = null) {
    if (!this.isGrounded || this.jumpCooldown > 0) return false

    const absDx = Math.abs(dx)
    if (chasePlatform) return true
    if (dy > 0.75 && absDx < 7.5) return true
    if (this.blockedDir === dir && dy > -0.35) return true
    if (this.stuckTimer > 0.18 && dy > -0.45) return true
    if (absDx < 1.4 && dy > 0.35) return true
    if (!this._hasGroundAhead(platforms, dir) && dy >= -0.2 && absDx > 1.0) return true

    return false
  }

  _findChasePlatform(player, platforms, dir) {
    const playerAbove = player.y - this.y > 0.7
    if (!playerAbove || !this.isGrounded) return null

    const currentFootY = this.y - this.height / 2
    const maxJumpHeight = (this.jumpForce * this.jumpForce) / (2 * Math.abs(GRAVITY)) * 0.92
    const minLandingGap = 0.35
    const maxHorizontal = 8.8
    let best = null
    let bestScore = -Infinity

    for (const platform of platforms) {
      if (platform.destroyed || !platform.oneWay) continue

      const b = platform.bounds
      const landingY = b.top + this.height / 2
      const dy = landingY - this.y
      if (dy < minLandingGap || dy > maxJumpHeight) continue

      const padding = Math.min(0.45, Math.max(0, platform.w / 2 - 0.1))
      const minX = b.left + padding
      const maxX = b.right - padding
      const playerBiasedX = clamp(player.x, minX, maxX)
      const pathBiasedX = clamp(this.x + dir * 4.2, minX, maxX)
      const targetX = Math.abs(playerBiasedX - this.x) <= maxHorizontal
        ? playerBiasedX
        : pathBiasedX
      const dx = targetX - this.x
      if (Math.abs(dx) > maxHorizontal) continue

      const horizontalProgress = Math.max(0, Math.sign(player.x - this.x) * (targetX - this.x))
      const verticalProgress = b.top - currentFootY
      const playerDistance = Math.abs(player.x - targetX) + Math.abs(player.y - landingY) * 1.4
      const score = verticalProgress * 3 + horizontalProgress * 0.45 - playerDistance * 0.25

      if (score <= bestScore) continue
      bestScore = score
      best = { x: targetX, y: landingY }
    }

    return best
  }

  _hasGroundAhead(platforms, dir) {
    const checkX = this.x + dir * (this.width / 2 + 0.45)
    const footY = this.y - this.height / 2

    return platforms.some((p) => {
      if (p.destroyed) return false
      const b = p.bounds
      const withinX = checkX >= b.left && checkX <= b.right
      const nearTop = footY >= b.top - 0.18 && footY <= b.top + 0.72
      return withinX && nearTop
    })
  }

  _targetLeapVelocity(dx, dy) {
    const absDx = Math.abs(dx)
    if (dy <= 0.45 || absDx < 0.25 || absDx > 9.2) return null

    const gravity = Math.abs(GRAVITY)
    const discriminant = this.jumpForce * this.jumpForce - 2 * gravity * dy
    if (discriminant < 0) return null

    const airTime = (this.jumpForce + Math.sqrt(discriminant)) / gravity
    const estimatedTime = Math.max(0.38, Math.min(1.12, airTime))
    const vx = dx / estimatedTime
    return Math.max(-11.5, Math.min(11.5, vx))
  }

  _jump(leapVx = null) {
    this.vy = Math.max(this.vy, this.jumpForce)
    if (leapVx != null) this.vx = leapVx
    this.isGrounded = false
    this.jumpCooldown = this.jumpCooldownBase
  }

  _applyGravity(dt) {
    this.vy = Math.max(this.vy + GRAVITY * dt, MAX_FALL)
  }

  _resolveX(platforms) {
    for (const p of platforms) {
      if (p.destroyed) continue
      if (p.oneWay) continue
      if (!overlaps(this.bounds, p.bounds)) continue

      this.blockedDir = Math.sign(this.vx) || this.facingDir
      if (this.x <= p.x) {
        this.x = p.bounds.left - this.width / 2
      } else {
        this.x = p.bounds.right + this.width / 2
      }
      this.vx = 0
    }
  }

  _resolveY(platforms, previousY = this.y) {
    this.isGrounded = false
    for (const p of platforms) {
      if (p.destroyed) continue
      if (!overlaps(this.bounds, p.bounds)) continue

      if (p.oneWay) {
        const b = p.bounds
        const previousBottom = previousY - this.height / 2
        const currentBottom = this.bounds.bottom
        const falling = this.vy <= 0
        const crossedTop = previousBottom >= b.top - 0.08
        const nearTop = currentBottom <= b.top + 0.18
        if (!falling || !crossedTop || !nearTop) continue

        this.y = b.top + this.height / 2
        this.vy = 0
        this.isGrounded = true
        continue
      }

      if (this.y <= p.y) {
        this.y = p.bounds.bottom - this.height / 2
        this.vy = 0
      } else {
        this.y = p.bounds.top + this.height / 2
        this.vy = 0
        this.isGrounded = true
      }
    }
  }

  _animState() {
    if (this.state === 'dying') return 'die'
    if (this.state === 'hurt') return 'hurt'
    if (this.state === 'spawning') return 'idle'
    if (this.state === 'attacking') return this.attackDef.state
    if (!this.isGrounded) return this.vy >= 0 ? 'jumpRise' : 'jumpFall'
    if (Math.abs(this.vx) > 0.1) return 'run'
    return 'idle'
  }

  _syncVisual(dt) {
    let opacity = 1
    if (this.state === 'dying') opacity = Math.max(0, this.deathTimer / DEATH_DURATION)
    else if (this.state === 'spawning') opacity = 0.25 + 0.75 * (1 - this.spawnTimer / 0.45)

    const spawnFlash = this.state === 'spawning' && Math.floor(this.spawnTimer * 20) % 2 === 0
    const windupFlash =
      this.state === 'attacking' &&
      this.attackPhase === 'windup' &&
      Math.floor(performance.now() / 90) % 2 === 0
    const activeFlash = this.state === 'attacking' && this.attackPhase === 'active'
    const tint = this.flashTimer > 0
      ? 0xffffff
      : activeFlash
        ? 0xff2f2f
        : windupFlash
          ? 0xffb23f
          : spawnFlash
            ? 0x66ffee
            : this.tint

    this.sprite.setTransform(this.x, this.y, this.facingDir, this.height, opacity)
    this.sprite.setTint(tint)
    this.sprite.play(this._animState(), dt)
  }

  dispose() {
    this.sprite.dispose?.()
    this.sprite.group?.parent?.remove(this.sprite.group)
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
