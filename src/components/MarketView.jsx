import React, { useState, useEffect } from 'react'
import { KING_CONFIG, STORE_ITEMS, BUILDINGS_CONFIG, getRankingPayoutSchedule } from '../game/config'
import { Coins, Shield, Sparkles, TrendingUp, ArrowDownToLine, Flame, Lock, Unlock, DollarSign, Clock, Trophy, Info } from 'lucide-react'

export default function MarketView({ gameState, onClose }) {
  const {
    king,
    buildings,
    treasuryProtectionLimit,
    treasuryPendingLimit,
    treasuryDailyWithdrawLimit,
    kingProtected,
    kingExposed,
    productiveTroopsCount,
    maxKingProductiveTroops,
    estimatedDailyKing,
    claimPendingKing,
    withdrawKingToVault,
    buyPeaceShield,
    buyFounderPack,
    shieldUntil,
  } = gameState

  const [activeTab, setActiveTab] = useState('p2p') // 'p2p' | 'treasury' | 'farming' | 'store'
  const [withdrawAmount, setWithdrawAmount] = useState('25')
  const [payoutSchedule, setPayoutSchedule] = useState(() => getRankingPayoutSchedule())

  useEffect(() => {
    const timer = setInterval(() => {
      setPayoutSchedule(getRankingPayoutSchedule())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const now = Date.now()
  const isShieldActive = shieldUntil > now
  const shieldHoursLeft = isShieldActive ? Math.ceil((shieldUntil - now) / (3600 * 1000)) : 0

  return (
    <div className="view-panel market-panel">
      <header className="panel-header">
        <div className="panel-title-wrap">
          <Coins className="panel-icon gold" />
          <div>
            <h2>Tesorería y Mercado Web3</h2>
            <p>Token KING · 1,000,000 Supply · Protección y Retiros</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-back-map" onClick={onClose} title="Volver al mapa">
            🗺️ Ver Mapa
          </button>
        )}
      </header>

      {/* Subnavegación */}
      <div className="sub-tabs">
        <button
          type="button"
          className={activeTab === 'p2p' ? 'active' : ''}
          onClick={() => setActiveTab('p2p')}
        >
          🤝 Mercado P2P (Muy Pronto)
        </button>
        <button
          type="button"
          className={activeTab === 'treasury' ? 'active' : ''}
          onClick={() => setActiveTab('treasury')}
        >
          🏛️ Tesorería
        </button>
        <button
          type="button"
          className={activeTab === 'farming' ? 'active' : ''}
          onClick={() => setActiveTab('farming')}
        >
          📈 Farming & Pools
        </button>
        <button
          type="button"
          className={activeTab === 'store' ? 'active' : ''}
          onClick={() => setActiveTab('store')}
        >
          🛡️ Tienda & Packs (Muy Pronto)
        </button>
      </div>

      {activeTab === 'treasury' && (
        <div className="tab-content treasury-content">
          {/* Dashboard de 4 Estados de KING (Sección 11) */}
          <div className="treasury-grid">
            {/* Estado 1: Pendiente */}
            <div className="treasury-card pending-card">
              <div className="card-top">
                <small>1. KING Pendiente</small>
                <span className="badge">No robable</span>
              </div>
              <div className="amount-row">
                <h3>{king.pending.toFixed(2)}</h3>
                <span className="unit">KING</span>
              </div>
              <p className="card-hint">
                Límite de Tesorería Nv.{buildings.treasury}: {treasuryPendingLimit} KING (+25% buffer).
              </p>
              <button
                type="button"
                className="claim-btn"
                onClick={claimPendingKing}
                disabled={king.pending <= 0}
              >
                Reclamar a Tesorería (Sin Fee)
              </button>
            </div>

            {/* Estado 2: Tesorería (Protegido vs Expuesto) */}
            <div className="treasury-card treasury-balance-card">
              <div className="card-top">
                <small>2 & 3. Saldo en Tesorería</small>
                <span className="badge-gold">{king.claimed.toFixed(2)} KING</span>
              </div>

              <div className="split-status-row">
                <div className="split-box protected">
                  <div className="split-header">
                    <Lock size={13} />
                    <strong>Protegido</strong>
                  </div>
                  <h3>{kingProtected.toFixed(2)}</h3>
                  <small>Inmune a saqueos PvP (Límite: {treasuryProtectionLimit})</small>
                </div>

                <div className="split-box exposed">
                  <div className="split-header">
                    <Unlock size={13} />
                    <strong>Expuesto</strong>
                  </div>
                  <h3>{kingExposed.toFixed(2)}</h3>
                  <small>20% saqueable en caso de derrota PvP</small>
                </div>
              </div>
            </div>

            {/* Estado 4: Vault & Retiro */}
            <div className="treasury-card vault-card">
              <div className="card-top">
                <small>4. KING en Vault / Billetera Externa</small>
                <span className="badge-secure">100% Seguro</span>
              </div>
              <div className="amount-row">
                <h3 className="vault-val">{king.vault.toFixed(2)}</h3>
                <span className="unit">KING</span>
              </div>

              {/* Formulario de Retiro con 5% fee */}
              <div className="withdraw-box">
                <div className="withdraw-input-row">
                  <label htmlFor="withdraw-amt">Retirar a Vault:</label>
                  <input
                    id="withdraw-amt"
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={king.claimed}
                  />
                  <button
                    type="button"
                    className="max-btn"
                    onClick={() => setWithdrawAmount(String(Math.min(king.claimed, treasuryDailyWithdrawLimit)))}
                  >
                    MÁX
                  </button>
                </div>

                <div className="fee-breakdown">
                  <div className="fee-line">
                    <span>Comisión de Retiro (5%):</span>
                    <strong>-{(Number(withdrawAmount || 0) * 0.05).toFixed(2)} KING</strong>
                  </div>
                  <div className="fee-subdetails">
                    <small>🔥 2% Quema · 🎁 2% Pool Recompensas · 👑 1% Reino</small>
                  </div>
                  <div className="net-receive">
                    <span>Neto recibido en Vault:</span>
                    <strong>+{(Number(withdrawAmount || 0) * 0.95).toFixed(2)} KING</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="withdraw-btn"
                  onClick={() => withdrawKingToVault(withdrawAmount)}
                  disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > king.claimed}
                >
                  <ArrowDownToLine size={15} /> Retirar a Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'farming' && (
        <div className="tab-content farming-content">
          <div className="farming-overview-card">
            <h3>Farming de Productividad Diario</h3>
            <p>
              El token KING no se emite de forma infinita. Se distribuye diariamente entre los jugadores según su poder productivo de tropas elegibles en casa.
            </p>

            <div className="farming-metrics-grid">
              <div className="metric-box">
                <small>Tropas en Casa / Capacidad Granero</small>
                <strong>{productiveTroopsCount} / {maxKingProductiveTroops}</strong>
              </div>
              <div className="metric-box">
                <small>Pool Diario Inicial</small>
                <strong>{KING_CONFIG.DAILY_FARMING_POOL_INITIAL} KING/día</strong>
              </div>
              <div className="metric-box">
                <small>Método de Obtención</small>
                <strong className="reward-est">Misiones y Batallas</strong>
              </div>
            </div>
          </div>

          {/* Tabla de Halving (Sección 35) */}
          <div className="halving-card">
            <h4>Calendario de Halving del Pool de Farming</h4>
            <div className="halving-table">
              <div className="table-header">
                <span>Periodo</span>
                <span>Pool Total</span>
                <span>Emisión Diaria</span>
              </div>
              {KING_CONFIG.HALVING_SCHEDULE.map((item, idx) => (
                <div key={item.period} className={`table-row ${idx === 0 ? 'current' : ''}`}>
                  <span>{item.period} {idx === 0 ? '(Actual)' : ''}</span>
                  <strong>{item.poolTotal.toLocaleString()} KING</strong>
                  <span className="daily-val">{item.daily} KING/día</span>
                </div>
              ))}
            </div>
          </div>

          {/* Premios de Ranking Diario (00:00 UTC - Sección 37) */}
          <div className="ranking-card">
            <div className="ranking-card-header">
              <div className="ranking-title-group">
                <Trophy size={20} className="gold" />
                <h4>Top 5 del Reparto Diario de Poder</h4>
              </div>
              <span className="ranking-pool-tag">Pool: 40 KING/día · 00:00 UTC</span>
            </div>

            <div className="ranking-meta-box">
              <div className="meta-item">
                <Clock size={16} />
                <span>Próximo Pago / Inicio (00:00 UTC):</span>
                <strong className="countdown-highlight">{payoutSchedule.formattedCountdown}</strong>
              </div>
              <div className="meta-item">
                <span>Fecha de Inicio Oficial:</span>
                <strong>29/09/2026 a las 00:00 UTC</strong>
              </div>
              <div className="meta-item status">
                <span>Estado del Pool:</span>
                <span className={`status-badge ${payoutSchedule.isLive ? 'live' : 'scheduled'}`}>
                  {payoutSchedule.isLive ? '🟢 Activo en Producción' : '⏳ Cuenta Regresiva Oficial'}
                </span>
              </div>
            </div>

            <div className="ranking-prizes-row">
              {KING_CONFIG.RANKING_CONFIG.TIERS.map((tier) => (
                <div key={tier.rank} className="rank-prize-badge">
                  <span>{tier.label}</span>
                  <strong>{tier.baseKing} KING</strong>
                  <small>{tier.percentLabel} ({tier.percent * 100}%)</small>
                </div>
              ))}
            </div>

            <p className="ranking-expl-footer">
              ⚖️ <strong>Auditoría Automatizada:</strong> Cada 24 horas a las 00:00 UTC, el backend audita la suma real de Poder Militar (⭐) de todos los reinos y premia a los 5 mayores poderes aplicando la cuota porcentual exacta (37.5%, 25%, 17.5%, 12.5%, 7.5%).
            </p>
          </div>
        </div>
      )}

      {activeTab === 'store' && (
        <div className="tab-content store-content">
          {/* Estado de Escudo */}
          <div className={`shield-status-box ${isShieldActive ? 'protected' : 'unshielded'}`}>
            <Shield size={20} />
            <div>
              <strong>{isShieldActive ? `Escudo de Paz Activo (${shieldHoursLeft}h restantes)` : 'Sin Escudo de Paz Activo'}</strong>
              <small>
                {isShieldActive
                  ? 'Tu reino no puede ser asaltado en PvP. Lanzar un ataque PvP romperá el escudo.'
                  : 'Tu reino es vulnerable a saqueos de recursos y KING expuesto.'}
              </small>
            </div>
          </div>

          {/* Escudos de Paz */}
          <h4 className="store-section-title">Escudos de Paz (Comprados con KING)</h4>
          <div className="store-grid">
            {STORE_ITEMS.shields.map((s) => (
              <div key={s.id} className="store-card">
                <span className="store-icon">{s.icon}</span>
                <div className="store-card-info">
                  <strong>{s.name}</strong>
                  <small>Protección contra ataques PvP</small>
                </div>
                <button
                  type="button"
                  className="buy-king-btn"
                  onClick={() => buyPeaceShield(s)}
                  disabled={king.claimed < s.kingCost}
                >
                  {s.kingCost} KING
                </button>
              </div>
            ))}
          </div>

          {/* Planos con KING (Sección 68) */}
          <h4 className="store-section-title">Planos Arquitectónicos</h4>
          <div className="store-grid">
            {STORE_ITEMS.blueprints.map((bp) => (
              <div key={bp.id} className="store-card">
                <span className="store-icon">{bp.icon}</span>
                <div className="store-card-info">
                  <strong>{bp.name}</strong>
                  <small>{bp.description}</small>
                </div>
                <button
                  type="button"
                  className="buy-king-btn"
                  disabled={king.claimed < bp.kingCost}
                >
                  {bp.kingCost} KING
                </button>
              </div>
            ))}
          </div>

          {/* Founder Packs (Sección 66) */}
          <h4 className="store-section-title">Founder Packs Exclusivos</h4>
          <div className="founder-packs-grid">
            {STORE_ITEMS.founderPacks.map((pack) => (
              <div key={pack.id} className="pack-card">
                <div className="pack-img-frame">
                  <img src={pack.image} alt={pack.name} />
                </div>
                <div className="pack-body">
                  <div className="pack-top">
                    <h4>{pack.name}</h4>
                    <span className="pack-price">${pack.priceUsd} USD</span>
                  </div>
                  <ul className="pack-perks">
                    <li>👑 +{pack.kingBonus} KING directo</li>
                    <li>🌲 {pack.resources.wood.toLocaleString()} Madera, 🪨 {pack.resources.stone.toLocaleString()} Piedra, 🌾 {pack.resources.food.toLocaleString()} Comida</li>
                    <li>⚔️ {pack.troops.infantry} Infanterías, {pack.troops.archer} Arqueros, {pack.troops.cavalry} Caballerías</li>
                    <li>🛡️ {pack.shieldHours}h Escudo de Paz</li>
                    {pack.title && <li>⭐ {pack.title}</li>}
                  </ul>
                  <button
                    type="button"
                    className="buy-pack-btn"
                    onClick={() => buyFounderPack(pack)}
                  >
                    Canjear Pack
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'p2p' && (
        <div className="tab-content p2p-content">
          <div className="whitelist-hero-card" style={{ textAlign: 'center', padding: '26px 18px', background: 'linear-gradient(180deg, rgba(16, 42, 70, 0.95), rgba(8, 22, 38, 0.98))', borderRadius: '16px', border: '1px solid rgba(80, 160, 240, 0.35)' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏛️🤝</div>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(255, 185, 0, 0.16)', border: '1px solid rgba(255, 185, 0, 0.45)', borderRadius: '999px', color: '#ffd65a', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
              ⏳ Muy Pronto · En Desarrollo (Fase v0.2)
            </div>
            <h3 style={{ fontSize: '20px', color: '#ffffff', margin: '0 0 10px', fontWeight: '900' }}>
              Mercado P2P y Comercio Descentralizado
            </h3>
            <p style={{ fontSize: '13px', color: '#bcd6ee', maxWidth: '520px', margin: '0 auto 16px', lineHeight: '1.5' }}>
              El sistema de intercambio comercial entre jugadores se encuentra en fase de auditoría técnica. Cero bots y cero órdenes ficticias.
            </p>

            <div style={{ background: 'rgba(7, 18, 30, 0.8)', border: '1px solid rgba(80, 180, 255, 0.25)', borderRadius: '12px', padding: '14px 16px', maxWidth: '540px', margin: '0 auto 20px', textAlign: 'left', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <Info size={20} style={{ color: '#4cb7ff', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#ffd65a', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Regla Cero Fallbacks — Libro 100% P2P Real:
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: '#c5ddf5', lineHeight: '1.4' }}>
                  En FourKingdoms no utilizamos bots de arbitraje ni libros simulados con liquidez falsa. Cuando el mercado se active, podrás comerciar directamente tus excedentes de Madera, Piedra y Comida con otros señores feudales fijando tus propios precios en tokens KING.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', maxWidth: '560px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>🌲🪨🌾</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Comercio Libre de Recursos</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Vende excedentes de producción pasiva o botín de guerra a cambio de KING transferible.</small>
              </div>

              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>📜</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Subastas de Planos</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Compra y vende planos constructivos raros para acelerar el desarrollo del reino.</small>
              </div>

              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>⚡</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Fee Regional del 1%</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Las tarifas de intercambio nutren las arcas de tu Reino regional y financian recompensas.</small>
              </div>

              <div style={{ background: 'rgba(12, 30, 52, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '18px', marginBottom: '6px' }}>🔒</div>
                <strong style={{ color: '#eef8ff', fontSize: '12px', display: 'block', marginBottom: '3px' }}>Custodia en Tesorería</strong>
                <small style={{ color: '#9dbcdb', fontSize: '11px', lineHeight: '1.3', display: 'block' }}>Tus ingresos por venta se acreditan en tu Tesorería protegida de saqueos rivales.</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
