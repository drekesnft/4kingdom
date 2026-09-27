import React, { useState } from 'react'
import { TROOPS_CONFIG, BUILDINGS_CONFIG, HERO_MISSIONS } from '../game/config'
import { Swords, ShieldAlert, Zap, AlertTriangle, ScrollText, Sparkles } from 'lucide-react'

export default function BattleView({ gameState, onOpenReport, onClose }) {
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

  const barracksLvl = buildings.barracks
  const barracksDef = BUILDINGS_CONFIG.barracks.levels[barracksLvl]

  const currentBatch = trainingQueue.length > 0 ? trainingQueue[0] : null
  const now = Date.now()
  const trainingRemainingSec = currentBatch ? Math.max(1, Math.ceil((currentBatch.finishTime - now) / 1000)) : 0
  const trainingSpeedCost = calculateKingCostForSec(trainingRemainingSec)

  const heroRemainingSec = hero.activeMission ? Math.max(1, Math.ceil((hero.activeMission.finishTime - now) / 1000)) : 0
  const heroSpeedCost = calculateKingCostForSec(heroRemainingSec)

  return (
    <div className="view-panel battle-panel">
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Swords className="panel-icon" />
          <div>
            <h2>Ejército y Batalla</h2>
            <p>3 Tropas · Cola Cuartel Nv.{barracksLvl} · Héroe Alpha</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

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
          ⚔️ Cuartel
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
          <div className={`builder-card ${trainingQueue.length ? 'busy' : 'idle'}`}>
            <div className="builder-header">
              <strong>Cola del Cuartel (Nv. {barracksLvl})</strong>
              <span className="badge">
                {trainingQueue.reduce((acc, b) => acc + b.count, 0)}/{barracksDef.maxQueue} tropas
              </span>
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

          {/* Tarjetas de las 3 Tropas con Arte Oficial */}
          <div className="troops-cards-container">
            {Object.values(TROOPS_CONFIG).map((t) => {
              const isUnlocked = barracksDef.unlockedTroops.includes(t.id)
              const countToRecruit = recruitCounts[t.id] || 5
              const unitTrainSec = Math.round(t.trainTimeSec * (1 - barracksDef.speedBonus))
              const totalSec = unitTrainSec * countToRecruit
              const totalCost = {
                wood: t.cost.wood * countToRecruit,
                stone: t.cost.stone * countToRecruit,
                food: t.cost.food * countToRecruit,
              }

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

                      {isUnlocked ? (
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
                              onClick={() => setRecruitCounts((c) => ({ ...c, [t.id]: countToRecruit + 5 }))}
                            >
                              +5
                            </button>
                          </div>

                          <div className="troop-costs-row">
                            <span>🌲 {totalCost.wood}</span>
                            <span>🪨 {totalCost.stone}</span>
                            <span>🌾 {totalCost.food}</span>
                            <span className="time-badge">⏳ {Math.round(totalSec / 60)}m</span>
                          </div>

                          <button
                            type="button"
                            className="recruit-btn"
                            onClick={() => recruitTroops(t.id, countToRecruit)}
                          >
                            Reclutar ({countToRecruit})
                          </button>
                        </div>
                      ) : (
                        <div className="troop-locked-box">
                          <ShieldAlert size={14} />
                          <small>Desbloquea con Cuartel Nv. {t.requiredBarracksLevel}</small>
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
                <p>Sin niveles ni muerte permanente · Misiones de expedición</p>
              </div>
              <div className="hero-energy-badge">
                <span className="energy-icon">⚡</span>
                <strong>{hero.energy} / {hero.maxEnergy}</strong>
                <small>+1 cada 4h</small>
              </div>
            </div>

            {hero.activeMission ? (
              <div className="active-mission-box">
                <p>Misión en curso: <strong>{HERO_MISSIONS[hero.activeMission.missionId].name}</strong></p>
                <div className="progress-bar-wrap">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.max(5, 100 - (heroRemainingSec / hero.activeMission.totalSec) * 100)}%`,
                    }}
                  />
                </div>
                <div className="builder-actions">
                  <span className="timer-text">{heroRemainingSec}s restantes</span>
                  <button type="button" className="speedup-btn" onClick={speedupHeroMission}>
                    <Zap size={14} /> Acelerar ({heroSpeedCost} KING)
                  </button>
                </div>
              </div>
            ) : (
              <p className="hero-idle-text">El Héroe está descansando en la ciudadela y listo para explorar.</p>
            )}
          </div>

          <div className="missions-grid">
            {Object.values(HERO_MISSIONS).map((m) => (
              <div key={m.id} className="mission-card">
                <div className="mission-top">
                  <h4>{m.name}</h4>
                  <span className="mission-energy-tag">⚡ {m.energyCost} Energía</span>
                </div>
                <p className="mission-desc">{m.description}</p>
                <div className="mission-stats-row">
                  <div><small>Duración</small><strong>⏳ {Math.round(m.durationSec / 60)}m</strong></div>
                  <div><small>Éxito</small><strong>🎯 {Math.round(m.successRate * 100)}%</strong></div>
                  <div><small>Botín</small><strong>📦 {m.rewardMin}–{m.rewardMax} res</strong></div>
                  {m.hasKingDrop && (
                    <div><small>Drop KING</small><strong className="king-highlight">👑 8% (1 KING)</strong></div>
                  )}
                </div>
                <button
                  type="button"
                  className="mission-btn"
                  onClick={() => startHeroMission(m.id)}
                  disabled={Boolean(hero.activeMission) || hero.energy < m.energyCost}
                >
                  Enviar al Héroe
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="tab-content reports-content">
          {battleReports.length === 0 ? (
            <div className="no-reports-box">
              <ScrollText size={32} />
              <p>Aún no hay reportes de combate registrados.</p>
              <small>Envía marchas contra campamentos NPC o jugadores rivales para ver el desglose.</small>
            </div>
          ) : (
            <div className="reports-list">
              {battleReports.map((rep) => (
                <div
                  key={rep.id}
                  className={`report-item-card ${rep.isVictory ? 'victory' : 'defeat'}`}
                  onClick={() => onOpenReport(rep)}
                >
                  <div className="report-badge-col">
                    <strong>{rep.result}</strong>
                    <small>{new Date(rep.timestamp).toLocaleTimeString()}</small>
                  </div>
                  <div className="report-info-col">
                    <h4>{rep.targetName}</h4>
                    <p>Enviadas: {rep.totalSent} · Regresan: {rep.totalReturned} · Bajas: {rep.totalLosses}</p>
                    {rep.isVictory && (
                      <small className="loot-preview">
                        Botín: 🌲{rep.loot.wood} 🪨{rep.loot.stone} 🌾{rep.loot.food}
                        {rep.kingLoot > 0 ? ` · 👑 +${rep.kingLoot} KING` : ''}
                      </small>
                    )}
                  </div>
                  <button type="button" className="view-report-btn">Ver</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
