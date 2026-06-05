import * as THREE from 'three'

export class HitSparks {
  constructor(scene) {
    this.scene = scene
    this.particles = []
    this.geometry = new THREE.PlaneGeometry(0.22, 0.22)
  }

  burst(x, y, dir = 1, strength = 1, colorOverride = null) {
    const count = Math.round(5 + strength * 4)
    const color = colorOverride ?? (strength >= 1.2 ? 0xfff1a8 : 0xffffff)

    for (let i = 0; i < count; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(this.geometry, mat)
      mesh.position.set(x, y, 0.9)
      mesh.renderOrder = 20
      this.scene.add(mesh)

      const angle = (Math.random() - 0.5) * Math.PI * 0.9
      const speed = (4 + Math.random() * 6) * strength
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed * dir + dir * 2,
        vy: Math.sin(angle) * speed,
        life: 0.18 + Math.random() * 0.12,
        maxLife: 0.3,
        spin: (Math.random() - 0.5) * 20,
      })
    }

    const flashMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const flash = new THREE.Mesh(this.geometry, flashMat)
    flash.position.set(x + dir * 0.2, y, 0.92)
    flash.scale.setScalar(2 + strength)
    flash.renderOrder = 19
    this.scene.add(flash)
    this.particles.push({
      mesh: flash,
      vx: 0,
      vy: 0,
      life: 0.1,
      maxLife: 0.1,
      spin: 0,
      grow: 9,
    })
  }

  // 광역 충격파 링 (확장하며 사라짐)
  ring(x, y, color = 0xffffff) {
    const geo = new THREE.RingGeometry(0.15, 0.32, 28)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, 0.9)
    mesh.renderOrder = 21
    this.scene.add(mesh)
    this.particles.push({
      mesh,
      vx: 0,
      vy: 0,
      life: 0.34,
      maxLife: 0.34,
      spin: 0,
      grow: 28,
      fixed: true,
      ownGeo: geo,
    })
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i]
      p.life -= dt
      const ratio = Math.max(0, p.life / p.maxLife)

      if (!p.fixed) {
        p.mesh.position.x += p.vx * dt
        p.mesh.position.y += p.vy * dt
        p.vy -= 14 * dt
      }
      p.mesh.rotation.z += p.spin * dt
      p.mesh.material.opacity = ratio * (p.fixed ? 0.9 : 1)
      if (p.grow) p.mesh.scale.addScalar(p.grow * dt)

      if (p.life > 0) continue

      this.scene.remove(p.mesh)
      p.mesh.material.dispose()
      if (p.ownGeo) p.ownGeo.dispose()
      this.particles.splice(i, 1)
    }
  }
}
