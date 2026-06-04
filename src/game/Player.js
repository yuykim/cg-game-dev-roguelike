import { SpriteAnimator } from './SpriteAnimator.js'

const GRAVITY = -28
const MOVE_SPEED = 8
const JUMP_FORCE = 14
const MAX_FALL = -22
const WALL_SLIDE_SPEED = -2
const ROLL_SPEED = 20
const ROLL_DURATION = 0.18
const ATTACK_DURATION = 0.32
const ATTACK_COMBO_WINDOW = 0.42
const INVINCIBLE_AFTER_HIT = 1.2
const COYOTE_TIME = 0.11
const JUMP_BUFFER_TIME = 0.12
const ROLL_TRAIL_INTERVAL = 0.045

export class Player {
  constructor(scene, input) {
    this.input = input

    this.spawnX = 0
    this.spawnY = 2

    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = 0
    this.vy = 0
    this.width = 0.7
    this.height = 1.1

    this.isGrounded = false
    this.touchingWallLeft = false
    this.touchingWallRight = false
    this.facingDir = 1

    this.isRolling = false
    this.rollTimer = 0
    this.rollDir = 1
    this.airRollUsed = false
    this.rollTrailTimer = 0

    this.attackTimer = 0
    this.attackHasHit = false
    this.attackComboStep = 1
    this.attackComboWindow = 0
    this.attackId = 0
    this.jumpBufferTimer = 0
    this.coyoteTimer = 0

    this.maxHp = 3
    this.hp = this.maxHp
    this.isInvincible = false
    this.invincibleTimer = 0

    this.sprite = new SpriteAnimator(scene)
    this.events = []
  }

  get bounds() {
    const halfWidth = this.width / 2
    const halfHeight = this.height / 2

    return {
      left: this.x - halfWidth,
      right: this.x + halfWidth,
      bottom: this.y - halfHeight,
      top: this.y + halfHeight,
    }
  }

  get isAttacking() {
    return this.attackTimer > 0
  }

  get attackBounds() {
    const reach = 0.85
    const vertical = 0.75
    const centerX = this.x + this.facingDir * (this.width / 2 + reach / 2)

    return {
      left: centerX - reach / 2,
      right: centerX + reach / 2,
      bottom: this.y - vertical / 2,
      top: this.y + vertical / 2,
    }
  }

  setSpawn(x, y) {
    this.spawnX = x
    this.spawnY = y
    this.resetToSpawn({ restoreHp: true })
  }

  resetToSpawn({ restoreHp = false } = {}) {
    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = 0
    this.vy = 0
    this.isGrounded = false
    this.touchingWallLeft = false
    this.touchingWallRight = false
    this.isRolling = false
    this.rollTimer = 0
    this.airRollUsed = false
    this.rollTrailTimer = 0
    this.attackTimer = 0
    this.attackHasHit = false
    this.attackComboStep = 1
    this.attackComboWindow = 0
    this.attackId = 0
    this.jumpBufferTimer = 0
    this.coyoteTimer = 0

    if (restoreHp) this.hp = this.maxHp

    this.syncVisual(0)
  }

  update(dt, platforms) {
    const wasGrounded = this.isGrounded
    const previousVy = this.vy

    this._tickInvincibility(dt)
    this._tickJumpHelpers(dt)
    this._handleAttack(dt)
    this._handleRoll(dt)

    if (!this.isRolling) {
      this._applyGravity(dt)
      this._handleHorizontal()
    }

    this.x += this.vx * dt
    this._resolveX(platforms)

    this.y += this.vy * dt
    this._resolveY(platforms)

    if (!wasGrounded && this.isGrounded && previousVy < -2) {
      this._emit('land', { impact: Math.min(1, Math.abs(previousVy) / 22) })
    }

    this._handleBufferedJump()
    this.syncVisual(dt)
  }

