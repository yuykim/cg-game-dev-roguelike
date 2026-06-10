export class InputManager {
  constructor() {
    this._held = {}
    this._justPressed = {}
    this._pending = {}

    window.addEventListener('keydown', (e) => {
      if (!this._held[e.code]) this._pending[e.code] = true
      this._held[e.code] = true
      e.preventDefault()
    })
    window.addEventListener('keyup', (e) => {
      this._held[e.code] = false
    })
  }

  // Call once at the start of each frame
  flush() {
    this._justPressed = { ...this._pending }
    this._pending = {}
  }

  isDown(code) { return !!this._held[code] }
  isJustPressed(code) { return !!this._justPressed[code] }

  get left()  { return this.isDown('KeyA') || this.isDown('ArrowLeft') }
  get right() { return this.isDown('KeyD') || this.isDown('ArrowRight') }
  get jump()  { return this.isJustPressed('Space') }
  // 구르기/대시/슬램 트리거 (Shift/Ctrl). 지상=구르기, 공중=대시, 공중+아래=슬램
  get roll()  {
    return (
      this.isJustPressed('ShiftLeft') ||
      this.isJustPressed('ShiftRight') ||
      this.isJustPressed('ControlLeft') ||
      this.isJustPressed('ControlRight')
    )
  }
  // 아래 방향키 (S / ArrowDown) — 공중 슬램 입력 조합용
  get down()  { return this.isDown('KeyS') || this.isDown('ArrowDown') }
  get attack(){ return this.isJustPressed('KeyJ') }
  get kick(){ return this.isJustPressed('KeyK') }
  get restart(){ return this.isJustPressed('KeyR') }
}
