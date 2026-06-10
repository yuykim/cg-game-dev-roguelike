export class Camera {
  constructor(threeCamera) {
    this.cam = threeCamera
    this.cam.position.set(0, 2, 18)
    this._cx = 0
    this._cy = 2
    this.shakeTime = 0
    this.shakeDuration = 0
    this.shakeStrength = 0

    // 방향성 킥 (타격 방향으로 카메라를 톡 밀었다가 복귀)
    this.kickX = 0
    this.kickY = 0

    // FOV 펀치 (큰 타격 시 순간적으로 살짝 줌인 → 복귀)
    this.baseFov = threeCamera.fov
    this.fovPunch = 0
  }

  // Frame-rate independent smooth follow with lag
  update(targetX, targetY, dt) {
    const speed = 5
    const factor = 1 - Math.exp(-speed * dt)
    this._cx += (targetX - this._cx) * factor
    this._cy += (targetY + 1 - this._cy) * factor

    const shake = this._getShakeOffset(dt)

    // 킥은 스프링처럼 0으로 복귀
    const kickDecay = 1 - Math.exp(-16 * dt)
    this.kickX -= this.kickX * kickDecay
    this.kickY -= this.kickY * kickDecay

    this.cam.position.x = this._cx + shake.x + this.kickX
    this.cam.position.y = this._cy + shake.y + this.kickY
    this.cam.position.z = 18
    this.cam.lookAt(this._cx, this._cy, 0)

    // FOV 펀치 복귀
    if (this.fovPunch > 0.001) {
      this.fovPunch -= this.fovPunch * (1 - Math.exp(-12 * dt))
      this.cam.fov = this.baseFov - this.fovPunch
      this.cam.updateProjectionMatrix()
    } else if (this.fovPunch !== 0) {
      this.fovPunch = 0
      this.cam.fov = this.baseFov
      this.cam.updateProjectionMatrix()
    }
  }

  shake(strength = 0.12, duration = 0.18) {
    if (strength < this.shakeStrength && this.shakeTime > 0) return

    this.shakeStrength = strength
    this.shakeDuration = duration
    this.shakeTime = duration
  }

  // 타격 방향으로 카메라를 밀어 묵직한 임팩트를 준다.
  kick(dirX = 0, dirY = 0, amount = 0.4) {
    this.kickX += dirX * amount
    this.kickY += dirY * amount
  }

  // 강한 타격 시 순간 줌인. amount는 줄어드는 fov(도) 양.
  punch(amount = 3) {
    this.fovPunch = Math.max(this.fovPunch, amount)
  }

  // 묵직한 타격용 통합 헬퍼 (흔들림 + 방향 킥 + 줌 펀치).
  impact({ shake = 0.18, duration = 0.18, dirX = 0, dirY = 0, kick = 0, fov = 0 } = {}) {
    this.shake(shake, duration)
    if (kick) this.kick(dirX, dirY, kick)
    if (fov) this.punch(fov)
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
