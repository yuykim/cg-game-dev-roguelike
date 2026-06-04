import * as THREE from 'three'

export class Hazard {
  constructor(scene, x, y, type = 'spike') {
    this.scene = scene
    this.x = x
    this.y = y
    this.currentX = x
    this.currentY = y
    this.w = type === 'laserV' ? 0.26 : type === 'laserH' ? 1 : 0.8
    this.h = type === 'laserV' ? 1 : type === 'laserH' ? 0.26 : 0.8
    this.type = type
    this.active = true

    if (type === 'orb') {
      this.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 18, 18),
        new THREE.MeshLambertMaterial({ color: 0xffc53d, emissive: 0x503000 }),
      )
    } else if (type === 'laserV') {
      this.mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xff3048 }),
      )
    } else if (type === 'laserH') {
      this.mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.18, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xff3048 }),
      )
    } else {
      this.mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 0.82, 3),
        new THREE.MeshLambertMaterial({ color: 0xf04444, emissive: 0x300000 }),
      )
      this.mesh.rotation.z = Math.PI
    }

    this.mesh.position.set(x, y, 0.7)
    scene.add(this.mesh)
  }

  get bounds() {
    return {
      left: this.currentX - this.w / 2,
      right: this.currentX + this.w / 2,
      bottom: this.currentY - this.h / 2,
      top: this.currentY + this.h / 2,
    }
  }

  update(elapsed) {
    if (this.type === 'orb') {
      this.currentY = this.y + Math.sin(elapsed * 3 + this.x) * 0.18
      this.mesh.position.y = this.currentY
      return
    }

    if (this.type === 'laserV' || this.type === 'laserH') {
      const phase = (elapsed * 1.65 + this.x * 0.17 + this.y * 0.11) % 2
      this.active = phase < 1.15
      this.mesh.material.opacity = this.active ? 0.78 : 0.12
      this.mesh.material.transparent = true
    }
  }

  captureSnapshot() {
    return {
      currentX: this.currentX,
      currentY: this.currentY,
      active: this.active,
      opacity: this.mesh.material.opacity ?? 1,
    }
  }

  applySnapshot(snapshot) {
    this.currentX = snapshot.currentX
    this.currentY = snapshot.currentY
    this.active = snapshot.active
    this.mesh.position.x = this.currentX
    this.mesh.position.y = this.currentY
    this.mesh.material.opacity = snapshot.opacity
    this.mesh.material.transparent = this.type === 'laserV' || this.type === 'laserH'
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
