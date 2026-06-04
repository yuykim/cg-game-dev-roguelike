import * as THREE from 'three'

const STATE_DEFS = {
  idle: { sequence: 'Idle', fps: 7, loop: true },
  run: { sequence: 'Run', fps: 12, loop: true },
  jumpRise: { sequence: 'JumpRise', fps: 1, loop: true },
  jumpFall: { sequence: 'JumpFall', fps: 1, loop: true },
  dash: { sequence: 'Dash', fps: 22, loop: false },
  roll: { sequence: 'Roll', fps: 18, loop: false },
  wallSlide: { sequence: 'WallSlide', fps: 10, loop: true },
  attack: { sequence: 'Combat/PunchA', fps: 16, loop: false },
}

export class SpriteAnimator {
  constructor(scene, options = {}) {
    this.basePath = options.basePath ?? '/Sprites/'
    this.pixelsPerUnit = options.pixelsPerUnit ?? 32
    this.frameWidth = options.frameWidth ?? 96
    this.frameHeight = options.frameHeight ?? 84

    this.sequences = {}
    this.currentState = 'idle'
    this.frameIndex = 0
    this.frameTime = 0
    this.ready = false

    this.textureLoader = new THREE.TextureLoader()
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const geometry = new THREE.PlaneGeometry(
      this.frameWidth / this.pixelsPerUnit,
      this.frameHeight / this.pixelsPerUnit,
    )

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.renderOrder = 10

    this.group = new THREE.Group()
    this.group.add(this.mesh)
    scene.add(this.group)

    this._load()
  }

  async _load() {
    try {
      const response = await fetch(`${this.basePath}frames-manifest.json`)
      const manifest = await response.json()

      await Promise.all(
        Object.entries(STATE_DEFS).map(async ([state, def]) => {
          const files = manifest.sequences?.[def.sequence]
          if (!files?.length) return

          const textures = await Promise.all(
            files.map((file) => this._loadTexture(`${this.basePath}${file}`)),
          )

          this.sequences[state] = {
            textures: textures.filter(Boolean),
            fps: def.fps,
            loop: def.loop,
          }
        }),
      )

      this.ready = true
      this.play('idle', 0, true)
    } catch (error) {
      console.warn('Failed to load sprite assets.', error)
    }
  }

  _loadTexture(url) {
    return new Promise((resolve) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.magFilter = THREE.NearestFilter
          texture.minFilter = THREE.NearestFilter
          texture.generateMipmaps = false
          texture.wrapS = THREE.ClampToEdgeWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          texture.colorSpace = THREE.SRGBColorSpace
          texture.needsUpdate = true
          resolve(texture)
        },
        undefined,
        () => resolve(null),
      )
    })
  }

  play(state, dt, force = false) {
    if (!this.ready) return

    const nextState = this.sequences[state] ? state : 'idle'
    const changed = force || nextState !== this.currentState

    if (changed) {
      this.currentState = nextState
      this.frameIndex = 0
      this.frameTime = 0
      this._applyFrame()
    }

    const sequence = this.sequences[this.currentState]
    if (!sequence || sequence.textures.length <= 1) return

    this.frameTime += dt
    const duration = 1 / sequence.fps

    while (this.frameTime >= duration) {
      this.frameTime -= duration

      if (this.frameIndex < sequence.textures.length - 1) {
        this.frameIndex += 1
      } else if (sequence.loop) {
        this.frameIndex = 0
      }

      this._applyFrame()
    }
  }

  setTransform(x, y, facingDir, collisionHeight, opacity = 1) {
    const visualHeight = this.frameHeight / this.pixelsPerUnit
    const groundAlignedY = y - collisionHeight / 2 + visualHeight / 2

    this.group.position.set(x, groundAlignedY, 0.82)
    this.group.scale.x = facingDir >= 0 ? 1 : -1
    this.material.opacity = opacity
  }

  _applyFrame() {
    const sequence = this.sequences[this.currentState]
    const texture = sequence?.textures[this.frameIndex]
    if (!texture || this.material.map === texture) return

    this.material.map = texture
    this.material.needsUpdate = true
  }
}

