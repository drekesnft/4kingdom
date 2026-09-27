import React from 'react'
import { BUILDINGS_CONFIG, KING_CONFIG } from '../game/config'
import { Hammer, Zap, ArrowUpCircle, CheckCircle, ShieldAlert } from 'lucide-react'

export default function BuildView({ gameState, onClose }) {
  const {
    buildings,
    buildingUnderConstruction,
    resources,
    king,
    canUpgradeBuilding,
    upgradeBuilding,
    speedupBuilding,
    calculateKingCostForSec,
  } = gameState

  const now = Date.now()
  const underConstruction = buildingUnderConstruction
  const remainingSec = underConstruction ? Math.max(1, Math.ceil((underConstruction.finishTime - now) / 1000)) : 0
  const speedCost = calculateKingCostForSec(remainingSec)

  const buildingList = Object.values(BUILDINGS_CONFIG)

  return (
    <div className="view-panel build-panel">
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Hammer className="panel-icon" />
          <div>
            <h2>Mi Base (Edificios)</h2>
            <p>5 Edificios Alpha · Nivel Máximo 5 · 1 Constructor</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Tarjeta del Constructor Activo */}
      <div className={`builder-card ${underConstruction ? 'busy' : 'idle'}`}>
        <div className="builder-header">
          <strong>Constructor del Reino</strong>
          <span className="badge">{underConstruction ? '1/1 Ocupado' : '1/1 Disponible'}</span>
        </div>
        {underConstruction ? (
          <div className="builder-active-body">
            <p>
              Mejorando <strong>{BUILDINGS_CONFIG[underConstruction.buildingId].name}</strong> al Nivel <strong>{underConstruction.targetLevel}</strong>
            </p>
            <div className="progress-bar-wrap">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.max(5, 100 - (remainingSec / underConstruction.totalSec) * 100)}%`,
                }}
              />
            </div>
            <div className="builder-actions">
              <span className="timer-text">{remainingSec}s restantes</span>
              <button
                type="button"
                className="speedup-btn"
                onClick={speedupBuilding}
                title="Acelerar inmediatamente (1 KING = 30s)"
              >
                <Zap size={14} /> Acelerar ({speedCost} KING)
              </button>
            </div>
          </div>
        ) : (
          <p className="builder-idle-text">El constructor está esperando nuevas órdenes de mejora.</p>
        )}
      </div>

      {/* Lista de Edificios */}
      <div className="buildings-grid">
        {buildingList.map((b) => {
          const currentLvl = buildings[b.id]
          const isMax = currentLvl >= 5
          const currentStats = b.levels[currentLvl]
          const nextStats = !isMax ? b.levels[currentLvl + 1] : null
          const upgradeCheck = !isMax ? canUpgradeBuilding(b.id) : { can: false }
          const isCurrentlyUpgrading = underConstruction?.buildingId === b.id

          return (
            <div key={b.id} className={`building-card ${isCurrentlyUpgrading ? 'building-active-work' : ''}`}>
              <div className="building-card-top">
                <span className="building-emoji">{b.icon}</span>
                <div className="building-info">
                  <div className="building-title-row">
                    <h3>{b.name}</h3>
                    <span className="building-level">Nv. {currentLvl}/5</span>
                  </div>
                  <p className="building-desc">{b.description}</p>
                </div>
              </div>

              {/* Estadísticas Activas */}
              <div className="building-stats-box">
                <div className="stat-item">
                  <small>Poder</small>
                  <strong>+{currentStats.power}</strong>
                </div>
                {b.id === 'castle' && (
                  <>
                    <div className="stat-item">
                      <small>Marchas</small>
                      <strong>{currentStats.marches} simultáneas</strong>
                    </div>
                    <div className="stat-item">
                      <small>Producción</small>
                      <strong>+{currentStats.passivePerHour.wood}W +{currentStats.passivePerHour.stone}S +{currentStats.passivePerHour.food}F/h</strong>
                    </div>
                  </>
                )}
                {b.id === 'barracks' && (
                  <>
                    <div className="stat-item">
                      <small>Cola máx.</small>
                      <strong>{currentStats.maxQueue} tropas</strong>
                    </div>
                    <div className="stat-item">
                      <small>Velocidad</small>
                      <strong>+{Math.round(currentStats.speedBonus * 100)}% rápida</strong>
                    </div>
                  </>
                )}
                {b.id === 'granary' && (
                  <>
                    <div className="stat-item">
                      <small>Cap. Logística</small>
                      <strong>{currentStats.logisticsCapacity} tropas</strong>
                    </div>
                    <div className="stat-item">
                      <small>Farming KING</small>
                      <strong>{currentStats.kingProductiveCap} tropas elegibles</strong>
                    </div>
                  </>
                )}
                {b.id === 'treasury' && (
                  <>
                    <div className="stat-item">
                      <small>KING Protegido</small>
                      <strong>{currentStats.protectedKing} KING</strong>
                    </div>
                    <div className="stat-item">
                      <small>Pendiente Máx</small>
                      <strong>{currentStats.pendingMax} KING</strong>
                    </div>
                  </>
                )}
                {b.id === 'wall' && (
                  <>
                    <div className="stat-item">
                      <small>Defensa Base</small>
                      <strong>+{Math.round(currentStats.defenseBonus * 100)}%</strong>
                    </div>
                    <div className="stat-item">
                      <small>Reducción Saqueo</small>
                      <strong>-{Math.round(currentStats.lootReduction * 100)}%</strong>
                    </div>
                  </>
                )}
              </div>

              {/* Botón y Costes de Mejora */}
              {!isMax ? (
                <div className="upgrade-section">
                  <div className="upgrade-cost-row">
                    <span>🌲 {nextStats.cost.wood}</span>
                    <span>🪨 {nextStats.cost.stone}</span>
                    <span>🌾 {nextStats.cost.food}</span>
                    <span className="upgrade-time">⏳ {Math.round(nextStats.upgradeTimeSec / 60)}m</span>
                  </div>

                  {upgradeCheck.can ? (
                    <button
                      type="button"
                      className="upgrade-btn ready"
                      onClick={() => upgradeBuilding(b.id)}
                      disabled={Boolean(underConstruction)}
                    >
                      <ArrowUpCircle size={15} /> Mejorar a Nv. {currentLvl + 1}
                    </button>
                  ) : (
                    <div className="upgrade-blocked">
                      <ShieldAlert size={13} />
                      <small>{upgradeCheck.reason}</small>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-level-badge">
                  <CheckCircle size={14} /> Nivel Máximo de Alpha
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
