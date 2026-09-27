import React, { useState } from 'react'
import { KING_CONFIG, STORE_ITEMS, BUILDINGS_CONFIG } from '../game/config'
import { Coins, Shield, Sparkles, TrendingUp, ArrowDownToLine, Flame, Lock, Unlock, DollarSign } from 'lucide-react'

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

  const [activeTab, setActiveTab] = useState('treasury') // 'treasury' | 'store' | 'farming' | 'p2p'
  const [withdrawAmount, setWithdrawAmount] = useState('25')

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
          🛡️ Tienda & Packs
        </button>
        <button
          type="button"
          className={activeTab === 'p2p' ? 'active' : ''}
          onClick={() => setActiveTab('p2p')}
        >
          🤝 Mercado P2P
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
                <small>Tu Participación Estimada</small>
                <strong className="reward-est">+{estimatedDailyKing} KING/día</strong>
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

          {/* Premios de Ranking Diario (Sección 37) */}
          <div className="ranking-card">
            <h4>Premios del Ranking Diario (40 KING/día)</h4>
            <div className="ranking-prizes-row">
              {KING_CONFIG.RANKING_DAILY_REWARDS.map((rew, i) => (
                <div key={i} className="rank-prize-badge">
                  <span>#{i + 1}</span>
                  <strong>{rew} KING</strong>
                </div>
              ))}
            </div>
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
          <div className="p2p-info-banner">
            <TrendingUp size={20} />
            <div>
              <strong>Mercado P2P de KING (Order Book Interno)</strong>
              <small>Precio de referencia inicial: $0.005 USD/KING · Fee regional: 1%</small>
            </div>
          </div>

          <div className="orderbook-preview">
            <div className="order-column buy-orders">
              <h5>Órdenes de Compra (Bids)</h5>
              <div className="order-row header"><span>Precio (USD)</span><span>Cantidad</span></div>
              <div className="order-row green"><span>$0.0051</span><span>12,500 KING</span></div>
              <div className="order-row green"><span>$0.0050</span><span>40,000 KING</span></div>
              <div className="order-row green"><span>$0.0049</span><span>85,000 KING</span></div>
            </div>

            <div className="order-column sell-orders">
              <h5>Órdenes de Venta (Asks)</h5>
              <div className="order-row header"><span>Precio (USD)</span><span>Cantidad</span></div>
              <div className="order-row red"><span>$0.0052</span><span>18,000 KING</span></div>
              <div className="order-row red"><span>$0.0053</span><span>35,000 KING</span></div>
              <div className="order-row red"><span>$0.0055</span><span>60,000 KING</span></div>
            </div>
          </div>

          <div className="p2p-action-box">
            <p>El libro de órdenes opera dentro del juego entre jugadores. Las transacciones aportan un 1% de tasa a la Tesorería del Reino.</p>
          </div>
        </div>
      )}
    </div>
  )
}
