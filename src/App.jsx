import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Crown, MapPin, Search, X, ZoomIn, ZoomOut, Zap, AlertTriangle, Info, Globe2 } from 'lucide-react'
import { TILE_TYPES, assignPlayerBase, assignRandomPlayerBase, generateMap, removeOldestGemTile, spawnGemTile } from './data/tileTypes'
import LandingPage from './components/LandingPage'
import BuildView from './components/BuildView'
import BattleView from './components/BattleView'
import ClanView from './components/ClanView'
import MarketView from './components/MarketView'
import MarchModal from './components/MarchModal'
import BattleReportModal from './components/BattleReportModal'
import MapMarchesOverlay from './components/MapMarchesOverlay'
import { useGameState } from './game/useGameState'

const MAP_SIZE = 50
const TILE_SIZE = 112
const GEM_SPAWN_MS = 30_000
const MAX_ACTIVE_GEMS = 4
const CENTER_INDEX = Math.floor(MAP_SIZE / 2)
const CENTER_ID = `${CENTER_INDEX}-${CENTER_INDEX}`
const INITIAL_SCALE = 0.68
const DEMO_BASE = { worldX: 4, worldY: -3 }
const DEMO_BASE_ID = `${DEMO_BASE.worldX + CENTER_INDEX}-${CENTER_INDEX - DEMO_BASE.worldY}`
const BASE_ASSET = '/assets/ui/base.png'
const MIN_COORD = -CENTER_INDEX
const MAX_COORD = MAP_SIZE - CENTER_INDEX - 1

const MENU_ITEMS = [
  { id: 'build', label: 'Mi Base', src: '/assets/ui/home.png' },
  { id: 'home', label: 'Mapa', isGlobe: true },
  { id: 'battle', label: 'Ejército', src: '/assets/ui/battle.png' },
  { id: 'clan', label: 'Clan', src: '/assets/ui/clan.png' },
  { id: 'market', label: 'Mercado', src: '/assets/ui/market.png' },
]

function isImportantTile(tile) {
  const def = TILE_TYPES[tile.type]
  return Boolean(tile.isPlayerBase || def.resource || def.role === 'enemy' || def.role === 'rubble')
}

const TileImage = memo(function TileImage({ def }) {
  const src = def.assets?.[0]
  if (!src) return <span className="tile-fallback visible">{def.fallback}</span>
  return <><img className="terrain-image" src={src} alt="" draggable="false" /><span className="tile-fallback">{def.fallback}</span></>
})

