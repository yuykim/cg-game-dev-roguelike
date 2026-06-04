import { SpriteAnimator } from './SpriteAnimator.js'

const GRAVITY = -28
const MOVE_SPEED = 8
const JUMP_FORCE = 14
const MAX_FALL = -22
const WALL_SLIDE_SPEED = -2
const DASH_SPEED = 20
const DASH_DURATION = 0.14
const ROLL_SPEED = 11
const ROLL_DURATION = 0.38
const ATTACK_DURATION = 0.32
const INVINCIBLE_AFTER_HIT = 1.2

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

    this.isDashing = false
    this.dashTimer = 0
    this.dashDir = 1
    this.airDashUsed = false

    this.isRolling = false
    this.rollTimer = 0
    this.rollDir = 1

    this.attackTimer = 0

    this.isInvincible = false
    this.invincibleTimer = 0
    this.hp = 3

    this.sprite = new SpriteAnimator(scene)
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

  update(dt, platforms) {
    this._tickInvincibility(dt)
    this._handleAttack(dt)
    this._handleDash(dt)
    this._handleRoll(dt)

    if (!this.isDashing) {
      this._applyGravity(dt)
    }

    if (!this.isDashing && !this.isRolling) {
      this._handleHorizontal()
    }

    this.x += this.vx * dt
    this._resolveX(platforms)

    this.y += this.vy * dt
    this._resolveY(platforms)

    this._handleJump()
    this._resetIfFallen()
    this._syncVisual(dt)
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

  _handleJump() {
    if (!this.input.jump || this.isDashing) return

    if (this.isGrounded) {
      this.vy = JUMP_FORCE
      this.isRolling = false
    } else if (this.touchingWallLeft) {
      this.vy = JUMP_FORCE
      this.vx = MOVE_SPEED * 1.1
      this.facingDir = 1
    } else if (this.touchingWallRight) {
      this.vy = JUMP_FORCE
      this.vx = -MOVE_SPEED * 1.1
      this.facingDir = -1
    }
  }

  _handleDash(dt) {
    if (this.isDashing) {
      this.dashTimer -= dt
      this.vx = this.dashDir * DASH_SPEED
      this.vy = 0

      if (this.dashTimer <= 0) {
        this.isDashing = false
        this.vx = 0
      }

      return
    }

    if (!this.input.dash || this.isRolling) return
    if (!this.isGrounded && this.airDashUsed) return

    this.isDashing = true
    this.dashTimer = DASH_DURATION
    this.dashDir = this.facingDir
    this.isInvincible = true
    this.invincibleTimer = DASH_DURATION

    if (!this.isGrounded) this.airDashUsed = true
  }

  _handleRoll(dt) {
    if (this.isRolling) {
      this.rollTimer -= dt
      this.vx = this.rollDir * ROLL_SPEED

      if (this.rollTimer <= 0 || !this.isGrounded) {
        this.isRolling = false
      }

      return
    }

    if (!this.input.roll || !this.isGrounded || this.isDashing) return

    this.isRolling = true
    this.rollTimer = ROLL_DURATION
    this.rollDir = this.facingDir
    this.attackTimer = 0
  }

  _handleAttack(dt) {
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt)
    }

    if (!this.input.attack || this.isDashing || this.isRolling) return

    this.attackTimer = ATTACK_DURATION
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
        this.airDashUsed = false
      }
    }
  }

  takeDamage() {
    if (this.isInvincible) return false

    this.hp -= 1
    this.isInvincible = true
    this.invincibleTimer = INVINCIBLE_AFTER_HIT
    return true
  }

  _tickInvincibility(dt) {
    if (!this.isInvincible) return

    this.invincibleTimer -= dt
    if (this.invincibleTimer <= 0) this.isInvincible = false
  }

  _resetIfFallen() {
    if (this.y > -12) return

    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = 0
    this.vy = 0
    this.isDashing = false
    this.isRolling = false
    this.airDashUsed = false
  }

  _syncVisual(dt) {
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

  _getAnimationState() {
    if (this.isDashing) return 'dash'
    if (this.isRolling) return 'roll'

    const wallSliding =
      (this.touchingWallLeft || this.touchingWallRight) &&
      !this.isGrounded &&
      this.vy < 0

    if (wallSliding) return 'wallSlide'
    if (this.attackTimer > 0) return 'attack'
    if (!this.isGrounded) return this.vy >= 0 ? 'jumpRise' : 'jumpFall'
    if (Math.abs(this.vx) > 0.1) return 'run'

    return 'idle'
  }
}

function overlaps(a, b) {
  return a.right > b.left && a.left < b.right && a.top > b.bottom && a.bottom < b.top
}

