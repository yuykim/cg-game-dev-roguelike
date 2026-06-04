export class Camera {
  constructor(threeCamera) {
    this.cam = threeCamera
    this.cam.position.set(0, 2, 18)
    this._cx = 0
    this._cy = 2
  }

  // Frame-rate independent smooth follow with lag
  update(targetX, targetY, dt) {
    const speed = 5
    const factor = 1 - Math.exp(-speed * dt)
    this._cx += (targetX - this._cx) * factor
    this._cy += (targetY + 1 - this._cy) * factor

    this.cam.position.x = this._cx
    this.cam.position.y = this._cy
    this.cam.position.z = 18
    this.cam.lookAt(this._cx, this._cy, 0)
  }
}
