import * as THREE from 'three'

export class Platform {
  constructor(scene, x, y, w, h, color = 0x555566) {
    this.x = x
    this.y = y
    this.w = w
    this.h = h

    const geo = new THREE.BoxGeometry(w, h, 1.2)
    const mat = new THREE.MeshLambertMaterial({ color })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(x, y, 0)
    scene.add(this.mesh)
  }

  get bounds() {
    return {
      left:   this.x - this.w / 2,
      right:  this.x + this.w / 2,
      bottom: this.y - this.h / 2,
      top:    this.y + this.h / 2,
    }
  }
}
