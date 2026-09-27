import React, { useState } from 'react'
import { BUILDINGS_CONFIG, KING_CONFIG } from '../game/config'
import { Hammer, Zap, ArrowUpCircle, CheckCircle, ShieldAlert, Sparkles, Shield, Swords, Wheat, Coins, Castle } from 'lucide-react'

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

  const [selectedBuildingId, setSelectedBuildingId] = useState('castle')

  const now = Date.now()
  const underConstruction = buildingUnderConstruction
  const remainingSec = underConstruction ? Math.max(1, Math.ceil((underConstruction.finishTime - now) / 1000)) : 0
  const speedCost = calculateKingCostForSec(remainingSec)

  const buildingList = Object.values(BUILDINGS_CONFIG)

  // Poder total aportado por los edificios
  const baseBuildingsPower = Object.entries(buildings).reduce((acc, [bId, lvl]) => {
    return acc + (BUILDINGS_CONFIG[bId]?.levels[lvl]?.power || 0)
  }, 0)

  // Comprobar si los 4 edificios cumplen para subir el Castillo (Sección 6)
  const isCastleReadyForNext = (
    buildings.castle < 5 &&
    buildings.barracks >= buildings.castle &&
    buildings.granary >= buildings.castle &&
    buildings.treasury >= buildings.castle &&
    buildings.wall >= buildings.castle
  )

  const scrollToBuilding = (bId) => {
    setSelectedBuildingId(bId)
    const el = document.getElementById(`building-card-${bId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  return (
    <div className="view-panel build-panel">
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Hammer className="panel-icon" />
          <div>
            <h2>Mi Base y Ciudadela</h2>
            <p>5 Edificios Alpha · Nivel Máximo 5 · 1 Constructor</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* HUB VISUAL DE LA CIUDADELA (Base Interactiva) */}
      <div className="citadel-hub-card">
        <div className="citadel-hub-header">
          <div className="citadel-hub-title">
            <span className="citadel-badge">🏛️ CIUDADELA PRINCIPAL</span>
            <h3>Tu Fortaleza Alpha</h3>
          </div>
          <div className="citadel-power-tag">
            <Sparkles size={13} />
            <span>Poder Edificios: <strong>+{baseBuildingsPower.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Rejilla Interactiva de los 5 Edificios */}
        <div className="citadel-layout-grid">
          {buildingList.map((b) => {
            const lvl = buildings[b.id] || 0
            const isUpgrading = underConstruction?.buildingId === b.id
            const isSelected = selectedBuildingId === b.id

            return (
              <button
                key={b.id}
                type="button"
                className={`citadel-building-slot ${isSelected ? 'selected' : ''} ${isUpgrading ? 'upgrading' : ''}`}
                onClick={() => scrollToBuilding(b.id)}
                title={`Ver detalles de ${b.name}`}
              >
                <div className="slot-icon-wrap">
                  <span className="slot-emoji">{b.icon}</span>
                  {isUpgrading && <span className="slot-hammer-pulse">🔨</span>}
                </div>
                <div className="slot-text-wrap">
                  <strong className="slot-name">{b.name}</strong>
                  <span className={`slot-lvl-badge ${lvl >= 5 ? 'max' : ''}`}>
                    {lvl >= 5 ? 'Nv.5 (MÁX)' : `Nv. ${lvl}/5`}
                  </span>
                </div>
                {isUpgrading && (
                  <div className="slot-mini-progress">
                    <div
                      className="slot-mini-bar"
                      style={{ width: `${Math.max(5, 100 - (remainingSec / underConstruction.totalSec) * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* REGLA DE PROGRESIÓN DEL CASTILLO (Sección 6) */}
      <div className="castle-progression-tracker">
        <div className="tracker-header">
          <span>🏰 Prerrequisito para Castillo Nv.{buildings.castle < 5 ? buildings.castle + 1 : 5}:</span>
          <strong>{isCastleReadyForNext ? '✨ ¡Listo para mejorar!' : `Requiere otros 4 a Nv.${buildings.castle}`}</strong>
        </div>
        <div className="tracker-pills-row">
          <div className={`tracker-pill ${buildings.barracks >= buildings.castle ? 'ready' : 'pending'}`}>
            ⚔️ Cuartel: Nv.{buildings.barracks}/{buildings.castle}
          </div>
          <div className={`tracker-pill ${buildings.granary >= buildings.castle ? 'ready' : 'pending'}`}>
            🌾 Granero: Nv.{buildings.granary}/{buildings.castle}
          </div>
          <div className={`tracker-pill ${buildings.treasury >= buildings.castle ? 'ready' : 'pending'}`}>
            🪙 Tesoro: Nv.{buildings.treasury}/{buildings.castle}
          </div>
          <div className={`tracker-pill ${buildings.wall >= buildings.castle ? 'ready' : 'pending'}`}>
            🛡️ Muralla: Nv.{buildings.wall}/{buildings.castle}
          </div>
        </div>
      </div>

      {/* TARJETA DEL CONSTRUCTOR ACTIVO */}
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
          <p className="builder-idle-text">Constructor libre. Selecciona un edificio para mejorar su nivel.</p>
        )}
      </div>

      {/* LISTA DETALLADA DE EDIFICIOS */}
      <div className="buildings-grid">
        {buildingList.map((b) => {
          const currentLvl = buildings[b.id] || 0
          const isMax = currentLvl >= 5
          const currentStats = b.levels[currentLvl] || b.levels[1]
          const nextStats = !isMax ? b.levels[currentLvl + 1] : null
          const upgradeCheck = !isMax ? canUpgradeBuilding(b.id) : { can: false }
          const isCurrentlyUpgrading = underConstruction?.buildingId === b.id
          const isSelected = selectedBuildingId === b.id

          return (
            <div
              key={b.id}
              id={`building-card-${b.id}`}
              className={`building-card ${isCurrentlyUpgrading ? 'building-active-work' : ''} ${isSelected ? 'highlight-card' : ''}`}
            >
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

              {/* Comparación de Estadísticas: Actual vs Siguiente Nivel */}
              <div className="stat-comparison-grid">
                <div className="comparison-column current">
                  <small>NIVEL ACTUAL ({currentLvl})</small>
                  <div className="stat-row-item">
                    <span>Poder:</span>
                    <strong>+{currentStats.power}</strong>
                  </div>
                  {b.id === 'castle' && (
                    <>
                      <div className="stat-row-item">
                        <span>Marchas:</span>
                        <strong>{currentStats.marches} simultánea(s)</strong>
                      </div>
                      <div className="stat-row-item">
                        <span>Producción:</span>
                        <strong>+{currentStats.passivePerHour.wood}W +{currentStats.passivePerHour.stone}S +{currentStats.passivePerHour.food}F/h</strong>
                      </div>
                    </>
                  )}
                  {b.id === 'barracks' && (
                    <>
                      <div className="stat-row-item">
                        <span>Cola máxima:</span>
                        <strong>{currentStats.maxQueue} tropas</strong>
                      </div>
                      <div className="stat-row-item">
                        <span>Velocidad:</span>
                        <strong>+{Math.round(currentStats.speedBonus * 100)}% rápida</strong>
                      </div>
                    </>
                  )}
                  {b.id === 'granary' && (
                    <>
                      <div className="stat-row-item">
                        <span>Logística:</span>
                        <strong>{currentStats.logisticsCapacity} tropas</strong>
                      </div>
                      <div className="stat-row-item">
                        <span>Farming KING:</span>
                        <strong>{currentStats.kingProductiveCap} tropas elegibles</strong>
                      </div>
                    </>
                  )}
                  {b.id === 'treasury' && (
                    <>
                      <div className="stat-row-item">
                        <span>KING protegido:</span>
                        <strong>{currentStats.protectedKing} KING</strong>
                      </div>
                      <div className="stat-row-item">
                        <span>Pendiente máx:</span>
                        <strong>{currentStats.pendingMax} KING</strong>
                      </div>
                    </>
                  )}
                  {b.id === 'wall' && (
                    <>
                      <div className="stat-row-item">
                        <span>Defensa base:</span>
                        <strong>+{Math.round(currentStats.defenseBonus * 100)}%</strong>
                      </div>
                      <div className="stat-row-item">
                        <span>Reducción saqueo:</span>
                        <strong>-{Math.round(currentStats.lootReduction * 100)}%</strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="comparison-column next">
                  <small>{isMax ? 'NIVEL MÁXIMO' : `SIGUIENTE (Nv. ${currentLvl + 1})`}</small>
                  {nextStats ? (
                    <>
                      <div className="stat-row-item">
                        <span>Poder:</span>
                        <strong className="highlight">+{nextStats.power}</strong>
                      </div>
                      {b.id === 'castle' && (
                        <>
                          <div className="stat-row-item">
                            <span>Marchas:</span>
                            <strong className="highlight">{nextStats.marches} simultánea(s)</strong>
                          </div>
                          <div className="stat-row-item">
                            <span>Producción:</span>
                            <strong className="highlight">+{nextStats.passivePerHour.wood}W +{nextStats.passivePerHour.stone}S +{nextStats.passivePerHour.food}F/h</strong>
                          </div>
                        </>
                      )}
                      {b.id === 'barracks' && (
                        <>
                          <div className="stat-row-item">
                            <span>Cola máxima:</span>
                            <strong className="highlight">{nextStats.maxQueue} tropas</strong>
                          </div>
                          <div className="stat-row-item">
                            <span>Velocidad:</span>
                            <strong className="highlight">+{Math.round(nextStats.speedBonus * 100)}% rápida</strong>
                          </div>
                        </>
                      )}
                      {b.id === 'granary' && (
                        <>
                          <div className="stat-row-item">
                            <span>Logística:</span>
                            <strong className="highlight">{nextStats.logisticsCapacity} tropas</strong>
                          </div>
                          <div className="stat-row-item">
                            <span>Farming KING:</span>
                            <strong className="highlight">{nextStats.kingProductiveCap} tropas</strong>
                          </div>
                        </>
                      )}
                      {b.id === 'treasury' && (
                        <>
                          <div className="stat-row-item">
                            <span>KING protegido:</span>
                            <strong className="highlight">{nextStats.protectedKing} KING</strong>
                          </div>
                          <div className="stat-row-item">
                            <span>Pendiente máx:</span>
                            <strong className="highlight">{nextStats.pendingMax} KING</strong>
                          </div>
                        </>
                      )}
                      {b.id === 'wall' && (
                        <>
                          <div className="stat-row-item">
                            <span>Defensa base:</span>
                            <strong className="highlight">+{Math.round(nextStats.defenseBonus * 100)}%</strong>
                          </div>
                          <div className="stat-row-item">
                            <span>Reducción saqueo:</span>
                            <strong className="highlight">-{Math.round(nextStats.lootReduction * 100)}%</strong>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#ffd65a' }}>
                      👑 ¡Edificio completamente desarrollado en Alpha!
                    </p>
                  )}
                </div>
              </div>

              {/* Sección de Costes y Botón de Mejora */}
              {!isMax ? (
                <div className="upgrade-section">
                  <div className="cost-pills-row">
                    <span className={`cost-pill ${resources.wood >= nextStats.cost.wood ? 'sufficient' : 'insufficient'}`}>
                      🪵 {nextStats.cost.wood.toLocaleString()}
                    </span>
                    <span className={`cost-pill ${resources.stone >= nextStats.cost.stone ? 'sufficient' : 'insufficient'}`}>
                      🪨 {nextStats.cost.stone.toLocaleString()}
                    </span>
                    <span className={`cost-pill ${resources.food >= nextStats.cost.food ? 'sufficient' : 'insufficient'}`}>
                      🌾 {nextStats.cost.food.toLocaleString()}
                    </span>
                    <span className="cost-pill time-pill">
                      ⏳ {Math.round(nextStats.upgradeTimeSec / 60)} min
                    </span>
                  </div>

                  {isCurrentlyUpgrading ? (
                    <button type="button" className="upgrade-action-btn working" onClick={speedupBuilding}>
                      <Zap size={14} /> En Construcción ({remainingSec}s) · Acelerar ({speedCost} KING)
                    </button>
                  ) : underConstruction ? (
                    <button type="button" className="upgrade-action-btn disabled" disabled>
                      🔨 Constructor ocupado en {BUILDINGS_CONFIG[underConstruction.buildingId]?.name}
                    </button>
                  ) : upgradeCheck.can ? (
                    <button
                      type="button"
                      className="upgrade-action-btn ready"
                      onClick={() => upgradeBuilding(b.id)}
                    >
                      <ArrowUpCircle size={15} /> Mejorar a Nivel {currentLvl + 1}
                    </button>
                  ) : (
                    <button type="button" className="upgrade-action-btn disabled" disabled title={upgradeCheck.reason}>
                      <ShieldAlert size={14} /> {upgradeCheck.reason}
                    </button>
                  )}
                </div>
              ) : (
                <button type="button" className="upgrade-action-btn max-level" disabled>
                  <CheckCircle size={14} /> Nivel Máximo de Alpha (Nv. 5)
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
