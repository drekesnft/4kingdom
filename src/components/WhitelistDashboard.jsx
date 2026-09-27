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
} from 'lucide-react'
import { authService, getUrlReferralCode } from '../services/authService'

export default function WhitelistDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(() => authService.getReferralStats(user.email))
  const [totalPreReg, setTotalPreReg] = useState(() => authService.getGlobalPreRegistrationCount())
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [referralInput, setReferralInput] = useState('')
  const [refMsg, setRefMsg] = useState('')
  const [refError, setRefError] = useState('')

  const myCode = stats.referralCode || user.referralCode || 'FK-SOVEREIGN'
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${myCode}`
    : `https://fourkingdoms.io/?ref=${myCode}`

  // Simular pulso de nuevos gobernantes cada pocos segundos para hype
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalPreReg(authService.getGlobalPreRegistrationCount() + Math.floor(Math.random() * 3))
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    } catch {
      // Fallback
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // Fallback
    }
  }

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `⚔️ ¡He asegurado mi puesto en la Whitelist Oficial de @FourKingdoms! 👑\nÚnete a mi clan antes del lanzamiento y reclama 5 tokens KING de Airdrop:\n${shareUrl}`
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
      `👑 ¡Entra a la Whitelist de FourKingdoms conmigo! Usa mi código *${myCode}* y recibe tokens KING de Airdrop:\n${shareUrl}`
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

    // Registrar referido
    const res = await authService.registerWhitelist({
      email: user.email,
      provider: user.provider || 'google',
      referralCode: normalized,
    })

    if (res.rewardedReferrer) {
      setRefMsg(`¡Excelente! Código ${normalized} vinculado con éxito. Tu aliado ha recibido 5 tokens KING.`)
      setStats(authService.getReferralStats(user.email))
      setReferralInput('')
    } else {
      setRefMsg(`Código ${normalized} guardado en tu registro de Whitelist.`)
      setReferralInput('')
    }
  }

  // Progreso de hito hacia 25,000
  const progressPercent = Math.min(100, Math.round((totalPreReg / 25000) * 100))

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
        {/* Hero Section */}
        <section className="wl-hero-card">
          <div className="wl-hero-badge">
            <Flame size={14} className="fire-icon" />
            <span>LANZAMIENTO OFICIAL · 29 DE SEPTIEMBRE DE 2026 (00:00 UTC)</span>
          </div>

          <h1 className="wl-hero-title">
            ¡Has Asegurado tu Trono en la Whitelist Oficial!
          </h1>
          <p className="wl-hero-desc">
            Las puertas de la Alpha Cerrada están fuertemente protegidas mientras los primeros comandantes auditan los reinos. Tu cuenta ha sido inscrita en la <strong>Vanguardia de Honor</strong> para el desembarco masivo.
          </p>

          {/* Contador Masivo de Pre-Registros */}
          <div className="wl-counter-banner">
            <div className="wl-counter-header">
              <span className="live-indicator">
                <span className="pulsing-dot"></span> EN VIVO
              </span>
              <span className="counter-label">Gobernantes Pre-Registrados en los 4 Reinos:</span>
            </div>

            <div className="wl-big-number">
              <Users size={32} className="gold" />
              <span>{totalPreReg.toLocaleString()}</span>
              <small>SEÑORES DE LA GUERRA</small>
            </div>

            {/* Barra de Hitos */}
            <div className="wl-milestone-wrap">
              <div className="wl-milestone-bar-bg">
                <div
                  className="wl-milestone-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="wl-milestone-steps">
                <span className="step unlocked">✅ 10K: Escudo de Paz 24h</span>
                <span className="step current">🎯 25K: +500 Madera & Piedra</span>
                <span className="step locked">🔒 50K: Sorteo 1,000 KING</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sección Épica de Airdrop por Referidos (5 TOKENS POR REFERIDO) */}
        <section className="wl-referral-epic-card">
          <div className="wl-section-header">
            <div className="wl-title-icon-wrap">
              <Coins size={26} className="gold-icon pulse" />
              <div>
                <h2>Airdrop de Reclutamiento: 5 Tokens KING por Aliado</h2>
                <p>
                  Cada gobernante que se registre en la Whitelist con tu código te otorga <strong>5 Tokens KING</strong> asegurados para tu Vault en el lanzamiento.
                </p>
              </div>
            </div>
            <div className="wl-airdrop-total-pill">
              <Coins size={18} className="gold-icon" />
              <div>
                <small>Tu Airdrop Acumulado:</small>
                <strong>{stats.airdropTokens} KING</strong>
              </div>
            </div>
          </div>

          {/* Tarjeta de Código y Enlace de Referido */}
          <div className="wl-codes-grid">
            {/* Código Personal */}
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
              <small>Comparte este código con tus aliados o miembros de tu gremio.</small>
            </div>

            {/* Enlace Directo */}
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
              <small>Al hacer clic en tu enlace, tu código se aplicará automáticamente.</small>
            </div>
          </div>

          {/* Botones de Compartir Rápido (1 Clic) */}
          <div className="wl-social-share-row">
            <span className="share-prompt">Compartir en Redes:</span>
            <button
              type="button"
              className="social-btn btn-twitter"
              onClick={handleShareTwitter}
            >
              <span>𝕏 Compartir en Twitter / X</span>
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

          {/* Estadísticas de Reclutamiento */}
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

        {/* Sección de Vincular Código si alguien lo invitó */}
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
                Vincular Aliado
              </button>
            </form>

            {refMsg && <p className="ref-success-msg">{refMsg}</p>}
            {refError && <p className="ref-error-msg">{refError}</p>}
          </section>
        )}

        {/* Beneficios Garantizados del Pase Whitelist */}
        <section className="wl-perks-grid">
          <div className="perk-box">
            <Shield size={22} className="gold" />
            <h4>Escudo de Paz 24h</h4>
            <p>Inmune a asaltos en tu primera sesión para construir tu base sin peligro.</p>
          </div>

          <div className="perk-box">
            <Crown size={22} className="gold" />
            <h4>Reserva de Coordenada</h4>
            <p>Prioridad para ubicar tu reino en los cuadrantes Norte, Sur, Este u Oeste.</p>
          </div>

          <div className="perk-box">
            <Coins size={22} className="gold" />
            <h4>Airdrop Directo a Vault</h4>
            <p>Tus tokens ganados por referidos se transferirán de forma segura en el TGE.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
