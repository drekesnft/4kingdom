import React, { useState, useEffect } from 'react'
import { BUILDINGS_CONFIG, KING_CONFIG } from '../game/config'
import {
  Hammer,
  Zap,
  ArrowUpCircle,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Shield,
  Swords,
  Wheat,
  Coins,
  Castle,
  Clock,
  Layers,
  BarChart3,
  TrendingUp,
  XCircle,
} from 'lucide-react'

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
    passiveProductionPerHour,
    logisticsCapacity,
    totalTroopsCount,
    logisticsMultiplier,
    totalFoodUpkeepPerHour,
    productiveTroopsCount,
    maxKingProductiveTroops,
    estimatedDailyKing,
    treasuryProtectionLimit,
    treasuryDailyWithdrawLimit,
  } = gameState

  const [activeTab, setActiveTab] = useState('citadel') // 'citadel' | 'inspector' | 'builder' | 'bonuses'
  const [selectedBuildingId, setSelectedBuildingId] = useState('castle')

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!buildingUnderConstruction) return
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [buildingUnderConstruction])

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

  const handleSelectBuildingInInspector = (bId) => {
    setSelectedBuildingId(bId)
    setActiveTab('inspector')
  }

  const selectedBuildingDef = BUILDINGS_CONFIG[selectedBuildingId]
  const currentLvl = buildings[selectedBuildingId] || 0
  const isMaxLvl = currentLvl >= 5
  const nextLvl = currentLvl + 1
  const currentLevelStats = selectedBuildingDef?.levels[currentLvl] || null
  const nextLevelStats = !isMaxLvl ? selectedBuildingDef?.levels[nextLvl] : null
  const upgradeCheck = canUpgradeBuilding(selectedBuildingId)

  const handleUpgradeAction = (bId) => {
    const res = upgradeBuilding(bId)
    if (!res.success) {
      alert(res.reason)
    }
  }

  return (
    <div className="view-panel build-panel">
      {/* Encabezado Gaming */}
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Hammer className="panel-icon" />
          <div>
            <h2>Mi Base y Ciudadela</h2>
            <p>5 Edificios Alpha · Nivel Máx 5 · 1 Constructor Universal</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Pestañas Gaming Intuitivas */}
      <div className="gaming-subtabs">
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'citadel' ? 'active' : ''}`}
          onClick={() => setActiveTab('citadel')}
        >
          <Castle size={14} /> Ciudadela
        </button>
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspector')}
        >
          <Layers size={14} /> Inspector de Edificios
        </button>
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          <Hammer size={14} /> Constructor {underConstruction && <span className="tab-pulse-badge">1</span>}
        </button>
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'bonuses' ? 'active' : ''}`}
          onClick={() => setActiveTab('bonuses')}
        >
          <BarChart3 size={14} /> Bonos del Reino
        </button>
      </div>

      {/* PESTAÑA 1: CIUDADELA (HUB VISUAL) */}
      {activeTab === 'citadel' && (
        <div className="citadel-tab-content">
          {/* Tarjeta de Resumen de la Ciudadela */}
          <div className="citadel-hub-card">
            <div className="citadel-hub-header">
              <div className="citadel-hub-title">
                <span className="citadel-badge">🏛️ BASE OPERATIVA ALPHA</span>
                <h3>Fortaleza Central</h3>
              </div>
              <div className="citadel-power-tag">
                <Sparkles size={13} />
                <span>Poder Total: <strong>+{baseBuildingsPower.toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Rejilla de los 5 Edificios */}
            <div className="citadel-layout-grid">
              {buildingList.map((b) => {
                const lvl = buildings[b.id] || 0
                const isUpgrading = underConstruction?.buildingId === b.id
                const isNotBuilt = lvl === 0

                return (
                  <div
                    key={b.id}
                    className={`citadel-building-slot ${isUpgrading ? 'upgrading' : ''} ${isNotBuilt ? 'not-built' : ''}`}
                    onClick={() => handleSelectBuildingInInspector(b.id)}
                  >
                    <div className="slot-icon-wrap">
                      <span className="slot-emoji">{b.icon}</span>
                      {isUpgrading && <span className="slot-hammer-pulse">🔨</span>}
                    </div>
                    <div className="slot-text-wrap">
                      <strong className="slot-name">{b.name}</strong>
                      <span className={`slot-lvl-badge ${lvl >= 5 ? 'max' : isNotBuilt ? 'warning' : ''}`}>
                        {lvl >= 5 ? 'Nv.5 (MÁX)' : isNotBuilt ? '⚠️ Sin Construir' : `Nv. ${lvl}/5`}
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

                    <button
                      type="button"
                      className="slot-inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectBuildingInInspector(b.id)
                      }}
                    >
                      {isNotBuilt ? '🔨 Construir' : '🔍 Inspeccionar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Prerrequisitos del Castillo */}
          <div className="castle-progression-tracker">
            <div className="tracker-header">
              <span>🏰 Requisito para Castillo Nv.{buildings.castle < 5 ? buildings.castle + 1 : 5}:</span>
              <strong>{isCastleReadyForNext ? '✨ ¡Listo para mejorar!' : `Requiere otros 4 edificios a Nv.${buildings.castle}`}</strong>
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

          {/* Estado Rápido del Constructor */}
          {underConstruction ? (
            <div className="builder-card busy" onClick={() => setActiveTab('builder')}>
              <div className="builder-header">
                <strong>🔨 Obra en Curso</strong>
                <span className="badge">1/1 Ocupado</span>
              </div>
              <p>
                Mejorando <strong>{BUILDINGS_CONFIG[underConstruction.buildingId].name}</strong> al Nivel <strong>{underConstruction.targetLevel}</strong> ({remainingSec}s restantes)
              </p>
              <div className="progress-bar-wrap">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(5, 100 - (remainingSec / underConstruction.totalSec) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="builder-card idle" onClick={() => setActiveTab('inspector')}>
              <div className="builder-header">
                <strong>🔨 Constructor Disponible</strong>
                <span className="badge ready">1/1 Libre</span>
              </div>
              <p>El constructor está listo para levantar o mejorar tus estructuras. Selecciona un edificio para comenzar.</p>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: INSPECTOR DE EDIFICIOS (ENFOCADO Y SIN SCROLL) */}
      {activeTab === 'inspector' && (
        <div className="inspector-tab-content">
          {/* Selector Horizontal de los 5 Edificios */}
          <div className="building-selector-pills">
            {buildingList.map((b) => {
              const lvl = buildings[b.id] || 0
              const isSelected = selectedBuildingId === b.id
              const isUpgrading = underConstruction?.buildingId === b.id

              return (
                <button
                  key={b.id}
                  type="button"
                  className={`selector-pill-btn ${isSelected ? 'active' : ''} ${isUpgrading ? 'upgrading' : ''}`}
                  onClick={() => setSelectedBuildingId(b.id)}
                >
                  <span className="pill-emoji">{b.icon}</span>
                  <span className="pill-name">{b.name}</span>
                  <span className="pill-lvl">{lvl === 0 ? 'Nv.0' : `Nv.${lvl}`}</span>
                </button>
              )
            })}
          </div>

          {/* Ficha Enfocada del Edificio Seleccionado */}
          <div className="building-focused-card">
            <div className="building-focused-header">
              <div className="focused-icon-box">
                <span>{selectedBuildingDef.icon}</span>
              </div>
              <div className="focused-title-wrap">
                <div className="focused-name-row">
                  <h3>{selectedBuildingDef.name}</h3>
                  <span className={`focused-lvl-tag ${currentLvl >= 5 ? 'max' : currentLvl === 0 ? 'not-built' : ''}`}>
                    {currentLvl >= 5 ? 'Nv. 5 (Máximo)' : currentLvl === 0 ? '⚠️ No Construido' : `Nivel ${currentLvl} de 5`}
                  </span>
                </div>
                <p className="focused-role-desc">{selectedBuildingDef.roleDescription}</p>
              </div>
            </div>

            {/* Comparador de Estadísticas: Nivel Actual vs Siguiente Nivel */}
            <div className="stats-comparison-grid">
              <div className="comparison-col current">
                <span className="col-label">Nivel Actual ({currentLvl === 0 ? 'Sin Construir' : `Nv. ${currentLvl}`})</span>
                <div className="stat-rows-box">
                  {currentLvl === 0 ? (
                    <div className="stat-row muted">
                      <span>Estructura inactiva. No aporta beneficios.</span>
                    </div>
                  ) : (
                    <>
                      <div className="stat-row">
                        <span>Poder aportado:</span>
                        <strong>+{currentLevelStats?.power || 0} ⭐</strong>
                      </div>
                      {selectedBuildingId === 'castle' && (
                        <>
                          <div className="stat-row">
                            <span>Producción Pasiva:</span>
                            <strong>+{currentLevelStats?.passivePerHour?.wood}/h</strong>
                          </div>
                          <div className="stat-row">
                            <span>Marchas Simultáneas:</span>
                            <strong>{currentLevelStats?.marches}</strong>
                          </div>
                        </>
                      )}
                      {selectedBuildingId === 'barracks' && (
                        <>
                          <div className="stat-row">
                            <span>Tropas Desbloqueadas:</span>
                            <strong>{currentLevelStats?.unlockedTroops?.join(', ')}</strong>
                          </div>
                          <div className="stat-row">
                            <span>Bonus Velocidad:</span>
                            <strong>{Math.round((currentLevelStats?.speedBonus || 0) * 100)}%</strong>
                          </div>
                        </>
                      )}
                      {selectedBuildingId === 'granary' && (
                        <>
                          <div className="stat-row">
                            <span>Capacidad Logística:</span>
                            <strong>{currentLevelStats?.logisticsCapacity} tropas</strong>
                          </div>
                          <div className="stat-row">
                            <span>Tropas Productivas KING:</span>
                            <strong>{currentLevelStats?.kingProductiveCap}</strong>
                          </div>
                        </>
                      )}
                      {selectedBuildingId === 'treasury' && (
                        <>
                          <div className="stat-row">
                            <span>KING Protegido:</span>
                            <strong>{currentLevelStats?.protectedKing} KING</strong>
                          </div>
                          <div className="stat-row">
                            <span>Retiro Diario Máx:</span>
                            <strong>{currentLevelStats?.dailyWithdrawMax} KING</strong>
                          </div>
                        </>
                      )}
                      {selectedBuildingId === 'wall' && (
                        <>
                          <div className="stat-row">
                            <span>Mitigación de Daño:</span>
                            <strong>{currentLevelStats?.defenseMitigation}</strong>
                          </div>
                          <div className="stat-row">
                            <span>Guarnición Defensiva:</span>
                            <strong>{currentLevelStats?.garrisonBonus}</strong>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {!isMaxLvl && (
                <div className="comparison-col next">
                  <span className="col-label next-label">
                    <TrendingUp size={13} /> Siguiente Nivel (Nv. {nextLvl})
                  </span>
                  <div className="stat-rows-box">
                    <div className="stat-row highlight">
                      <span>Poder aportado:</span>
                      <strong>+{nextLevelStats?.power} ⭐</strong>
                    </div>
                    {selectedBuildingId === 'castle' && (
                      <>
                        <div className="stat-row highlight">
                          <span>Producción Pasiva:</span>
                          <strong>+{nextLevelStats?.passivePerHour?.wood}/h</strong>
                        </div>
                        <div className="stat-row highlight">
                          <span>Marchas Simultáneas:</span>
                          <strong>{nextLevelStats?.marches}</strong>
                        </div>
                      </>
                    )}
                    {selectedBuildingId === 'barracks' && (
                      <>
                        <div className="stat-row highlight">
                          <span>Tropas Desbloqueadas:</span>
                          <strong>{nextLevelStats?.unlockedTroops?.join(', ')}</strong>
                        </div>
                        <div className="stat-row highlight">
                          <span>Bonus Velocidad:</span>
                          <strong>{Math.round((nextLevelStats?.speedBonus || 0) * 100)}%</strong>
                        </div>
                      </>
                    )}
                    {selectedBuildingId === 'granary' && (
                      <>
                        <div className="stat-row highlight">
                          <span>Capacidad Logística:</span>
                          <strong>{nextLevelStats?.logisticsCapacity} tropas</strong>
                        </div>
                        <div className="stat-row highlight">
                          <span>Tropas Productivas KING:</span>
                          <strong>{nextLevelStats?.kingProductiveCap}</strong>
                        </div>
                      </>
                    )}
                    {selectedBuildingId === 'treasury' && (
                      <>
                        <div className="stat-row highlight">
                          <span>KING Protegido:</span>
                          <strong>{nextLevelStats?.protectedKing} KING</strong>
                        </div>
                        <div className="stat-row highlight">
                          <span>Retiro Diario Máx:</span>
                          <strong>{nextLevelStats?.dailyWithdrawMax} KING</strong>
                        </div>
                      </>
                    )}
                    {selectedBuildingId === 'wall' && (
                      <>
                        <div className="stat-row highlight">
                          <span>Mitigación de Daño:</span>
                          <strong>{nextLevelStats?.defenseMitigation}</strong>
                        </div>
                        <div className="stat-row highlight">
                          <span>Guarnición Defensiva:</span>
                          <strong>{nextLevelStats?.garrisonBonus}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Costes y Botón de Acción */}
            {!isMaxLvl ? (
              <div className="focused-action-section">
                {/* Chequeo de Costes */}
                <div className="cost-chips-row">
                  <div className={`cost-chip ${resources.wood >= nextLevelStats.cost.wood ? 'ok' : 'missing'}`}>
                    <span>🌲 Madera:</span>
                    <strong>{(nextLevelStats.cost.wood || 0).toLocaleString()}</strong>
                  </div>
                  <div className={`cost-chip ${resources.stone >= nextLevelStats.cost.stone ? 'ok' : 'missing'}`}>
                    <span>🪨 Piedra:</span>
                    <strong>{(nextLevelStats.cost.stone || 0).toLocaleString()}</strong>
                  </div>
                  <div className={`cost-chip ${resources.food >= nextLevelStats.cost.food ? 'ok' : 'missing'}`}>
                    <span>🌾 Comida:</span>
                    <strong>{(nextLevelStats.cost.food || 0).toLocaleString()}</strong>
                  </div>
                  <div className="cost-chip time">
                    <Clock size={12} />
                    <span>⏱️ Obra:</span>
                    <strong>
                      {(() => {
                        const sec = nextLevelStats.upgradeTimeSec ?? nextLevelStats.timeSec ?? 0
                        if (sec >= 3600) return `${(sec / 3600).toFixed(1)}h`
                        if (sec >= 60) return `${Math.round(sec / 60)} min`
                        return `${sec}s`
                      })()}
                    </strong>
                  </div>
                </div>

                {/* Motivo de bloqueo si no se puede mejorar */}
                {!upgradeCheck.can && (
                  <div className="upgrade-block-reason">
                    <AlertTriangle size={14} />
                    <span>{upgradeCheck.reason}</span>
                  </div>
                )}

                {/* Botón Principal */}
                <button
                  type="button"
                  className={`focused-upgrade-btn ${currentLvl === 0 ? 'build-new' : ''}`}
                  onClick={() => handleUpgradeAction(selectedBuildingId)}
                  disabled={!upgradeCheck.can}
                >
                  <Hammer size={16} />
                  {currentLvl === 0 ? `Construir ${selectedBuildingDef.name} (Nivel 1)` : `Mejorar a Nivel ${nextLvl}`}
                </button>
              </div>
            ) : (
              <div className="max-level-banner">
                <CheckCircle size={20} className="check-icon" />
                <div>
                  <strong>¡Nivel Máximo Alcanzado!</strong>
                  <p>Este edificio está al Nivel 5, el tope establecido para la Alpha v0.1.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: CONSTRUCTOR DEDICADO */}
      {activeTab === 'builder' && (
        <div className="builder-tab-content">
          <div className="builder-queue-card">
            <div className="queue-top-row">
              <div className="queue-title-wrap">
                <Hammer size={18} />
                <div>
                  <h3>Cola de Construcción</h3>
                  <small>Capacidad Alpha: 1 Constructor Universal</small>
                </div>
              </div>
              <span className={`builder-status-badge ${underConstruction ? 'busy' : 'idle'}`}>
                {underConstruction ? 'Ocupado (1/1)' : 'Libre (1/1)'}
              </span>
            </div>

            {underConstruction ? (
              <div className="builder-active-details">
                <div className="active-project-card">
                  <div className="project-icon">
                    {BUILDINGS_CONFIG[underConstruction.buildingId]?.icon}
                  </div>
                  <div className="project-info">
                    <h4>{BUILDINGS_CONFIG[underConstruction.buildingId]?.name}</h4>
                    <p>Subiendo a <strong>Nivel {underConstruction.targetLevel}</strong></p>
                    <span className="project-timer">⏱️ {remainingSec} segundos restantes</span>
                  </div>
                </div>

                <div className="project-progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.max(5, 100 - (remainingSec / underConstruction.totalSec) * 100)}%`,
                    }}
                  />
                </div>

                {/* Botón de Aceleración con KING */}
                <div className="speedup-action-box">
                  <div className="speedup-info">
                    <span>Aceleración Universal con KING:</span>
                    <small>1 KING = 30 segundos · Coste exacto: <strong>{speedCost} KING</strong></small>
                  </div>
                  <button
                    type="button"
                    className="btn-speedup-king"
                    onClick={speedupBuilding}
                    disabled={king.claimed < speedCost}
                  >
                    <Zap size={15} /> Terminar Inmediatamente ({speedCost} KING)
                  </button>
                </div>
              </div>
            ) : (
              <div className="builder-empty-state">
                <CheckCircle size={36} className="empty-icon-idle" />
                <h4>Tu Constructor está libre</h4>
                <p>Ve al <strong>Inspector de Edificios</strong> para ordenar una mejora o construir un nuevo edificio.</p>
                <button
                  type="button"
                  className="go-inspector-btn"
                  onClick={() => setActiveTab('inspector')}
                >
                  Ir al Inspector de Edificios
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 4: BONOS DEL REINO */}
      {activeTab === 'bonuses' && (
        <div className="bonuses-tab-content">
          <div className="bonuses-grid">
            {/* Producción Pasiva */}
            <div className="bonus-metric-card">
              <div className="metric-header">
                <Castle size={16} />
                <strong>Producción Pasiva del Reino</strong>
              </div>
              <div className="metric-values">
                <div><span>🌲 Madera:</span><strong>+{passiveProductionPerHour.wood}/h</strong></div>
                <div><span>🪨 Piedra:</span><strong>+{passiveProductionPerHour.stone}/h</strong></div>
                <div><span>🌾 Comida:</span><strong>+{passiveProductionPerHour.food}/h</strong></div>
              </div>
              <small>Otorgado por el Castillo (Nv. {buildings.castle})</small>
            </div>

            {/* Logística y Comida */}
            <div className="bonus-metric-card">
              <div className="metric-header">
                <Wheat size={16} />
                <strong>Logística y Mantenimiento</strong>
              </div>
              <div className="metric-values">
                <div><span>Capacidad Logística:</span><strong>{logisticsCapacity} tropas</strong></div>
                <div><span>Tropas Totales:</span><strong>{totalTroopsCount} tropas</strong></div>
                <div><span>Multiplicador Penalización:</span><strong>{logisticsMultiplier.toFixed(2)}x</strong></div>
                <div><span>Consumo Neto de Comida:</span><strong>-{totalFoodUpkeepPerHour}/h</strong></div>
              </div>
              <small>Otorgado por el Granero (Nv. {buildings.granary})</small>
            </div>

            {/* Estado de KING */}
            <div className="bonus-metric-card">
              <div className="metric-header">
                <Coins size={16} />
                <strong>Tesoro y Recompensas KING</strong>
              </div>
              <div className="metric-values">
                <div><span>Estado del Token:</span><strong>Activo</strong></div>
                <div><span>Obtención:</span><strong>Misiones, Asaltos y Botín</strong></div>
              </div>
              <small>El token KING no se genera pasivamente. Se obtiene únicamente mediante misiones, asaltos a campamentos hostiles y victorias PvP.</small>
            </div>

            {/* Seguridad de Tesorería */}
            <div className="bonus-metric-card">
              <div className="metric-header">
                <Shield size={16} />
                <strong>Seguridad de Tesorería</strong>
              </div>
              <div className="metric-values">
                <div><span>KING Protegido:</span><strong>{treasuryProtectionLimit} KING</strong></div>
                <div><span>Límite Retiro Diario:</span><strong>{treasuryDailyWithdrawLimit} KING / día</strong></div>
              </div>
              <small>Otorgado por la Tesorería (Nv. {buildings.treasury})</small>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
