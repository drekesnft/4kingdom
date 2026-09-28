import React, { useState, useEffect } from 'react'

export default function MapMarchesOverlay({
  marches,
  baseCoord,
  mapSize = 50,
  tileSize = 112,
  onSpeedupMarch,
  onCancelMarch,
  calculateKingCostForSec,
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    // Actualizar animación suave cada 200ms
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [])

  if (!marches || marches.length === 0) return null

  const centerIndex = Math.floor(mapSize / 2)
  const mapPixelSize = mapSize * tileSize
  const defaultBaseX = baseCoord?.worldX ?? baseCoord?.x ?? 0
  const defaultBaseY = baseCoord?.worldY ?? baseCoord?.y ?? 0

  return (
    <div
      className="map-marches-overlay"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${mapPixelSize}px`,
        height: `${mapPixelSize}px`,
        pointerEvents: 'none',
        zIndex: 18,
      }}
    >
      <svg
        width={mapPixelSize}
        height={mapPixelSize}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="glow-attack" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ff5252" floodOpacity="0.8" />
          </filter>
          <filter id="glow-gather" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#4fc3f7" floodOpacity="0.8" />
          </filter>
        </defs>

        {marches.map((m) => {
          const origX = typeof m.originX === 'number' ? m.originX : defaultBaseX
          const origY = typeof m.originY === 'number' ? m.originY : defaultBaseY
          const origGridX = origX + centerIndex
          const origGridY = centerIndex - origY
          const origPx = (origGridX + 0.5) * tileSize
          const origPy = (origGridY + 0.5) * tileSize

          const targetGridX = m.targetX + centerIndex
          const targetGridY = centerIndex - m.targetY
          const targetPx = (targetGridX + 0.5) * tileSize
          const targetPy = (targetGridY + 0.5) * tileSize

          const isAttack = m.type === 'npc' || m.type === 'pvp' || m.type === 'fortress' || m.type === 'capital'
          const strokeColor = isAttack ? '#ff5252' : '#4fc3f7'
          const filterId = isAttack ? 'url(#glow-attack)' : 'url(#glow-gather)'

          return (
            <g key={`route_${m.id}`}>
              {/* Línea de ruta con guiones animados */}
              <line
                x1={origPx}
                y1={origPy}
                x2={targetPx}
                y2={targetPy}
                stroke={strokeColor}
                strokeWidth="4"
                strokeDasharray="10 8"
                className="animated-march-line"
                filter={filterId}
                opacity="0.85"
              />

              {/* Anillo pulsante en el objetivo */}
              <circle
                cx={targetPx}
                cy={targetPy}
                r="36"
                fill="none"
                stroke={strokeColor}
                strokeWidth="3"
                className="pulsing-target-ring"
              />
              <circle
                cx={targetPx}
                cy={targetPy}
                r="8"
                fill={strokeColor}
                opacity="0.9"
              />
            </g>
          )
        })}
      </svg>

      {/* Fichas móviles animadas de los ejércitos sobre la ruta */}
      {marches.map((m) => {
        const origX = typeof m.originX === 'number' ? m.originX : defaultBaseX
        const origY = typeof m.originY === 'number' ? m.originY : defaultBaseY
        const origGridX = origX + centerIndex
        const origGridY = centerIndex - origY
        const origPx = (origGridX + 0.5) * tileSize
        const origPy = (origGridY + 0.5) * tileSize

        const targetGridX = m.targetX + centerIndex
        const targetGridY = centerIndex - m.targetY
        const targetPx = (targetGridX + 0.5) * tileSize
        const targetPy = (targetGridY + 0.5) * tileSize

        let currX = origPx
        let currY = origPy
        let angleDeg = 0
        let statusLabel = 'Viajando'
        let remSec = 0

        if (m.status === 'traveling') {
          const totalDuration = m.arriveTime - m.startTime
          const elapsed = now - m.startTime
          const progress = Math.min(1, Math.max(0, elapsed / (totalDuration || 1)))
          currX = origPx + (targetPx - origPx) * progress
          currY = origPy + (targetPy - origPy) * progress
          angleDeg = (Math.atan2(targetPy - origPy, targetPx - origPx) * 180) / Math.PI
          remSec = Math.max(1, Math.ceil((m.arriveTime - now) / 1000))
          statusLabel = m.type === 'gather' ? 'Hacia recurso' : 'Al asalto'
        } else if (m.status === 'gathering') {
          currX = targetPx
          currY = targetPy
          remSec = Math.max(1, Math.ceil((m.gatherUntil - now) / 1000))
          statusLabel = 'Recolectando'
        } else if (m.status === 'returning') {
          const startReturn = m.gatherUntil || m.arriveTime || now
          const totalReturn = m.returnTime - startReturn
          const elapsed = now - startReturn
          const progress = Math.min(1, Math.max(0, elapsed / (totalReturn || 1)))
          // Regresa desde el objetivo hacia la base
          currX = targetPx + (origPx - targetPx) * progress
          currY = targetPy + (origPy - targetPy) * progress
          angleDeg = (Math.atan2(origPy - targetPy, origPx - targetPx) * 180) / Math.PI
          remSec = Math.max(1, Math.ceil((m.returnTime - now) / 1000))
          statusLabel = 'Regresando a base'
        }

        // Selección de imagen representativa según la tropa dominante
        let troopImg = '/assets/troops/infantry.png'
        if ((m.army.cavalry || 0) > 0) troopImg = '/assets/troops/cavalry.png'
        else if ((m.army.archer || 0) > 0) troopImg = '/assets/troops/archer.png'

        const costKing = calculateKingCostForSec ? calculateKingCostForSec(remSec) : 1
        const isAttack = m.type === 'npc' || m.type === 'pvp' || m.type === 'fortress'

        return (
          <div
            key={`marker_${m.id}`}
            className="moving-army-marker"
            style={{
              position: 'absolute',
              left: `${currX}px`,
              top: `${currY}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
          >
            {/* Etiqueta flotante con tiempo restante y acciones */}
            <div className={`march-token-bubble ${m.status === 'returning' ? 'returning' : isAttack ? 'attack' : 'gather'}`}>
              <span className="bubble-type">{statusLabel}</span>
              <strong className="bubble-timer">{remSec}s</strong>
              <div className="bubble-token-actions">
                {onCancelMarch && m.status !== 'returning' && (
                  <button
                    type="button"
                    className="token-cancel-btn"
                    onClick={() => onCancelMarch(m.id)}
                    title="Cancelar marcha y devolver tropas inmediatamente"
                  >
                    ❌
                  </button>
                )}
                {onSpeedupMarch && (
                  <button
                    type="button"
                    className="token-speedup-btn"
                    onClick={() => onSpeedupMarch(m.id)}
                    title={
                      m.status === 'returning'
                        ? `Acelerar Regreso con ${costKing} KING`
                        : m.status === 'gathering'
                        ? `Acelerar Minería con ${costKing} KING`
                        : `Acelerar Ida con ${costKing} KING`
                    }
                  >
                    ⚡{costKing}
                  </button>
                )}
              </div>
            </div>

            {/* Avatar circular de la tropa marchando con flecha de dirección */}
            <div className="army-avatar-wrapper">
              <div
                className="direction-indicator"
                style={{ transform: `rotate(${angleDeg}deg)` }}
              >
                ▲
              </div>
              <img src={troopImg} alt="Marcha" className="army-avatar-img" />
              <div className="army-badge-count">
                {(m.army.infantry || 0) + (m.army.archer || 0) + (m.army.cavalry || 0)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
