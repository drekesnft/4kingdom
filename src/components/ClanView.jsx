import React, { useState, useEffect } from 'react'
import { REGIONAL_KINGDOMS, KING_CONFIG, TROOPS_CONFIG } from '../game/config'
import { totalTroopCount } from '../game/combat'
import {
  Shield,
  Crown,
  Castle,
  Users,
  Flag,
  Clock,
  Coins,
  Sparkles,
  Info,
  ChevronRight,
  Plus,
  Send,
  CheckCircle,
} from 'lucide-react'

export default function ClanView({ gameState, onSelectTarget, onClose }) {
  const {
    clan,
    clanRallies = [],
    troops,
    joinRally,
    donateToClan,
    resources,
    setRecentNotification,
  } = gameState

  const [activeTab, setActiveTab] = useState('clan') // 'clan' | 'rallies' | 'kingdoms'
  const [selectedKingdomKey, setSelectedKingdomKey] = useState('north')
  const [joiningRallyId, setJoiningRallyId] = useState(null)
  const [joinArmy, setJoinArmy] = useState({ infantry: 0, archer: 0, cavalry: 0 })
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Actualizar reloj para countdowns cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const kingdom = REGIONAL_KINGDOMS[selectedKingdomKey]

  const handleOpenJoin = (rally) => {
    setJoiningRallyId(rally.id)
    setJoinArmy({
      infantry: Math.min(troops.infantry, 5),
      archer: Math.min(troops.archer, 5),
      cavalry: Math.min(troops.cavalry, 2),
    })
  }

  const handleConfirmJoin = (rallyId) => {
    const total = totalTroopCount(joinArmy)
    if (total === 0) {
      alert('Debes seleccionar al menos una tropa.')
      return
    }
    const res = joinRally(rallyId, joinArmy)
    if (res.success) {
      setJoiningRallyId(null)
    } else {
      alert(res.reason)
    }
  }

  const handleDonate = (resType, amount) => {
    donateToClan(resType, amount)
  }

  return (
    <div className="view-panel clan-panel">
      {/* Encabezado */}
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Shield className="panel-icon" />
          <div>
            <h2>Clanes y 4 Reinos</h2>
            <p>Alianzas · Rallies de 5 min · Capitales y Fortalezas</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Aclaración de Diseño: Reino vs Clan */}
      <div className="clan-clarification-banner">
        <Info size={16} className="info-icon" />
        <div className="banner-text">
          <strong>Aclaración Territorial:</strong> Tu base pertenece geográficamente al <em>Reino del Norte / Sur / Este / Oeste</em> en el mapa. <strong>Tu Clan es una alianza independiente</strong> de jugadores que coordina defensas, tesorería y Rallies conjuntos.
        </div>
      </div>

      {/* Pestañas Gaming */}
      <div className="gaming-subtabs">
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'clan' ? 'active' : ''}`}
          onClick={() => setActiveTab('clan')}
        >
          <Shield size={14} /> Mi Clan
        </button>
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'rallies' ? 'active' : ''}`}
          onClick={() => setActiveTab('rallies')}
        >
          <Flag size={14} /> Rallies Activos ({clanRallies.filter((r) => r.status === 'gathering').length})
        </button>
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'kingdoms' ? 'active' : ''}`}
          onClick={() => setActiveTab('kingdoms')}
        >
          <Crown size={14} /> 4 Reinos (Territorio)
        </button>
      </div>

      {/* CONTENIDO PESTAÑA 1: MI CLAN */}
      {activeTab === 'clan' && (
        <div className="clan-tab-content">
          {/* Ficha Principal de la Alianza */}
          <div className="clan-profile-card">
            <div className="clan-profile-top">
              <div className="clan-crest">⚜️</div>
              <div className="clan-profile-info">
                <div className="clan-name-row">
                  <h3>{clan?.name || 'Vanguardia Valyria'}</h3>
                  <span className="clan-tag">[{clan?.tag || 'VAL'}]</span>
                </div>
                <p>Líder: <strong>{clan?.leader || 'Lord Comandante'}</strong> · Tu Rol: <span className="clan-role-tag">{clan?.role || 'Miembro'}</span></p>
                <small className="clan-desc-text">{clan?.description}</small>
              </div>
            </div>

            <div className="clan-quick-stats">
              <div><small>Miembros</small><strong>{clan?.membersCount || 14}/{clan?.maxMembers || 30}</strong></div>
              <div><small>Nivel de Clan</small><strong>Nv. {clan?.level || 1}</strong></div>
              <div><small>Poder Total</small><strong>⭐ 84,200</strong></div>
              <div><small>KING en Arca</small><strong>👑 {clan?.vaultKing || 240}</strong></div>
            </div>
          </div>

          {/* Arcas y Donaciones al Clan */}
          <div className="clan-vault-card">
            <div className="vault-header">
              <div className="vault-title">
                <Coins size={16} />
                <strong>Arca y Donaciones de Alianza</strong>
              </div>
              <span className="vault-bonus-badge">+5% Bono de Clan</span>
            </div>
            <p className="vault-desc">Dona materiales para subir de nivel las tecnologías del clan y desbloquear bonificaciones defensivas colectivas.</p>

            <div className="vault-res-grid">
              <div className="vault-res-item">
                <span>🌲 Madera aportada: <strong>{(clan?.donations?.wood || 0).toLocaleString()}</strong></span>
                <button
                  type="button"
                  className="clan-donate-btn"
                  onClick={() => handleDonate('wood', 500)}
                  disabled={(resources.wood || 0) < 500}
                >
                  +500 Madera
                </button>
              </div>
              <div className="vault-res-item">
                <span>🪨 Piedra aportada: <strong>{(clan?.donations?.stone || 0).toLocaleString()}</strong></span>
                <button
                  type="button"
                  className="clan-donate-btn"
                  onClick={() => handleDonate('stone', 500)}
                  disabled={(resources.stone || 0) < 500}
                >
                  +500 Piedra
                </button>
              </div>
            </div>
          </div>

          {/* Miembros del Clan */}
          <div className="clan-roster-card">
            <h4>Miembros de la Alianza ({clan?.membersCount || 14})</h4>
            <div className="members-list">
              <div className="member-row leader">
                <div className="member-info">
                  <span className="member-rank-icon">👑</span>
                  <div>
                    <strong>{clan?.leader || 'Lord Comandante'}</strong>
                    <small>Líder del Clan · Base (12, -8)</small>
                  </div>
                </div>
                <div className="member-stat">
                  <span>14,500 ⭐</span>
                  <span className="online-tag">En Línea</span>
                </div>
              </div>

              <div className="member-row you">
                <div className="member-info">
                  <span className="member-rank-icon">⚔️</span>
                  <div>
                    <strong>Mi Base (Tú)</strong>
                    <small>Miembro · Base ({gameState.resources ? '4, -3' : '4, -3'})</small>
                  </div>
                </div>
                <div className="member-stat">
                  <span>{gameState.kingdomPower.toLocaleString()} ⭐</span>
                  <span className="online-tag you">Tú</span>
                </div>
              </div>

              <div className="member-row">
                <div className="member-info">
                  <span className="member-rank-icon">🛡️</span>
                  <div>
                    <strong>Sir Ronald [VAL]</strong>
                    <small>Oficial · Base (8, -5)</small>
                  </div>
                </div>
                <div className="member-stat">
                  <span>9,800 ⭐</span>
                  <span className="online-tag">En Línea</span>
                </div>
              </div>

              <div className="member-row">
                <div className="member-info">
                  <span className="member-rank-icon">🏹</span>
                  <div>
                    <strong>Lady Gwen [VAL]</strong>
                    <small>Miembro · Base (-6, 14)</small>
                  </div>
                </div>
                <div className="member-stat">
                  <span>7,200 ⭐</span>
                  <span className="offline-tag">Hace 1h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: RALLIES ACTIVOS */}
      {activeTab === 'rallies' && (
        <div className="rallies-tab-content">
          <div className="rallies-header-banner">
            <div className="rallies-banner-title">
              <Flag size={18} />
              <div>
                <h3>Rallies de Asalto Conjunto</h3>
                <p>Concentración de tropas durante 5 minutos. Bajas y botín compartidos proporcionalmente.</p>
              </div>
            </div>
            <div className="rallies-hint">
              💡 Puedes convocar un Rally contra cualquier objetivo seleccionándolo directamente en el mapa.
            </div>
          </div>

          {clanRallies.length === 0 ? (
            <div className="empty-rallies-card">
              <Clock size={36} className="empty-icon" />
              <h4>No hay Rallies activos en este momento</h4>
              <p>Selecciona un Campamento Hostil, Fortaleza, Capital o Base Rival en el Mapa y presiona <strong>Convocar Rally de Clan (5 min)</strong>.</p>
            </div>
          ) : (
            <div className="rallies-grid">
              {clanRallies.map((rally) => {
                const isGathering = rally.status === 'gathering'
                const secLeft = Math.max(0, Math.ceil((rally.launchTime - currentTime) / 1000))
                const min = Math.floor(secLeft / 60)
                const sec = secLeft % 60
                const formattedTime = `${min}:${sec < 10 ? '0' : ''}${sec}`
                const totalRallyTroops = totalTroopCount(rally.totalArmy)
                const hasPlayerJoined = rally.participants.some((p) => p.isPlayer)

                return (
                  <div key={rally.id} className={`rally-card ${isGathering ? 'gathering' : 'marching'}`}>
                    <div className="rally-card-top">
                      <div>
                        <div className="rally-badge-row">
                          <span className={`rally-status-tag ${isGathering ? 'countdown' : 'marching'}`}>
                            {isGathering ? `⏳ Salida en: ${formattedTime}` : '⚔️ En Marcha hacia Objetivo'}
                          </span>
                          <span className="rally-target-type-badge">{rally.targetType.toUpperCase()}</span>
                        </div>
                        <h4 className="rally-target-name">{rally.targetName}</h4>
                        <small className="rally-coord">Coordenadas: ({rally.targetX}, {rally.targetY}) · Convocado por: <strong>{rally.creator}</strong></small>
                      </div>
                    </div>

                    {/* Resumen del Ejército del Rally */}
                    <div className="rally-army-preview">
                      <div className="army-stat-box">
                        <small>Total Tropas</small>
                        <strong>{totalRallyTroops}</strong>
                      </div>
                      <div className="army-breakdown-row">
                        <span>⚔️ Inf: {rally.totalArmy.infantry || 0}</span>
                        <span>🏹 Arq: {rally.totalArmy.archer || 0}</span>
                        <span>🐴 Cab: {rally.totalArmy.cavalry || 0}</span>
                      </div>
                    </div>

                    {/* Participantes */}
                    <div className="rally-participants-list">
                      <small className="participants-title">Aportantes ({rally.participants.length}):</small>
                      <div className="participants-tags">
                        {rally.participants.map((p, idx) => (
                          <span key={idx} className={`participant-tag ${p.isPlayer ? 'you' : ''}`}>
                            {p.name}: {totalTroopCount(p.army)} tropas
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Acciones de Unión */}
                    {isGathering && (
                      <div className="rally-actions">
                        {joiningRallyId === rally.id ? (
                          <div className="join-form-box">
                            <h5>Selecciona las tropas para unirte:</h5>
                            <div className="join-troop-inputs">
                              <div>
                                <label>⚔️ Inf ({troops.infantry})</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={troops.infantry}
                                  value={joinArmy.infantry}
                                  onChange={(e) => setJoinArmy({ ...joinArmy, infantry: Math.min(troops.infantry, Number(e.target.value)) })}
                                />
                              </div>
                              <div>
                                <label>🏹 Arq ({troops.archer})</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={troops.archer}
                                  value={joinArmy.archer}
                                  onChange={(e) => setJoinArmy({ ...joinArmy, archer: Math.min(troops.archer, Number(e.target.value)) })}
                                />
                              </div>
                              <div>
                                <label>🐴 Cab ({troops.cavalry})</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={troops.cavalry}
                                  value={joinArmy.cavalry}
                                  onChange={(e) => setJoinArmy({ ...joinArmy, cavalry: Math.min(troops.cavalry, Number(e.target.value)) })}
                                />
                              </div>
                            </div>
                            <div className="join-form-buttons">
                              <button
                                type="button"
                                className="confirm-join-btn"
                                onClick={() => handleConfirmJoin(rally.id)}
                              >
                                <CheckCircle size={14} /> Confirmar Refuerzo
                              </button>
                              <button
                                type="button"
                                className="cancel-join-btn"
                                onClick={() => setJoiningRallyId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="join-rally-btn"
                            onClick={() => handleOpenJoin(rally)}
                          >
                            <Plus size={14} /> {hasPlayerJoined ? 'Aportar Más Tropas al Rally' : 'Unirse al Rally de Clan'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 3: 4 REINOS (TERRITORIO) */}
      {activeTab === 'kingdoms' && (
        <div className="kingdoms-tab-content">
          {/* Selector de los 4 Reinos */}
          <div className="kingdoms-selector">
            {Object.entries(REGIONAL_KINGDOMS).map(([kKey, kData]) => (
              <button
                key={kKey}
                type="button"
                className={selectedKingdomKey === kKey ? 'active' : ''}
                onClick={() => setSelectedKingdomKey(kKey)}
              >
                {kData.name}
              </button>
            ))}
          </div>

          {/* Detalle del Reino Seleccionado */}
          <div className="kingdom-detail-card">
            <div className="kingdom-header-row">
              <div>
                <h3>{kingdom.name}</h3>
                <small>Cuadrante Político {kingdom.quadrant} · Bonus Territorial: +3% Producción pasiva regional</small>
              </div>
              <Crown className="crown-icon" />
            </div>

            {/* Capital */}
            <div className="capital-box">
              <div className="capital-title-row">
                <div className="capital-name-wrap">
                  <Castle size={20} />
                  <div>
                    <strong>{kingdom.capital.name}</strong>
                    <small>Coord: ({kingdom.capital.coord.x}, {kingdom.capital.coord.y})</small>
                  </div>
                </div>
                <span className="king-title-badge">Rey: {kingdom.capital.king}</span>
              </div>
              <p className="capital-rules-text">
                Conquistar la Capital regional nombra al Comandante del asalto como Rey del cuadrante. Tras la conquista se activa 1 hora de reorganización inmune a ataques.
              </p>
              <div className="capital-actions">
                <button
                  type="button"
                  className="rally-btn"
                  onClick={() => {
                    if (onClose) onClose()
                    setRecentNotification(`Localiza la Capital en (${kingdom.capital.coord.x}, ${kingdom.capital.coord.y}) para despachar asalto o convocar Rally.`)
                  }}
                >
                  <Flag size={14} /> Asediar Capital con Rally de Clan (5 min)
                </button>
              </div>
            </div>

            {/* 2 Fortalezas del Reino */}
            <h4 className="fortress-section-title">Fortalezas Estratégicas ({kingdom.fortresses.length})</h4>
            <div className="fortresses-grid">
              {kingdom.fortresses.map((f) => (
                <div key={f.id} className="fortress-card">
                  <div className="fortress-top">
                    <strong>{f.name}</strong>
                    <span className="fortress-coord">({f.coord.x}, {f.coord.y})</span>
                  </div>
                  <p className="fortress-clan">Controlador: <strong>{f.controller}</strong></p>
                  <div className="fortress-reward-row">
                    <small>Pool de Recompensas</small>
                    <strong>~52 KING/día</strong>
                    <small>(70% participantes / 30% Clan)</small>
                  </div>
                  <button
                    type="button"
                    className="fortress-attack-btn"
                    onClick={() => {
                      if (onClose) onClose()
                      setRecentNotification(`Localiza ${f.name} en (${f.coord.x}, ${f.coord.y}) para asediarla o convocar Rally.`)
                    }}
                  >
                    Asediar Fortaleza
                  </button>
                </div>
              ))}
            </div>

            {/* Sistema de Impuesto y Renta */}
            <div className="tax-info-box">
              <Coins size={16} />
              <div>
                <strong>Tesorería e Impuesto Regional</strong>
                <p>
                  Renta del 0.5% del valor recolectado en este cuadrante + 1% fee de transacciones del Reino.
                  Distribución: 50% Clan gobernante, 30% Reserva defensiva, 20% Eventos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
