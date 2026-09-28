import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  handleReload = () => {
    // Si hay parámetros con error en la URL, limpiarlos antes de recargar
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (url.searchParams.has('error')) {
          url.searchParams.delete('error')
          url.searchParams.delete('error_code')
          url.searchParams.delete('error_description')
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''))
        }
      }
    } catch {
      // Ignorar errores de URL
    }
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at center, #1b2032 0%, #080b12 100%)',
          color: '#f0e6d2',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          <div style={{
            maxWidth: '480px',
            background: 'rgba(20, 27, 45, 0.95)',
            border: '1px solid rgba(212, 163, 89, 0.35)',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏰</div>
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: '20px',
              fontWeight: '700',
              color: '#f6d896',
              letterSpacing: '0.04em',
            }}>
              Aviso del Reino
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#cbd5e1',
              lineHeight: '1.6',
              margin: '0 0 24px 0',
            }}>
              Se ha detectado un conflicto visual al renderizar la casilla. No se ha perdido ningún dato ni progreso de tu ciudadela.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #d4a359 0%, #a26b2b 100%)',
                color: '#0a0d16',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(212, 163, 89, 0.4)',
                letterSpacing: '0.03em',
              }}
            >
              🔄 Recargar Reino y Mapa
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
