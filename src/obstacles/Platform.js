import * as THREE from 'three'

export class Platform {
  constructor(scene, x, y, w, h, color = 0x555566, options = {}) {
    this.scene = scene
    this.x = x
    this.y = y
    this.w = w
    this.h = h
    this.breakable = options.breakable ?? false
    this.maxHits = options.hitsToBreak ?? 1
    this.hitsRemaining = this.maxHits
    this.destroyed = false
    this.motion = options.motion ?? null
    this.baseX = x
    this.baseY = y
    this.prevX = x
    this.prevY = y
    this.dx = 0
    this.dy = 0

    const geo = new THREE.BoxGeometry(w, h, 1.2)
    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: this.breakable,
      opacity: this.breakable ? 0.9 : 1,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(x, y, 0)
    scene.add(this.mesh)
  }

  update(elapsed) {
    this.prevX = this.x
    this.prevY = this.y

    if (this.motion) {
      const phase = elapsed * this.motion.speed + this.motion.phase
      const amount = Math.sin(phase) * this.motion.amplitude
      this.x = this.baseX + this.motion.x * amount
      this.y = this.baseY + this.motion.y * amount
      this.mesh.position.set(this.x, this.y, 0)
    }

    this.dx = this.x - this.prevX
    this.dy = this.y - this.prevY
  }

  get bounds() {
    return {
      left:   this.x - this.w / 2,
      right:  this.x + this.w / 2,
      bottom: this.y - this.h / 2,
      top:    this.y + this.h / 2,
    }
  }

  destroy() {
    this.setDestroyed(true)
  }

  hit() {
    if (!this.breakable || this.destroyed) return false

    this.hitsRemaining -= 1
    this.mesh.material.opacity = this.hitsRemaining > 1 ? 0.56 : 0.9

    if (this.hitsRemaining <= 0) {
      this.destroy()
      return true
    }

    return false
  }

  setDestroyed(destroyed) {
    if (!this.breakable && destroyed) return
    if (this.destroyed === destroyed) return

    this.destroyed = destroyed
    this.mesh.visible = !destroyed
  }

  captureSnapshot() {
    return {
      x: this.x,
      y: this.y,
      prevX: this.prevX,
      prevY: this.prevY,
      dx: this.dx,
      dy: this.dy,
      destroyed: this.destroyed,
      hitsRemaining: this.hitsRemaining,
    }
  }

  applySnapshot(snapshot) {
    this.x = snapshot.x
    this.y = snapshot.y
    this.prevX = snapshot.prevX
    this.prevY = snapshot.prevY
    this.dx = snapshot.dx
    this.dy = snapshot.dy
    this.hitsRemaining = snapshot.hitsRemaining ?? this.maxHits
    this.setDestroyed(snapshot.destroyed)
    this.mesh.material.opacity = this.breakable && this.hitsRemaining > 1 ? 0.56 : 0.9
    this.mesh.position.set(this.x, this.y, 0)
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
