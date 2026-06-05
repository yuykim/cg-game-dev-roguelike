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
- Player actions: move, jump, wall jump, roll, punch, unlockable kick, rush, breaker, bolt, and shock J/K combos
- Enemy actions: explicit windup, active hitbox, recovery
- Contact damage is disabled. Damage happens only during enemy attack active frames or projectile collision.
- HP starts at 10 to support varied incoming damage.
- Runs now use 15 objective rooms with automatic random rewards between rooms.

## Controls

| Action | Key | Unlock |
| --- | --- | --- |
| Move | A/D, Arrow keys | Start |
| Jump | Space | Start |
| Roll | Shift, Ctrl, S | Start |
| Punch combo | J | Start |
| Kick combo | K | Defeat a kicker |
| Rush Strike | J,K,K | Defeat a fast enemy |
| Breaker | K,K,J | Defeat a guarder |
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
| Guarder | Guard bash | Breaker |
| Fast | Lunge | Rush Strike |
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
| J,K,K | Rush Strike | Long forward strike. Good for closing a lane, catching ranged enemies, and deleting incoming projectiles. |
| K,K,J | Breaker | Short heavy strike. Good for cracking guarders, tanks, and clustered enemies. |

Echo Bolt unlocks by defeating a shooter. Both shock combos unlock together by defeating a tank. Rush Strike unlocks from fast enemies, and Breaker unlocks from guarders. This gives specialist enemies readable identities and turns their techniques into player combo branches.

## Run Structure

The prototype now uses a 15-room run with rotating platform layouts and mixed objectives.

| Room | Objective | Focus |
| --- | --- | --- |
| 1 | Eliminate | Kicker introduction and basic crowd control. |
| 2 | Eliminate | Fast enemy pressure and Rush Strike unlock. |
| 3 | Hunt shooter | Shooter introduction and Echo Bolt unlock. |
| 4 | Survive | Vertical pressure with guarder, fast, and ranged enemies. |
| 5 | Hunt tank | Tank introduction and shock combo unlock. |
| 6 | Eliminate | Double crossfire pressure. |
| 7 | Hunt guarders | Breaker unlock and anti-guard lesson. |
| 8 | Survive | Pit endurance with mixed heavy/ranged pressure. |
| 9 | Eliminate | Tank pair room. |
| 10 | Hunt warden | Mini-boss target room. |
| 11 | Hunt sniper | Sniper nest priority target. |
| 12 | Survive | Last-stand vertical pressure. |
| 13 | Eliminate | Heavy room with tanks and guarders. |
| 14 | Hunt warden | Warden guard target room. |
| 15 | Eliminate | Final mixed-enemy clear. |

Clearing a room heals up to 2 HP. This keeps the longer run viable without removing the cost of taking damage.

## Room Objectives

Room goals should change the player's priority, not only enemy count.

- Eliminate: kill every enemy.
- Hunt: kill all enemies of the target type, then the room ends.
- Survive: stay alive until the timer ends, then remaining threats are cleared.

The HUD shows the current objective progress: enemy count, target count, or survival seconds.

## Automatic Rewards

After each non-final room, one available upgrade is granted automatically. The run does not pause for reward selection, because the game relies on action tempo and room-to-room flow.

- Skill-specific rewards enter the pool only after that skill is unlocked.
- Heavy Hands: punch damage +1
- Iron Kick: kick damage +1
- Charged Bolt: Echo Bolt damage +1
- Quick Charge: Echo Bolt cooldown -15%
- Wide Shock: Shock Heavy radius +0.4
- Deep Shock: shock damage +1
- Static Flow: shock cooldown -12%
- Second Breath: max HP +2 and heal 2
- Technique Core: Rush Strike and Breaker damage +1

Rewards are run-based and reset on restart.

## Platform Chase

Floating arena platforms are one-way platforms.

- Ground and side walls stay solid.
- Floating platforms ignore side and bottom collision.
- Player and enemies land only when falling onto the platform top.
- This prevents enemies from getting stuck against platform sides while jumping.
- Arena layouts use reachable step heights so enemies can climb instead of turning platforms into safe camping spots.

Enemies use targeted leaps when the player is above them.

- Airborne enemies preserve their leap velocity instead of immediately overwriting it with ground movement.
- If the player is too high for a direct jump, enemies target the next reachable one-way platform first.
- Ranged enemies can spawn on elevated platforms, making each layout change the opening pressure pattern.
- This is not full pathfinding. It is a pragmatic platform-chase layer so map layouts create combat variables.

## Layout Variables

The arena layouts should change how the player solves a wave, not just change decoration.

- Low center platforms create roll/jump escape routes but also give melee enemies chase access.
- Side perches make shooters and snipers dangerous until the player closes distance or uses Echo Bolt.
- Tower layouts reward vertical movement, but enemies can climb in steps.
- Pit/finale layouts create temporary safe pockets, not permanent safe zones.

## Projectiles

Shooter enemies fire projectiles after a windup.

- Projectiles damage the player on collision.
- Player attacks can destroy incoming projectiles.
- Echo Bolt creates a player-owned projectile.
- Shock combos, Rush Strike, and Breaker can clear projectiles in their visible area.
- Projectile reflection is not part of the current input model because guard was removed.

## Attack Readability

Enemy attacks and player shock skills show temporary range telegraphs.

- Red rectangles: enemy melee attacks.
- Orange lanes: shooter projectile timing/range.
- Purple circles: heavy shock attacks.
- Blue rectangles: player Shock Line.
- Green rectangles: player Rush Strike.
- Orange rectangles: player Breaker.

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
2. Tune reward values so damage upgrades do not trivialize late rooms.
3. Add a throw enemy and unlock throw as a J/K sequence.
4. Add room modifiers such as low gravity, closing walls, or projectile rain.
5. Add boss-only mechanics that require switching between Rush, Breaker, Bolt, and Shock.