const TileButton = memo(function TileButton({ tile, def, important, isSelected, onSelect }) {
  const isOwnBase = tile.worldX === DEMO_BASE.worldX && tile.worldY === DEMO_BASE.worldY

  return (
    <button
      type="button"
      tabIndex={-1}
      className={`tile tile-${def.role} ${important ? 'tile-interactive' : ''} ${tile.type === 'gems' ? 'gem-spawn' : ''} ${isOwnBase ? 'player-base-own' : tile.isPlayerBase ? 'player-base' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(tile)}
      aria-haspopup={important ? 'dialog' : undefined}
      aria-label={`${def.name}, coordenadas ${tile.worldX}, ${tile.worldY}${important ? ', abrir información' : ''}`}
    >
      <TileImage def={def} />
      <span className="axis-coordinate">{tile.worldX},{tile.worldY}</span>
      {tile.isPlayerBase && <img className="base-layer" src={BASE_ASSET} alt="" draggable="false" aria-hidden="true" />}
      {isOwnBase && (
        <div className="own-base-marker">
          <span className="own-base-beacon"></span>
          <span className="own-base-tag">👑 TU BASE</span>
        </div>
      )}
    </button>
  )
})

const MapGrid = memo(function MapGrid({
  tiles,
  selectedId,
  onSelectTile,
  gridRef,
  initialStyle,
  marches,
  baseCoord,
  onSpeedupMarch,
  calculateKingCostForSec,
}) {
  return (
    <div ref={gridRef} className="map-grid" style={initialStyle}>
      {tiles.map((tile) => {
        const def = TILE_TYPES[tile.type]
        const important = isImportantTile(tile)
        return (
          <TileButton
            key={tile.id}
            tile={tile}
            def={def}
            important={important}
            isSelected={selectedId === tile.id}
            onSelect={onSelectTile}
          />
        )
      })}
      <MapMarchesOverlay
        marches={marches}
        baseCoord={baseCoord}
        mapSize={MAP_SIZE}
        tileSize={TILE_SIZE}
        onSpeedupMarch={onSpeedupMarch}
        calculateKingCostForSec={calculateKingCostForSec}
      />
    </div>
  )
})

export default function App() {
  const gameState = useGameState(DEMO_BASE)

  const initialMap = useMemo(() => {
    const generated = generateMap(MAP_SIZE)
    const demo = assignPlayerBase(generated, DEMO_BASE_ID, 'Tu Reino (Jugador 01)', 'VAL')
    let currentTiles = demo.assigned ? demo.tiles : generated

    // Spawn 1 base aliada del mismo clan [VAL]
    const allySpawn = assignRandomPlayerBase(currentTiles, 'Sir Ronald', 'VAL')
    if (allySpawn.assigned) currentTiles = allySpawn.tiles

    // Spawn 1 base rival de clan rival [ARK]
    const rivalSpawn = assignRandomPlayerBase(currentTiles, 'Lord Kael', 'ARK')
    if (rivalSpawn.assigned) currentTiles = rivalSpawn.tiles

    return currentTiles
  }, [])

  const [tiles, setTiles] = useState(initialMap)
  const [selectedId, setSelectedId] = useState(DEMO_BASE_ID)
  const [popupOpen, setPopupOpen] = useState(false)
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [offset, setOffset] = useState({ x: -1500, y: -1500 })
  const [nextGemIn, setNextGemIn] = useState(GEM_SPAWN_MS)
  const [notice, setNotice] = useState('FourKingdoms Alpha v0.1 · Toca recursos, bases, o campamentos para interactuar.')
  const [playerNumber, setPlayerNumber] = useState(2)
  const [activeMenu, setActiveMenu] = useState('build')
  const [coordQuery, setCoordQuery] = useState('')
  const [currentView, setCurrentView] = useState('landing')

  // Modales
  const [marchModalTarget, setMarchModalTarget] = useState(null) // tile
  const [selectedReport, setSelectedReport] = useState(null)
  const [showResourceDetails, setShowResourceDetails] = useState(false)

  const viewportRef = useRef(null)
  const mapGridRef = useRef(null)
  const cameraRef = useRef({ x: -1500, y: -1500, scale: INITIAL_SCALE })
  const animationFrameRef = useRef(null)
  const viewportSizeRef = useRef({ width: 430, height: 590 })
  const activePointers = useRef(new Map())
  const dragRef = useRef({
    isDragging: false,
    suppressClick: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
    initialOffset: { x: -1500, y: -1500 },
    initialPinchDist: 0,
    initialPinchScale: INITIAL_SCALE,
    initialPinchCenter: { x: 0, y: 0 },
    initialPinchOffset: { x: -1500, y: -1500 },
  })

  const selected = selectedId ? tiles.find((tile) => tile.id === selectedId) : null
  const activeGemCount = tiles.filter((tile) => tile.type === 'gems').length

  // Sincronizar notificación reciente
  useEffect(() => {
    if (gameState.recentNotification) {
      setNotice(gameState.recentNotification)
    }
  }, [gameState.recentNotification])

  const applyTransform = useCallback((x, y, s) => {
    cameraRef.current = { x, y, scale: s }
    if (mapGridRef.current) {
      mapGridRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`
    }
  }, [])

  const updateViewportSize = useCallback(() => {
    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        viewportSizeRef.current = { width: rect.width, height: rect.height }
      }
    }
  }, [])

  const clampOffset = useCallback((nextOffset, atScale) => {
    const s = atScale ?? cameraRef.current.scale
    const { width, height } = viewportSizeRef.current
    const worldWidth = MAP_SIZE * TILE_SIZE * s
    const worldHeight = MAP_SIZE * TILE_SIZE * s
    const minX = Math.min(0, width - worldWidth)
    const minY = Math.min(0, height - worldHeight)
    return {
      x: Math.min(0, Math.max(minX, nextOffset.x)),
      y: Math.min(0, Math.max(minY, nextOffset.y)),
    }
  }, [])

  const tileCenteredOffset = useCallback((worldX, worldY, atScale) => {
    updateViewportSize()
    const s = atScale ?? cameraRef.current.scale
    const { width, height } = viewportSizeRef.current
    const gridX = worldX + CENTER_INDEX
    const gridY = CENTER_INDEX - worldY
    const tileCenterX = (gridX + 0.5) * TILE_SIZE * s
    const tileCenterY = (gridY + 0.5) * TILE_SIZE * s
    return clampOffset({
      x: width / 2 - tileCenterX,
      y: height / 2 - tileCenterY,
    }, s)
  }, [clampOffset, updateViewportSize])

  const focusTile = useCallback((worldX, worldY, atScale = cameraRef.current.scale) => {
    cancelAnimationFrame(animationFrameRef.current)
    requestAnimationFrame(() => {
      const nextOffset = tileCenteredOffset(worldX, worldY, atScale)
      applyTransform(nextOffset.x, nextOffset.y, atScale)
      setOffset(nextOffset)
      setScale(atScale)
    })
  }, [applyTransform, tileCenteredOffset])

  useEffect(() => {
    if (currentView === 'game' && activeMenu === 'home') {
      const timer = setTimeout(() => {
        updateViewportSize()
        focusTile(DEMO_BASE.worldX, DEMO_BASE.worldY, INITIAL_SCALE)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [currentView, activeMenu, focusTile, updateViewportSize])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNextGemIn((remaining) => {
        if (remaining <= 1000) {
          setTiles((current) => {
            const gemCount = current.filter((tile) => tile.type === 'gems').length
            const pruned = gemCount >= MAX_ACTIVE_GEMS ? removeOldestGemTile(current) : current
            return spawnGemTile(pruned)
          })
          return GEM_SPAWN_MS
        }
        return remaining - 1000
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const recenter = () => {
      updateViewportSize()
      const current = cameraRef.current
      const clamped = clampOffset(current, current.scale)
      applyTransform(clamped.x, clamped.y, current.scale)
      setOffset(clamped)
    }
    window.addEventListener('resize', recenter)
    return () => window.removeEventListener('resize', recenter)
  }, [applyTransform, clampOffset, updateViewportSize])

  const zoom = useCallback((delta) => {
    cancelAnimationFrame(animationFrameRef.current)
    updateViewportSize()
    const currentScale = cameraRef.current.scale
    const nextScale = Math.min(1.3, Math.max(0.42, Number((currentScale + delta).toFixed(2))))
    if (nextScale === currentScale) return

    const { width, height } = viewportSizeRef.current
    const cx = width / 2
    const cy = height / 2
    const ratio = nextScale / currentScale
    const current = cameraRef.current
    const nextOffset = {
      x: cx - (cx - current.x) * ratio,
      y: cy - (cy - current.y) * ratio,
    }
    const clamped = clampOffset(nextOffset, nextScale)
    applyTransform(clamped.x, clamped.y, nextScale)
    setScale(nextScale)
    setOffset(clamped)
  }, [applyTransform, clampOffset, updateViewportSize])

  const centerOrigin = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current)
    setSelectedId(CENTER_ID)
    setPopupOpen(false)
    focusTile(0, 0, INITIAL_SCALE)
  }, [focusTile])

  function onPointerDown(event) {
    if (event.target.closest('.map-search, .zoom-controls, .tile-popup, .floating-marches-bar, .modal-overlay, .map-quick-bar, .bottom-nav, .top-bar')) return

    cancelAnimationFrame(animationFrameRef.current)
    updateViewportSize()

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {}

    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    const ptrs = Array.from(activePointers.current.values())

    if (ptrs.length === 1) {
      dragRef.current = {
        isDragging: false,
        suppressClick: false,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: performance.now(),
        vx: 0,
        vy: 0,
        initialOffset: { ...cameraRef.current },
        initialPinchDist: 0,
        initialPinchScale: cameraRef.current.scale,
        initialPinchCenter: { x: 0, y: 0 },
        initialPinchOffset: { ...cameraRef.current },
      }
    } else if (ptrs.length === 2) {
      const p1 = ptrs[0]
      const p2 = ptrs[1]
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      dragRef.current.isDragging = true
      dragRef.current.suppressClick = true
      dragRef.current.initialPinchDist = dist
      dragRef.current.initialPinchScale = cameraRef.current.scale
      dragRef.current.initialPinchCenter = center
      dragRef.current.initialPinchOffset = { ...cameraRef.current }
      dragRef.current.vx = 0
      dragRef.current.vy = 0
    }
  }

  function onPointerMove(event) {
    if (!activePointers.current.has(event.pointerId)) return

    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })

    const ptrs = Array.from(activePointers.current.values())
    const drag = dragRef.current

    if (ptrs.length === 1) {
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY

      if (!drag.isDragging && Math.hypot(dx, dy) > 14) {
        drag.isDragging = true
        drag.suppressClick = true
      }

      if (drag.isDragging) {
        const now = performance.now()
        const dt = Math.max(1, now - drag.lastTime)
        const stepDx = event.clientX - drag.lastX
        const stepDy = event.clientY - drag.lastY

        const instVx = stepDx / dt
        const instVy = stepDy / dt
        drag.vx = drag.vx * 0.35 + instVx * 0.65
        drag.vy = drag.vy * 0.35 + instVy * 0.65
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        drag.lastTime = now

        const nextOffset = clampOffset({
          x: drag.initialOffset.x + dx,
          y: drag.initialOffset.y + dy,
        }, cameraRef.current.scale)

        applyTransform(nextOffset.x, nextOffset.y, cameraRef.current.scale)
      }
    } else if (ptrs.length === 2 && drag.initialPinchDist > 0) {
      const p1 = ptrs[0]
      const p2 = ptrs[1]
      const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }

      const scaleFactor = currentDist / drag.initialPinchDist
      const rawScale = drag.initialPinchScale * scaleFactor
      const nextScale = Math.min(1.3, Math.max(0.42, rawScale))

      const { width, height } = viewportSizeRef.current
      if (width > 0 && height > 0) {
        const viewport = viewportRef.current
        const rect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0 }
        const cx = drag.initialPinchCenter.x - rect.left
        const cy = drag.initialPinchCenter.y - rect.top
        const ratio = nextScale / drag.initialPinchScale

        const panDx = currentCenter.x - drag.initialPinchCenter.x
        const panDy = currentCenter.y - drag.initialPinchCenter.y

        const nextX = cx - (cx - drag.initialPinchOffset.x) * ratio + panDx
        const nextY = cy - (cy - drag.initialPinchOffset.y) * ratio + panDy

        const clamped = clampOffset({ x: nextX, y: nextY }, nextScale)
        applyTransform(clamped.x, clamped.y, nextScale)
      }
    }
  }

  function onPointerUp(event) {
    const isOverlay = Boolean(event.target.closest('.map-search, .zoom-controls, .tile-popup, .floating-marches-bar, .modal-overlay, .map-quick-bar, .bottom-nav, .top-bar'))

    if (activePointers.current.has(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {}
      activePointers.current.delete(event.pointerId)
    }

    if (isOverlay) {
      dragRef.current.isDragging = false
      return
    }

    const remaining = Array.from(activePointers.current.values())
    const drag = dragRef.current

    if (remaining.length === 1) {
      const p = remaining[0]
      drag.startX = p.x
      drag.startY = p.y
      drag.lastX = p.x
      drag.lastY = p.y
      drag.lastTime = performance.now()
      drag.initialOffset = { ...cameraRef.current }
      drag.initialPinchDist = 0
      drag.vx = 0
      drag.vy = 0
      return
    }

    if (remaining.length === 0) {
      const totalDist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)

      if (drag.isDragging && totalDist > 14) {
        drag.suppressClick = true
        setTimeout(() => {
          drag.suppressClick = false
        }, 120)

        const timeSinceMove = performance.now() - drag.lastTime
        let vx = timeSinceMove > 60 ? 0 : drag.vx * 16
        let vy = timeSinceMove > 60 ? 0 : drag.vy * 16
        const speed = Math.hypot(vx, vy)

        if (speed > 1) {
          const maxSpeed = 30
          if (speed > maxSpeed) {
            const factor = maxSpeed / speed
            vx *= factor
            vy *= factor
          }

          const runInertia = () => {
            vx *= 0.92
            vy *= 0.92
            const current = cameraRef.current
            const nextOffset = clampOffset({
              x: current.x + vx,
              y: current.y + vy,
            }, current.scale)

            if (nextOffset.x === current.x) vx = 0
            if (nextOffset.y === current.y) vy = 0

            applyTransform(nextOffset.x, nextOffset.y, current.scale)

            if (Math.hypot(vx, vy) > 0.25) {
              animationFrameRef.current = requestAnimationFrame(runInertia)
            } else {
              setOffset({ x: nextOffset.x, y: nextOffset.y })
              setScale(current.scale)
            }
          }

          animationFrameRef.current = requestAnimationFrame(runInertia)
        } else {
          setOffset({ x: cameraRef.current.x, y: cameraRef.current.y })
          setScale(cameraRef.current.scale)
        }
      } else {
        // Clic / Toque deliberado (sin arrastre)
        drag.isDragging = false
        drag.suppressClick = false
        setOffset({ x: cameraRef.current.x, y: cameraRef.current.y })
        setScale(cameraRef.current.scale)

        // Detección directa de casilla por coordenadas absolutas
        if (mapGridRef.current) {
          const rect = mapGridRef.current.getBoundingClientRect()
          const s = cameraRef.current.scale
          const relX = (event.clientX - rect.left) / s
          const relY = (event.clientY - rect.top) / s
          const gx = Math.floor(relX / TILE_SIZE)
          const gy = Math.floor(relY / TILE_SIZE)
          if (gx >= 0 && gx < MAP_SIZE && gy >= 0 && gy < MAP_SIZE) {
            const tileId = `${gx}-${gy}`
            const tappedTile = tiles.find((t) => t.id === tileId)
            if (tappedTile) {
              selectTile(tappedTile)
            }
          }
        }
      }
      drag.isDragging = false
    }
  }

  function onWheel(event) {
    event.preventDefault()
    cancelAnimationFrame(animationFrameRef.current)
    updateViewportSize()
    const viewport = viewportRef.current
    if (!viewport) return

    const rect = viewport.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top

    const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92
    const currentScale = cameraRef.current.scale
    const nextScale = Math.min(1.3, Math.max(0.42, Number((currentScale * zoomFactor).toFixed(2))))
    if (nextScale === currentScale) return

    const ratio = nextScale / currentScale
    const current = cameraRef.current
    const nextOffset = {
      x: cx - (cx - current.x) * ratio,
      y: cy - (cy - current.y) * ratio,
    }

    const clamped = clampOffset(nextOffset, nextScale)
    applyTransform(clamped.x, clamped.y, nextScale)
    setScale(nextScale)
    setOffset(clamped)
  }

  const selectTile = useCallback((tile) => {
    setSelectedId(tile.id)
    setPopupOpen(true)
    const isOwn = tile.worldX === DEMO_BASE.worldX && tile.worldY === DEMO_BASE.worldY
    if (tile.isPlayerBase) {
      const isAlly = Boolean(tile.clanTag && gameState.clan && tile.clanTag === gameState.clan.tag)
      setNotice(
        isOwn
          ? `🏰 Tu Base Principal en (${tile.worldX}, ${tile.worldY})`
          : isAlly
          ? `🛡️ Base Aliada de ${tile.owner} [${tile.clanTag}] en (${tile.worldX}, ${tile.worldY})`
          : `⚔️ Base Rival de ${tile.owner} [${tile.clanTag || 'Sin Clan'}] en (${tile.worldX}, ${tile.worldY})`
      )
    } else {
      setNotice(`Casilla (${tile.worldX}, ${tile.worldY}) · ${TILE_TYPES[tile.type].name}`)
    }
  }, [gameState.clan])

  function popupData(tile) {
    const targetTile = tile
    const def = TILE_TYPES[targetTile.type]
    const tileLabel = `Tile ${def.tileNumber}`
    const isOwnBase = targetTile.worldX === DEMO_BASE.worldX && targetTile.worldY === DEMO_BASE.worldY

    if (targetTile.isPlayerBase) {
      const isAlly = Boolean(targetTile.clanTag && gameState.clan && targetTile.clanTag === gameState.clan.tag)

      return {
        title: isOwnBase
          ? '🏰 Tu Reino (Base Principal)'
          : isAlly
          ? `🛡️ Base Aliada: ${targetTile.owner} [${targetTile.clanTag}]`
          : `⚔️ Base Rival: ${targetTile.owner} [${targetTile.clanTag || 'Sin Clan'}]`,
        subtitle: isOwnBase
          ? `Coordenadas (${targetTile.worldX}, ${targetTile.worldY}) · Ciudadela Nv.${gameState.buildings.castle}`
          : isAlly
          ? `Miembro de tu Clan ${gameState.clan.name} [${gameState.clan.tag}]`
          : 'Jugador Rival en los 4 Reinos',
        lines: isOwnBase ? [
          `🏛️ Castillo Nv.${gameState.buildings.castle} · 🛡️ Muralla Nv.${gameState.buildings.wall} · ⚔️ Cuartel Nv.${gameState.buildings.barracks}`,
          `Producción pasiva: 🪵 +${gameState.passiveProductionPerHour.wood} / 🪨 +${gameState.passiveProductionPerHour.stone} / 🌾 +${gameState.passiveProductionPerHour.food} por hora`,
          `Tropas en guarnición: ${gameState.troops.infantry} Infantería, ${gameState.troops.archer} Arqueros, ${gameState.troops.cavalry} Caballería`,
        ] : isAlly ? [
          `Posición: (${targetTile.worldX}, ${targetTile.worldY})`,
          'Base de tu aliado del clan. Puedes enviarle tropas de refuerzo para apoyar su guarnición defensiva.',
          `Tropas disponibles en tu ciudadela: ${gameState.troops.infantry} Inf, ${gameState.troops.archer} Arq, ${gameState.troops.cavalry} Cab`,
        ] : [
          `Posición: (${targetTile.worldX}, ${targetTile.worldY})`,
          'Base rival enemiga. Asalta su ciudadela para saquear recursos y expoliar KING sin protección.',
          `Tropas disponibles en tu ciudadela: ${gameState.troops.infantry} Inf, ${gameState.troops.archer} Arq, ${gameState.troops.cavalry} Cab`,
        ],
        image: BASE_ASSET,
        action: isOwnBase
          ? '🏛️ Gestionar Base y Edificios'
          : isAlly
          ? '🛡️ Enviar Refuerzos (Aliado)'
          : '⚔️ Asaltar Base (PvP)',
        onClick: () => {
          setPopupOpen(false)
          if (isOwnBase) {
            setActiveMenu('build')
          } else {
            setMarchModalTarget(targetTile)
          }
        },
      }
    }

    if (def.resource === 'wood' || def.resource === 'stone' || def.resource === 'food') return {
      title: def.name,
      subtitle: `${tileLabel} · Recurso: ${def.resource.toUpperCase()}`,
      lines: [
        `Posición: (${targetTile.worldX}, ${targetTile.worldY})`,
        'Nodo de recursos naturales. Envía una marcha para recolectar.',
        `Tropas disponibles en tu ciudadela: ${gameState.troops.infantry} Inf, ${gameState.troops.archer} Arq, ${gameState.troops.cavalry} Cab`,
      ],
      image: def.assets?.[0],
      action: 'Enviar a Recolectar',
      onClick: () => {
        setPopupOpen(false)
        setMarchModalTarget(targetTile)
      },
    }

    if (def.resource === 'gems') return {
      title: 'Gemas doradas',
      subtitle: `${tileLabel} · Evento temporal`,
      lines: [
        `Posición: (${targetTile.worldX}, ${targetTile.worldY})`,
        'Aparición especial limitada en el mapa.',
      ],
      image: def.assets?.[0],
      action: 'Recolectar Gemas',
      onClick: () => {
        setPopupOpen(false)
        setMarchModalTarget(targetTile)
      },
    }

    if (def.role === 'enemy') return {
      title: 'Campamento Hostil (NPC)',
      subtitle: `${tileLabel} · Campamento Enemigo`,
      lines: [
        `Posición: (${targetTile.worldX}, ${targetTile.worldY})`,
        'Asalta este campamento hostil para conseguir botín de recursos y probabilidad de drop de KING.',
      ],
      image: def.assets?.[0],
      action: 'Asaltar Campamento',
      onClick: () => {
        setPopupOpen(false)
        setMarchModalTarget(targetTile)
      },
    }

    if (def.role === 'rubble') return {
      title: 'Escombros y Ruinas',
      subtitle: `${tileLabel} · Punto de Interés`,
      lines: [
        `Posición: (${targetTile.worldX}, ${targetTile.worldY})`,
        'Restos arqueológicos. Envía una expedición para registrar los restos.',
      ],
      image: def.assets?.[0],
      action: 'Explorar Ruinas',
      onClick: () => {
        setPopupOpen(false)
        setMarchModalTarget(targetTile)
      },
    }

    return {
      title: def.name,
      subtitle: `${tileLabel} · Terreno`,
      lines: [`Posición: (${targetTile.worldX}, ${targetTile.worldY})`, 'Terreno del continente.'],
      image: def.assets?.[0],
      action: 'Cerrar',
      onClick: () => setPopupOpen(false),
    }
  }

  function searchCoordinates(event) {
    event.preventDefault()
    const match = coordQuery.trim().match(/^\(?\s*(-?\d+)\s*[,;\s]\s*(-?\d+)\s*\)?$/)
    if (!match) {
      setNotice('Escribe coordenadas exactas como 4,-3')
      return
    }
    const worldX = Number(match[1])
    const worldY = Number(match[2])
    if (worldX < MIN_COORD || worldX > MAX_COORD || worldY < MIN_COORD || worldY > MAX_COORD) {
      setNotice(`Fuera del mapa. Rango válido: X ${MIN_COORD}…${MAX_COORD}, Y ${MIN_COORD}…${MAX_COORD}.`)
      return
    }
    const id = `${worldX + CENTER_INDEX}-${CENTER_INDEX - worldY}`
    const tile = tiles.find((item) => item.id === id)
    if (!tile) return
    setSelectedId(tile.id)
    setPopupOpen(isImportantTile(tile))
    focusTile(worldX, worldY)
    setNotice(`Coordenada encontrada: (${worldX}, ${worldY}) · ${tile.isPlayerBase ? 'Base de jugador' : TILE_TYPES[tile.type].name}`)
  }

  function simulatePlayerJoin() {
    const owner = `Jugador ${String(playerNumber).padStart(2, '0')}`
    const result = assignRandomPlayerBase(tiles, owner)
    if (!result.assigned) {
      setNotice(result.reason)
      return
    }
    setTiles(result.tiles)
    setSelectedId(result.target.id)
    setPopupOpen(true)
    setPlayerNumber((value) => value + 1)
    focusTile(result.target.worldX, result.target.worldY)
    setNotice(`${owner} se ha establecido en (${result.target.worldX}, ${result.target.worldY}).`)
  }

  const detail = selected ? popupData(selected) : null
  const netFoodRate = Math.round(gameState.passiveProductionPerHour.food - gameState.totalFoodUpkeepPerHour)

  if (currentView === 'landing') {
    return <LandingPage onPlay={() => setCurrentView('game')} />
  }

  return (
    <main className="game-shell">
      <section className="game-phone" aria-label="FourKingdoms App">
        {/* Barra Superior de Recursos Reales */}
        <header className="top-bar">
          <div className="brand-row">
            <div className="brand-title-wrap">
              <img
                src="/assets/ui/logo-fourkingdoms.png"
                alt="FourKingdoms"
                className="game-brand-logo"
              />
              <div>
                <p className="eyebrow">ALPHA v0.1 · PODER ⭐ {gameState.kingdomPower.toLocaleString()}</p>
                <h1>FOURKINGDOMS</h1>
              </div>
            </div>
            <div className="top-bar-controls">
              <button
                type="button"
                className="btn-top-action reset"
                onClick={() => {
                  if (window.confirm('¿Reiniciar partida con cuenta nueva limpia de Alpha v0.1? (1,500W, 1,500S, 1,800F, 120 KING, 10 Infanterías y solo Castillo Nv.1)')) {
                    gameState.resetGame()
                    setActiveMenu('home')
                  }
                }}
                title="Reiniciar a cuenta nueva"
              >
                🔄 Nueva Cuenta
              </button>
              <button
                type="button"
                className="btn-top-action sandbox"
                onClick={gameState.grantTestResources}
                title="Otorgar recursos y KING para pruebas rápidas"
              >
                ⚡ Sandbox
              </button>
              <button
                type="button"
                className="back-to-landing-btn"
                onClick={() => setCurrentView('landing')}
                title="Volver a la Landing Page"
              >
                ← Landing
              </button>
            </div>
          </div>

          <div
            className="resource-row resource-row-four"
            onClick={() => setShowResourceDetails(!showResourceDetails)}
            title="Toca para ver el desglose económico"
          >
            <div>
              <span>🌲</span>
              <strong>{Math.floor(gameState.resources.wood).toLocaleString()}</strong>
              <small>+{gameState.passiveProductionPerHour.wood}/h</small>
            </div>
            <div>
              <span>🪨</span>
              <strong>{Math.floor(gameState.resources.stone).toLocaleString()}</strong>
              <small>+{gameState.passiveProductionPerHour.stone}/h</small>
            </div>
            <div
              className={gameState.isHungry ? 'hungry-pill' : ''}
              title={`Producción: +${gameState.passiveProductionPerHour.food}/h | Consumo ejército: -${gameState.totalFoodUpkeepPerHour}/h | Balance neto: ${netFoodRate >= 0 ? '+' : ''}${netFoodRate}/h`}
            >
              <span>🌾</span>
              <strong>{Math.floor(gameState.resources.food).toLocaleString()}</strong>
              <small className={gameState.isHungry ? 'red-text' : (netFoodRate >= 0 ? 'green-text' : 'orange-text')}>
                {gameState.isHungry ? '¡HAMBRE!' : `${netFoodRate >= 0 ? '+' : ''}${netFoodRate}/h`}
              </small>
            </div>
            <div className="king-resource">
              <Crown size={20} />
              <strong>{gameState.king.claimed.toFixed(0)}</strong>
              <small>+{gameState.estimatedDailyKing}/d</small>
            </div>
          </div>
        </header>

        {/* Selector Rápido: Mi Base vs Mapa Mundial */}
        <div className="view-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${activeMenu === 'build' ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu('build')
              setPopupOpen(false)
            }}
          >
            🏰 Mi Ciudad / Base
          </button>
          <button
            type="button"
            className={`mode-btn ${activeMenu === 'home' ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu('home')
              setPopupOpen(false)
            }}
          >
            🗺️ Mapa Mundial (50×50)
          </button>
        </div>

        {/* Modal de Desglose Económico Rápido */}
        {showResourceDetails && (
          <div className="modal-overlay" onClick={() => setShowResourceDetails(false)}>
            <div className="march-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="march-modal-header">
                <h3>Economía del Reino</h3>
                <button type="button" className="close-btn" onClick={() => setShowResourceDetails(false)}><X size={18} /></button>
              </div>
              <div className="tax-info-box">
                <div>
                  <strong>Producción Pasiva del Castillo:</strong>
                  <p>🌲 +{gameState.passiveProductionPerHour.wood}W/h · 🪨 +{gameState.passiveProductionPerHour.stone}S/h · 🌾 +{gameState.passiveProductionPerHour.food}F/h</p>
                  <strong>Mantenimiento de Ejército:</strong>
                  <p>🌾 -{gameState.totalFoodUpkeepPerHour} Comida/h (Penalización logística: ×{gameState.logisticsMultiplier.toFixed(2)})</p>
                  <strong>Estados de KING:</strong>
                  <p>
                    Pendiente: {gameState.king.pending.toFixed(2)} KING<br />
                    Protegido: {gameState.kingProtected.toFixed(2)} KING<br />
                    Expuesto: {gameState.kingExposed.toFixed(2)} KING<br />
                    Vault / Wallet: {gameState.king.vault.toFixed(2)} KING
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
        {activeMenu === 'home' && (
          <div
            ref={viewportRef}
            className="map-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onScroll={(e) => {
              e.currentTarget.scrollLeft = 0
              e.currentTarget.scrollTop = 0
            }}
          >
            {/* Buscador de Coordenadas */}
            <form className="map-search" onSubmit={searchCoordinates}>
              <MapPin size={16} />
              <input value={coordQuery} onChange={(e) => setCoordQuery(e.target.value)} placeholder="X,Y ej. 4,-3" aria-label="Buscar coordenadas" />
              <button type="submit" aria-label="Buscar"><Search size={17} /></button>
            </form>

            {/* Banner Flotante de Marchas Activas */}
            {gameState.marches.length > 0 && (
              <div className="floating-marches-bar">
                {gameState.marches.map((m) => {
                  const now = Date.now()
                  let targetTime = m.arriveTime
                  let phaseLabel = 'Viajando'
                  if (m.status === 'gathering') { targetTime = m.gatherUntil; phaseLabel = 'Recolectando' }
                  if (m.status === 'returning') { targetTime = m.returnTime; phaseLabel = 'Regresando' }
                  const remSec = Math.max(1, Math.ceil((targetTime - now) / 1000))
                  const speedCost = gameState.calculateKingCostForSec(remSec)

                  return (
                    <div key={m.id} className="march-pill">
                      <div className="march-pill-left">
                        <span>🐎</span>
                        <div>
                          <strong>{m.targetName}</strong> ({phaseLabel}: {remSec}s)
                        </div>
                      </div>
                      <button
                        type="button"
                        className="march-pill-speedup"
                        onClick={() => gameState.speedupMarch(m.id)}
                      >
                        ⚡ {speedCost} KING
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Cuadrícula del Mapa */}
            <MapGrid
              tiles={tiles}
              selectedId={selectedId}
              onSelectTile={selectTile}
              gridRef={mapGridRef}
              marches={gameState.marches}
              baseCoord={DEMO_BASE}
              onSpeedupMarch={gameState.speedupMarch}
              calculateKingCostForSec={gameState.calculateKingCostForSec}
              initialStyle={{
                gridTemplateColumns: `repeat(${MAP_SIZE}, ${TILE_SIZE}px)`,
                gridAutoRows: `${TILE_SIZE}px`,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
            />

            {/* Controles de Zoom y Centrado */}
            <div className="zoom-controls">
              <button
                type="button"
                className="zoom-base-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  focusTile(DEMO_BASE.worldX, DEMO_BASE.worldY, INITIAL_SCALE)
                  const baseTile = tiles.find((t) => t.worldX === DEMO_BASE.worldX && t.worldY === DEMO_BASE.worldY)
                  if (baseTile) {
                    setSelectedId(baseTile.id)
                    setPopupOpen(true)
                  }
                }}
                title="Centrar en Mi Base (4, -3)"
                aria-label="Centrar en Mi Base"
              >
                🏰
              </button>
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(0.1)} aria-label="Acercar"><ZoomIn /></button>
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(-0.1)} aria-label="Alejar"><ZoomOut /></button>
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={centerOrigin} aria-label="Centrar en cero cero"><Crosshair /></button>
            </div>

            {/* Barra de Acceso Rápido a Mi Base */}
            <div className="map-quick-bar">
              <button
                type="button"
                className="btn-quick-base"
                onClick={() => setActiveMenu('build')}
              >
                🏛️ Mi Base (Edificios)
              </button>
              <button
                type="button"
                className="btn-quick-center"
                onClick={() => {
                  focusTile(DEMO_BASE.worldX, DEMO_BASE.worldY, INITIAL_SCALE)
                  const baseTile = tiles.find((t) => t.worldX === DEMO_BASE.worldX && t.worldY === DEMO_BASE.worldY)
                  if (baseTile) {
                    setSelectedId(baseTile.id)
                    setPopupOpen(true)
                  }
                }}
              >
                📍 Centrar (4, -3)
              </button>
            </div>

            {/* Estado de Gemas Temporales */}
            <div className="gem-status">
              <span className="gem-dot">◆</span>
              <div>
                <strong>{activeGemCount}/{MAX_ACTIVE_GEMS} gemas</strong>
                <small>Nueva en {Math.ceil(nextGemIn / 1000)}s</small>
              </div>
            </div>

            {/* Popup Informativo de Casilla */}
            {popupOpen && selected && detail && (
              <section
                className="tile-popup"
                role="dialog"
                aria-modal="false"
                aria-label="Información de la casilla"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button className="popup-close" type="button" onClick={() => setPopupOpen(false)} aria-label="Cerrar"><X size={20} /></button>
                <div className="popup-art"><img src={detail.image} alt="" /></div>
                <div className="popup-copy">
                  <small>COORD. ({selected.worldX}, {selected.worldY}) · TILE {TILE_TYPES[selected.type].tileNumber}</small>
                  <h2>{detail.title}</h2>
                  <strong>{detail.subtitle}</strong>
                  {detail.lines.map((line) => <p key={line}>{line}</p>)}
                </div>
                <button
                  type="button"
                  className="popup-action"
                  onClick={() => {
                    detail.onClick ? detail.onClick() : setPopupOpen(false)
                  }}
                >
                  {detail.action}
                </button>
              </section>
            )}
          </div>
        )}

        {activeMenu === 'build' && <BuildView gameState={gameState} onClose={() => setActiveMenu('home')} />}
        {activeMenu === 'battle' && (
          <BattleView
            gameState={gameState}
            onClose={() => setActiveMenu('home')}
            onGoToBuild={() => setActiveMenu('build')}
            onOpenReport={(rep) => setSelectedReport(rep)}
          />
        )}
        {activeMenu === 'clan' && <ClanView gameState={gameState} onClose={() => setActiveMenu('home')} />}
        {activeMenu === 'market' && <MarketView gameState={gameState} onClose={() => setActiveMenu('home')} />}

        {/* Barra de Notificaciones y Spawn de Jugadores */}
        <div className="notice-bar">
          <span>{notice}</span>
          {activeMenu === 'home' && (
            <button type="button" className="spawn-player-button" onClick={simulatePlayerJoin}>+ Jugador</button>
          )}
        </div>

        {/* Barra de Navegación Inferior */}
        <nav className="bottom-nav" aria-label="Navegación principal">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeMenu === item.id ? 'active' : ''}
              onClick={() => {
                setActiveMenu(item.id)
                setPopupOpen(false)
              }}
            >
              {item.isGlobe ? (
                <div className="nav-globe-wrap">
                  <Globe2 className="nav-globe-icon" size={24} />
                </div>
              ) : (
                <img className="nav-art" src={item.src} alt="" draggable="false" />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Modal de Despacho de Marcha */}
        {marchModalTarget && (
          <MarchModal
            tile={marchModalTarget}
            tileDef={TILE_TYPES[marchModalTarget.type]}
            baseCoord={DEMO_BASE}
            gameState={gameState}
            onClose={() => setMarchModalTarget(null)}
          />
        )}

        {/* Modal de Reporte de Batalla */}
        {selectedReport && (
          <BattleReportModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </section>
    </main>
  )
}
