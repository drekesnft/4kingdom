import { useState, useEffect } from 'react'
import {
  Clock,
  Crown,
  Coins,
  Shield,
  Swords,
  Trophy,
  ArrowLeft,
  LogOut,
  Sparkles,
  Flame,
  CheckCircle2,
} from 'lucide-react'
import { ALPHA_LAUNCH_CONFIG } from '../game/config'

export default function PreLaunchModal({ user, onEnter, onBackToLanding, onLogout }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const remainingMs = Math.max(0, ALPHA_LAUNCH_CONFIG.LAUNCH_TIMESTAMP - now)
  const isUnlocked = remainingMs <= 0

  const hours = Math.floor(remainingMs / (1000 * 60 * 60))
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000)

  const padZero = (n) => String(n).padStart(2, '0')

  const kingdomName = user?.assignedKingdom === 'north'
    ? '❄️ Reino del Norte'
    : user?.assignedKingdom === 'south'
    ? '☀️ Reino del Sur'
    : user?.assignedKingdom === 'east'
    ? '🌅 Reino del Este'
    : user?.assignedKingdom === 'west'
    ? '🌑 Reino del Oeste'
    : '⏳ Asignación Territorial en Apertura'

  return (
    <div className="prelaunch-screen-root">
      <div className="prelaunch-card">
        {/* Encabezado */}
        <div className="prelaunch-header">
          <img
            src="/assets/ui/logo-fourkingdoms.png"
            alt="FourKingdoms Logo"
            className="prelaunch-logo-img"
          />
          <div className="prelaunch-badge-pill">
            <span className="pulsing-beacon"></span>
            <span>APERTURA OFICIAL ALPHA · 00:00 UTC (18:30 HORA PERÚ)</span>
          </div>

          {isUnlocked ? (
            <div className="unlocked-header-box">
              <h1 className="unlocked-title">⚔️ ¡LOS PORTALES SE HAN ABIERTO!</h1>
              <p className="unlocked-subtitle">
                La gran guerra por el trono ha comenzado. Todos los reinos están activos en el mapa mundial.
              </p>
            </div>
          ) : (
            <>
              <h1 className="prelaunch-title">Inicio Oficial a las 18:30 (Hora Perú)</h1>
              <p className="prelaunch-subtitle">
                Horario oficial del Servidor: <strong>00:00 UTC</strong>. Para garantizar equidad absoluta en el despliegue de tropas y recolección de recursos, las puertas del reino se abrirán simultáneamente.
              </p>
            </>
          )}
        </div>

        {/* Reloj de Cuenta Regresiva */}
        {!isUnlocked ? (
          <div className="prelaunch-countdown-wrap">
            <div className="countdown-grid">
              <div className="countdown-box">
                <span className="countdown-digits">{padZero(hours)}</span>
                <span className="countdown-label">HORAS</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-box">
                <span className="countdown-digits">{padZero(minutes)}</span>
                <span className="countdown-label">MINUTOS</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-box">
                <span className="countdown-digits">{padZero(seconds)}</span>
                <span className="countdown-label">SEGUNDOS</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="prelaunch-action-launch">
            <button
              type="button"
              className="btn-enter-kingdom-epic"
              onClick={onEnter}
            >
              <Swords size={20} />
              <span>⚔️ ¡INGRESAR AHORA A MI REINO!</span>
            </button>
          </div>
        )}

        {/* Tarjeta de Información de Reparto de Tokens por Ranking */}
        <div className="prelaunch-ranking-banner">
          <div className="ranking-banner-icon">
            <Trophy size={24} className="trophy-icon" />
          </div>
          <div className="ranking-banner-text">
            <strong>🏆 Reparto Diario de Ranking: 00:00 UTC</strong>
            <p>
              El pool diario de <strong>40 Tokens KING</strong> se valida y distribuye automáticamente cada día a las <strong>00:00 UTC</strong> entre los 5 gobernantes con mayor poder del continente.
            </p>
          </div>
        </div>

        {/* Ficha de Preparación del Evaluador */}
        {user && (
          <div className="prelaunch-user-card">
            <div className="user-card-header">
              <CheckCircle2 size={16} className="text-green" />
              <span>Gobernador Autorizado para Despliegue</span>
            </div>
            <div className="user-stats-grid">
              <div className="user-stat-cell">
                <small>Cuenta Asignada</small>
                <strong>{user.email}</strong>
              </div>
              <div className="user-stat-cell">
                <small>Balance Inicial</small>
                <strong className="text-gold">🪙 10 KING</strong>
              </div>
              <div className="user-stat-cell">
                <small>Fuerza Militar Inicial</small>
                <strong>⚔️ 10 Infantería</strong>
              </div>
              <div className="user-stat-cell">
                <small>Territorio</small>
                <strong>{kingdomName}</strong>
              </div>
            </div>
            {user.referralCode && (
              <div className="user-ref-cell">
                <small>Tu Código de Referido (+5 KING por aliado):</small>
                <code>{user.referralCode}</code>
              </div>
            )}
          </div>
        )}

        {/* Controles de Navegación Inferiores */}
        <div className="prelaunch-footer-actions">
          {onBackToLanding && (
            <button
              type="button"
              className="btn-prelaunch-back"
              onClick={onBackToLanding}
            >
              <ArrowLeft size={15} /> Volver a la Landing Page
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              className="btn-prelaunch-logout"
              onClick={onLogout}
            >
              <LogOut size={15} /> Cerrar Sesión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
