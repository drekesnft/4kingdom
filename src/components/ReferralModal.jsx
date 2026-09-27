import { useState, useEffect } from 'react'
import {
  Crown,
  Coins,
  Copy,
  Check,
  Users,
  Award,
  X,
  Share2,
  Send,
  MessageCircle,
  Flame,
  Sparkles,
  Trophy,
  Shield,
  Package,
  Swords,
} from 'lucide-react'
import {
  authService,
  COMMUNITY_MILESTONES,
  TOP_REFERRAL_PRIZES,
} from '../services/authService'

export default function ReferralModal({ isOpen, onClose, user }) {
  if (!isOpen) return null

  const [activeTab, setActiveTab] = useState('referral') // 'referral' | 'milestones' | 'leaderboard'
  const [stats, setStats] = useState(() => authService.getReferralStats(user?.email || ''))
  const [totalPreReg, setTotalPreReg] = useState(() => authService.getGlobalPreRegistrationCount())
  const [topReferrers, setTopReferrers] = useState(() => authService.getTopReferrers())

  useEffect(() => {
    let isMounted = true
    async function loadDynamic() {
      try {
        const [realCount, realStats, realLeaders] = await Promise.all([
          authService.fetchGlobalPreRegistrationCount(),
          authService.fetchReferralStats(user?.email || ''),
          authService.fetchTopReferrers(),
        ])
        if (isMounted) {
          setTotalPreReg(realCount)
          setStats(realStats)
          setTopReferrers(realLeaders)
        }
      } catch (err) {
        console.error('[ReferralModal] Error cargando datos dinámicos:', err)
      }
    }
    loadDynamic()
    return () => {
      isMounted = false
    }
  }, [user?.email])

  const myCode = stats.referralCode || user?.referralCode || 'FK-ALPHA-WAR'
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${myCode}`
    : `https://fourkingdoms.online/?ref=${myCode}`

  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

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
      `⚔️ ¡Estoy jugando la Alpha de @FourKingdoms! 👑\nUsa mi código oficial de comandante ${myCode} para unirte a la Whitelist y ganar 5 tokens KING de Airdrop:\n${shareUrl}`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `⚔️ ¡Únete a la Whitelist de FourKingdoms con mi código de Alpha ${myCode} y asegura tu Airdrop de 5 tokens KING!:\n${shareUrl}`
    )
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank')
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `👑 ¡Entra a la Whitelist de FourKingdoms conmigo! Usa mi código *${myCode}* y recibe 5 tokens KING de Airdrop:\n${shareUrl}`
    )
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="referral-modal-card in-game-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="referral-modal-close"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="referral-modal-header">
          <div className="referral-crown-badge">
            <Coins size={28} className="gold-icon" />
          </div>
          <span className="ref-tag">PANEL DE COMANDANTE ALPHA</span>
          <h2>Airdrop de Referidos & Hitos Comunitarios</h2>
          <p>
            Como gobernante oficial de la Alpha, tus referidos te otorgan <strong>5 tokens KING</strong> para tu Tesorería/Vault y compites por el Top 5 de Reclutadores.
          </p>
        </div>

        {/* Tabs de Navegación */}
        <div className="modal-subtabs">
          <button
            type="button"
            className={activeTab === 'referral' ? 'active' : ''}
            onClick={() => setActiveTab('referral')}
          >
            🎁 Mi Airdrop (5 KING)
          </button>
          <button
            type="button"
            className={activeTab === 'milestones' ? 'active' : ''}
            onClick={() => setActiveTab('milestones')}
          >
            🎯 Hitos (cada 500)
          </button>
          <button
            type="button"
            className={activeTab === 'leaderboard' ? 'active' : ''}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 Top 5 Reclutadores
          </button>
        </div>

        {/* ============================================================== */}
        {/* PESTAÑA 1: MI CÓDIGO Y AIRDROP                                 */}
        {/* ============================================================== */}
        {activeTab === 'referral' && (
          <div className="tab-pane-content">
            <div className="ref-modal-metrics">
              <div className="metric-item">
                <small>Aliados Reclutados</small>
                <strong>{stats.referralsCount} Gobernantes</strong>
              </div>
              <div className="metric-item gold">
                <small>Airdrop Acumulado</small>
                <strong>{stats.airdropTokens} KING</strong>
              </div>
            </div>

            <div className="ref-code-card">
              <small>Tu Código de Referencia Alpha:</small>
              <div className="ref-code-row">
                <span className="code-text">{myCode}</span>
                <button
                  type="button"
                  className={`btn-copy-ref ${copiedCode ? 'copied' : ''}`}
                  onClick={handleCopyCode}
                >
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedCode ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="ref-link-card">
              <small>Enlace de Invitación Directo:</small>
              <div className="ref-link-row">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`btn-copy-ref ${copiedLink ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="ref-social-actions">
              <button type="button" className="btn-social-tw" onClick={handleShareTwitter}>
                𝕏 Twitter
              </button>
              <button type="button" className="btn-social-tg" onClick={handleShareTelegram}>
                <Send size={13} /> Telegram
              </button>
              <button type="button" className="btn-social-wa" onClick={handleShareWhatsApp}>
                <MessageCircle size={13} /> WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: HITOS COMUNITARIOS CADA 500                         */}
        {/* ============================================================== */}
        {activeTab === 'milestones' && (
          <div className="tab-pane-content milestones-modal-pane">
            <div className="in-modal-counter">
              <Users size={18} className="gold" />
              <span>Gobernantes Registrados: <strong>{totalPreReg}</strong></span>
            </div>

            <div className="modal-milestones-list">
              {COMMUNITY_MILESTONES.map((m) => {
                const isUnlocked = totalPreReg >= m.target
                const pct = Math.min(100, Math.round((totalPreReg / m.target) * 100))

                return (
                  <div
                    key={m.target}
                    className={`modal-milestone-item ${isUnlocked ? 'unlocked' : ''}`}
                  >
                    <div className="milestone-badge-top">
                      <span className="target-num">🎯 {m.target} REGISTROS</span>
                      <span className={`status-badge ${isUnlocked ? 'done' : 'prog'}`}>
                        {isUnlocked ? '✅ Desbloqueado' : `${pct}%`}
                      </span>
                    </div>
                    <strong>{m.title}</strong>
                    <p>{m.reward}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: TOP 5 DE RECLUTADORES                               */}
        {/* ============================================================== */}
        {activeTab === 'leaderboard' && (
          <div className="tab-pane-content leaderboard-modal-pane">
            <div className="leaderboard-pool-banner">
              <Trophy size={18} className="gold" />
              <div>
                <strong>Pool de Reclutamiento: 100 KING + 3 Pases VIP</strong>
                <small>Repartido entre los 5 mayores reclutadores</small>
              </div>
            </div>

            <div className="modal-rankings-list">
              {topReferrers.map((r) => {
                const isMe = r.code === myCode

                return (
                  <div key={r.rank} className={`modal-rank-item ${isMe ? 'is-me' : ''}`}>
                    <span className="rank-pos">{r.rankLabel}</span>
                    <div className="rank-name-box">
                      <strong>{r.name}</strong>
                      <small>{r.code}</small>
                    </div>
                    <span className="rank-refs-count">{r.referralsCount} refs</span>
                    <div className="rank-prize-badge">
                      <span>+{r.prizeKing} KING</span>
                      {r.hasVip && <small>+ VIP</small>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
