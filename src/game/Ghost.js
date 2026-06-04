import { SpriteAnimator } from './SpriteAnimator.js'
import { overlaps } from './Player.js'

const GHOST_DISABLED_SECONDS = 1.5

export class Ghost {
  constructor(scene) {
    this.width = 0.7
    this.height = 1.1
    this.x = 0
    this.y = 0
    this.facingDir = 1
    this.attackTimer = 0
    this.attackComboStep = 1
    this.attackId = 0
    this.visible = false
    this.disabledTimer = 0
    this.lastAttackIdHit = 0

    this.sprite = new SpriteAnimator(scene, {
      tint: 0x66f6ff,
      opacity: 0.56,
      z: 0.62,
      renderOrder: 8,
    })
    this.sprite.setVisible(false)
  }

  get active() {
    return this.visible && this.disabledTimer <= 0
  }

  get status() {
    if (!this.visible) return 'ECHO RECORDING'
    if (this.disabledTimer > 0) return 'ECHO DISABLED'
    return 'ECHO ACTIVE'
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
    return this.active && this.attackTimer > 0
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

  reset() {
    this.visible = false
    this.disabledTimer = 0
    this.lastAttackIdHit = 0
    this.sprite.setVisible(false)
  }

  update(dt, snapshot, hazards) {
    if (!snapshot) {
      this.visible = false
      this.sprite.setVisible(false)
      return
    }

    this.visible = true
    this.x = snapshot.x
    this.y = snapshot.y
    this.facingDir = snapshot.facingDir
    this.attackTimer = snapshot.attackTimer
    this.attackComboStep = snapshot.attackComboStep ?? 1
    this.attackId = snapshot.attackId ?? 0

    this.disabledTimer = Math.max(0, this.disabledTimer - dt)

    if (this.disabledTimer <= 0) {
      for (const hazard of hazards) {
        if (!hazard.active) continue
        if (!overlaps(this.bounds, hazard.bounds)) continue

        this.disabledTimer = GHOST_DISABLED_SECONDS
        break
      }
    }

    const state = snapshot.animationState ?? 'idle'
    const opacity = this.disabledTimer > 0 ? 0.16 : 0.56
    this.sprite.setVisible(true)
    this.sprite.setTransform(this.x, this.y, this.facingDir, this.height, opacity)
    this.sprite.play(state, dt)
  }

  consumeAttackHit() {
    if (!this.isAttacking || this.attackId === this.lastAttackIdHit) return false

    this.lastAttackIdHit = this.attackId
    return true
  }
}