  captureSnapshot() {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      isGrounded: this.isGrounded,
      touchingWallLeft: this.touchingWallLeft,
      touchingWallRight: this.touchingWallRight,
      facingDir: this.facingDir,
      isRolling: this.isRolling,
      rollTimer: this.rollTimer,
      rollDir: this.rollDir,
      airRollUsed: this.airRollUsed,
      rollTrailTimer: this.rollTrailTimer,
      attackTimer: this.attackTimer,
      attackHasHit: this.attackHasHit,
      attackComboStep: this.attackComboStep,
      attackComboWindow: this.attackComboWindow,
      attackId: this.attackId,
      animationState: this._getAnimationState(),
      jumpBufferTimer: this.jumpBufferTimer,
      coyoteTimer: this.coyoteTimer,
      hp: this.hp,
      isInvincible: this.isInvincible,
      invincibleTimer: this.invincibleTimer,
    }
  }

  applySnapshot(snapshot) {
    Object.assign(this, snapshot)
    this.syncVisual(0)
  }

  takeDamage() {
    if (this.isInvincible) return false

    this.hp = Math.max(0, this.hp - 1)
    this.isInvincible = true
    this.invincibleTimer = INVINCIBLE_AFTER_HIT
    this._emit('damage')
    return true
  }

  consumeAttackHit() {
    if (!this.isAttacking || this.attackHasHit) return false

    this.attackHasHit = true
    return true
  }

  syncVisual(dt) {
    const state = this._getAnimationState()
    const flashing = this.isInvincible && Math.floor(performance.now() / 80) % 2 === 0

    this.sprite.setTransform(
      this.x,
      this.y,
      this.facingDir,
      this.height,
      flashing ? 0.35 : 1,
    )
    this.sprite.play(state, dt)
  }

  consumeEvents() {
    const events = this.events
    this.events = []
    return events
  }

  _handleHorizontal() {
    if (this.input.left) {
      this.vx = -MOVE_SPEED
      this.facingDir = -1
    } else if (this.input.right) {
      this.vx = MOVE_SPEED
      this.facingDir = 1
    } else {
      this.vx = 0
    }
  }

  _tickJumpHelpers(dt) {
    if (this.input.jump) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt)
    }

    if (this.isGrounded) {
      this.coyoteTimer = COYOTE_TIME
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt)
    }
  }

  _handleBufferedJump() {
    if (this.jumpBufferTimer <= 0 || this.isRolling) return

    if (this.isGrounded) {
      this.vy = JUMP_FORCE
      this.isGrounded = false
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('jump')
    } else if (this.coyoteTimer > 0) {
      this.vy = JUMP_FORCE
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('jump')
    } else if (this.touchingWallLeft) {
      this.vy = JUMP_FORCE
      this.vx = MOVE_SPEED * 1.1
      this.facingDir = 1
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('wallJump')
    } else if (this.touchingWallRight) {
      this.vy = JUMP_FORCE
      this.vx = -MOVE_SPEED * 1.1
      this.facingDir = -1
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('wallJump')
    }
  }

  _handleRoll(dt) {
    if (this.isRolling) {
      this.rollTimer -= dt
      this.rollTrailTimer -= dt
      this.vx = this.rollDir * ROLL_SPEED
      this.vy = 0

      if (this.rollTrailTimer <= 0) {
        this.rollTrailTimer = ROLL_TRAIL_INTERVAL
        this.sprite.spawnAfterimage()
      }

      if (this.rollTimer <= 0) {
        this.isRolling = false
        this.vx = 0
      }

      return
    }

    if (!this.input.roll) return
    if (!this.isGrounded && this.airRollUsed) return

    this.isRolling = true
    this.rollTimer = ROLL_DURATION
    this.rollDir = this.facingDir
    this.rollTrailTimer = 0
    this.isInvincible = true
    this.invincibleTimer = ROLL_DURATION
    this.attackTimer = 0
    this.attackHasHit = false
    this._emit('roll')

    if (!this.isGrounded) this.airRollUsed = true
  }

  _handleAttack(dt) {
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt)
      if (this.attackTimer === 0) this.attackHasHit = false
    }

    this.attackComboWindow = Math.max(0, this.attackComboWindow - dt)

    if (!this.input.attack || this.isRolling) return

    this.attackComboStep = this.attackComboWindow > 0
      ? (this.attackComboStep % 3) + 1
      : 1
    this.attackTimer = ATTACK_DURATION
    this.attackComboWindow = ATTACK_COMBO_WINDOW
    this.attackHasHit = false
    this.attackId += 1
    this._emit('attack')
  }

  _applyGravity(dt) {
    const wallSliding =
      (this.touchingWallLeft || this.touchingWallRight) &&
      !this.isGrounded &&
      this.vy < 0

    if (wallSliding) {
      this.vy = Math.max(this.vy + GRAVITY * dt, WALL_SLIDE_SPEED)
    } else {
      this.vy = Math.max(this.vy + GRAVITY * dt, MAX_FALL)
    }
  }

  _resolveX(platforms) {
    this.touchingWallLeft = false
    this.touchingWallRight = false

    for (const platform of platforms) {
      if (platform.destroyed) continue

      const platformBounds = platform.bounds
      const playerBounds = this.bounds
      if (!overlaps(playerBounds, platformBounds)) continue

      if (this.x <= platform.x) {
        this.x = platformBounds.left - this.width / 2
        this.vx = 0
        this.touchingWallRight = true
      } else {
        this.x = platformBounds.right + this.width / 2
        this.vx = 0
        this.touchingWallLeft = true
      }
    }
  }

  _resolveY(platforms) {
    this.isGrounded = false

    for (const platform of platforms) {
      if (platform.destroyed) continue

      const platformBounds = platform.bounds
      const playerBounds = this.bounds
      if (!overlaps(playerBounds, platformBounds)) continue

      if (this.y <= platform.y) {
        this.y = platformBounds.bottom - this.height / 2
        this.vy = 0
      } else {
        this.y = platformBounds.top + this.height / 2
        this.vy = 0
        this.isGrounded = true
        this.airRollUsed = false
        this.coyoteTimer = COYOTE_TIME
      }
    }
  }

  _tickInvincibility(dt) {
    if (!this.isInvincible) return

    this.invincibleTimer -= dt
    if (this.invincibleTimer <= 0) this.isInvincible = false
  }

  _getAnimationState() {
    if (this.isRolling) return 'roll'

    const wallSliding =
      (this.touchingWallLeft || this.touchingWallRight) &&
      !this.isGrounded &&
      this.vy < 0

    if (wallSliding) return 'wallSlide'
    if (this.attackTimer > 0) return `attack${this.attackComboStep}`
    if (!this.isGrounded) return this.vy >= 0 ? 'jumpRise' : 'jumpFall'
    if (Math.abs(this.vx) > 0.1) return 'run'

    return 'idle'
  }

  _emit(type, data = {}) {
    this.events.push({ type, ...data })
  }
}

export function overlaps(a, b) {
  return a.right > b.left && a.left < b.right && a.top > b.bottom && a.bottom < b.top
}
