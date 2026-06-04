import * as THREE from 'three'
import { InputManager } from './InputManager.js'
import { Player } from './Player.js'
import { Camera } from './Camera.js'
import { Platform } from '../obstacles/Platform.js'

export class Game {
  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    document.body.appendChild(this.renderer.domElement)

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d0d14)
    this.scene.fog = new THREE.Fog(0x0d0d14, 20, 60)

    // Camera
    this.threeCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100)
    this.followCamera = new Camera(this.threeCamera)

    // Lights
    this._setupLights()

    // Systems
    this.input = new InputManager()

    // Entities
    this.platforms = []
    this._buildTestMap()
    this.player = new Player(this.scene, this.input)

    // Loop state
    this._lastTime = performance.now()

    window.addEventListener('resize', () => this._onResize())
  }

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(4, 10, 8)
    this.scene.add(dir)

    // Blue rim from behind for the 2.5D vibe
    const rim = new THREE.DirectionalLight(0x3366ff, 0.4)
    rim.position.set(-4, 2, -6)
    this.scene.add(rim)
  }

  _buildTestMap() {
    const add = (x, y, w, h, color) => {
      const p = new Platform(this.scene, x, y, w, h, color)
      this.platforms.push(p)
    }

    // Ground
    add(0, -2, 30, 1)

    // Basic platforms
    add(-5,  1, 4, 0.8)
    add( 0,  3, 3, 0.8)
    add( 5,  2, 4, 0.8)
    add( 9,  4, 3, 0.8)

    // Wall for wall-jump practice
    add(-9, 2, 1, 6, 0x334455)

    // Tall wall on right
    add(13, 3, 1, 8, 0x334455)

    // High platform only reachable by wall jump
    add(11, 7, 4, 0.8, 0x226644)
  }

  start() {
    requestAnimationFrame((t) => this._loop(t))
  }

  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05)
    this._lastTime = timestamp

    this.input.flush()
    this.player.update(dt, this.platforms)
    this.followCamera.update(this.player.x, this.player.y, dt)

    this.renderer.render(this.scene, this.threeCamera)
    requestAnimationFrame((t) => this._loop(t))
  }

  _onResize() {
    this.threeCamera.aspect = window.innerWidth / window.innerHeight
    this.threeCamera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
