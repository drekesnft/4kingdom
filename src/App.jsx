import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Crown, MapPin, Search, X, ZoomIn, ZoomOut } from 'lucide-react'
import { TILE_TYPES, assignPlayerBase, assignRandomPlayerBase, generateMap, removeOldestGemTile, spawnGemTile } from './data/tileTypes'
import LandingPage from './components/LandingPage'

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
  { id: 'battle', label: 'Batalla', src: '/assets/ui/battle.png' },
  { id: 'build', label: 'Construir', src: '/assets/ui/build.png' },
  { id: 'home', label: 'Inicio', src: '/assets/ui/home.png' },
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
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`tile tile-${def.role} ${important ? 'tile-interactive' : ''} ${tile.type === 'gems' ? 'gem-spawn' : ''} ${tile.isPlayerBase ? 'player-base' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(tile)}
      aria-haspopup={important ? 'dialog' : undefined}
      aria-label={`${def.name}, coordenadas ${tile.worldX}, ${tile.worldY}${important ? ', abrir información' : ''}`}
    >
      <TileImage def={def} />
      <span className="axis-coordinate">{tile.worldX},{tile.worldY}</span>
      {tile.isPlayerBase && <img className="base-layer" src={BASE_ASSET} alt="" draggable="false" aria-hidden="true" />}
    </button>
  )
})

const MapGrid = memo(function MapGrid({ tiles, selectedId, onSelectTile, gridRef, initialStyle }) {
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
    </div>
  )
})

export default function App() {
  const initialMap = useMemo(() => {
    const generated = generateMap(MAP_SIZE)
    const demo = assignPlayerBase(generated, DEMO_BASE_ID, 'Jugador 01')
    return demo.assigned ? demo.tiles : generated
  }, [])

  const [tiles, setTiles] = useState(initialMap)
  const [selectedId, setSelectedId] = useState(DEMO_BASE_ID)
  const [popupOpen, setPopupOpen] = useState(false)
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [offset, setOffset] = useState({ x: -1500, y: -1500 })
  const [nextGemIn, setNextGemIn] = useState(GEM_SPAWN_MS)
  const [notice, setNotice] = useState('Mapa 50×50. Toca recursos, bases, enemigos, gemas o escombros para ver su ficha.')
  const [playerNumber, setPlayerNumber] = useState(2)
  const [activeMenu, setActiveMenu] = useState('home')
  const [coordQuery, setCoordQuery] = useState('')
  const [currentView, setCurrentView] = useState('landing')

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
    if (currentView === 'game') {
      const timer = setTimeout(() => {
        updateViewportSize()
        focusTile(DEMO_BASE.worldX, DEMO_BASE.worldY, INITIAL_SCALE)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [currentView, focusTile, updateViewportSize])

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
    if (event.target.closest('.map-search, .zoom-controls, .tile-popup')) return

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

      if (!drag.isDragging && Math.hypot(dx, dy) > 4) {
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
    if (activePointers.current.has(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {}
      activePointers.current.delete(event.pointerId)
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
      if (drag.isDragging) {
        drag.suppressClick = true
        setTimeout(() => {
          drag.suppressClick = false
        }, 100)

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
        setOffset({ x: cameraRef.current.x, y: cameraRef.current.y })
        setScale(cameraRef.current.scale)
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
    if (dragRef.current.isDragging || dragRef.current.suppressClick) return
    setSelectedId(tile.id)
    if (isImportantTile(tile)) {
      setPopupOpen(true)
      setNotice(`(${tile.worldX}, ${tile.worldY}) · ${tile.isPlayerBase ? 'Base del jugador' : TILE_TYPES[tile.type].name}`)
    } else {
      setPopupOpen(false)
    }
  }, [])

  function popupData(tile) {
    const def = TILE_TYPES[tile.type]
    const tileLabel = `Tile ${def.tileNumber}`

    if (tile.isPlayerBase) return {
      title: 'Base del jugador',
      subtitle: tile.owner,
      lines: [
        'Centro del reino',
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Terreno base: Tile 1',
        'Desde aquí se gestionarán edificios, defensa y tropas.',
      ],
      image: BASE_ASSET,
      action: 'Ver base',
    }

    if (def.resource === 'wood') return {
      title: 'Bosque de madera',
      subtitle: `${tileLabel} · Recurso: Madera`,
      lines: [
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Nodo natural de madera.',
        'Puede ser recolectado, protegido o disputado por otros jugadores.',
        'Se usará principalmente para construcciones y mejoras.',
      ],
      image: def.assets?.[0],
      action: 'Recolectar madera',
    }

    if (def.resource === 'stone') return {
      title: def.name,
      subtitle: `${tileLabel} · Recurso: Piedra`,
      lines: [
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Yacimiento de piedra del mapa.',
        'Puede ser explotado, protegido o conquistado.',
        'Se usará para fortificaciones, edificios y mejoras.',
      ],
      image: def.assets?.[0],
      action: 'Extraer piedra',
    }

    if (def.resource === 'food') return {
      title: 'Zona de comida',
      subtitle: `${tileLabel} · Recurso: Comida`,
      lines: [
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Zona productiva de alimento.',
        'Sostiene el crecimiento del reino y el mantenimiento de tropas.',
      ],
      image: def.assets?.[0],
      action: 'Recolectar comida',
    }

    if (def.resource === 'gems') return {
      title: 'Gemas doradas',
      subtitle: `${tileLabel} · Evento temporal`,
      lines: [
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Aparición especial y limitada en el mapa.',
        'Debes farmearla antes de que desaparezca y la casilla vuelva a Tile 1.',
      ],
      image: def.assets?.[0],
      action: 'Farmear gemas',
    }

    if (def.role === 'enemy') return {
      title: 'Campamento enemigo',
      subtitle: `${tileLabel} · Enemigo`,
      lines: [
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Objetivo hostil del mapa.',
        'Podrás atacarlo para obtener botín, progreso y control territorial.',
      ],
      image: def.assets?.[0],
      action: 'Atacar',
    }

    if (def.role === 'rubble') return {
      title: 'Escombros',
      subtitle: `${tileLabel} · Punto de interés`,
      lines: [
        `Posición: (${tile.worldX}, ${tile.worldY})`,
        'Restos abandonados en el mapa.',
        'Puede convertirse en un punto de exploración, loot o una futura ubicación estratégica.',
      ],
      image: def.assets?.[0],
      action: 'Explorar',
    }

    return {
      title: def.name,
      subtitle: `${tileLabel} · Terreno`,
      lines: [`Posición: (${tile.worldX}, ${tile.worldY})`, 'Casilla del mundo.'],
      image: def.assets?.[0],
      action: 'Cerrar',
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
    setNotice(`Coordenada encontrada: (${worldX}, ${worldY}) · ${tile.isPlayerBase ? 'Base del jugador' : TILE_TYPES[tile.type].name}`)
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
    setNotice(`${owner} → segmento ${result.quadrant} → (${result.target.worldX}, ${result.target.worldY}). Entorno: ${result.counts.wood} madera, ${result.counts.stone} piedra y ${result.counts.food} comida.`)
  }

  const detail = selected ? popupData(selected) : null

  if (currentView === 'landing') {
    return <LandingPage onPlay={() => setCurrentView('game')} />
  }

  return (
    <main className="game-shell">
      <section className="game-phone" aria-label="Kingdom Wars prototype">
        <header className="top-bar">
          <div className="brand-row">
            <div className="brand-title-wrap">
              <img
                src="/assets/ui/logo-fourkingdoms.png"
                alt="FourKingdoms"
                className="game-brand-logo"
              />
              <div>
                <p className="eyebrow">TEMPORADA 0 · MAPA {MAP_SIZE}×{MAP_SIZE}</p>
                <h1>FOURKINGDOMS</h1>
              </div>
            </div>
            <button
              type="button"
              className="back-to-landing-btn"
              onClick={() => setCurrentView('landing')}
              title="Volver al inicio"
            >
              ← Inicio
            </button>
          </div>
          <div className="resource-row resource-row-four">
            <div><span>🌲</span><strong>1.2K</strong><small>Madera</small></div>
            <div><span>🪨</span><strong>850</strong><small>Piedra</small></div>
            <div><span>🌾</span><strong>640</strong><small>Comida</small></div>
            <div className="king-resource"><Crown size={20} /><strong>120</strong><small>KING</small></div>
          </div>
        </header>

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
          <form className="map-search" onSubmit={searchCoordinates}>
            <MapPin size={16} />
            <input value={coordQuery} onChange={(e) => setCoordQuery(e.target.value)} placeholder="X,Y  ej. 4,-3" aria-label="Buscar coordenadas" />
            <button type="submit" aria-label="Buscar"><Search size={17} /></button>
          </form>

          <MapGrid
            tiles={tiles}
            selectedId={selectedId}
            onSelectTile={selectTile}
            gridRef={mapGridRef}
            initialStyle={{
              gridTemplateColumns: `repeat(${MAP_SIZE}, ${TILE_SIZE}px)`,
              gridAutoRows: `${TILE_SIZE}px`,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
          />

          <div className="zoom-controls">
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(0.1)} aria-label="Acercar"><ZoomIn /></button>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => zoom(-0.1)} aria-label="Alejar"><ZoomOut /></button>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={centerOrigin} aria-label="Centrar en cero cero"><Crosshair /></button>
          </div>

          <div className="gem-status"><span className="gem-dot">◆</span><div><strong>{activeGemCount}/{MAX_ACTIVE_GEMS} gemas</strong><small>Nueva en {Math.ceil(nextGemIn / 1000)}s</small></div></div>

          {popupOpen && selected && detail && (
            <section className="tile-popup" role="dialog" aria-modal="false" aria-label="Información de la casilla">
              <button className="popup-close" type="button" onClick={() => setPopupOpen(false)} aria-label="Cerrar"><X size={20} /></button>
              <div className="popup-art"><img src={detail.image} alt="" /></div>
              <div className="popup-copy">
                <small>COORD. ({selected.worldX}, {selected.worldY}) · TILE {TILE_TYPES[selected.type].tileNumber}</small>
                <h2>{detail.title}</h2>
                <strong>{detail.subtitle}</strong>
                {detail.lines.map((line) => <p key={line}>{line}</p>)}
              </div>
              <button type="button" className="popup-action" onClick={() => setNotice(`${detail.action}: (${selected.worldX}, ${selected.worldY}) · ${detail.title}`)}>{detail.action}</button>
            </section>
          )}
        </div>

        <div className="notice-bar"><span>{notice}</span><button type="button" className="spawn-player-button" onClick={simulatePlayerJoin}>+ Jugador</button></div>

        <nav className="bottom-nav" aria-label="Navegación principal">
          {MENU_ITEMS.map((item) => (
            <button key={item.id} type="button" className={activeMenu === item.id ? 'active' : ''} onClick={() => setActiveMenu(item.id)}>
              <img className="nav-art" src={item.src} alt="" draggable="false" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  )
}
