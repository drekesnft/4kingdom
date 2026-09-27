import React, { useState } from 'react'
import { TROOPS_CONFIG, NPC_TIERS, RESOURCE_TIERS } from '../game/config'
import { calculateArmyCarry, totalTroopCount, calculateArmyAttack } from '../game/combat'
import { X, Send, Compass, ShieldAlert, AlertTriangle, Sparkles } from 'lucide-react'

export default function MarchModal({ tile, tileDef, baseCoord, gameState, onClose }) {
  const { troops, dispatchMarch, isHungry, maxSimultaneousMarches, marches, shieldUntil } = gameState

  const [selectedArmy, setSelectedArmy] = useState({
    infantry: Math.min(troops.infantry, 5),
    archer: Math.min(troops.archer, 0),
    cavalry: Math.min(troops.cavalry, 0),
  })

  // Distancia Chebyshev: max(|x2 - x1|, |y2 - y1|)
  const dx = Math.abs(tile.worldX - baseCoord.worldX)
  const dy = Math.abs(tile.worldY - baseCoord.worldY)
  const distance = Math.max(dx, dy, 1)

  // Tipo de marcha según tile
  let marchType = 'gather'
  let targetTitle = tileDef.name
  let targetLevel = 1
  let nodeReserve = 250

  if (tileDef.role === 'enemy') {
    marchType = 'npc'
    // Asignar nivel de NPC según distancia o hash
    targetLevel = Math.min(5, Math.max(1, Math.floor(distance / 4) + 1))
    targetTitle = `Campamento Hostil Nv.${targetLevel}`
  } else if (tile.isPlayerBase) {
    marchType = 'pvp'
    targetTitle = `Base de ${tile.owner || 'Jugador Rival'}`
  } else if (tileDef.resource) {
    marchType = 'gather'
    targetLevel = Math.min(5, Math.max(1, Math.floor(distance / 5) + 1))
    nodeReserve = RESOURCE_TIERS[targetLevel]?.reserve || 500
  }

  // Velocidad de viaje (Sección 3):
  // 1 casilla/min = 60s/casilla
  // Solo caballería = 2 casillas/min = 30s/casilla
  const isCavalryOnly = selectedArmy.cavalry > 0 && selectedArmy.infantry === 0 && selectedArmy.archer === 0
  let travelSecPerTile = isCavalryOnly ? 30 : 60
  if (isHungry) travelSecPerTile = Math.round(travelSecPerTile * 1.33) // -25% vel por hambre
  const travelDurationSec = distance * travelSecPerTile

  const totalTroops = totalTroopCount(selectedArmy)
  const totalCarry = calculateArmyCarry(selectedArmy)
  const totalAttack = calculateArmyAttack(selectedArmy, isHungry)

  const handleSliderChange = (tId, val) => {
    const num = Math.max(0, Math.min(troops[tId] || 0, Number(val)))
    setSelectedArmy((prev) => ({ ...prev, [tId]: num }))
  }

  const handleDispatch = () => {
    const result = dispatchMarch({
      type: marchType,
      targetX: tile.worldX,
      targetY: tile.worldY,
      targetName: targetTitle,
      army: selectedArmy,
      resourceType: tileDef.resource,
      nodeResourceMax: nodeReserve,
      targetLevel,
    })

    if (result.success) {
      onClose()
    } else {
      alert(result.reason)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="march-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="march-modal-header">
          <div>
            <h3>Despachar Marcha</h3>
            <p>{targetTitle} en ({tile.worldX}, {tile.worldY})</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Datos de viaje y distancia */}
        <div className="march-travel-info">
          <div className="info-stat">
            <Compass size={16} />
            <span>Distancia: <strong>{distance} casillas</strong></span>
          </div>
          <div className="info-stat">
            <span>Tiempo de viaje: <strong>~{Math.round(travelDurationSec / 60)} min</strong></span>
          </div>
          {isCavalryOnly && (
            <div className="cavalry-bonus-tag">
              ⚡ Bonus solo Caballería: 2 casillas/min
            </div>
          )}
        </div>

        {/* Advertencias */}
        {marchType === 'pvp' && shieldUntil > Date.now() && (
          <div className="pvp-warning-box">
            <ShieldAlert size={16} />
            <small>¡Atención! Iniciar este asalto PvP cancelará de inmediato tu Escudo de Paz.</small>
          </div>
        )}

        {isHungry && (
          <div className="hunger-warning-box">
            <AlertTriangle size={15} />
            <small>Hambre activa: velocidad de viaje reducida 25% y ataque reducido 20%.</small>
          </div>
        )}

        {/* Resumen del objetivo */}
        {marchType === 'npc' && (
          <div className="target-summary-box">
            <div className="target-summary-header">
              <strong>Enemigos: {NPC_TIERS[targetLevel].name}</strong>
              <small>Poder: {NPC_TIERS[targetLevel].power}</small>
            </div>
            <p>Guarnición: {NPC_TIERS[targetLevel].recommended}</p>
            <small className="king-loot-hint">Posibilidad de drop KING: {Math.round(NPC_TIERS[targetLevel].kingDropRate * 100)}% ({NPC_TIERS[targetLevel].kingDropAmount} KING)</small>
          </div>
        )}

        {marchType === 'gather' && (
          <div className="target-summary-box">
            <div className="target-summary-header">
              <strong>Nodo de {tileDef.name} (Nv. {targetLevel})</strong>
              <small>Reserva: {nodeReserve}</small>
            </div>
            <p>Capacidad de tu marcha: {totalCarry} / {nodeReserve}</p>
          </div>
        )}

        {/* Selectores de Tropas */}
        <div className="army-selectors-list">
          <h4>Selecciona las tropas a enviar:</h4>
          {Object.values(TROOPS_CONFIG).map((t) => {
            const available = troops[t.id] || 0
            const currentSelected = selectedArmy[t.id] || 0

            return (
              <div key={t.id} className="army-selector-item">
                <div className="selector-troop-info">
                  <img src={t.image} alt={t.name} />
                  <div>
                    <strong>{t.name}</strong>
                    <small>Disponibles en casa: {available}</small>
                  </div>
                </div>
                <div className="slider-control">
                  <button
                    type="button"
                    className="quick-adjust-btn"
                    onClick={() => handleSliderChange(t.id, currentSelected - 1)}
                    disabled={currentSelected <= 0}
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0"
                    max={available}
                    value={currentSelected}
                    onChange={(e) => handleSliderChange(t.id, e.target.value)}
                    disabled={available === 0}
                  />
                  <button
                    type="button"
                    className="quick-adjust-btn"
                    onClick={() => handleSliderChange(t.id, currentSelected + 1)}
                    disabled={currentSelected >= available}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="quick-adjust-btn max"
                    onClick={() => handleSliderChange(t.id, available)}
                    disabled={available === 0}
                  >
                    MÁX
                  </button>
                  <span className="count-display">{currentSelected}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Totales de la Marcha */}
        <div className="march-totals-card">
          <div><small>Tropas enviadas:</small><strong>{totalTroops}</strong></div>
          <div><small>Poder de Ataque:</small><strong>⚔️ {totalAttack}</strong></div>
          <div><small>Carga total:</small><strong>🎒 {totalCarry}</strong></div>
          <div><small>Marchas en curso:</small><strong>{marches.length}/{maxSimultaneousMarches}</strong></div>
        </div>

        {/* Botón de Enviar */}
        <button
          type="button"
          className="dispatch-submit-btn"
          onClick={handleDispatch}
          disabled={totalTroops === 0 || marches.length >= maxSimultaneousMarches}
        >
          <Send size={16} /> Despachar Marcha
        </button>
      </div>
    </div>
  )
}
