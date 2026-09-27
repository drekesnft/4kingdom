import { useState } from 'react'
import { KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { authService } from '../services/authService'

export default function ChangePasswordModal({ user, onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 5) {
      setError('La nueva contraseña debe tener al menos 5 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.')
      return
    }

    setLoading(true)
    try {
      const res = await authService.changePassword(user.email, newPassword)
      if (res.success) {
        onPasswordChanged(res.user)
      } else {
        setError(res.error || 'Error al actualizar la contraseña en el backend.')
      }
    } catch {
      setError('Fallo de conexión al actualizar contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay forced-modal">
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pass-title"
      >
        <div className="auth-modal-header">
          <div className="auth-brand-badge lock-badge">
            <KeyRound size={28} className="gold-icon" />
          </div>
          <p className="auth-eyebrow">PASO 1 DE SEGURIDAD</p>
          <h2 id="change-pass-title">Cambio de Contraseña Obligatorio</h2>
          <p className="auth-subtitle">
            Has ingresado con la clave temporal generada para <strong>{user?.email}</strong>.
            Por seguridad, debes establecer tu nueva contraseña personal para continuar.
          </p>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group">
            <label htmlFor="new-password">Nueva Contraseña (mínimo 5 caracteres)</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Escribe tu nueva clave"
                required
                minLength={5}
                autoFocus
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="confirm-password">Confirmar Nueva Contraseña</label>
            <div className="auth-input-wrap">
              <ShieldCheck size={16} className="input-icon" />
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva clave"
                required
                minLength={5}
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Guardando en Backend...' : '🔒 Guardar Contraseña y Continuar'}
          </button>
        </form>

        <div className="auth-footer-note">
          <small>
            Tu nueva clave quedará almacenada de forma segura en el backend y la necesitarás en tus próximos inicios de sesión.
          </small>
        </div>
      </div>
    </div>
  )
}
