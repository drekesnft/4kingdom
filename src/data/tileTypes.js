export const TILE_TYPES = {
  base: { name: 'Terreno nevado', tileNumber: 1, role: 'base', fallback: '❄️', assets: ['/assets/tiles/tile1.png'] },
  wood: { name: 'Bosque de madera', tileNumber: 2, role: 'resource', resource: 'wood', fallback: '🌲', assets: ['/assets/tiles/tile2.png'] },
  stoneA: { name: 'Cantera', tileNumber: 3, role: 'resource', resource: 'stone', fallback: '🪨', assets: ['/assets/tiles/tile3.png'] },
  decorativeA: { name: 'Terreno decorativo', tileNumber: 4, role: 'decorative', fallback: '❄️', assets: ['/assets/tiles/tile4.png'] },
  stoneB: { name: 'Yacimiento de piedra', tileNumber: 5, role: 'resource', resource: 'stone', fallback: '⛏️', assets: ['/assets/tiles/tile5.png'] },
  gems: { name: 'Gemas doradas', tileNumber: 6, role: 'event', resource: 'gems', fallback: '💎', assets: ['/assets/tiles/tile6.png'] },
  decorativeB: { name: 'Terreno decorativo', tileNumber: 7, role: 'decorative', fallback: '💧', assets: ['/assets/tiles/tile7.png'] },
  food: { name: 'Zona de comida', tileNumber: 8, role: 'resource', resource: 'food', fallback: '🌾', assets: ['/assets/tiles/tile8.png'] },
  enemy: { name: 'Campamento enemigo', tileNumber: 9, role: 'enemy', fallback: '⚔️', assets: ['/assets/tiles/tile9.png'] },
  rubble: { name: 'Escombros', tileNumber: 10, role: 'rubble', fallback: '🏚️', assets: ['/assets/tiles/tile10.png'] },
}

function hash(x, y, salt = 0) {
  let value = Math.imul(x + 101 + salt, 374761393) + Math.imul(y + 131, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return (value ^ (value >>> 16)) >>> 0
}

function seededOrder(items, seedX, seedY) {
  return [...items].sort((a, b) => hash(a.worldX + seedX, a.worldY + seedY, 17) - hash(b.worldX + seedX, b.worldY + seedY, 17))
}

function quadrantOf(tile) {
  if (tile.worldX > 0 && tile.worldY > 0) return 1
  if (tile.worldX < 0 && tile.worldY > 0) return 2
  if (tile.worldX < 0 && tile.worldY < 0) return 3
  if (tile.worldX > 0 && tile.worldY < 0) return 4
  return 0
}

export function generateMap(size = 25) {
  const half = Math.floor(size / 2)
  return Array.from({ length: size * size }, (_, index) => {
    const gridX = index % size
    const gridY = Math.floor(index / size)
    const worldX = gridX - half
    const worldY = half - gridY
    const roll = hash(worldX, worldY) % 1000
    let type = 'base'

    if (roll < 74) type = 'wood'
    else if (roll < 116) type = 'stoneA'
    else if (roll < 150) type = 'stoneB'
    else if (roll < 188) type = 'food'
    else if (roll < 203) type = 'enemy'
    else if (roll < 220) type = 'rubble'
    else if (roll < 246) type = 'decorativeA'
    else if (roll < 274) type = 'decorativeB'

    return { id: `${gridX}-${gridY}`, gridX, gridY, worldX, worldY, type, isPlayerBase: false, owner: null }
  })
}

export function assignPlayerBase(tiles, targetId, owner = 'Jugador') {
  const target = tiles.find((tile) => tile.id === targetId)
  if (!target || target.isPlayerBase) return { tiles, assigned: false, reason: 'La casilla elegida no está disponible.' }

  const ring = tiles.filter((tile) => {
    if (tile.id === target.id || tile.isPlayerBase) return false
    const dx = Math.abs(tile.worldX - target.worldX)
    const dy = Math.abs(tile.worldY - target.worldY)
    const distance = Math.max(dx, dy)
    return distance >= 2 && distance <= 3
  })

  const ordered = seededOrder(ring, target.worldX, target.worldY)
  const woodCount = 2 + (hash(target.worldX, target.worldY, 31) % 2)
  const stoneCount = 2 + (hash(target.worldX, target.worldY, 47) % 2)
  const foodCount = 4
  const needed = woodCount + stoneCount + foodCount
  if (ordered.length < needed) return { tiles, assigned: false, reason: 'No hay espacio suficiente alrededor de esta casilla.' }

  const replacements = new Map()
  let cursor = 0
  for (let i = 0; i < woodCount; i += 1) replacements.set(ordered[cursor++].id, 'wood')
  for (let i = 0; i < stoneCount; i += 1) {
    const tile = ordered[cursor++]
    replacements.set(tile.id, i % 2 === 0 ? 'stoneA' : 'stoneB')
  }
  for (let i = 0; i < foodCount; i += 1) replacements.set(ordered[cursor++].id, 'food')

  const nextTiles = tiles.map((tile) => {
    if (tile.id === target.id) {
      return { ...tile, previousType: tile.type, type: 'base', isPlayerBase: true, owner }
    }
    const replacement = replacements.get(tile.id)
    return replacement ? { ...tile, type: replacement } : tile
  })

  return { tiles: nextTiles, assigned: true, target: { ...target, type: 'base', isPlayerBase: true, owner }, counts: { wood: woodCount, stone: stoneCount, food: foodCount } }
}

export function assignRandomPlayerBase(tiles, owner = 'Jugador') {
  const baseCounts = [1, 2, 3, 4].map((quadrant) => ({
    quadrant,
    count: tiles.filter((tile) => tile.isPlayerBase && quadrantOf(tile) === quadrant).length,
  }))
  const minCount = Math.min(...baseCounts.map((item) => item.count))
  const leastUsed = baseCounts.filter((item) => item.count === minCount)
  const chosenQuadrant = leastUsed[Math.floor(Math.random() * leastUsed.length)].quadrant

  const existingBases = tiles.filter((tile) => tile.isPlayerBase)
  const candidates = tiles.filter((tile) => {
    if (tile.isPlayerBase || quadrantOf(tile) !== chosenQuadrant) return false
    if (Math.abs(tile.worldX) > 9 || Math.abs(tile.worldY) > 9) return false
    return existingBases.every((base) => Math.max(Math.abs(tile.worldX - base.worldX), Math.abs(tile.worldY - base.worldY)) >= 7)
  })

  if (!candidates.length) return { tiles, assigned: false, reason: `No quedan posiciones válidas en el segmento ${chosenQuadrant}.` }
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  const result = assignPlayerBase(tiles, target.id, owner)
  return { ...result, quadrant: chosenQuadrant }
}

export function spawnGemTile(tiles) {
  const candidates = tiles.filter((tile) => tile.type === 'base' && !tile.isPlayerBase)
  if (!candidates.length) return tiles
  const chosen = candidates[Math.floor(Math.random() * candidates.length)]
  return tiles.map((tile) => tile.id === chosen.id ? { ...tile, type: 'gems', spawnedAt: Date.now() } : tile)
}

export function removeOldestGemTile(tiles) {
  const gems = tiles.filter((tile) => tile.type === 'gems').sort((a, b) => (a.spawnedAt ?? 0) - (b.spawnedAt ?? 0))
  if (!gems.length) return tiles
  const oldest = gems[0]
  return tiles.map((tile) => tile.id === oldest.id ? { ...tile, type: 'base', spawnedAt: undefined } : tile)
}
