import { useState } from 'react'
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
} from 'lucide-react'
import { authService } from '../services/authService'

export default function ReferralModal({ isOpen, onClose, user }) {
  if (!isOpen) return null

  const stats = authService.getReferralStats(user?.email || '')
  const myCode = stats.referralCode || user?.referralCode || 'FK-ALPHA-WAR'
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${myCode}`
    : `https://fourkingdoms.io/?ref=${myCode}`

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
      `⚔️ ¡Estoy jugando la Alpha de @FourKingdoms! 👑\nUsa mi código de comandante ${myCode} para asegurar tu puesto en la Whitelist y ganar 5 tokens KING de Airdrop:\n${shareUrl}`
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
      `👑 ¡Entra a la Whitelist de FourKingdoms conmigo! Usa mi código *${myCode}* y recibe tokens KING de Airdrop:\n${shareUrl}`
    )
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="referral-modal-card"
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

        <div className="referral-modal-header">
          <div className="referral-crown-badge">
            <Coins size={30} className="gold-icon" />
          </div>
          <span className="ref-tag">PROGRAMA DE EMBAJADORES ALPHA</span>
          <h2>Airdrop de Reclutamiento: 5 KING por Aliado</h2>
          <p>
            Como gobernante oficial de la Alpha, cada amigo que invites a la Whitelist te genera <strong>5 tokens KING</strong> para tu Tesorería/Vault.
          </p>
        </div>

        {/* Resumen de Métricas */}
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

        {/* Tarjeta de Código */}
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

        {/* Enlace de Invitación */}
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

        {/* Botones de Compartir */}
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
    </div>
  )
}
