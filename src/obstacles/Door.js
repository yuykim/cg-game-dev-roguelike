import * as THREE from 'three'

export class Door {
  constructor(scene, x, y) {
    this.scene = scene
    this.x = x
    this.y = y
    this.w = 1
    this.h = 2
    this.destroyed = false
    this.open = false
    this.dx = 0
    this.dy = 0
    this.prevX = x
    this.prevY = y

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.w, this.h, 0.72),
      new THREE.MeshLambertMaterial({
        color: 0x37ff88,
        transparent: true,
        opacity: 0.82,
      }),
    )
    this.mesh.position.set(x, y, 0.58)
    scene.add(this.mesh)
  }

  get bounds() {
    return {
      left: this.x - this.w / 2,
      right: this.x + this.w / 2,
      bottom: this.y - this.h / 2,
      top: this.y + this.h / 2,
    }
  }

  update() {}

  setOpen(open) {
    if (this.open === open) return

    this.open = open
    this.destroyed = open
    this.mesh.visible = !open
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
      open: this.open,
    }
  }

  applySnapshot(snapshot) {
    this.setOpen(snapshot.open ?? snapshot.destroyed)
  }

  dispose() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

