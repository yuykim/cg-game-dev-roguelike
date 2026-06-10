import { SpriteAnimator } from './SpriteAnimator.js'

const GRAVITY = -28
const MOVE_SPEED = 8
const JUMP_FORCE = 14
const MAX_FALL = -22
const WALL_SLIDE_SPEED = -2
const ROLL_SPEED = 20
const ROLL_DURATION = 0.18
const SLAM_SPEED = -36
const SLAM_RECOVERY = 0.16
const ATTACK_DURATION = 0.32
const ATTACK_COMBO_WINDOW = 0.42
const INVINCIBLE_AFTER_HIT = 1.2
const COYOTE_TIME = 0.11
const JUMP_BUFFER_TIME = 0.12
const ROLL_TRAIL_INTERVAL = 0.045
const HURT_DURATION = 0.22
const DAMAGE_FLASH_DURATION = 0.24
const HIT_KNOCKBACK = 7
const STARTING_HP = 10
const BASE_UPGRADES = {
  punchDamageBonus: 0,
  kickDamageBonus: 0,
  boltDamageBonus: 0,
  boltCooldownMultiplier: 1,
  shockDamageBonus: 0,
  shockRadiusBonus: 0,
  shockCooldownMultiplier: 1,
  skillDamageBonus: 0,
}
const SHOCK_MOVES = {
  heavy: {
    animation: 'shock',
    shape: 'circle',
    duration: 0.4,
    cooldown: 2.6,
    radius: 3.2,
    damage: 2,
    force: 18,
    label: 'SHOCK HEAVY',
  },
  light: {
    animation: 'shockLight',
    shape: 'rect',
    duration: 0.3,
    cooldown: 1.35,
    range: 3.75,
    vertical: 1.2,
    damage: 1,
    force: 11,
    label: 'SHOCK LINE',
  },
  bolt: {
    animation: 'shockLight',
    duration: 0.24,
    cooldown: 1.55,
    speed: 13,
    damage: 2,
    label: 'ECHO BOLT',
  },
  lunge: {
    animation: 'attack2',
    duration: 0.24,
    cooldown: 1.15,
    range: 2.75,
    vertical: 0.95,
    damage: 2,
    force: 16,
    label: 'RUSH STRIKE',
  },
  breaker: {
    animation: 'kick3',
    duration: 0.34,
    cooldown: 1.85,
    range: 1.55,
    vertical: 1.05,
    damage: 3,
    force: 19,
    label: 'BREAKER',
  },
  // 구르기 도중 J: 어퍼컷 런처 — 맞은 적을 공중으로 띄운다.
  uppercut: {
    animation: 'attack3',
    duration: 0.34,
    range: 1.6,
    vertical: 1.7,
    damage: 2,
    force: 6,
    launch: 17,
    hop: 9,
    label: 'UPPERCUT',
  },
}

const SLAM_COOLDOWN = 4.0

// 키 추가 없이 J/K 콤보로만 스킬 발동. (J,J,K = 충격파)
const SKILL_PATTERNS = [
  { skill: 'shock', move: 'heavy', seq: ['J', 'J', 'K'] },
  { skill: 'shock', move: 'light', seq: ['J', 'K', 'J'] },
  { skill: 'bolt', move: 'bolt', seq: ['K', 'J', 'K'] },
  { skill: 'lunge', move: 'lunge', seq: ['J', 'K', 'K'] },
  { skill: 'breaker', move: 'breaker', seq: ['K', 'K', 'J'] },
]

export class Player {
  constructor(scene, input) {
    this.input = input

    this.spawnX = 0
    this.spawnY = 2

    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = 0
    this.vy = 0
    this.width = 0.7
    this.height = 1.1

    this.isGrounded = false
    this.touchingWallLeft = false
    this.touchingWallRight = false
    this.facingDir = 1

    this.isRolling = false
    this.rollTimer = 0
    this.rollDir = 1
    this.airRollUsed = false
    this.rollTrailTimer = 0

    this.isSlamming = false

    this.attackTimer = 0
    this.attackHasHit = false
    this.attackComboStep = 1
    this.attackStyle = 'punch'
    this.attackComboWindow = 0
    this.attackId = 0
    this.comboSeq = []
    this.jumpBufferTimer = 0
    this.coyoteTimer = 0

    this.maxHp = STARTING_HP
    this.hp = this.maxHp
    this.isInvincible = false
    this.invincibleTimer = 0
    this.isDead = false
    this.hurtTimer = 0
    this.damageFlashTimer = 0
    this.shockTimer = 0
    this.shockCooldown = 0
    this.boltCooldown = 0
    this.lungeCooldown = 0
    this.breakerCooldown = 0
    this.slamCooldown = 0
    this.shockStyle = 'heavy'
    this.skills = { kick: false, shock: false, bolt: false, lunge: false, breaker: false }
    this.upgrades = { ...BASE_UPGRADES }

    this.sprite = new SpriteAnimator(scene)
    this.events = []
  }

