import { useState, useEffect } from 'react'
import {
  Crown,
  Share2,
  Copy,
  Check,
  Users,
  Coins,
  Shield,
  Sparkles,
  ExternalLink,
  LogOut,
  Flame,
  Award,
  Clock,
  Send,
  MessageCircle,
  Package,
  Swords,
  Trophy,
} from 'lucide-react'
import {
  authService,
  COMMUNITY_MILESTONES,
  TOP_REFERRAL_PRIZES,
  getUrlReferralCode,
} from '../services/authService'

export default function WhitelistDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(() => authService.getReferralStats(user.email))
  const [totalPreReg, setTotalPreReg] = useState(() => authService.getGlobalPreRegistrationCount())
  const [topReferrers, setTopReferrers] = useState(() => authService.getTopReferrers())
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [referralInput, setReferralInput] = useState('')
  const [refMsg, setRefMsg] = useState('')
  const [refError, setRefError] = useState('')

  const myCode = stats.referralCode || user.referralCode || 'FK-SOVEREIGN'
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${myCode}`
    : `https://fourkingdoms.io/?ref=${myCode}`

  // Pulso de nuevos registros comunitarios
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedCount = authService.getGlobalPreRegistrationCount() + Math.floor(Math.random() * 2)
      setTotalPreReg(updatedCount)
      setTopReferrers(authService.getTopReferrers())
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {}
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {}
  }

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `⚔️ ¡He asegurado mi puesto en la Whitelist Oficial de @FourKingdoms! 👑\nÚnete a mi clan antes del 29/09/2026 y reclama 5 tokens KING de Airdrop:\n${shareUrl}`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `⚔️ ¡Únete a la Whitelist de FourKingdoms con mi código ${myCode} y asegura tu Airdrop de 5 tokens KING!:\n${shareUrl}`
    )
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank')
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `👑 ¡Entra a la Whitelist de FourKingdoms conmigo! Usa mi código *${myCode}* y recibe 5 tokens KING de Airdrop:\n${shareUrl}`
    )
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  const handleApplyReferral = async (e) => {
    e.preventDefault()
    setRefMsg('')
    setRefError('')
    if (!referralInput.trim()) return

    const normalized = referralInput.trim().toUpperCase()
    if (normalized === myCode) {
      setRefError('No puedes usar tu propio código de referencia.')
      return
    }

    const res = await authService.registerWhitelist({
      email: user.email,
      provider: user.provider || 'google',
      referralCode: normalized,
    })

    if (res.rewardedReferrer) {
      setRefMsg(`¡Código ${normalized} vinculado con éxito! Tu aliado ha recibido sus 5 tokens KING.`)
      setStats(authService.getReferralStats(user.email))
      setTopReferrers(authService.getTopReferrers())
      setReferralInput('')
    } else {
      setRefMsg(`Código ${normalized} guardado en tu registro de Whitelist.`)
      setReferralInput('')
    }
  }

  // Progreso general hacia el hito máximo de 2,500
  const progressPercent = Math.min(100, Math.round((totalPreReg / 2500) * 100))

  return (
    <div className="whitelist-dashboard-root">
      {/* Top Header */}
      <header className="wl-header">
        <div className="wl-brand">
          <img
            src="/assets/ui/logo-fourkingdoms.png"
            alt="FourKingdoms"
            className="wl-logo-img"
          />
          <div className="wl-brand-meta">
            <span className="wl-tag-badge">🛡️ WHITELIST OFICIAL ALPHA</span>
            <small>Panel de Comando del Pre-Registro</small>
          </div>
        </div>

        <div className="wl-user-controls">
          <div className="wl-user-pill">
            <span className="wl-avatar-dot"></span>
            <div className="wl-user-text">
              <span className="wl-user-email">{user.email}</span>
              <span className="wl-user-verified">
                {user.provider === 'google' ? 'Google Verificado' : 'Aspirante Registrado'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="wl-logout-btn"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="wl-main-content">
        {/* Hero Section con Fecha Oficial */}
        <section className="wl-hero-card">
          <div className="wl-hero-badge">
            <Flame size={14} className="fire-icon" />
            <span>APERTURA OFICIAL · 29 DE SEPTIEMBRE DE 2026 (00:00 UTC)</span>
          </div>

          <h1 className="wl-hero-title">
            ¡Has Asegurado tu Trono en la Whitelist Oficial!
          </h1>
          <p className="wl-hero-desc">
            Tu linaje ha sido registrado en la <strong>Vanguardia de Honor</strong>. Cuando comience la conquista el 29/09/2026, ingresarás con todas las recompensas comunitarias desbloqueadas y tu saldo de tokens KING asegurado.
          </p>

          {/* Contador Masivo de Pre-Registros */}
          <div className="wl-counter-banner">
            <div className="wl-counter-header">
              <span className="live-indicator">
                <span className="pulsing-dot"></span> EN VIVO
              </span>
              <span className="counter-label">Gobernantes Pre-Registrados:</span>
            </div>

            <div className="wl-big-number">
              <Users size={32} className="gold" />
              <span>{totalPreReg.toLocaleString()}</span>
              <small>SEÑORES DE LA GUERRA</small>
            </div>

            {/* Barra General de Progreso */}
            <div className="wl-milestone-wrap">
              <div className="wl-milestone-bar-bg">
                <div
                  className="wl-milestone-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="wl-milestone-progress-text">
                <span>Progreso hacia el Hito Supremo: <strong>{totalPreReg} / 2,500 Gobernantes</strong></span>
                <span>{progressPercent}% Completado</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECCIÓN 1: HITOS COMUNITARIOS CADA 500 REGISTROS (COSAS REALES)*/}
        {/* ============================================================== */}
        <section className="wl-milestones-section">
          <div className="section-title-wrap">
            <div className="section-badge-icon">
              <Sparkles size={20} className="gold-icon" />
            </div>
            <div>
              <h2>Hitos Comunitarios de Pre-Registro (Cada 500 Gobernantes)</h2>
              <p>Recompensas directas y reales para TODOS los jugadores pre-registrados al alcanzar cada meta.</p>
            </div>
          </div>

          <div className="milestones-grid">
            {COMMUNITY_MILESTONES.map((m) => {
              const isUnlocked = totalPreReg >= m.target
              const currentStepProgress = Math.min(100, Math.round((totalPreReg / m.target) * 100))

              return (
                <div
                  key={m.target}
                  className={`milestone-card ${isUnlocked ? 'unlocked' : 'in-progress'}`}
                >
                  <div className="milestone-card-top">
                    <div className="target-pill">
                      <span>🎯 {m.target.toLocaleString()} REGISTROS</span>
                    </div>
                    <span className={`status-pill ${isUnlocked ? 'done' : 'active'}`}>
                      {isUnlocked ? '✅ Desbloqueado' : `${currentStepProgress}%`}
                    </span>
                  </div>

                  <h3 className="milestone-title">{m.title}</h3>
                  <div className="milestone-reward-box">
                    <strong>{m.reward}</strong>
                  </div>
                  <p className="milestone-desc">{m.desc}</p>

                  <div className="milestone-mini-bar">
                    <div
                      className="milestone-mini-fill"
                      style={{ width: `${isUnlocked ? 100 : currentStepProgress}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECCIÓN 2: AIRDROP POR REFERIDOS (5 TOKENS KING POR AMIGO)     */}
        {/* ============================================================== */}
        <section className="wl-referral-epic-card">
          <div className="wl-section-header">
            <div className="wl-title-icon-wrap">
              <Coins size={26} className="gold-icon pulse" />
              <div>
                <h2>Airdrop de Reclutamiento: 5 Tokens KING por Aliado</h2>
                <p>
                  Ganas <strong>5 Tokens KING</strong> asegurados para tu Vault por cada gobernante que se registre en la Whitelist con tu código.
                </p>
              </div>
            </div>
            <div className="wl-airdrop-total-pill">
              <Coins size={20} className="gold-icon" />
              <div>
                <small>Tu Airdrop Acumulado:</small>
                <strong>{stats.airdropTokens} KING</strong>
              </div>
            </div>
          </div>

          {/* Tarjetas de Código y Enlace */}
          <div className="wl-codes-grid">
            <div className="wl-code-box">
              <span className="box-label">Tu Código de Referencia Único:</span>
              <div className="code-display-row">
                <span className="code-val">{myCode}</span>
                <button
                  type="button"
                  className={`btn-copy-code ${copiedCode ? 'copied' : ''}`}
                  onClick={handleCopyCode}
                >
                  {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>
              <small>Comparte este código para que tus aliados lo ingresen al unirse.</small>
            </div>

            <div className="wl-link-box">
              <span className="box-label">Tu Enlace de Invitación Directo:</span>
              <div className="link-display-row">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="link-input"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`btn-copy-link ${copiedLink ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? '¡Copiado!' : 'Copiar Enlace'}</span>
                </button>
              </div>
              <small>Aplica tu código automáticamente al abrirse en el navegador.</small>
            </div>
          </div>

          {/* Botones de Compartir */}
          <div className="wl-social-share-row">
            <span className="share-prompt">Difundir en Redes:</span>
            <button
              type="button"
              className="social-btn btn-twitter"
              onClick={handleShareTwitter}
            >
              <span>𝕏 Compartir en X</span>
            </button>
            <button
              type="button"
              className="social-btn btn-telegram"
              onClick={handleShareTelegram}
            >
              <Send size={15} />
              <span>Telegram</span>
            </button>
            <button
              type="button"
              className="social-btn btn-whatsapp"
              onClick={handleShareWhatsApp}
            >
              <MessageCircle size={15} />
              <span>WhatsApp</span>
            </button>
          </div>

          {/* Métricas de Reclutamiento */}
          <div className="wl-stats-row">
            <div className="stat-card">
              <Users size={22} className="blue" />
              <div>
                <small>Aliados Reclutados</small>
                <strong>{stats.referralsCount} Gobernantes</strong>
              </div>
            </div>

            <div className="stat-card highlight">
              <Coins size={22} className="gold" />
              <div>
                <small>Tokens Ganados (5 c/u)</small>
                <strong>{stats.airdropTokens} KING</strong>
              </div>
            </div>

            <div className="stat-card">
              <Award size={22} className="purple" />
              <div>
                <small>Rango de Reclutador</small>
                <strong>
                  {stats.referralsCount >= 10
                    ? '👑 Señor Supremo'
                    : stats.referralsCount >= 3
                    ? '⚔️ Capitán de Huestes'
                    : '🛡️ Recluta de Vanguardia'}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECCIÓN 3: TOP 5 DE RECLUTADORES (100 KING + 3 PASES VIP)      */}
        {/* ============================================================== */}
        <section className="wl-top-referrals-section">
          <div className="section-title-wrap">
            <div className="section-badge-icon gold-badge">
              <Trophy size={20} className="gold-icon" />
            </div>
            <div>
              <h2>Top 5 de Reclutadores (Pool Adicional de 100 KING + 3 Pases VIP)</h2>
              <p>
                Los 5 comandantes que traigan más aliados se reparten 100 KING extra y los 3 primeros obtienen Pase VIP Fundador.
              </p>
            </div>
          </div>

          <div className="top-referrals-table-card">
            <div className="table-header-row">
              <span className="col-rank">Posición</span>
              <span className="col-user">Comandante</span>
              <span className="col-code">Código</span>
              <span className="col-refs">Referidos</span>
              <span className="col-prize">Premio Extra</span>
            </div>

            <div className="table-body">
              {topReferrers.map((ref) => {
                const isUser = ref.code === myCode || ref.email === user.email

                return (
                  <div
                    key={ref.rank}
                    className={`table-rank-row rank-${ref.rank} ${isUser ? 'current-user-row' : ''}`}
                  >
                    <div className="col-rank">
                      <span className="rank-tag">{ref.rankLabel}</span>
                    </div>

                    <div className="col-user">
                      <span className="user-name">{ref.name}</span>
                      {ref.hasVip && (
                        <span className="vip-badge" title="Pase VIP Fundador Alpha">
                          👑 PASE VIP
                        </span>
                      )}
                      {isUser && <span className="you-pill">TÚ</span>}
                    </div>

                    <div className="col-code">
                      <code>{ref.code}</code>
                    </div>

                    <div className="col-refs">
                      <strong>{ref.referralsCount}</strong> aliados
                    </div>

                    <div className="col-prize">
                      <div className="prize-wrap">
                        <span className="king-amt">+{ref.prizeKing} KING</span>
                        {ref.hasVip && <small className="vip-tag">+ Pase VIP</small>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="table-footer-summary">
              <div className="user-standing-summary">
                <Award size={16} className="gold" />
                <span>
                  Tu récord actual: <strong>{stats.referralsCount} referidos</strong> · Airdrop directo: <strong>{stats.airdropTokens} KING</strong>.
                  {stats.referralsCount < 5
                    ? ' ¡Invita aliados para escalar al Top 5 y ganar hasta 40 KING extra + Pase VIP!'
                    : ' ¡Estás compitiendo en la cima de los 4 Reinos!'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Vincular Aliado si no tiene */}
        {!user.referredBy && (
          <section className="wl-claim-ref-card">
            <div className="claim-ref-info">
              <Sparkles size={20} className="gold-icon" />
              <div>
                <strong>¿Alguien te invitó a FourKingdoms?</strong>
                <p>Ingresa el código de tu aliado para otorgarle sus 5 tokens KING de Airdrop.</p>
              </div>
            </div>

            <form onSubmit={handleApplyReferral} className="claim-ref-form">
              <input
                type="text"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value)}
                placeholder="Ejemplo: FK-AMIGO-9X"
                className="ref-input"
              />
              <button type="submit" className="btn-apply-ref">
                Vincular Aliado (+5 KING)
              </button>
            </form>

            {refMsg && <p className="ref-success-msg">{refMsg}</p>}
            {refError && <p className="ref-error-msg">{refError}</p>}
          </section>
        )}
      </main>
    </div>
  )
}
