import React, { useState } from 'react'
import { REGIONAL_KINGDOMS, KING_CONFIG } from '../game/config'
import { Shield, Crown, Castle, Users, Flag, Clock, Coins, Sparkles } from 'lucide-react'

export default function ClanView({ gameState, onSelectTarget, onClose }) {
  const [selectedKingdomKey, setSelectedKingdomKey] = useState('north')
  const [rallyTimeLeft, setRallyTimeLeft] = useState(300) // 5 min
  const [isRallyActive, setIsRallyActive] = useState(false)

  const kingdom = REGIONAL_KINGDOMS[selectedKingdomKey]

  const startRallyDemo = (targetName) => {
    setIsRallyActive(true)
    setRallyTimeLeft(300)
    gameState.setRecentNotification(`¡Rally de Clan de 5 minutos iniciado contra ${targetName}! Los aliados están aportando tropas.`)
  }

  return (
    <div className="view-panel clan-panel">
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Shield className="panel-icon" />
          <div>
            <h2>Clanes y 4 Reinos</h2>
            <p>4 Capitales · 8 Fortalezas · Rallies de 5 min · Reyes</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Ficha de Clan */}
      <div className="clan-profile-card">
        <div className="clan-profile-top">
          <div className="clan-crest">⚜️</div>
          <div className="clan-profile-info">
            <div className="clan-name-row">
              <h3>Orden del Trono de Hielo</h3>
              <span className="clan-tag">[ICE]</span>
            </div>
            <p>Rango: #3 en el Servidor · Miembros: 32/50 · Rey de Escarcha</p>
          </div>
        </div>

        <div className="clan-quick-stats">
          <div><small>Poder Total</small><strong>⭐ 84,200</strong></div>
          <div><small>Tesorería Clan</small><strong>👑 3,450 KING</strong></div>
          <div><small>Capitales</small><strong>🏰 1/1 Máx</strong></div>
          <div><small>Fortalezas</small><strong>🛡️ 2 Controladas</strong></div>
        </div>
      </div>

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
            <small>Cuadrante Político {kingdom.quadrant} · Bonus Regional: +3% Producción pasiva</small>
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
            Conquistar la Capital nombra al Comandante del asalto como Rey regional. Tras la conquista se activa 1 hora de reorganización inmune a ataques.
          </p>
          <div className="capital-actions">
            <button
              type="button"
              className="rally-btn"
              onClick={() => startRallyDemo(kingdom.capital.name)}
            >
              <Flag size={14} /> Convocar Rally de Clan (5 min)
            </button>
          </div>
        </div>

        {/* 2 Fortalezas del Reino */}
        <h4 className="fortress-section-title">Fortalezas Estratégicas del Reino</h4>
        <div className="fortresses-grid">
          {kingdom.fortresses.map((f) => (
            <div key={f.id} className="fortress-card">
              <div className="fortress-top">
                <strong>{f.name}</strong>
                <span className="fortress-coord">({f.coord.x}, {f.coord.y})</span>
              </div>
              <p className="fortress-clan">Controlador: <strong>{f.controller}</strong></p>
              <div className="fortress-reward-row">
                <small>Pool de Fortress</small>
                <strong>~52 KING/día</strong>
                <small>(70% participantes / 30% Clan)</small>
              </div>
              <button
                type="button"
                className="fortress-attack-btn"
                onClick={() => startRallyDemo(f.name)}
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
              Renta del 0.5% del valor recolectado regional + 1% fee de transacciones del Reino.
              Distribución: 50% Clan gobernante, 30% Reserva defensiva, 20% Eventos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
