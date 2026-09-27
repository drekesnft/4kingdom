import React, { useState } from 'react'
import { TROOPS_CONFIG, BUILDINGS_CONFIG, HERO_MISSIONS } from '../game/config'
import { Swords, ShieldAlert, Zap, AlertTriangle, ScrollText, Sparkles, ArrowRight, Compass } from 'lucide-react'

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
                              onClick={() => setRecruitCounts((c) => ({ ...c, [t.id]: Math.max(1, countToRecruit - 1) }))}
                              disabled={countToRecruit <= 1}
                            >
                              -1
                            </button>
                            <span className="qty-number">{countToRecruit} uds.</span>
                            <button
                              type="button"
                              onClick={() => setRecruitCounts((c) => ({ ...c, [t.id]: Math.min(barracksDef.maxQueue - currentQueueCount, countToRecruit + 1) }))}
                              disabled={countToRecruit >= barracksDef.maxQueue - currentQueueCount}
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              className="btn-max-qty"
                              onClick={() => {
                                const spaceLeft = Math.max(1, barracksDef.maxQueue - currentQueueCount)
                                const maxByWood = Math.floor(resources.wood / (t.cost.wood || 1))
                                const maxByStone = Math.floor(resources.stone / (t.cost.stone || 1))
                                const maxByFood = Math.floor(resources.food / (t.cost.food || 1))
                                const maxAffordable = Math.min(maxByWood, maxByStone, maxByFood)
                                const finalCount = Math.max(1, Math.min(spaceLeft, maxAffordable > 0 ? maxAffordable : spaceLeft))
                                setRecruitCounts((c) => ({ ...c, [t.id]: finalCount }))
                              }}
                            >
                              MÁX
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

      {/* PESTAÑA 2: SANTUARIO DEL HÉROE (REDESIGN GAMING AAA) */}
      {activeTab === 'hero' && (
        <div className="tab-content hero-content">
          {/* Ficha Principal del Héroe */}
          <div className="hero-sanctuary-card">
            <div className="hero-sanctuary-header">
              <div className="hero-avatar-frame">
                <span className="hero-avatar-icon">👑</span>
                <span className="hero-rank-tag">Rango S</span>
              </div>
              <div className="hero-sanctuary-title">
                <div className="hero-name-row">
                  <h3>Comandante del Reino</h3>
                  <span className="hero-badge">Alpha v0.1</span>
                </div>
                <p className="hero-perk-text">Líder táctico inmortal · Otorga bonos en misiones secretas de expedición</p>
                
                {/* Orbes de Energía */}
                <div className="hero-energy-orbs-wrap">
                  <span className="energy-label">Energía Táctica:</span>
                  <div className="energy-orbs-row">
                    {[1, 2, 3].map((slot) => {
                      const isFilled = slot <= hero.energy
                      return (
                        <div key={slot} className={`energy-orb ${isFilled ? 'charged' : 'empty'}`}>
                          <Zap size={14} />
                        </div>
                      )
                    })}
                  </div>
                  <small className="energy-cooldown-text">
                    {hero.energy < hero.maxEnergy ? '⚡ +1 cada 4h' : '✨ Al Máximo (3/3)'}
                  </small>
                </div>
              </div>
            </div>

            {/* Misión Activa en Tiempo Real */}
            {hero.activeMission ? (
              <div className="hero-live-mission-card">
                <div className="live-mission-top">
                  <div className="live-mission-title">
                    <Compass size={18} className="live-compass-icon" />
                    <div>
                      <strong>Misión en Curso: {HERO_MISSIONS[hero.activeMission.missionId]?.name}</strong>
                      <small>El Héroe se encuentra explorando las tierras salvajes...</small>
                    </div>
                  </div>
                  <span className="live-mission-timer">⏱️ {heroRemainingSec}s</span>
                </div>

                <div className="hero-progress-track">
                  <div
                    className="hero-progress-bar"
                    style={{
                      width: `${Math.max(5, 100 - (heroRemainingSec / (hero.activeMission.totalSec || 1)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="live-mission-actions">
                  <small>Aceleración con KING (1 KING = 30s):</small>
                  <button type="button" className="hero-speed-btn" onClick={speedupHeroMission}>
                    <Zap size={13} /> Completar Ya ({heroSpeedCost} KING)
                  </button>
                </div>
              </div>
            ) : (
              <div className="hero-idle-state">
                <Sparkles size={16} className="sparkle-icon" />
                <span>El Héroe está descansando en la fortaleza. Selecciona una expedición táctica abajo.</span>
              </div>
            )}
          </div>

          {/* Lista de Misiones Tácticas */}
          <div className="hero-missions-section">
            <h4 className="missions-section-title">Expediciones Tácticas Disponibles</h4>
            <div className="hero-missions-grid">
              {Object.values(HERO_MISSIONS).map((m) => {
                const canAffordEnergy = hero.energy >= m.energyCost
                const isHeroBusy = Boolean(hero.activeMission)
                const isKingDrop = Boolean(m.hasKingDrop)

                return (
                  <div key={m.id} className={`hero-mission-gaming-card ${isKingDrop ? 'special-drop' : ''}`}>
                    <div className="mission-gaming-header">
                      <div className="mission-title-group">
                        <h5>{m.name}</h5>
                        <p>{m.description}</p>
                      </div>
                      <span className="mission-energy-cost-badge">
                        <Zap size={12} /> {m.energyCost}⚡
                      </span>
                    </div>

                    <div className="mission-stats-chips">
                      <div className="stat-chip">
                        <span>⏱️ Tiempo</span>
                        <strong>{Math.round(m.durationSec / 60)} min</strong>
                      </div>
                      <div className="stat-chip">
                        <span>🎯 Prob. Éxito</span>
                        <strong className="green-chip">{Math.round(m.successRate * 100)}%</strong>
                      </div>
                      <div className="stat-chip">
                        <span>🎁 Recursos</span>
                        <strong>{m.rewardMin}–{m.rewardMax}</strong>
                      </div>
                      {isKingDrop && (
                        <div className="stat-chip king-chip">
                          <span>👑 Drop KING</span>
                          <strong>{Math.round(m.kingDropChance * 100)}% (+{m.kingAmount})</strong>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`mission-launch-btn ${!canAffordEnergy || isHeroBusy ? 'disabled' : ''}`}
                      disabled={isHeroBusy || !canAffordEnergy}
                      onClick={() => startHeroMission(m.id)}
                    >
                      {isHeroBusy
                        ? '⏳ Héroe Ocupado en Misión'
                        : !canAffordEnergy
                        ? '⚡ Requiere Más Energía'
                        : `⚔️ Iniciar ${m.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: REPORTES DE BATALLA */}
      {activeTab === 'reports' && (
        <div className="tab-content reports-content">
          <div className="reports-header-row">
            <div className="reports-title-wrap">
              <ScrollText size={18} />
              <div>
                <h3>Informes de Combate Recientes</h3>
                <small>Alpha v0.1 · Últimos asaltos, defensas y recolecciones</small>
              </div>
            </div>
            <span className="reports-counter">{battleReports.length} informes</span>
          </div>

          {battleReports.length === 0 ? (
            <div className="no-reports-card">
              <ScrollText size={36} className="empty-scroll-icon" />
              <h4>Sin actividad bélica reciente</h4>
              <p>Envía marchas o convoca Rallies contra campamentos NPC, fortalezas o rivales en el mapa para ver el registro táctico.</p>
            </div>
          ) : (
            <div className="reports-list">
              {battleReports.map((r) => {
                const isVic = r.result === 'VICTORIA'
                const totalCasualties = (r.casualties?.infantry || 0) + (r.casualties?.archer || 0) + (r.casualties?.cavalry || 0)

                return (
                  <div
                    key={r.id}
                    className={`report-item-card ${isVic ? 'victory' : 'defeat'}`}
                    onClick={() => onOpenReport(r)}
                  >
                    <div className="report-badge-result">
                      {isVic ? 'VICTORIA' : 'DERROTA'}
                    </div>
                    <div className="report-info">
                      <strong>Vs. {r.enemyName || r.targetName || 'Enemigo'}</strong>
                      <div className="report-mini-meta">
                        <span>{r.date}</span>
                        <span className={totalCasualties > 0 ? 'red-cas' : ''}>
                          Bajas: -{totalCasualties}
                        </span>
                        {r.kingLoot > 0 && <span className="gold-drop">+{r.kingLoot} KING</span>}
                      </div>
                    </div>
                    <div className="report-arrow"><ArrowRight size={16} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
