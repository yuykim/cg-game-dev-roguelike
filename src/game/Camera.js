export class Camera {
  constructor(threeCamera) {
    this.cam = threeCamera
    this.cam.position.set(0, 2, 18)
    this._cx = 0
    this._cy = 2
    this.shakeTime = 0
    this.shakeDuration = 0
    this.shakeStrength = 0
  }

  // Frame-rate independent smooth follow with lag
  update(targetX, targetY, dt) {
    const speed = 5
    const factor = 1 - Math.exp(-speed * dt)
    this._cx += (targetX - this._cx) * factor
    this._cy += (targetY + 1 - this._cy) * factor

    const shake = this._getShakeOffset(dt)

    this.cam.position.x = this._cx + shake.x
    this.cam.position.y = this._cy + shake.y
    this.cam.position.z = 18
    this.cam.lookAt(this._cx, this._cy, 0)
  }

  shake(strength = 0.12, duration = 0.18) {
    if (strength < this.shakeStrength && this.shakeTime > 0) return

    this.shakeStrength = strength
    this.shakeDuration = duration
    this.shakeTime = duration
  }

  _getShakeOffset(dt) {
    if (this.shakeTime <= 0) return { x: 0, y: 0 }

    this.shakeTime = Math.max(0, this.shakeTime - dt)
    const ratio = this.shakeDuration <= 0 ? 0 : this.shakeTime / this.shakeDuration
    const strength = this.shakeStrength * ratio * ratio

    return {
      x: (Math.random() * 2 - 1) * strength,
      y: (Math.random() * 2 - 1) * strength,
    }
  }
}
