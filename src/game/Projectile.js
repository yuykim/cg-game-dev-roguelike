import * as THREE from 'three'

export class Projectile {
  constructor(scene, x, y, dir, options = {}) {
    this.scene = scene
    this.x = x
    this.y = y
    this.dir = dir >= 0 ? 1 : -1
    this.speed = options.speed ?? 9
    this.damage = options.damage ?? 1
    this.width = 0.34
    this.height = 0.24
    this.life = options.life ?? 3.4
    this.reflected = false
    this.destroyed = false

    const geometry = new THREE.SphereGeometry(0.16, 12, 8)
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8c42,
      transparent: true,
      opacity: 0.95,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.renderOrder = 18
    this.mesh.position.set(this.x, this.y, 0.9)
    this.scene.add(this.mesh)
  }

  get bounds() {
    const hw = this.width / 2
    const hh = this.height / 2
    return {
      left: this.x - hw,
      right: this.x + hw,
      bottom: this.y - hh,
      top: this.y + hh,
    }
  }

  update(dt) {
    this.life -= dt
    this.x += this.dir * this.speed * dt
    this.mesh.position.set(this.x, this.y, 0.9)
    this.mesh.rotation.y += this.dir * dt * 12
    if (this.life <= 0) this.destroyed = true
  }

  reflect() {
    this.reflected = true
    this.dir *= -1
    this.speed *= 1.18
    this.damage += 1
    this.mesh.material.color.setHex(0x69e7ff)
  }

  destroy() {
    this.destroyed = true
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
