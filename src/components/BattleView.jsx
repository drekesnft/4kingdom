import React, { useState } from 'react'
import { TROOPS_CONFIG, BUILDINGS_CONFIG, HERO_MISSIONS } from '../game/config'
import { Swords, ShieldAlert, Zap, AlertTriangle, ScrollText, Sparkles, ArrowRight } from 'lucide-react'

export default function BattleView({ gameState, onOpenReport, onClose, onGoToBuild }) {
  const {
    troops,
    totalTroopsOwned,
    totalTroopsCount,
    logisticsCapacity,
    logisticsRatio,
    logisticsMultiplier,
    totalFoodUpkeepPerHour,
    isHungry,
    productiveTroopsCount,
    maxKingProductiveTroops,
    buildings,
    resources,
    trainingQueue,
    recruitTroops,
    speedupTraining,
    calculateKingCostForSec,
    hero,
    startHeroMission,
    speedupHeroMission,
    battleReports,
  } = gameState

  const [activeTab, setActiveTab] = useState('recruit') // 'recruit' | 'hero' | 'reports'
  const [recruitCounts, setRecruitCounts] = useState({ infantry: 5, archer: 5, cavalry: 5 })

  const barracksLvl = buildings.barracks || 0
  const barracksDef = barracksLvl > 0 ? BUILDINGS_CONFIG.barracks.levels[barracksLvl] : { maxQueue: 0, speedBonus: 0, unlockedTroops: [] }

  const currentBatch = trainingQueue.length > 0 ? trainingQueue[0] : null
  const now = Date.now()
  const trainingRemainingSec = currentBatch ? Math.max(1, Math.ceil((currentBatch.finishTime - now) / 1000)) : 0
  const trainingSpeedCost = calculateKingCostForSec(trainingRemainingSec)

  const heroRemainingSec = hero.activeMission ? Math.max(1, Math.ceil((hero.activeMission.finishTime - now) / 1000)) : 0
  const heroSpeedCost = calculateKingCostForSec(heroRemainingSec)

  const currentQueueCount = trainingQueue.reduce((acc, b) => acc + b.count, 0)

  return (
    <div className="view-panel battle-panel">
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Swords className="panel-icon" />
          <div>
            <h2>Ejército y Batalla</h2>
            <p>
              {barracksLvl > 0 ? `Cuartel Nv.${barracksLvl} · 3 Tropas Alpha · Héroe` : '⚠️ Cuartel no construido · Héroe'}
            </p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Validación Crucial: Alerta si el Cuartel no está construido */}
      {barracksLvl < 1 && (
        <div className="barracks-alert-box">
          <AlertTriangle className="alert-icon-big" size={26} />
          <div className="alert-copy">
            <strong>¡Cuartel Militar no construido!</strong>
            <p>Debes construir el Cuartel en Mi Base para poder reclutar Infantería, Arqueros y Caballería.</p>
          </div>
          {onGoToBuild && (
            <button type="button" className="btn-build-barracks" onClick={onGoToBuild}>
              🏛️ Ir a Construir
            </button>
          )}
        </div>
      )}

      {/* Alerta de Hambre (Famine) */}
      {isHungry && (
        <div className="hunger-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>¡ESTADO DE HAMBRE ACTIVO!</strong>
            <small>Comida en 0. Penalizaciones: -25% velocidad de marcha, -20% ataque, -20% defensa.</small>
          </div>
        </div>
      )}

      {/* Resumen Logístico del Ejército */}
      <div className="logistics-card">
        <div className="logistics-row">
          <div>
            <small>Tropas Totales</small>
            <strong>{totalTroopsCount} / {logisticsCapacity}</strong>
          </div>
          <div>
            <small>Mantenimiento</small>
            <strong className="food-cost">-{totalFoodUpkeepPerHour} 🌾/h</strong>
          </div>
          <div>
            <small>Penalización</small>
            <strong className={logisticsMultiplier > 1 ? 'penalty-active' : ''}>×{logisticsMultiplier.toFixed(2)}</strong>
          </div>
          <div>
            <small>Farming KING</small>
            <strong>{productiveTroopsCount}/{maxKingProductiveTroops}</strong>
          </div>
        </div>
        <div className="logistics-progress-bar">
          <div
            className={`logistics-progress-fill ${logisticsRatio > 1 ? 'overflow' : ''}`}
            style={{ width: `${Math.min(100, logisticsRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* Subnavegación de Pestañas */}
      <div className="sub-tabs">
        <button
          type="button"
          className={activeTab === 'recruit' ? 'active' : ''}
          onClick={() => setActiveTab('recruit')}
        >
          ⚔️ Cuartel {barracksLvl > 0 ? `(Nv.${barracksLvl})` : '(Bloqueado)'}
        </button>
        <button
          type="button"
          className={activeTab === 'hero' ? 'active' : ''}
          onClick={() => setActiveTab('hero')}
        >
          ⚡ Héroe ({hero.energy}/{hero.maxEnergy})
        </button>
        <button
          type="button"
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          📜 Reportes ({battleReports.length})
        </button>
      </div>

      {activeTab === 'recruit' && (
        <div className="tab-content recruit-content">
          {/* Cola de Reclutamiento Activa */}
          {barracksLvl > 0 ? (
            <div className={`builder-card ${trainingQueue.length ? 'busy' : 'idle'}`}>
              <div className="builder-header">
                <strong>Cola del Cuartel (Nv. {barracksLvl})</strong>
                <span className="badge">
                  {currentQueueCount}/{barracksDef.maxQueue} tropas
                </span>
              </div>

              <div className="barracks-perks-row">
                <span>⚡ Velocidad: <strong>+{Math.round(barracksDef.speedBonus * 100)}% más rápida</strong></span>
                <span>📋 Cola máx: <strong>{barracksDef.maxQueue} tropas</strong></span>
              </div>

              {currentBatch ? (
                <div className="builder-active-body">
                  <p>
                    Entrenando <strong>{currentBatch.count} {TROOPS_CONFIG[currentBatch.troopId].name}</strong>
                    {trainingQueue.length > 1 && <small> (+{trainingQueue.length - 1} en espera)</small>}
                  </p>
                  <div className="progress-bar-wrap">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(5, 100 - (trainingRemainingSec / currentBatch.totalSec) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="builder-actions">
                    <span className="timer-text">{trainingRemainingSec}s restantes</span>
                    <button type="button" className="speedup-btn" onClick={speedupTraining}>
                      <Zap size={14} /> Acelerar ({trainingSpeedCost} KING)
                    </button>
                  </div>
                </div>
              ) : (
                <p className="builder-idle-text">Cuartel libre. Selecciona tropas para reclutar.</p>
              )}
            </div>
          ) : (
            <div className="builder-card idle">
              <div className="builder-header">
                <strong>Cola del Cuartel</strong>
                <span className="badge">No disponible</span>
              </div>
              <p className="builder-idle-text">Construye el Cuartel para habilitar la cola de reclutamiento militar.</p>
            </div>
          )}

          {/* Tarjetas de las 3 Tropas con Arte Oficial y Validaciones */}
          <div className="troops-cards-container">
            {Object.values(TROOPS_CONFIG).map((t) => {
              const isUnlocked = barracksLvl > 0 && barracksDef.unlockedTroops.includes(t.id)
              const countToRecruit = recruitCounts[t.id] || 5
              const unitTrainSec = Math.round(t.trainTimeSec * (1 - (barracksDef.speedBonus || 0)))
              const totalSec = unitTrainSec * countToRecruit
              const totalCost = {
                wood: t.cost.wood * countToRecruit,
                stone: t.cost.stone * countToRecruit,
                food: t.cost.food * countToRecruit,
              }

              const hasEnoughResources = (
                resources.wood >= totalCost.wood &&
                resources.stone >= totalCost.stone &&
                resources.food >= totalCost.food
              )
              const hasQueueSpace = currentQueueCount + countToRecruit <= barracksDef.maxQueue

              return (
                <div key={t.id} className={`troop-card ${!isUnlocked ? 'locked' : ''}`}>
                  <div className="troop-card-inner">
                    <div className="troop-art-frame">
                      <img src={t.image} alt={t.name} className="troop-illustration" />
                      <span className="troop-line-badge">{t.line}</span>
                    </div>

                    <div className="troop-details">
                      <div className="troop-header-row">
                        <h3>{t.name}</h3>
                        <span className="troop-owned-badge">En casa: <strong>{troops[t.id] || 0}</strong></span>
                      </div>
                      <p className="troop-desc">{t.description}</p>

                      {/* Estadísticas de combate (Sección 17) */}
                      <div className="troop-stats-grid">
                        <div><small>Ataque</small><strong>⚔️ {t.attack}</strong></div>
                        <div><small>Defensa</small><strong>🛡️ {Math.round(t.defense * 100)}%</strong></div>
                        <div><small>Vida</small><strong>❤️ {t.hp}</strong></div>
                        <div><small>Poder</small><strong>⭐ {t.power}</strong></div>
                        <div><small>Carga</small><strong>🎒 {t.carry}</strong></div>
                        <div><small>Comida</small><strong>🌾 {t.foodUpkeepPerHour}/h</strong></div>
                      </div>

                      {barracksLvl < 1 ? (
                        <div className="troop-locked-box">
                          <ShieldAlert size={14} />
                          <small>Requiere construir el Cuartel Militar (Nivel 1)</small>
                        </div>
                      ) : isUnlocked ? (
                        <div className="troop-action-wrap">
                          <div className="quantity-selector">
                            <button
                              type="button"
                              onClick={() => setRecruitCounts((c) => ({ ...c, [t.id]: Math.max(1, countToRecruit - 5) }))}
                            >
                              -5
                            </button>
                            <span>{countToRecruit} uds.</span>
                            <button
                              type="button"
                              onClick={() => setRecruitCounts((c) => ({ ...c, [t.id]: Math.min(barracksDef.maxQueue, countToRecruit + 5) }))}
                            >
                              +5
                            </button>
                          </div>

                          <div className="troop-costs-row">
                            <span style={{ color: resources.wood >= totalCost.wood ? '#a3e9b4' : '#ff9b9b' }}>
                              🪵 {totalCost.wood}
                            </span>
                            <span style={{ color: resources.stone >= totalCost.stone ? '#a3e9b4' : '#ff9b9b' }}>
                              🪨 {totalCost.stone}
                            </span>
                            <span style={{ color: resources.food >= totalCost.food ? '#a3e9b4' : '#ff9b9b' }}>
                              🌾 {totalCost.food}
                            </span>
                            <span className="time-badge">⏳ {Math.round(totalSec / 60)}m</span>
                          </div>

                          {!hasQueueSpace ? (
                            <button type="button" className="recruit-btn" disabled style={{ opacity: 0.6 }}>
                              Cola llena ({currentQueueCount}/{barracksDef.maxQueue})
                            </button>
                          ) : !hasEnoughResources ? (
                            <button type="button" className="recruit-btn" disabled style={{ opacity: 0.6 }}>
                              Recursos insuficientes
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="recruit-btn"
                              onClick={() => recruitTroops(t.id, countToRecruit)}
                            >
                              Reclutar ({countToRecruit})
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="troop-locked-box">
                          <ShieldAlert size={14} />
                          <small>Desbloquea con Cuartel Nivel {t.requiredBarracksLevel} (Actual: Nv.{barracksLvl})</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'hero' && (
        <div className="tab-content hero-content">
          <div className="hero-status-card">
            <div className="hero-status-header">
              <div>
                <h3>Héroe del Reino (Alpha v0.1)</h3>
                <p>Sin niveles ni muerte permanente · Misiones tácticas</p>
              </div>
              <div className="hero-energy-badge">
                <span className="energy-icon">⚡</span>
                <strong>{hero.energy} / {hero.maxEnergy}</strong>
                <small>+1 cada 4h</small>
              </div>
            </div>

            {hero.activeMission ? (
              <div className="hero-active-mission">
                <div className="hero-mission-pulse">
                  <span>En Misión: <strong>{HERO_MISSIONS[hero.activeMission.missionId].name}</strong></span>
                  <span className="mission-timer">{heroRemainingSec}s restantes</span>
                </div>
                <button type="button" className="hero-speed-btn" onClick={speedupHeroMission}>
                  <Zap size={13} /> Acelerar con {heroSpeedCost} KING
                </button>
              </div>
            ) : (
              <p className="hero-ready-text">El Héroe está descansando en la fortaleza listo para una misión.</p>
            )}
          </div>

          <div className="hero-missions-list">
            {Object.values(HERO_MISSIONS).map((m) => {
              const canAffordEnergy = hero.energy >= m.energyCost
              const isHeroBusy = Boolean(hero.activeMission)

              return (
                <div key={m.id} className="hero-mission-card">
                  <div className="mission-card-top">
                    <div>
                      <h4>{m.name}</h4>
                      <p>{m.description}</p>
                    </div>
                    <span className="mission-energy-pill">⚡ {m.energyCost} Energía</span>
                  </div>

                  <div className="mission-meta-grid">
                    <div><small>Duración</small><strong>{Math.round(m.durationSec / 60)} min</strong></div>
                    <div><small>Probabilidad</small><strong>{Math.round(m.successRate * 100)}%</strong></div>
                    <div><small>Recompensa</small><strong>{m.rewardMin}–{m.rewardMax}</strong></div>
                    <div><small>KING Drop</small><strong>{m.hasKingDrop ? `${Math.round(m.kingDropChance * 100)}% (+1)` : 'No'}</strong></div>
                  </div>

                  <button
                    type="button"
                    className="mission-launch-btn"
                    disabled={isHeroBusy || !canAffordEnergy}
                    onClick={() => startHeroMission(m.id)}
                  >
                    {isHeroBusy
                      ? 'Héroe en misión'
                      : !canAffordEnergy
                      ? 'Energía insuficiente'
                      : `Comenzar ${m.name}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="tab-content reports-content">
          <div className="reports-header-row">
            <h3>Informes de Combate Recientes</h3>
            <span className="reports-counter">{battleReports.length} informes</span>
          </div>

          {battleReports.length === 0 ? (
            <div className="no-reports-card">
              <ScrollText size={32} />
              <p>No tienes informes de batalla recientes.</p>
              <small>Envía marchas a atacar campamentos NPC o rivales para ver el desglose de combate.</small>
            </div>
          ) : (
            <div className="reports-list">
              {battleReports.map((r) => (
                <div
                  key={r.id}
                  className={`report-item-card ${r.result === 'VICTORIA' ? 'victory' : 'defeat'}`}
                  onClick={() => onOpenReport(r)}
                >
                  <div className="report-badge-result">{r.result}</div>
                  <div className="report-info">
                    <strong>Vs. {r.enemyName}</strong>
                    <small>{r.date} · Bajas: -{r.casualties.infantry + r.casualties.archer + r.casualties.cavalry} tropas</small>
                  </div>
                  <div className="report-arrow"><ArrowRight size={16} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
