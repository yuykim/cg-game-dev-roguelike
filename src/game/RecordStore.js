const STORAGE_KEY = 'rewind-runner-records-v1'

export class RecordStore {
  constructor() {
    this.records = this._load()
  }

  getLevelBest(levelId) {
    return this.records.levels[levelId] ?? null
  }

  getTotalBest() {
    return this.records.totalBest ?? null
  }

  saveLevelBest(levelId, seconds, playerName) {
    const previous = this.records.levels[levelId]
    if (previous?.time != null && previous.time <= seconds) return false

    this.records.levels[levelId] = {
      time: seconds,
      name: normalizeName(playerName),
      savedAt: new Date().toISOString(),
    }
    this._save()
    return true
  }

  saveTotalBest(seconds, playerName) {
    if (this.records.totalBest?.time != null && this.records.totalBest.time <= seconds) {
      return false
    }

    this.records.totalBest = {
      time: seconds,
      name: normalizeName(playerName),
      savedAt: new Date().toISOString(),
    }
    this._save()
    return true
  }

  reset() {
    this.records = { levels: {}, totalBest: null }
    this._save()
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { levels: {}, totalBest: null }

      const parsed = JSON.parse(raw)
      const levels = {}

      for (const [levelId, value] of Object.entries(parsed.levels ?? {})) {
        levels[levelId] = normalizeRecord(value)
      }

      return {
        levels,
        totalBest: normalizeRecord(parsed.totalBest),
      }
    } catch {
      return { levels: {}, totalBest: null }
    }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records))
  }
}

export function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--.--'

  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`
}

function normalizeRecord(value) {
  if (value == null) return null

  if (typeof value === 'number') {
    return { time: value, name: 'PLAYER', savedAt: null }
  }

  if (typeof value === 'object' && typeof value.time === 'number') {
    return {
      time: value.time,
      name: normalizeName(value.name),
      savedAt: value.savedAt ?? null,
    }
  }

  return null
}

function normalizeName(name) {
  const clean = String(name ?? '').trim().slice(0, 12)
  return clean || 'PLAYER'
}

