import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  SEASON_CONFIG,
  RARITY_TIERS,
  STARTER_COMMANDER,
  SUMMONABLE_COMMANDERS,
  SEASON_ROADMAP,
  SEASON_PRIZES,
} from '../data/commandersConfig'
import '../commanders.css'
import {
  Shield,
  Zap,
  Flame,
  Trophy,
  Coins,
  Crown,
  Sparkles,
  CheckCircle2,
  Clock,
  Lock,
  ArrowRight,
  TrendingUp,
  X,
  Swords,
  Users,
} from 'lucide-react'

const STORAGE_KEY_COMMANDERS = 'fk_commanders_v1'
const STORAGE_KEY_CLAIM_TIME = 'fk_commanders_last_claim_v1'
const STORAGE_KEY_SEASON_POOL = 'fk_commanders_season_pool_v1'

export default function CommandersView({ gameState, onClose }) {
  const { king, setRecentNotification, grantTestResources } = gameState

  // Sub-pestañas: 'fleet' (Mi Guardia) | 'dealership' (Invocación) | 'roadmap' (Cronograma) | 'prizes' (Premios & NFT)
  const [activeTab, setActiveTab] = useState('fleet')

  // Carga inicial de comandantes desde localStorage (o asigna el Starter Gratuito si es nuevo)
  const [commanders, setCommanders] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMMANDERS)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    // Starter inicial por defecto (el "Beater" de FourKingdoms)
    const starter = { ...STARTER_COMMANDER, obtainedAt: Date.now() - 3600 * 1000 * 2 }
    return [starter]
  })

  // Timestamp del último claim (por defecto hace 1 hora para dar botín inicial que probar)
  const [lastClaimTime, setLastClaimTime] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLAIM_TIME)
      if (saved) return Number(saved)
    } catch {}
    return Date.now() - 3600 * 1000 // 1 hora de botín acumulado de prueba
  })

  // Pozo de temporada dinámico (Base 10,000 + 50% de las invocaciones)
  const [seasonPool, setSeasonPool] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SEASON_POOL)
      if (saved) return Number(saved)
    } catch {}
    return SEASON_CONFIG.basePoolKing
  })

  // Estado del modal de revelación de invocación
  const [revealedCommander, setRevealedCommander] = useState(null)
  const [isSummoning, setIsSummoning] = useState(false)

  // Guardar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMMANDERS, JSON.stringify(commanders))
    } catch {}
  }, [commanders])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLAIM_TIME, String(lastClaimTime))
    } catch {}
  }, [lastClaimTime])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SEASON_POOL, String(seasonPool))
    } catch {}
  }, [seasonPool])

  // Cálculo del rendimiento total por hora de la flota
  const totalYieldPerHour = useMemo(() => {
    return commanders.reduce((acc, c) => acc + (c.yieldPerHour || 0), 0)
  }, [commanders])

  // Ticker en vivo (Actualiza cada 200ms para sensación de flujo continuo)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 200)
    return () => clearInterval(timer)
  }, [])

  // Botín acumulado en tiempo real
  const elapsedHours = Math.max(0, (now - lastClaimTime) / (3600 * 1000))
  const unclaimedLoot = elapsedHours * totalYieldPerHour

  // Reclamar botín acumulado a Tesorería
  const handleClaimLoot = () => {
    if (unclaimedLoot <= 0.01) return
    const lootAmount = Number(unclaimedLoot.toFixed(2))

    // Acreditar directamente en la tesorería de gameState en el Frontend
    if (typeof gameState.claimPendingKing === 'function') {
      // Si el gameState tiene handler, podemos sumar a pending o claimed
      // En useGameState, manipulamos claimed agregando la recompensa
      if (gameState.king) {
        gameState.king.claimed = Number((gameState.king.claimed + lootAmount).toFixed(2))
      }
    }

    setLastClaimTime(Date.now())
    if (setRecentNotification) {
      setRecentNotification(`👑 ¡Botín reclamado! +${lootAmount} KING transferidos a tu Tesorería.`)
    }
  }

  // Invocar nuevo comandante (Inspirado en Mint Car de Hood Cars)
  const handleSummonCommander = () => {
    const cost = SEASON_CONFIG.summonCostKing

    if (commanders.length >= SEASON_CONFIG.maxCommandersPerPlayer) {
      if (setRecentNotification) setRecentNotification('⚠️ Has alcanzado el límite de 50 Comandantes.')
      return
    }

    if (king.claimed < cost) {
      if (setRecentNotification) {
        setRecentNotification(`⚠️ KING insuficiente en Tesorería. Requiere ${cost} KING para invocar.`)
      }
      return
    }

    setIsSummoning(true)

    // Descontar coste de tesorería
    gameState.king.claimed = Math.max(0, Number((gameState.king.claimed - cost).toFixed(2)))

    // Economía del 50% Burn / 50% Season Pool
    const poolContribution = cost * SEASON_CONFIG.seasonPoolPercentage
    setSeasonPool((prev) => prev + poolContribution)

    // Tirada de dados aleatoria según Drop Rates
    const roll = Math.random()
    let chosenRarity = 'common'
    if (roll < 0.03) {
      chosenRarity = 'legendary' // 3%
    } else if (roll < 0.10) {
      chosenRarity = 'epic' // 7%
    } else if (roll < 0.25) {
      chosenRarity = 'rare' // 15%
    } else if (roll < 0.55) {
      chosenRarity = 'uncommon' // 30%
    } else {
      chosenRarity = 'common' // 45%
    }

    // Elegir plantilla según rareza
    const pool = SUMMONABLE_COMMANDERS.filter((c) => c.rarity === chosenRarity)
    const template = pool[Math.floor(Math.random() * pool.length)] || SUMMONABLE_COMMANDERS[0]

    const newCmd = {
      ...template,
      instanceId: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      obtainedAt: Date.now(),
    }

    // Delay de animación para expectativa y suspenso gaming
    setTimeout(() => {
      setCommanders((prev) => [newCmd, ...prev])
      setRevealedCommander(newCmd)
      setIsSummoning(false)
      if (setRecentNotification) {
        setRecentNotification(`🔥 ¡Invocado! ${newCmd.name} (${RARITY_TIERS[newCmd.rarity].label}) se une a tu guardia.`)
      }
    }, 600)
  }

  return (
    <div className="view-panel commanders-panel">
      {/* Header Superior Principal */}
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Crown className="panel-icon gold" />
          <div>
            <h2>Guardia & Temporada 1</h2>
            <p>Comandantes de Guerra · Temporada de 45 Días · Pozo Competitivo</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Barra de Estadísticas Superiores (Estilo Hood Cars: Slots 1/50, Rendimiento, Saldo, Pozo) */}
      <div className="commanders-top-stats">
        <div className="stat-chip">
          <span className="stat-icon">👑</span>
          <span className="stat-label">Guardia:</span>
          <span className="stat-value">{commanders.length} / {SEASON_CONFIG.maxCommandersPerPlayer}</span>
        </div>
        <div className="stat-chip">
          <Users size={12} style={{ color: '#38bdf8' }} />
          <span className="stat-label">Gobernantes:</span>
          <span className="stat-value">31 Reinos</span>
        </div>
        <div className="stat-chip">
          <span className="stat-icon">⚡</span>
          <span className="stat-label">Rendimiento:</span>
          <span className="stat-value neon-green">+{totalYieldPerHour.toFixed(2)}/h</span>
        </div>
        <div className="stat-chip gold-chip">
          <Coins size={12} style={{ color: '#fbbf24' }} />
          <span className="stat-label">Tesorería:</span>
          <span className="stat-value neon-gold">{king.claimed.toFixed(2)} KING</span>
        </div>
        <div className="stat-chip pool-chip">
          <Trophy size={12} style={{ color: '#f87171' }} />
          <span className="stat-label">Pozo T1:</span>
          <span className="stat-value neon-red">{Math.floor(seasonPool).toLocaleString()} KING</span>
        </div>
      </div>

      {/* Sub-navegación inspirada en Hood Cars */}
      <div className="sub-tabs">
        <button
          type="button"
          className={activeTab === 'fleet' ? 'active' : ''}
          onClick={() => setActiveTab('fleet')}
        >
          🛡️ Mi Guardia ({commanders.length})
        </button>
        <button
          type="button"
          className={activeTab === 'dealership' ? 'active' : ''}
          onClick={() => setActiveTab('dealership')}
        >
          ⚔️ Invocación Real
        </button>
        <button
          type="button"
          className={activeTab === 'roadmap' ? 'active' : ''}
          onClick={() => setActiveTab('roadmap')}
        >
          📜 Cronograma T1
        </button>
        <button
          type="button"
          className={activeTab === 'prizes' ? 'active' : ''}
          onClick={() => setActiveTab('prizes')}
        >
          🏆 Premios & NFTs
        </button>
      </div>

      {/* ====================================================================
          PESTAÑA 1: MI GUARDIA (YOUR FLEET)
          ==================================================================== */}
      {activeTab === 'fleet' && (
        <div className="fleet-content">
          {/* Hero Card del Botín Unclaimed (Ticking en Vivo) */}
          <div className="unclaimed-hero-card">
            <div className="unclaimed-info">
              <h3>
                <Sparkles size={14} style={{ color: '#38bdf8' }} />
                Botín Acumulado de la Guardia
              </h3>
              <div className="unclaimed-counter-row">
                <span className="ticker-value">+{unclaimedLoot.toFixed(4)}</span>
                <span className="ticker-unit">KING</span>
              </div>
              <p className="unclaimed-rate-sub">
                Produciendo <strong>+{totalYieldPerHour.toFixed(2)} KING/hora</strong> · {commanders.length} Comandante(s) asignados
              </p>
            </div>

            <button
              type="button"
              className="btn-claim-loot"
              onClick={handleClaimLoot}
              disabled={unclaimedLoot < 0.01}
            >
              <Coins size={16} /> Reclamar a Tesorería
            </button>
          </div>

          {/* Listado de Comandantes */}
          <div className="commanders-section-title">
            <h4>Tus Comandantes en Activo</h4>
            <small style={{ color: '#94a3b8' }}>
              {commanders.length} de {SEASON_CONFIG.maxCommandersPerPlayer} plazas ocupadas
            </small>
          </div>

          <div className="commanders-grid">
            {commanders.map((cmd) => {
              const rarityDef = RARITY_TIERS[cmd.rarity] || RARITY_TIERS.common
              return (
                <div
                  key={cmd.instanceId || cmd.id}
                  className="commander-card"
                  style={{ borderColor: rarityDef.border }}
                >
                  <div className="card-banner-top">
                    <span
                      className="rarity-pill"
                      style={{
                        background: rarityDef.bgBadge,
                        color: rarityDef.color,
                        border: `1px solid ${rarityDef.border}`,
                      }}
                    >
                      {rarityDef.label}
                    </span>
                    <span className="cmd-power-tag">⭐ +{cmd.powerBonus} Poder</span>
                  </div>

                  <div className="commander-card-body">
                    <div
                      className="commander-avatar-frame"
                      style={{ borderColor: rarityDef.color }}
                    >
                      <img src={cmd.image} alt={cmd.name} />
                    </div>

                    <div className="commander-details">
                      <h5>{cmd.name}</h5>
                      <p className="cmd-title">{cmd.title}</p>
                      <span className="cmd-yield-badge">
                        ⚡ +{cmd.yieldPerHour.toFixed(2)} KING/h
                      </span>
                    </div>
                  </div>

                  <div className="commander-card-footer">
                    <div className="military-perk">
                      <Swords size={12} />
                      <span>{rarityDef.militaryBonusLabel}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          PESTAÑA 2: INVOCACIÓN REAL (DEALERSHIP)
          ==================================================================== */}
      {activeTab === 'dealership' && (
        <div className="summon-dealership-container">
          <div className="summon-hero-banner">
            <span className="summon-badge-burn">
              <Flame size={12} /> 50% Quema · 50% Pozo de Temporada
            </span>
            <h3>Altar de Invocación de Guerra</h3>
            <p className="summon-desc">
              Recluta comandantes para fortalecer tu ejército y multiplicar tu botín pasivo.
              Cada invocación quema la mitad de los tokens y envía la otra mitad al gran pozo
              que se repartirá entre los mejores generales de la temporada.
            </p>

            <div className="tokenomics-split-box">
              <div className="split-pill burn-split">
                <small>🔥 Quema Definitiva (50%)</small>
                <strong>-12.50 KING</strong>
              </div>
              <div className="split-pill pool-split">
                <small>🏆 Pozo de Temporada (50%)</small>
                <strong>+12.50 KING</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn-summon-action"
              onClick={handleSummonCommander}
              disabled={isSummoning || king.claimed < SEASON_CONFIG.summonCostKing}
            >
              <Sparkles size={18} />
              {isSummoning ? 'Invocando Comandante...' : `Invocar Comandante · ${SEASON_CONFIG.summonCostKing} KING`}
            </button>
          </div>

          {/* Tabla de Probabilidades y Retorno (Idéntica a Hood Cars) */}
          <div className="drop-rates-card">
            <h4>Tasas de Aparición y Rendimiento Militar</h4>
            <div className="drop-rates-grid">
              {Object.entries(RARITY_TIERS)
                .filter(([k]) => k !== 'starter')
                .map(([key, tier]) => (
                  <div
                    key={key}
                    className="drop-rate-box"
                    style={{ borderTopColor: tier.color }}
                  >
                    <span className="tier-name" style={{ color: tier.color }}>
                      {tier.label}
                    </span>
                    <span className="tier-percent">{tier.dropRate * 100}%</span>
                    <span className="tier-yield">+{tier.yieldPerHour} KING/h</span>
                    <small style={{ color: '#94a3b8', fontSize: '10px' }}>
                      {key === 'rare' ? 'Recupera en ~7 días' : tier.militaryBonusLabel}
                    </small>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          PESTAÑA 3: ROADMAP DE TEMPORADA (SEASON TIMELINE)
          ==================================================================== */}
      {activeTab === 'roadmap' && (
        <div className="roadmap-container">
          <div className="roadmap-header">
            <span className="roadmap-season-tag">Temporada 1: 45 Días</span>
            <h3>{SEASON_CONFIG.seasonName}</h3>
            <p>
              De asentamiento pacífico a la gran guerra del Trono Imperial. La gloria se conquista en fases.
            </p>

            <div className="roadmap-progress-bar-wrap">
              <div className="roadmap-progress-fill" style={{ width: '33%' }}></div>
            </div>
            <span className="roadmap-progress-label">2 / 6 Checkpoints Superados</span>
          </div>

          <div className="timeline-list">
            {SEASON_ROADMAP.map((item) => (
              <div key={item.id} className={`timeline-item ${item.status}`}>
                <div className="timeline-marker">
                  {item.status === 'done' ? (
                    <CheckCircle2 size={14} />
                  ) : item.status === 'active' ? (
                    <Sparkles size={13} style={{ color: '#ffffff' }} />
                  ) : (
                    <Lock size={12} style={{ color: '#64748b' }} />
                  )}
                </div>

                <div className="timeline-card">
                  <div className="timeline-card-header">
                    <span className="timeline-date">{item.dateLabel}</span>
                    <span className={`timeline-status-tag ${item.status}`}>
                      {item.statusLabel}
                    </span>
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          PESTAÑA 4: RANKING & PREMIACIÓN NFT
          ==================================================================== */}
      {activeTab === 'prizes' && (
        <div className="prizes-container">
          <div className="pool-glory-banner">
            <h3>Pozo de Guerra Acumulado de la Temporada 1</h3>
            <div className="pool-big-number">
              {Math.floor(seasonPool).toLocaleString()} KING
            </div>
            <small style={{ color: '#94a3b8' }}>
              Equivalente de referencia: ${(seasonPool * 0.005).toFixed(2)} USD · Crece con cada invocación
            </small>
          </div>

          <div className="prizes-table">
            {SEASON_PRIZES.distribution.map((p, idx) => {
              const estimatedKing = Math.floor((seasonPool * p.sharePercent) / 100)
              return (
                <div key={idx} className="prize-row">
                  <div className="prize-rank-col">
                    <span className="prize-badge-rank">{p.badge}</span>
                    <div>
                      <strong>{p.rank}</strong>
                      <span className="prize-nft-tag">
                        <Trophy size={11} /> {p.nftTitle}
                      </span>
                    </div>
                  </div>
                  <div className="prize-share-col">
                    <span className="prize-percent-tag">{p.sharePercent}%</span>
                    <span className="prize-est-king">~{estimatedKing.toLocaleString()} KING</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="drop-rates-card">
            <h4>Reglas de la Temporada</h4>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12px', lineHeight: '1.6' }}>
              {SEASON_PRIZES.rules.map((r, idx) => (
                <li key={idx} style={{ marginBottom: '6px' }}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal de Revelación de Invocación (Animación y Carta) */}
      {revealedCommander && (
        <div className="summon-reveal-overlay" onClick={() => setRevealedCommander(null)}>
          <div
            className="summon-reveal-modal"
            style={{
              borderColor: RARITY_TIERS[revealedCommander.rarity]?.color || '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="rarity-pill"
              style={{
                background: RARITY_TIERS[revealedCommander.rarity]?.bgBadge,
                color: RARITY_TIERS[revealedCommander.rarity]?.color,
                border: `1px solid ${RARITY_TIERS[revealedCommander.rarity]?.border}`,
              }}
            >
              ¡NUEVO {RARITY_TIERS[revealedCommander.rarity]?.label.toUpperCase()}!
            </span>

            <div
              className="reveal-avatar-frame"
              style={{
                borderColor: RARITY_TIERS[revealedCommander.rarity]?.color,
                boxShadow: `0 0 30px ${RARITY_TIERS[revealedCommander.rarity]?.color}66`,
              }}
            >
              <img src={revealedCommander.image} alt={revealedCommander.name} />
            </div>

            <h3 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '20px' }}>
              {revealedCommander.name}
            </h3>
            <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '12px' }}>
              {revealedCommander.title}
            </p>

            <span className="cmd-yield-badge" style={{ fontSize: '13px', padding: '6px 12px' }}>
              ⚡ +{revealedCommander.yieldPerHour.toFixed(2)} KING/hora
            </span>

            <p style={{ margin: '14px 0 0 0', color: '#e2e8f0', fontSize: '12px' }}>
              {revealedCommander.description}
            </p>

            <button
              type="button"
              className="btn-confirm-reveal"
              onClick={() => setRevealedCommander(null)}
            >
              Asignar a Mi Guardia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
