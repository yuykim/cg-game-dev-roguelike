# Echo Brawler Design

## Core

Echo Brawler is a 2.5D side-view action roguelite. The player starts as a bare-handed fighter and grows by defeating enemies that use specific actions.

- Platform: WebGL / Three.js
- View: 2D sprite characters in a 3D arena
- Combat: 1 vs many, no weapons
- Starting action: punch combo only
- Growth rule: defeat a specialist enemy to unlock that enemy's action

## Current Prototype

- Runtime entry: `src/game/Arena.js`
- Player actions: move, jump, wall jump, roll, punch, unlockable kick, unlockable guard
- Enemy actions: explicit windup, active hitbox, recovery
- Contact damage is disabled. Damage happens only during enemy attack active frames or projectile collision.
- HP starts at 10 to support varied incoming damage.

## Controls

| Action | Key | Unlock |
| --- | --- | --- |
| Move | A/D, Arrow keys | Start |
| Jump | Space | Start |
| Roll | Shift, Ctrl, S | Start |
| Punch combo | J | Start |
| Kick combo | K | Defeat a kicker |
| Guard | Hold G | Defeat a guarder |
| Restart | R | Start |

## Steal-A-Move Progression

The main growth fantasy is "take the enemy's technique and add it to my kit."

| Enemy | Enemy action | Player unlock |
| --- | --- | --- |
| Grunt | Jab | None |
| Kicker | Kick attack | Kick combo |
| Guarder | Guard bash | Guard |
| Fast | Lunge | Future lunge skill candidate |
| Shooter | Projectile | Future ranged counter skill candidate |
| Tank | Heavy shock attack | Future shock skill candidate |

Rules:

- Unlocks happen once per run.
- Restarting a run resets unlocked actions.
- The HUD shows unlocked actions.
- The help text adds new keys only after unlock.

## Platform Chase

Floating arena platforms are one-way platforms.

- Ground and side walls stay solid.
- Floating platforms ignore side and bottom collision.
- Player and enemies land only when falling onto the platform top.
- This prevents enemies from getting stuck against platform sides while jumping.

Enemies use targeted leaps when the player is above them.

- If the player is high enough and within leap range, enemies jump with horizontal velocity toward the player.
- This is not full pathfinding. It is a pragmatic fix so platform camping does not trivialize waves.

## Projectiles

Shooter enemies fire projectiles after a windup.

- Projectiles damage the player on collision.
- Player attacks can destroy incoming projectiles.
- Guard reflects frontal projectiles.
- Reflected projectiles can damage enemies.

## Current Damage

- Grunt jab: 1
- Fast lunge: 2
- Kicker kick: 2
- Guarder bash: 1
- Shooter projectile: 2
- Tank smash: 3

## Next Design Targets

1. Add visible attack/projectile hitbox debug toggle for tuning.
2. Add a `shock` unlock from tanks.
3. Add a throw enemy and unlock throw.
4. Add reward cards that modify unlocked actions.
5. Add rooms that reward specific unlocked actions.