  get bounds() {
    const halfWidth = this.width / 2
    const halfHeight = this.height / 2

    return {
      left: this.x - halfWidth,
      right: this.x + halfWidth,
      bottom: this.y - halfHeight,
      top: this.y + halfHeight,
    }
  }

  get isAttacking() {
    return this.attackTimer > 0
  }

  get isShocking() {
    return this.shockTimer > 0
  }

  get attackBounds() {
    const reach = this.attackStyle === 'kick' ? 1.18 : 0.85
    const vertical = this.attackStyle === 'kick' ? 0.82 : 0.75
    const centerX = this.x + this.facingDir * (this.width / 2 + reach / 2)

    return {
      left: centerX - reach / 2,
      right: centerX + reach / 2,
      bottom: this.y - vertical / 2,
      top: this.y + vertical / 2,
    }
  }

  setSpawn(x, y) {
    this.spawnX = x
    this.spawnY = y
    this.resetToSpawn({ restoreHp: true })
  }

  resetToSpawn({ restoreHp = false } = {}) {
    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = 0
    this.vy = 0
    this.isGrounded = false
    this.touchingWallLeft = false
    this.touchingWallRight = false
    this.isRolling = false
    this.rollTimer = 0
    this.airRollUsed = false
    this.rollTrailTimer = 0
    this.isSlamming = false
    this.attackTimer = 0
    this.attackHasHit = false
    this.attackComboStep = 1
    this.attackStyle = 'punch'
    this.attackComboWindow = 0
    this.attackId = 0
    this.comboSeq = []
    this.jumpBufferTimer = 0
    this.coyoteTimer = 0
    this.isDead = false
    this.hurtTimer = 0
    this.damageFlashTimer = 0
    this.shockTimer = 0
    this.shockCooldown = 0
    this.boltCooldown = 0
    this.lungeCooldown = 0
    this.breakerCooldown = 0
    this.slamCooldown = 0
    this.shockStyle = 'heavy'
    this.isInvincible = false
    this.invincibleTimer = 0
    this.sprite.setTint(0xffffff)

    if (restoreHp) this.hp = this.maxHp

    this.syncVisual(0)
  }

  update(dt, platforms) {
    const wasGrounded = this.isGrounded
    const previousVy = this.vy

    if (this.isDead) {
      this._applyGravity(dt)
      this.vx *= 1 - Math.min(1, 8 * dt)
      this.x += this.vx * dt
      this._resolveX(platforms)
      const previousY = this.y
      this.y += this.vy * dt
      this._resolveY(platforms, previousY)
      this.syncVisual(dt)
      return
    }

    this._tickInvincibility(dt)
    this._tickDamageFeedback(dt)
    this._tickHurt(dt)
    this._tickShock(dt)

    if (this.hurtTimer <= 0 && !this.isShocking && !this.isSlamming) {
      this._tickJumpHelpers(dt)
      this._handleAttack(dt)
      if (!this.isShocking) this._handleRoll(dt)
    }

    if (this.isSlamming) {
      this.vx = 0
      this.vy = SLAM_SPEED
    } else if (this.isShocking) {
      this._applyGravity(dt)
      this.vx = 0
    } else if (!this.isRolling && this.hurtTimer <= 0) {
      this._applyGravity(dt)
      this._handleHorizontal()
    } else if (this.hurtTimer > 0) {
      this._applyGravity(dt)
      this.vx *= 1 - Math.min(1, 7 * dt)
    }

    this.x += this.vx * dt
    this._resolveX(platforms)

    const previousY = this.y
    this.y += this.vy * dt
    this._resolveY(platforms, previousY)

    if (this.isSlamming && this.isGrounded) {
      this._resolveSlamLanding(previousVy)
    } else if (!wasGrounded && this.isGrounded && previousVy < -2) {
      this._emit('land', { impact: Math.min(1, Math.abs(previousVy) / 22) })
    }

    if (this.hurtTimer <= 0 && !this.isShocking && !this.isSlamming) this._handleBufferedJump()
    this.syncVisual(dt)
  }

