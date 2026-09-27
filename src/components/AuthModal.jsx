import { useState } from 'react'
import { Crown, Lock, Mail, ShieldAlert, Sparkles, X } from 'lucide-react'
import { authService } from '../services/authService'

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('antoniox4253@gmail.com')
  const [password, setPassword] = useState('k9t4m')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await authService.login(email, password)
      if (res.success) {
        onLoginSuccess(res.user)
      } else {
        setError(res.error || 'Credenciales no válidas.')
      }
    } catch {
      setError('Error al conectar con el servidor de autenticación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        <div className="auth-modal-header">
          <div className="auth-brand-badge">
            <Crown size={28} className="gold-icon" />
          </div>
          <p className="auth-eyebrow">FOURKINGDOMS · ACCESO PRIVADO ALPHA</p>
          <h2 id="auth-modal-title">Iniciar Sesión en tu Reino</h2>
          <p className="auth-subtitle">
            Ingresa con tu correo asignado y tu clave temporal para acceder a la conquista.
          </p>
        </div>

        {/* Badge Informativo de Cuenta de Prueba */}
        <div className="auth-test-pill">
          <Sparkles size={16} className="sparkle-icon" />
          <div>
            <strong>Evaluador Alpha v0.1:</strong>
            <p>
              Cuenta habilitada: <code>antoniox4253@gmail.com</code>
              <br />
              Clave temporal: <code>k9t4m</code>
            </p>
          </div>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

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
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Clave de 5 caracteres"
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
            Validación gobernada por Backend · Al acceder por primera vez se te solicitará cambiar tu clave temporal por seguridad.
          </small>
        </div>
      </div>
    </div>
  )
}
