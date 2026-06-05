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
- Player actions: move, jump, wall jump, roll, punch, unlockable kick, unlockable bolt, unlockable J/K shock combos
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
| Echo Bolt | K,J,K | Defeat a shooter |
| Shock Heavy | J,J,K | Defeat a tank |
| Shock Line | J,K,J | Defeat a tank |
| Restart | R | Start |

## Steal-A-Move Progression

The main growth fantasy is "take the enemy's technique and add it to my kit."

| Enemy | Enemy action | Player unlock |
| --- | --- | --- |
| Grunt | Jab | None |
| Kicker | Kick attack | Kick combo |
| Guarder | Guard bash | None |
| Fast | Lunge | Future lunge skill candidate |
| Shooter | Projectile | Echo Bolt |
| Sniper | Charged projectile | None |
| Tank | Heavy shock attack | Shock combos |
| Warden | Boss shock attack | None |

Rules:

- Unlocks happen once per run.
- Restarting a run resets unlocked actions.
- The HUD shows unlocked actions.
- The help text adds new keys only after unlock.
- No new combat keys are added after unlocks. Advanced actions are selected through J/K sequences.
- Guard was intentionally removed so the combat language stays focused on J/K timing and sequencing.

## Current J/K Skill Combos

| Combo | Skill | Use |
| --- | --- | --- |
| J,J,K | Shock Heavy | Circular crowd-control burst around the player. Clears projectiles and pushes enemies away. |
| J,K,J | Shock Line | Faster forward shock wave. Lower damage, shorter cooldown, useful for interrupting a lane or deleting projectiles. |
| K,J,K | Echo Bolt | Forward projectile. Useful for punishing shooters/snipers or hitting enemies across platforms. |

Echo Bolt unlocks by defeating a shooter. Both shock combos unlock together by defeating a tank. This gives specialist enemies readable identities and turns their techniques into player combo branches.

## Run Structure

The prototype now uses a 9-wave run with rotating platform layouts.

| Wave | Focus |
| --- | --- |
| 1 | Kicker introduction and basic crowd control. |
| 2 | Split-lane movement and fast enemy pressure. |
| 3 | Shooter introduction and Echo Bolt unlock. |
| 4 | Vertical platform chase with mixed melee/ranged enemies. |
| 5 | Tank introduction and shock combo unlock. |
| 6 | Crossfire pressure with shooter/sniper composition. |
| 7 | Vertical pressure with tank plus fast enemies. |
| 8 | Endurance mix with two tanks. |
| 9 | Warden finale. |

Clearing a wave heals up to 2 HP. This keeps the longer run viable without removing the cost of taking damage.

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
- Echo Bolt creates a player-owned projectile.
- Shock combos can clear projectiles in their visible area.
- Projectile reflection is not part of the current input model because guard was removed.

## Attack Readability

Enemy attacks and player shock skills show temporary range telegraphs.

- Red rectangles: enemy melee attacks.
- Orange lanes: shooter projectile timing/range.
- Purple circles: heavy shock attacks.
- Blue rectangles: player Shock Line.

The telegraph is intentionally always visible in the prototype so damage timing can be tuned without a separate debug toggle.

## Current Damage

- Grunt jab: 1
- Fast lunge: 2
- Kicker kick: 2
- Guarder bash: 1
- Shooter projectile: 2
- Sniper projectile: 3
- Tank smash: 3
- Warden smash: 3

## Next Design Targets

1. Tune wave count, healing, and enemy counts after playtesting.
2. Add a lunge branch from fast enemies.
3. Add a throw enemy and unlock throw as a J/K sequence.
4. Add reward cards that modify unlocked actions.
5. Add rooms that reward specific unlocked actions.
