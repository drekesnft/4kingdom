import React, { useState, useEffect, useMemo } from 'react'
import {
  Trophy,
  Crown,
  Swords,
  Castle,
  Sparkles,
  Clock,
  Award,
  Shield,
  Zap,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { gameService } from '../services/gameService'
import { getRankingPayoutSchedule, KING_CONFIG } from '../game/config'
import { isSupabaseConfigured } from '../services/supabaseClient'

export default function RankingView({ gameState, currentUser, onClose }) {
  const [rankings, setRankings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRealtimePing, setLastRealtimePing] = useState(Date.now())
  const [schedule, setSchedule] = useState(() => getRankingPayoutSchedule())

  // Estado para editar Nombre de Gobernante / Perfil
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState('')
  const [isSavingUsername, setIsSavingUsername] = useState(false)

  const myEmail = (currentUser?.email || '').trim().toLowerCase()

  // Contador regresivo dinámico hacia el corte diario a las 00:00 UTC
  useEffect(() => {
    const timer = setInterval(() => {
      setSchedule(getRankingPayoutSchedule())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Carga inicial y Suscripción en Tiempo Real con Supabase Realtime
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoading(true)
      try {
        const data = await gameService.fetchTopKingdomsRanking(50)
        if (isMounted) {
          setRankings(data)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('[RankingView] Error al cargar ranking inicial:', err)
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()

    // Suscripción Realtime a cambios en la tabla 'kingdoms'
    const unsubscribe = gameService.subscribeToRankingUpdates((updatedKingdom) => {
      if (!isMounted || !updatedKingdom) return

      setRankings((prevList) => {
        const index = prevList.findIndex((k) => k.id === updatedKingdom.id)
        let nextList
        if (index >= 0) {
          nextList = [...prevList]
          nextList[index] = { ...nextList[index], ...updatedKingdom }
        } else {
          nextList = [...prevList, updatedKingdom]
        }
        // Ordenar inmediatamente por poder militar descendente
        return nextList.sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0))
      })
      setLastRealtimePing(Date.now())
    })

    return () => {
      isMounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const handleManualRefresh = async () => {
    setIsLoading(true)
    const data = await gameService.fetchTopKingdomsRanking(50)
    setRankings(data)
    setIsLoading(false)
    setLastRealtimePing(Date.now())
  }

  // Abrir modal de edición de nombre
  const handleOpenEditUsername = (currentName) => {
    setNewUsername(currentName || '')
    setUsernameError('')
    setUsernameSuccess('')
    setIsEditingUsername(true)
  }

  // Guardar y validar nombre en Backend Supabase
  const handleSaveUsername = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!myEmail) {
      setUsernameError('No se encontró una sesión activa con email.')
      return
    }

    setUsernameError('')
    setUsernameSuccess('')
    setIsSavingUsername(true)

    try {
      const res = await gameService.updateKingdomUsername(myEmail, newUsername)
      if (!res.ok) {
        setUsernameError(res.error || 'No se pudo guardar el nombre.')
        setIsSavingUsername(false)
        return
      }

      // Éxito: actualizar estado local inmediato
      setRankings((prevList) =>
        prevList.map((k) => {
          const isTarget =
            k.id?.toLowerCase() === myEmail ||
            k.username?.toLowerCase() === myEmail.split('@')[0]
          if (isTarget) {
            return { ...k, username: res.username }
          }
          return k
        })
      )

      setUsernameSuccess(`¡Nombre actualizado exitosamente a "${res.username}"!`)
      setIsSavingUsername(false)
      setTimeout(() => {
        setIsEditingUsername(false)
        setUsernameSuccess('')
      }, 1200)
    } catch (err) {
      console.error('[RankingView] Error inesperado al guardar username:', err)
      setUsernameError('Error inesperado de conexión.')
      setIsSavingUsername(false)
    }
  }

  // Lista con ranking y formato de datos
  const enrichedRankings = useMemo(() => {
    return rankings.map((k, index) => {
      const rank = index + 1
      const isMe = Boolean(myEmail && (k.id?.toLowerCase() === myEmail || k.username?.toLowerCase() === myEmail.split('@')[0]))
      const castleLevel = k.buildings?.castle || 1
      const troopsTotal = k.troops
        ? (k.troops.infantry || 0) + (k.troops.archer || 0) + (k.troops.cavalry || 0)
        : 0

      // Recompensa diaria proyectada según nivel del Top 5
      let dailyKingReward = 0
      let tierLabel = ''
      if (rank === 1) { dailyKingReward = 15; tierLabel = '🥇 Top 1' }
      else if (rank === 2) { dailyKingReward = 10; tierLabel = '🥈 Top 2' }
      else if (rank === 3) { dailyKingReward = 7; tierLabel = '🥉 Top 3' }
      else if (rank === 4) { dailyKingReward = 5; tierLabel = '🎖️ Top 4' }
      else if (rank === 5) { dailyKingReward = 3; tierLabel = '🎖️ Top 5' }

      // Nombre completo del comandante visible para todos en el ranking:
      // Si el username es el genérico por defecto 'Lord Conquistador', muestra el identificador de su cuenta (ej. sergiowalterdullar, antoniox4253, etc.)
      const rawName = (k.username && k.username !== 'Lord Conquistador')
        ? k.username
        : (k.id?.includes('@') ? k.id.split('@')[0] : (k.username || 'Comandante'))
      const displayName = isMe ? `${rawName} (Tú)` : rawName

      return {
        ...k,
        rank,
        isMe,
        rawName,
        displayName,
        castleLevel,
        troopsTotal,
        dailyKingReward,
        tierLabel,
        displayPower: Number(k.power || 0),
      }
    })
  }, [rankings, myEmail])

  const myStanding = useMemo(() => {
    const found = enrichedRankings.find((r) => r.isMe)
    if (found) return found
    const defaultRaw = (currentUser?.username || currentUser?.email?.split('@')[0] || 'Comandante')
    return {
      rank: enrichedRankings.length + 1,
      displayPower: gameState.kingdomPower,
      dailyKingReward: 0,
      displayName: `${defaultRaw} (Tú)`,
      rawName: defaultRaw,
    }
  }, [enrichedRankings, gameState.kingdomPower, currentUser])

  const top3 = enrichedRankings.slice(0, 3)

  return (
    <div className="view-panel ranking-panel">
      {/* Encabezado Gaming */}
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Trophy className="panel-icon gold-trophy" />
          <div>
            <h2>Salón de la Fama y Clasificación Militar</h2>
            <p>Poderío bélico de los 4 Reinos · Actualización en tiempo real vía Supabase</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Banner de Corte Diario */}
      <div className="ranking-realtime-banner banner-clean">
        <div className="banner-countdown-col">
          <div className="countdown-pill">
            <Clock size={16} className="gold" />
            <span>Siguiente Corte Diario (00:00 UTC):</span>
            <strong>{schedule.formattedCountdown}</strong>
          </div>
          <small className="pool-info">
            Pool Diario: <strong>40 KING</strong> repartidos entre el Top 5
          </small>
        </div>
      </div>

      {/* PÓDIUM TOP 3 */}
      {top3.length > 0 && (
        <div className="podium-grid">
          {/* Segundo Lugar */}
          {top3[1] && (
            <div className={`podium-card silver ${top3[1].isMe ? 'is-me' : ''}`}>
              <div className="podium-crown">🥈</div>
              <span className="podium-rank-tag">Top 2</span>
              <h4 className="podium-name">{top3[1].displayName}</h4>
              <div className="podium-power-badge">
                <Sparkles size={13} />
                <span>⭐ {top3[1].displayPower.toLocaleString()}</span>
              </div>
              <div className="podium-meta">
                <span>🏰 Nv.{top3[1].castleLevel}</span>
                <span>⚔️ {top3[1].troopsTotal} tropas</span>
              </div>
              <div className="podium-prize">
                <strong>+10 KING</strong>
                <small>/ corte diario</small>
              </div>
            </div>
          )}

          {/* Primer Lugar (Líder Supremo) */}
          {top3[0] && (
            <div className={`podium-card gold champion ${top3[0].isMe ? 'is-me' : ''}`}>
              <div className="podium-crown">👑 🥇</div>
              <span className="podium-rank-tag gold-tag">CAMPEÓN SUPREMO</span>
              <h4 className="podium-name champion-name">{top3[0].displayName}</h4>
              <div className="podium-power-badge gold-power">
                <Sparkles size={15} />
                <span>⭐ {top3[0].displayPower.toLocaleString()}</span>
              </div>
              <div className="podium-meta">
                <span>🏰 Nv.{top3[0].castleLevel}</span>
                <span>⚔️ {top3[0].troopsTotal} tropas</span>
              </div>
              <div className="podium-prize champion-prize">
                <strong>+15 KING</strong>
                <small>/ corte diario</small>
              </div>
            </div>
          )}

          {/* Tercer Lugar */}
          {top3[2] && (
            <div className={`podium-card bronze ${top3[2].isMe ? 'is-me' : ''}`}>
              <div className="podium-crown">🥉</div>
              <span className="podium-rank-tag">Top 3</span>
              <h4 className="podium-name">{top3[2].displayName}</h4>
              <div className="podium-power-badge">
                <Sparkles size={13} />
                <span>⭐ {top3[2].displayPower.toLocaleString()}</span>
              </div>
              <div className="podium-meta">
                <span>🏰 Nv.{top3[2].castleLevel}</span>
                <span>⚔️ {top3[2].troopsTotal} tropas</span>
              </div>
              <div className="podium-prize">
                <strong>+7 KING</strong>
                <small>/ corte diario</small>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tarjeta de Tu Posición */}
      <div className="my-standing-banner">
        <div className="my-standing-info">
          <Award size={20} className="gold" />
          <div>
            <div className="my-standing-name-row">
              <span className="standing-lord-label">Gobernante:</span>
              <strong className="standing-lord-name">{myStanding.rawName}</strong>
              <button
                type="button"
                className="btn-edit-username-trigger"
                onClick={() => handleOpenEditUsername(myStanding.rawName)}
                title="Editar nombre de gobernante"
              >
                <Pencil size={14} />
                <span>Editar Nombre</span>
              </button>
            </div>
            <div className="my-standing-subtext">
              <span>Posición #{myStanding.rank} · Poder ⭐ {gameState.kingdomPower.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="my-standing-reward">
          <small>Premio Diario Proyectado:</small>
          <strong>{myStanding.dailyKingReward > 0 ? `+${myStanding.dailyKingReward} KING` : 'Fuera del Top 5'}</strong>
        </div>
      </div>

      {/* Tabla Completa de Clasificación */}
      <div className="ranking-table-card">
        <div className="ranking-table-header">
          <span className="col-rank">#</span>
          <span className="col-player">Gobernante</span>
          <span className="col-castle">Castillo</span>
          <span className="col-troops">Fuerza</span>
          <span className="col-power">Poder Militar</span>
          <span className="col-reward">Premio Diario</span>
        </div>

        <div className="ranking-table-body">
          {enrichedRankings.length === 0 ? (
            <div className="ranking-empty-row">
              {isLoading ? 'Cargando posiciones en vivo...' : 'No hay gobernantes registrados en este momento.'}
            </div>
          ) : (
            enrichedRankings.map((r) => (
              <div
                key={r.id}
                className={`ranking-table-row ${r.isMe ? 'current-player-row' : ''} ${r.rank <= 3 ? `top-${r.rank}` : ''}`}
              >
                <div className="col-rank">
                  <span className={`rank-number-badge rank-${r.rank}`}>
                    {r.rank === 1 ? '🥇 1' : r.rank === 2 ? '🥈 2' : r.rank === 3 ? '🥉 3' : `#${r.rank}`}
                  </span>
                </div>

                <div className="col-player">
                  <div className="player-name-cell">
                    <strong className="player-name-text">{r.displayName}</strong>
                    {r.isMe && (
                      <>
                        <span className="you-pill-chip">TÚ</span>
                        <button
                          type="button"
                          className="btn-edit-username-inline"
                          onClick={() => handleOpenEditUsername(r.rawName)}
                          title="Cambiar tu nombre de gobernante"
                        >
                          <Pencil size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="col-castle">
                  <span>🏰 Nv.{r.castleLevel}</span>
                </div>

                <div className="col-troops">
                  <span>⚔️ {r.troopsTotal.toLocaleString()}</span>
                </div>

                <div className="col-power">
                  <strong className="power-number">⭐ {r.displayPower.toLocaleString()}</strong>
                </div>

                <div className="col-reward">
                  {r.dailyKingReward > 0 ? (
                    <span className="reward-king-badge">🪙 +{r.dailyKingReward} KING</span>
                  ) : (
                    <span className="no-reward-text">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Edición de Nombre de Gobernante */}
      {isEditingUsername && (
        <div className="username-modal-overlay" onClick={() => !isSavingUsername && setIsEditingUsername(false)}>
          <div
            className="username-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="username-modal-header">
              <div className="username-modal-title">
                <Pencil size={18} className="gold" />
                <h3>Editar Nombre de Gobernante</h3>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                disabled={isSavingUsername}
                onClick={() => setIsEditingUsername(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUsername} className="username-modal-body">
              <p className="username-modal-desc">
                Elige tu nombre visible para todos los comandantes del reino. Debe tener entre 3 y 20 caracteres (solo letras, números y guión bajo).
              </p>

              <div className="username-input-group">
                <label htmlFor="input-new-username">Nombre único:</label>
                <input
                  id="input-new-username"
                  type="text"
                  maxLength={20}
                  value={newUsername}
                  onChange={(e) => {
                    setNewUsername(e.target.value)
                    if (usernameError) setUsernameError('')
                  }}
                  placeholder="Ej: Lord_Conquistador"
                  disabled={isSavingUsername}
                  autoFocus
                  className="username-input-field"
                />
                <span className="username-char-counter">{newUsername.trim().length}/20</span>
              </div>

              {usernameError && (
                <div className="username-feedback-box error">
                  <X size={16} />
                  <span>{usernameError}</span>
                </div>
              )}

              {usernameSuccess && (
                <div className="username-feedback-box success">
                  <Check size={16} />
                  <span>{usernameSuccess}</span>
                </div>
              )}

              <div className="username-modal-actions">
                <button
                  type="button"
                  className="btn-username-cancel"
                  disabled={isSavingUsername}
                  onClick={() => setIsEditingUsername(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-username-save"
                  disabled={isSavingUsername || !newUsername.trim()}
                >
                  {isSavingUsername ? (
                    <>
                      <Loader2 size={16} className="spin-icon" />
                      <span>Validando en Servidor...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Guardar Nombre</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
