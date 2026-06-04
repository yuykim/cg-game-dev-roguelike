import { Platform } from '../obstacles/Platform.js'
import { Hazard } from '../obstacles/Hazard.js'
import { ExitGate } from '../obstacles/ExitGate.js'
import { TILE_SIZE } from './levels.js'

export function buildLevel(scene, level) {
  const rows = level.ascii
  const width = Math.max(...rows.map((row) => row.length))
  const height = rows.length
  const platforms = []
  const hazards = []
  const breakables = []
  let spawn = { x: 0, y: 2 }
  let exit = null

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const row = rows[rowIndex].padEnd(width, '.')
    let col = 0

    while (col < width) {
      const char = row[col]

      if (char === '#' || char === '=') {
        const start = col
        while (col < width && row[col] === char) col += 1
        const run = col - start
        const moving = char === '='
        platforms.push(
          new Platform(
            scene,
            tileX(start + run / 2, width),
            tileY(rowIndex, height),
            run * TILE_SIZE,
            TILE_SIZE,
            moving ? 0x2f91ff : 0x4d5368,
            moving
              ? {
                  motion: {
                    x: 1,
                    y: 0,
                    amplitude: 1.35,
                    speed: 1.1,
                    phase: start * 0.41 + rowIndex * 0.23,
                  },
                }
              : {},
          ),
        )
        continue
      }

      const x = tileX(col + 0.5, width)
      const y = tileY(rowIndex, height)

      if (char === 'B') {
        const block = new Platform(scene, x, y, TILE_SIZE, TILE_SIZE, 0xb87438, {
          breakable: true,
        })
        platforms.push(block)
        breakables.push(block)
      } else if (char === 'S') {
        spawn = { x, y: y + 0.1 }
      } else if (char === 'E') {
        exit = new ExitGate(scene, x, y)
      } else if (char === '^') {
        hazards.push(new Hazard(scene, x, y - 0.08, 'spike'))
      } else if (char === 'o') {
        hazards.push(new Hazard(scene, x, y, 'orb'))
      } else if (char === '|') {
        hazards.push(new Hazard(scene, x, y, 'laserV'))
      } else if (char === '-') {
        hazards.push(new Hazard(scene, x, y, 'laserH'))
      }

      col += 1
    }
  }

  return {
    platforms,
    hazards,
    breakables,
    exit,
    spawn,
    width,
    height,
    deathY: -3,
  }
}

function tileX(tileCenterX, width) {
  return (tileCenterX - width / 2) * TILE_SIZE
}

function tileY(rowIndex, height) {
  return (height - rowIndex - 1) * TILE_SIZE
}
