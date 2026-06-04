import * as THREE from 'three'
import { overlaps } from '../game/Player.js'

export class Button {
  constructor(scene, x, y, options = {}) {
    this.scene = scene
    this.x = x
    this.y = y
    this.w = 0.82
    this.h = 0.22
    this.ghostOnly = options.ghostOnly ?? false
    this.pressed = false

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.w, this.h, 0.5),
      new THREE.MeshLambertMaterial({
        color: this.ghostOnly ? 0x46f5ff : 0x53ff83,
        emissive: this.ghostOnly ? 0x12383c : 0x103b1d,
      }),
    )
    this.mesh.position.set(x, y - 0.36, 0.72)
    scene.add(this.mesh)
  }

  get bounds() {
    return {
      left: this.x - this.w / 2,
      right: this.x + this.w / 2,
      bottom: this.y - 0.5,
      top: this.y + 0.2,
    }
  }

  update(player, ghost) {
    const playerPressed = !this.ghostOnly && overlaps(player.bounds, this.bounds)
    const ghostPressed = ghost.active && overlaps(ghost.bounds, this.bounds)
    this.pressed = playerPressed || ghostPressed

    this.mesh.scale.y = this.pressed ? 0.45 : 1
    this.mesh.material.emissiveIntensity = this.pressed ? 1.4 : 0.55
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

