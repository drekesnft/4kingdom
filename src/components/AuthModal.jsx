import { useState, useEffect } from 'react'
import { Lock, Mail, ShieldAlert, Sparkles, X, Flame, Coins, Users, ArrowLeft, Check } from 'lucide-react'
import { authService, getUrlReferralCode } from '../services/authService'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="google-svg-icon" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.36 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  )
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState(() => getUrlReferralCode())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHypeWhitelist, setShowHypeWhitelist] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const urlRef = getUrlReferralCode()
      if (urlRef) setReferralCode(urlRef)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Manejo de Inicio de Sesión / Validación de Acceso
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await authService.login(email, password)
      if (res.success) {
        onLoginSuccess(res.user)
      } else if (res.notRegistered) {
        // Correo no registrado -> Activar Pantalla de Alto Hype de Whitelist
        setShowHypeWhitelist(true)
      } else {
        setError(res.error || 'Credenciales no válidas. Verifica tu contraseña.')
      }
    } catch (err) {
      console.error('[AuthModal] Error al procesar login:', err)
      setError('Error al conectar con el servidor de autenticación.')
    } finally {
      setLoading(false)
    }
  }

  // Manejo de Registro en Whitelist con Email
  const handleRegisterWhitelist = async () => {
    if (!email || !email.includes('@')) {
      setError('Ingresa un correo electrónico válido para unirte a la Whitelist.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await authService.registerWhitelist({
        email,
        provider: 'email',
        referralCode,
      })
      if (res.success) {
        onLoginSuccess(res.user)
      } else {
        setError(res.error || 'No se pudo completar el registro en Whitelist.')
      }
    } catch (err) {
      console.error('[AuthModal] Error registrando en Whitelist:', err)
      setError('Fallo de conexión al registrar en Whitelist.')
    } finally {
      setLoading(false)
    }
  }

  // Flujo de Registro / Acceso Directo con Google OAuth
  const handleGoogleClick = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await authService.loginWithGoogle(referralCode)
      if (res.redirecting) {
        // Redirección oficial de Google OAuth en curso hacia cuentas de Google
        return
      }
      if (res.success && res.user) {
        onLoginSuccess(res.user)
      } else if (res.error) {
        setError(res.error)
      }
    } catch (err) {
      console.error('[AuthModal] Error en Google Auth:', err)
      setError('Error al autenticar con Google.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`auth-modal-card ${showHypeWhitelist ? 'hype-mode' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>


        {/* ============================================================== */}
        {/* PANTALLA 1: MODAL DE ALTO HYPE PARA WHITELIST                  */}
        {/* ============================================================== */}
        {showHypeWhitelist ? (
          <div className="auth-hype-view">
            <div className="hype-header">
              <img
                src="/assets/ui/logo-fourkingdoms.png"
                alt="FourKingdoms Logo"
                className="auth-logo-img"
              />
              <div className="hype-flame-pill">
                <Flame size={15} className="fire-icon" />
                <span>CUPO ALPHA RESERVADO PARA GOBERNANTES ELEGIDOS</span>
              </div>
              <h2 className="hype-title">¡El Trono de los 4 Reinos te Espera!</h2>
              <p className="hype-story">
                Las puertas de la <strong>Alpha Cerrada</strong> están fuertemente custodiadas, pero la gran guerra por el trono supremo recién comienza.
                <br /><br />
                ¡No te quedes fuera de la historia! Únete a la <strong>Whitelist Oficial</strong> ahora, asegura tu lugar en la vanguardia y acumula un <strong>Airdrop exclusivo de 5 Tokens KING</strong> por cada aliado que reclutes.
              </p>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert">
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="hype-actions-box">
              {/* Botón Principal: Registrar con Google */}
              <button
                type="button"
                className="auth-google-btn-epic"
                onClick={handleGoogleClick}
                disabled={loading}
              >
                <GoogleIcon />
                <span>Registrarme con Google para Whitelist</span>
              </button>

              <div className="auth-divider">
                <span>O asegurar acceso con este correo</span>
              </div>

              <div className="hype-email-confirm-box">
                <div className="email-display-tag">
                  <Mail size={15} />
                  <span>{email}</span>
                </div>

                <div className="ref-optional-input">
                  <label htmlFor="ref-input-opt">¿Tienes código de referido? (Opcional):</label>
                  <input
                    id="ref-input-opt"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Ejemplo: FK-ANTO-77"
                  />
                </div>

                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={handleRegisterWhitelist}
                  disabled={loading}
                >
                  {loading ? 'Asegurando puesto...' : '🛡️ Acceder a Whitelist y Reclamar Airdrop'}
                </button>
              </div>

              <button
                type="button"
                className="btn-back-to-login"
                onClick={() => setShowHypeWhitelist(false)}
              >
                <ArrowLeft size={14} /> Volver a intentar con otra cuenta
              </button>
            </div>

            <div className="hype-footer-badge">
              <Coins size={14} className="gold-icon" />
              <span>5 Tokens KING de Airdrop por cada referido + Escudo de Paz Día 1</span>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* PANTALLA 2: FORMULARIO DE ACCESO ALPHA LIMPIO Y ELEGANTE       */
          /* ============================================================== */
          <>
            <div className="auth-modal-header">
              <img
                src="/assets/ui/logo-fourkingdoms.png"
                alt="FourKingdoms Logo"
                className="auth-logo-img"
              />
              <p className="auth-eyebrow">ACCESO PRIVADO ALPHA</p>
              <h2 id="auth-modal-title">Iniciar Sesión en tu Reino</h2>
              <p className="auth-subtitle">
                Ingresa con tu correo asignado y tu clave para acceder a la conquista.
              </p>
            </div>

            {error && (
              <div className="auth-error-banner" role="alert">
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Botón de Acceso Rápido con Google */}
            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleClick}
              disabled={loading}
            >
              <GoogleIcon />
              <span>Continuar o Registrar con Google</span>
            </button>

            <div className="auth-divider">
              <span>O ingresa con tu correo</span>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-input-group">
                <label htmlFor="auth-email">Correo Electrónico</label>
                <div className="auth-input-wrap">
                  <Mail size={16} className="input-icon" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label htmlFor="auth-password">Contraseña o Clave Temporal</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu clave de acceso"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? 'Verificando con Backend...' : '🛡️ Acceder a mi Reino'}
              </button>
            </form>

            <div className="auth-footer-note">
              <small>
                Validación gobernada por Backend · Si no estás en la lista Alpha, se habilitará tu registro en la Whitelist Oficial con Airdrop de 5 KING.
              </small>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
