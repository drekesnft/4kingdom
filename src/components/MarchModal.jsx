import React, { useState } from 'react'
import { TROOPS_CONFIG, NPC_TIERS, RESOURCE_TIERS } from '../game/config'
import { calculateArmyCarry, totalTroopCount, calculateArmyAttack } from '../game/combat'
import { X, Send, Compass, ShieldAlert, AlertTriangle, Sparkles, Flag, Users } from 'lucide-react'

export default function MarchModal({ tile, tileDef, baseCoord, gameState, onClose }) {
  const { troops, dispatchMarch, createRally, clan, isHungry, maxSimultaneousMarches, marches, shieldUntil } = gameState

  const [isRallyMode, setIsRallyMode] = useState(false)
  const [selectedArmy, setSelectedArmy] = useState({
    infantry: Math.min(troops.infantry, 5),
    archer: Math.min(troops.archer, 0),
    cavalry: Math.min(troops.cavalry, 0),
  })

  // Distancia Chebyshev: max(|x2 - x1|, |y2 - y1|)
  const dx = Math.abs(tile.worldX - baseCoord.worldX)
  const dy = Math.abs(tile.worldY - baseCoord.worldY)
  const distance = Math.max(dx, dy, 1)

  const isAllyBase = Boolean(tile.isPlayerBase && clan && tile.clanTag && tile.clanTag === clan.tag)

  // Tipo de marcha según tile
  let marchType = 'gather'
  let targetTitle = tileDef.name
  let targetLevel = 1
  let nodeReserve = 250

  if (tileDef.role === 'enemy') {
    marchType = 'npc'
    targetLevel = Math.min(5, Math.max(1, Math.floor(distance / 4) + 1))
    targetTitle = `Campamento Hostil Nv.${targetLevel}`
  } else if (tile.isPlayerBase) {
    if (isAllyBase) {
      marchType = 'reinforce'
      targetTitle = `Refuerzos a ${tile.owner || 'Aliado'} [${tile.clanTag}]`
    } else {
      marchType = 'pvp'
      targetTitle = `Base Rival de ${tile.owner || 'Jugador Rival'} [${tile.clanTag || 'Sin Clan'}]`
    }
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
    if (isRallyMode) {
      if (!clan) {
        alert('Debes pertenecer a un clan para convocar un Rally.')
        return
      }
      const result = createRally({
        targetX: tile.worldX,
        targetY: tile.worldY,
        targetName: targetTitle,
        targetType: marchType,
        army: selectedArmy,
        targetLevel,
        resourceType: tileDef.resource,
      })

      if (result.success) {
        onClose()
      } else {
        alert(result.reason)
      }
    } else {
      const result = dispatchMarch({
        type: marchType,
        targetX: tile.worldX,
        targetY: tile.worldY,
        targetName: targetTitle,
        army: selectedArmy,
        resourceType: tileDef.resource,
        nodeResourceMax: nodeReserve,
        targetLevel,
        targetPlayer: tile.owner,
        targetClanTag: tile.clanTag,
      })

      if (result.success) {
        onClose()
      } else {
        alert(result.reason)
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="march-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="march-modal-header">
          <div>
            <h3>
              {marchType === 'reinforce'
                ? '🛡️ Enviar Refuerzos Aliados'
                : isRallyMode
                ? '🚩 Convocar Rally de Clan'
                : '⚔️ Despachar Marcha'}
            </h3>
            <p>{targetTitle} en ({tile.worldX}, {tile.worldY})</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Banner Explicativo si es Refuerzo a Aliado de Clan */}
        {marchType === 'reinforce' && (
          <div className="reinforce-banner-card">
            <ShieldAlert size={20} className="shield-blue-icon" />
            <div>
              <strong>🛡️ Asistencia a Compañero de Clan [{clan?.tag}]</strong>
              <p>Esta marcha trasladará tropas para reforzar la guarnición de tu aliado <strong>{tile.owner}</strong>. Regresará tras desplegar la defensa.</p>
            </div>
          </div>
        )}

        {/* Selector de Modo: Individual vs Rally de Clan */}
        <div className="march-mode-tabs">
          <button
            type="button"
            className={`mode-tab-btn ${!isRallyMode ? 'active' : ''}`}
            onClick={() => setIsRallyMode(false)}
          >
            <Send size={13} /> Marcha Individual
          </button>
          <button
            type="button"
            className={`mode-tab-btn rally ${isRallyMode ? 'active' : ''}`}
            onClick={() => setIsRallyMode(true)}
          >
            <Flag size={13} /> Convocar Rally (5 min)
          </button>
        </div>

        {isRallyMode && (
          <div className="rally-explainer-banner">
            <div className="rally-explainer-header">
              <Users size={15} />
              <strong>Convocatoria Conjunta de Clan (5 Minutos)</strong>
            </div>
            <p>
              Tu clan tendrá 5 minutos para sumar refuerzos al Rally. Al terminar la cuenta atrás, marcharán juntos hacia el objetivo.
              Las bajas y el botín se distribuirán <strong>proporcionalmente</strong> entre todos los aportantes.
            </p>
          </div>
        )}

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
          className={`dispatch-submit-btn ${isRallyMode ? 'rally-btn-submit' : ''} ${marchType === 'reinforce' ? 'reinforce-btn-submit' : ''}`}
          onClick={handleDispatch}
          disabled={totalTroops === 0 || (!isRallyMode && marches.length >= maxSimultaneousMarches)}
        >
          {marchType === 'reinforce' ? (
            <>
              <Users size={16} /> 🛡️ Enviar Refuerzos a Compañero
            </>
          ) : isRallyMode ? (
            <>
              <Flag size={16} /> Convocar Rally de Clan (5 min)
            </>
          ) : (
            <>
              <Send size={16} /> Despachar Marcha
            </>
          )}
        </button>
      </div>
    </div>
  )
}
