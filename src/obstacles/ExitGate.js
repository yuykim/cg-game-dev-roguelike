import * as THREE from 'three'

export class ExitGate {
  constructor(scene, x, y) {
    this.scene = scene
    this.x = x
    this.y = y
    this.w = 0.9
    this.h = 1.2

    const group = new THREE.Group()

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 1.25, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x35ff88, wireframe: true }),
    )
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.72, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x35ff88, transparent: true, opacity: 0.32 }),
    )

    group.add(frame)
    group.add(core)
    group.position.set(x, y, 0.78)

    this.mesh = group
    scene.add(group)
  }

  get bounds() {
    return {
      left: this.x - this.w / 2,
      right: this.x + this.w / 2,
      bottom: this.y - this.h / 2,
      top: this.y + this.h / 2,
    }
  }

  update(elapsed) {
    this.mesh.rotation.y = Math.sin(elapsed * 2) * 0.12
    this.mesh.children[1].material.opacity = 0.22 + Math.sin(elapsed * 5) * 0.12
  }

  dispose() {
    this.scene.remove(this.mesh)
    for (const child of this.mesh.children) {
      child.geometry.dispose()
      child.material.dispose()
    }
  }
}

