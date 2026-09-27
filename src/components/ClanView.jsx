import React, { useState } from 'react'
import { REGIONAL_KINGDOMS } from '../game/config'
import {
  Shield,
  Crown,
  Castle,
  Flag,
  Coins,
  Info,
  Users,
  Sparkles,
  Swords,
  Layers,
} from 'lucide-react'

export default function ClanView({ gameState, onClose }) {
  const { setRecentNotification } = gameState
  const [activeTab, setActiveTab] = useState('coming_soon') // 'coming_soon' | 'kingdoms'
  const [selectedKingdomKey, setSelectedKingdomKey] = useState('north')

  const kingdom = REGIONAL_KINGDOMS[selectedKingdomKey]

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
          className={`gaming-subtab-btn ${activeTab === 'coming_soon' ? 'active' : ''}`}
          onClick={() => setActiveTab('coming_soon')}
        >
          <Shield size={14} /> Sistema de Clanes (Muy Pronto)
        </button>
        <button
          type="button"
          className={`gaming-subtab-btn ${activeTab === 'kingdoms' ? 'active' : ''}`}
          onClick={() => setActiveTab('kingdoms')}
        >
          <Crown size={14} /> 4 Reinos (Territorio)
        </button>
      </div>

      {/* CONTENIDO PESTAÑA 1: SISTEMA DE CLANES (MUY PRONTO) */}
      {activeTab === 'coming_soon' && (
        <div className="clan-tab-content">
          <div className="whitelist-hero-card" style={{ textAlign: 'center', padding: '28px 18px', background: 'linear-gradient(180deg, rgba(16, 42, 70, 0.95), rgba(8, 22, 38, 0.98))', borderRadius: '16px', border: '1px solid rgba(80, 160, 240, 0.35)' }}>
            <div style={{ fontSize: '42px', marginBottom: '10px' }}>🛡️⚔️</div>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(255, 185, 0, 0.16)', border: '1px solid rgba(255, 185, 0, 0.45)', borderRadius: '999px', color: '#ffd65a', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
              ⏳ Muy Pronto · En Desarrollo
            </div>
            <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '0 0 10px', fontWeight: '900' }}>
              Sistema de Clanes y Alianzas Feudales
            </h3>
            <p style={{ fontSize: '13px', color: '#bcd6ee', maxWidth: '520px', margin: '0 auto 16px', lineHeight: '1.5' }}>
              El sistema de gremios y hermandades se activará en la siguiente fase multiplayer. No hay jugadores bot ni clanes ficticios creados.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', maxWidth: '560px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>👑</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Fundar tu Hermandad</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Crea tu estandarte, etiqueta de clan (Tag) y nombra oficiales para coordinar defensas.</small>
              </div>

              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>⚔️</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Rallies de 5 Minutos</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Convoca asaltos cooperativos contra Fortalezas regionales con reparto equitativo de bajas y botín.</small>
              </div>

              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>🏛️</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Arca del Clan y Tecnologías</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Dona Madera y Piedra para investigar bonos de ataque (+5%), defensa (+10%) y velocidad.</small>
              </div>

              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>🛡️</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Refuerzos Defensivos</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Envía tropas de apoyo a las bases de tus aliados para defenderlas de asaltos rivales.</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: 4 REINOS (TERRITORIO) */}
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
                  <Flag size={14} /> Localizar Capital en el Mapa
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
                      setRecentNotification(`Localiza ${f.name} en (${f.coord.x}, ${f.coord.y}) para asediarla o recolectar.`)
                    }}
                  >
                    Localizar Fortaleza
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