  captureSnapshot() {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      isGrounded: this.isGrounded,
      touchingWallLeft: this.touchingWallLeft,
      touchingWallRight: this.touchingWallRight,
      facingDir: this.facingDir,
      isRolling: this.isRolling,
      rollTimer: this.rollTimer,
      rollDir: this.rollDir,
      airRollUsed: this.airRollUsed,
      rollTrailTimer: this.rollTrailTimer,
      attackTimer: this.attackTimer,
      attackHasHit: this.attackHasHit,
      attackComboStep: this.attackComboStep,
      attackStyle: this.attackStyle,
      attackComboWindow: this.attackComboWindow,
      attackId: this.attackId,
      animationState: this._getAnimationState(),
      jumpBufferTimer: this.jumpBufferTimer,
      coyoteTimer: this.coyoteTimer,
      hp: this.hp,
      maxHp: this.maxHp,
      isInvincible: this.isInvincible,
      invincibleTimer: this.invincibleTimer,
      isDead: this.isDead,
      hurtTimer: this.hurtTimer,
      damageFlashTimer: this.damageFlashTimer,
      shockTimer: this.shockTimer,
      shockCooldown: this.shockCooldown,
      boltCooldown: this.boltCooldown,
      lungeCooldown: this.lungeCooldown,
      breakerCooldown: this.breakerCooldown,
      shockStyle: this.shockStyle,
      skills: { ...this.skills },
      upgrades: { ...this.upgrades },
    }
  }

  applySnapshot(snapshot) {
    Object.assign(this, snapshot)
    this.syncVisual(0)
  }

  takeDamage(amount = 1, sourceX = null) {
    if (this.isDead || this.isInvincible) return false

    const previousHp = this.hp
    const damageDir = sourceX == null
      ? -this.facingDir
      : Math.sign(this.x - sourceX) || -this.facingDir
    const damage = Math.max(1, Math.round(amount))

    this.hp = Math.max(0, this.hp - damage)
    this.isInvincible = true
    this.invincibleTimer = INVINCIBLE_AFTER_HIT
    this.damageFlashTimer = DAMAGE_FLASH_DURATION
    this.hurtTimer = HURT_DURATION
    this.shockTimer = 0
    this.isSlamming = false
    this.isRolling = false
    this.rollTimer = 0
    this.attackTimer = 0
    this.attackHasHit = false
    this.vx = damageDir * HIT_KNOCKBACK * Math.min(1.45, 0.85 + damage * 0.15)
    this.vy = Math.max(this.vy, 3.5 + damage * 0.55)
    this._emit('damage', { amount: damage, dir: damageDir, hp: this.hp })

    if (this.hp <= 0 && previousHp > 0) {
      this.isDead = true
      this.hurtTimer = 0
      this.isInvincible = false
      this.invincibleTimer = 0
      this.vx = damageDir * (HIT_KNOCKBACK * 0.65)
      this.vy = Math.max(this.vy, 5)
      this._emit('death', { dir: damageDir })
    }

    return true
  }

  resetSkills() {
    this.skills = { kick: false, shock: false, bolt: false, lunge: false, breaker: false }
    this.resetUpgrades()
    this.maxHp = STARTING_HP
    this.hp = Math.min(this.hp, this.maxHp)
  }

  resetUpgrades() {
    this.upgrades = { ...BASE_UPGRADES }
  }

  unlockSkill(skill) {
    if (!(skill in this.skills) || this.skills[skill]) return false

    this.skills[skill] = true
    this._emit('skillUnlocked', { skill })
    return true
  }

  consumeAttackHit() {
    if (!this.isAttacking || this.attackHasHit) return false

    this.attackHasHit = true
    return true
  }

  syncVisual(dt) {
    const state = this._getAnimationState()
    const invincibleFlash =
      !this.isDead &&
      this.isInvincible &&
      this.damageFlashTimer <= 0 &&
      Math.floor(performance.now() / 80) % 2 === 0
    const damageFlash =
      this.damageFlashTimer > 0 &&
      Math.floor(performance.now() / 45) % 2 === 0

    this.sprite.setTransform(
      this.x,
      this.y,
      this.facingDir,
      this.height,
      invincibleFlash ? 0.35 : 1,
    )
    this.sprite.setTint(damageFlash ? 0xff3344 : 0xffffff)
    this.sprite.play(state, dt)
  }

  consumeEvents() {
    const events = this.events
    this.events = []
    return events
  }

  _handleHorizontal() {
    if (this.input.left) {
      this.vx = -MOVE_SPEED
      this.facingDir = -1
    } else if (this.input.right) {
      this.vx = MOVE_SPEED
      this.facingDir = 1
    } else {
      this.vx = 0
    }
  }

  _tickJumpHelpers(dt) {
    if (this.input.jump) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt)
    }

    if (this.isGrounded) {
      this.coyoteTimer = COYOTE_TIME
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt)
    }
  }

  _handleBufferedJump() {
    if (this.jumpBufferTimer <= 0 || this.isRolling) return

    if (this.isGrounded) {
      this.vy = JUMP_FORCE
      this.isGrounded = false
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('jump')
    } else if (this.coyoteTimer > 0) {
      this.vy = JUMP_FORCE
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('jump')
    } else if (this.touchingWallLeft) {
      this.vy = JUMP_FORCE
      this.vx = MOVE_SPEED * 1.1
      this.facingDir = 1
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('wallJump')
    } else if (this.touchingWallRight) {
      this.vy = JUMP_FORCE
      this.vx = -MOVE_SPEED * 1.1
      this.facingDir = -1
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      this._emit('wallJump')
    }
  }

  _handleRoll(dt) {
    if (this.isSlamming) return

    if (this.isRolling) {
      this.rollTimer -= dt
      this.rollTrailTimer -= dt
      this.vx = this.rollDir * ROLL_SPEED
      this.vy = 0

      if (this.rollTrailTimer <= 0) {
        this.rollTrailTimer = ROLL_TRAIL_INTERVAL
        this.sprite.spawnAfterimage()
      }

      if (this.rollTimer <= 0) {
        this.isRolling = false
        this.vx = 0
      }

      return
    }

    if (!this.input.roll) return

    // 지상 = 구르기, 공중 = 공중 대시(수평, 1회)
    if (!this.isGrounded && this.airRollUsed) return

    this.isRolling = true
    this.rollTimer = ROLL_DURATION
    this.rollDir = this.facingDir
    this.rollTrailTimer = 0
    this.isInvincible = true
    this.invincibleTimer = ROLL_DURATION
    this.attackTimer = 0
    this.attackHasHit = false
    this._emit(this.isGrounded ? 'roll' : 'airDash')

    if (!this.isGrounded) this.airRollUsed = true
  }

  _startSlam() {
    this.isSlamming = true
    this.isRolling = false
    this.rollTimer = 0
    this.attackTimer = 0
    this.attackHasHit = false
    this.vx = 0
    this.vy = SLAM_SPEED
    this.airRollUsed = true
    this.slamCooldown = SLAM_COOLDOWN
    this._emit('slamStart')
  }

  _resolveSlamLanding(previousVy) {
    this.isSlamming = false
    // 낙하 속도가 빠를수록 충격이 크다
    const impact = Math.min(1, Math.abs(previousVy) / Math.abs(SLAM_SPEED))
    this.shockStyle = 'heavy'
    this.shockTimer = SLAM_RECOVERY
    this.vx = 0
    this._emit('slam', { x: this.x, y: this.y - this.height / 2, dir: this.facingDir, impact })
  }

  _handleAttack(dt) {
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt)
      if (this.attackTimer === 0) this.attackHasHit = false
    }

    this.attackComboWindow = Math.max(0, this.attackComboWindow - dt)
    if (this.attackComboWindow <= 0) this.comboSeq = []

    if (this.isShocking) return

    // 구르기/공중 대시 도중 J → 어퍼컷 런처 (적을 공중으로 띄움)
    if (this.isRolling) {
      if (this.input.attack) this._startUppercut()
      return
    }

    // 입력은 J / K 둘뿐. K는 킥 또는 스킬(충격파)이 언락됐을 때만 유효 입력.
    const pressedJ = this.input.attack
    const kReady =
      this.skills.kick ||
      this.skills.shock ||
      this.skills.bolt ||
      this.skills.lunge ||
      this.skills.breaker
    const pressedK = kReady && this.input.kick
    if (!pressedJ && !pressedK) return

    // 공중에서 아래(S) + J → 아래찍기 슬램
    if (pressedJ && !this.isGrounded && this.input.down && this.slamCooldown <= 0) {
      this._startSlam()
      this.comboSeq = []
      return
    }

    const btn = pressedJ ? 'J' : 'K'
    this.comboSeq.push(btn)
    if (this.comboSeq.length > 4) this.comboSeq.shift()

    // 콤보 시퀀스가 스킬 패턴과 맞으면 평타 대신 스킬 발동
    for (const pattern of SKILL_PATTERNS) {
      if (!this.skills[pattern.skill]) continue
      if (pattern.skill === 'shock' && this.shockCooldown > 0) continue
      if (pattern.skill === 'bolt' && this.boltCooldown > 0) continue
      if (pattern.skill === 'lunge' && this.lungeCooldown > 0) continue
      if (pattern.skill === 'breaker' && this.breakerCooldown > 0) continue
      if (!this._suffixMatch(pattern.seq)) continue

      if (pattern.skill === 'shock') this._startShock(pattern.move)
      if (pattern.skill === 'bolt') this._startBolt()
      if (pattern.skill === 'lunge') this._startSkillRect('lunge')
      if (pattern.skill === 'breaker') this._startSkillRect('breaker')
      this.comboSeq = []
      return
    }

    this._startBasicAttack(btn)
  }

  _startBasicAttack(btn) {
    const style = btn === 'K' && this.skills.kick ? 'kick' : 'punch'
    const sameStyle = this.attackStyle === style

    this.attackStyle = style
    this.attackComboStep = this.attackComboWindow > 0 && sameStyle
      ? (this.attackComboStep % 3) + 1
      : 1
    this.attackTimer = ATTACK_DURATION
    this.attackComboWindow = ATTACK_COMBO_WINDOW
    this.attackHasHit = false
    this.attackId += 1
    this._emit('attack', { style: this.attackStyle, step: this.attackComboStep })
  }

  _startShock(move = 'heavy') {
    const def = SHOCK_MOVES[move] ?? SHOCK_MOVES.heavy

    this.shockTimer = def.duration
    this.shockCooldown = def.cooldown * this.upgrades.shockCooldownMultiplier
    this.shockStyle = move
    this.vx = 0
    this.attackTimer = 0
    this.attackHasHit = false
    this.isInvincible = true
    this.invincibleTimer = Math.max(this.invincibleTimer, def.duration)
    this._emit('shock', {
      move,
      label: def.label,
      shape: def.shape,
      x: this.x,
      y: this.y,
      dir: this.facingDir,
      radius: def.radius == null ? undefined : def.radius + this.upgrades.shockRadiusBonus,
      range: def.range,
      vertical: def.vertical,
      force: def.force,
      damage: def.damage + this.upgrades.shockDamageBonus,
      duration: def.duration,
    })
  }

  _startBolt() {
    const def = SHOCK_MOVES.bolt

    this.shockTimer = def.duration
    this.boltCooldown = def.cooldown * this.upgrades.boltCooldownMultiplier
    this.shockStyle = 'bolt'
    this.vx = 0
    this.attackTimer = 0
    this.attackHasHit = false
    this._emit('bolt', {
      label: def.label,
      x: this.x + this.facingDir * (this.width / 2 + 0.32),
      y: this.y + 0.35,
      dir: this.facingDir,
      speed: def.speed,
      damage: def.damage + this.upgrades.boltDamageBonus,
    })
  }

  // 구르기/대시를 J로 캔슬하는 어퍼컷. 살짝 솟구치며 적을 위로 띄운다.
  _startUppercut() {
    const def = SHOCK_MOVES.uppercut

    this.isRolling = false
    this.rollTimer = 0
    this.shockTimer = def.duration
    this.shockStyle = 'uppercut'
    this.attackTimer = 0
    this.attackHasHit = false
    this.vx = 0
    this.vy = Math.max(this.vy, def.hop)
    this.isGrounded = false
    this.isInvincible = true
    this.invincibleTimer = Math.max(this.invincibleTimer, def.duration * 0.6)
    this._emit('uppercut', {
      label: def.label,
      x: this.x,
      y: this.y,
      dir: this.facingDir,
      range: def.range,
      vertical: def.vertical,
      force: def.force,
      damage: def.damage,
      launch: def.launch,
      duration: def.duration,
    })
  }

  _startSkillRect(move) {
    const def = SHOCK_MOVES[move]
    if (!def) return

    this.shockTimer = def.duration
    this.shockStyle = move
    if (move === 'lunge') this.lungeCooldown = def.cooldown
    if (move === 'breaker') this.breakerCooldown = def.cooldown
    this.vx = 0
    this.attackTimer = 0
    this.attackHasHit = false
    this._emit('skillRect', {
      move,
      label: def.label,
      x: this.x,
      y: this.y,
      dir: this.facingDir,
      range: def.range,
      vertical: def.vertical,
      force: def.force,
      damage: def.damage,
      duration: def.duration,
    })
  }

  _suffixMatch(seq) {
    if (this.comboSeq.length < seq.length) return false
    const offset = this.comboSeq.length - seq.length
    for (let i = 0; i < seq.length; i += 1) {
      if (this.comboSeq[offset + i] !== seq[i]) return false
    }
    return true
  }

  _applyGravity(dt) {
    const wallSliding =
      (this.touchingWallLeft || this.touchingWallRight) &&
      !this.isGrounded &&
      this.vy < 0

    if (wallSliding) {
      this.vy = Math.max(this.vy + GRAVITY * dt, WALL_SLIDE_SPEED)
    } else {
      this.vy = Math.max(this.vy + GRAVITY * dt, MAX_FALL)
    }
  }

  _resolveX(platforms) {
    this.touchingWallLeft = false
    this.touchingWallRight = false

    for (const platform of platforms) {
      if (platform.destroyed) continue
      if (platform.oneWay) continue

      const platformBounds = platform.bounds
      const playerBounds = this.bounds
      if (!overlaps(playerBounds, platformBounds)) continue

      if (this.x <= platform.x) {
        this.x = platformBounds.left - this.width / 2
        this.vx = 0
        this.touchingWallRight = true
      } else {
        this.x = platformBounds.right + this.width / 2
        this.vx = 0
        this.touchingWallLeft = true
      }
    }
  }

  _resolveY(platforms, previousY = this.y) {
    this.isGrounded = false

    for (const platform of platforms) {
      if (platform.destroyed) continue

      const platformBounds = platform.bounds
      const playerBounds = this.bounds
      if (!overlaps(playerBounds, platformBounds)) continue

      if (platform.oneWay) {
        const previousBottom = previousY - this.height / 2
        const falling = this.vy <= 0
        const crossedTop = previousBottom >= platformBounds.top - 0.08
        const nearTop = playerBounds.bottom <= platformBounds.top + 0.18
        if (!falling || !crossedTop || !nearTop) continue

        this.y = platformBounds.top + this.height / 2
        this.vy = 0
        this.isGrounded = true
        this.airRollUsed = false
        this.coyoteTimer = COYOTE_TIME
        continue
      }

      if (this.y <= platform.y) {
        this.y = platformBounds.bottom - this.height / 2
        this.vy = 0
      } else {
        this.y = platformBounds.top + this.height / 2
        this.vy = 0
        this.isGrounded = true
        this.airRollUsed = false
        this.coyoteTimer = COYOTE_TIME
      }
    }
  }

  _tickInvincibility(dt) {
    if (!this.isInvincible) return

    this.invincibleTimer -= dt
    if (this.invincibleTimer <= 0) this.isInvincible = false
  }

  _tickDamageFeedback(dt) {
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt)
  }

  _tickHurt(dt) {
    this.hurtTimer = Math.max(0, this.hurtTimer - dt)
  }

  _tickShock(dt) {
    this.shockCooldown = Math.max(0, this.shockCooldown - dt)
    this.boltCooldown = Math.max(0, this.boltCooldown - dt)
    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt)
    this.breakerCooldown = Math.max(0, this.breakerCooldown - dt)
    this.slamCooldown = Math.max(0, this.slamCooldown - dt)
    if (this.shockTimer > 0) {
      this.shockTimer = Math.max(0, this.shockTimer - dt)
      this.vx = 0
    }
  }

  _getAnimationState() {
    if (this.isDead) return 'dead'
    if (this.hurtTimer > 0) return 'hurt'
    if (this.isShocking) return SHOCK_MOVES[this.shockStyle]?.animation ?? 'shock'
    if (this.isSlamming) return 'jumpFall'
    if (this.isRolling) return 'roll'

    const wallSliding =
      (this.touchingWallLeft || this.touchingWallRight) &&
      !this.isGrounded &&
      this.vy < 0

    if (wallSliding) return 'wallSlide'
    if (this.attackTimer > 0) {
      return this.attackStyle === 'kick'
        ? `kick${this.attackComboStep}`
        : `attack${this.attackComboStep}`
    }
    if (!this.isGrounded) return this.vy >= 0 ? 'jumpRise' : 'jumpFall'
    if (Math.abs(this.vx) > 0.1) return 'run'

    return 'idle'
  }

  _emit(type, data = {}) {
    this.events.push({ type, ...data })
  }
}

export function overlaps(a, b) {
  return a.right > b.left && a.left < b.right && a.top > b.bottom && a.bottom < b.top
}
