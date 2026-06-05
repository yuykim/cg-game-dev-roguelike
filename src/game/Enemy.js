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
  attackHeavy: { sequence: 'Combat/ShockHeavy', fps: 14, loop: false },
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
    windup: 0.58,
    active: 0.22,
    recovery: 0.68,
    cooldown: 1.45,
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
    grantSkill: 'guard',
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
      this.vx = intent.moveDir * this.speed * intent.speedScale
      if (intent.jump) this._jump(intent.leapVx)
      else this._tryStartAttack(player, director)
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
    let moveDir = dir
    let speedScale = 1

    if (this._isPlayerInAttackStartRange(player)) {
      moveDir = 0
      speedScale = 0
    } else if (absDx < this.preferredRange && Math.abs(dy) < 0.7) {
      moveDir = -dir
      speedScale = 0.55
    }

    if (this.skirmisher && this.attackCooldown > 0.28 && absDx < 2.0 && Math.abs(dy) < 1.2) {
      moveDir = this.sideBias
      speedScale = 0.8
    }

    const leapVx = this._targetLeapVelocity(dx, dy)

    return {
      faceDir: dir,
      moveDir,
      speedScale,
      jump: this._shouldJump(player, platforms, dir, dx, dy),
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
  }

  _isPlayerInAttackStartRange(player) {
    const dx = Math.abs(player.x - this.x)
    const dy = Math.abs(player.y - this.y)
    return dx <= this.attackDef.range + 0.38 && dy <= this.attackDef.vertical * 0.85
  }

  _updateAttack(dt, player) {
    this.attackTimer -= dt

    if (this.attackPhase === 'windup') {
      this.vx = 0
      if (this.attackTimer <= 0) {
        this.attackPhase = 'active'
        this.attackTimer = this.attackDef.active
        this.attackHasHit = false
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
    if (!overlaps(this.attackBounds, player.bounds)) return

    this.attackHasHit = true
    player.takeDamage(this.attackDef.damage, this.x)
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

  _shouldJump(player, platforms, dir, dx, dy) {
    if (!this.isGrounded || this.jumpCooldown > 0) return false

    const absDx = Math.abs(dx)
    if (dy > 0.75 && absDx < 7.5) return true
    if (this.blockedDir === dir && dy > -0.35) return true
    if (this.stuckTimer > 0.18 && dy > -0.45) return true
    if (absDx < 1.4 && dy > 0.35) return true
    if (!this._hasGroundAhead(platforms, dir) && dy >= -0.2 && absDx > 1.0) return true

    return false
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
    if (dy <= 0.75 || absDx < 0.4 || absDx > 8.0) return null

    const estimatedTime = Math.max(0.42, Math.min(0.92, absDx / Math.max(4.5, this.speed * 1.25)))
    const vx = dx / estimatedTime
    return Math.max(-9.5, Math.min(9.5, vx))
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
