import { useState, useEffect } from 'react'
import { Compass, Crown, MapPin, Sparkles, Shield, ArrowRight } from 'lucide-react'
import { authService } from '../services/authService'
import { REGIONAL_KINGDOMS } from '../game/config'

const KINGDOM_DETAILS = {
  north: {
    title: 'Reino del Norte',
    banner: '❄️',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
    borderColor: '#38bdf8',
    textColor: '#7dd3fc',
    lore: 'Gélidas estepas y defensas inquebrantables bajo el manto de la nieve eterna. Los Señores de la Escarcha son maestros de la fortificación y la infantería pesada.',
    capital: 'Capital de Escarcha (-12, 12)',
    quadrantName: 'Cuadrante Noroeste (NW)',
  },
  south: {
    title: 'Reino del Sur',
    banner: '☀️',
    gradient: 'linear-gradient(135deg, #78350f 0%, #1c1917 100%)',
    borderColor: '#f59e0b',
    textColor: '#fde68a',
    lore: 'Tierras fértiles bañadas por el gran río y el sol perpetuo. Hogar de caballeros veloces y una producción de alimentos insuperable.',
    capital: 'Capital de la Corona (12, -12)',
    quadrantName: 'Cuadrante Sureste (SE)',
  },
  east: {
    title: 'Reino del Este',
    banner: '🌅',
    gradient: 'linear-gradient(135deg, #831843 0%, #1e1b4b 100%)',
    borderColor: '#ec4899',
    textColor: '#fbcfe8',
    lore: 'Cuna del Sol Naciente y de las canteras más ricas de piedra y oro. Forjadores legendarios y grandes riquezas comerciales.',
    capital: 'Capital del Sol Naciente (12, 12)',
    quadrantName: 'Cuadrante Noreste (NE)',
  },
  west: {
    title: 'Reino del Oeste',
    banner: '🌑',
    gradient: 'linear-gradient(135deg, #312e81 0%, #09090b 100%)',
    borderColor: '#818cf8',
    textColor: '#c7d2fe',
    lore: 'Acantilados escarpados y bosques sombríos. Tierra de arqueros legendarios, emboscadas nocturnas y disciplina férrea.',
    capital: 'Capital del Ocaso (-12, -12)',
    quadrantName: 'Cuadrante Suroeste (SW)',
  },
}

export default function KingdomAssignmentModal({ user, onKingdomConfirmed }) {
  const [loading, setLoading] = useState(true)
  const [assigned, setAssigned] = useState(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function assign() {
      // Si el usuario ya tenía reino asignado (en objeto o almacenamiento persistente), lo cargamos
      const normEmail = (user?.email || '').toLowerCase()
      const savedKingdom = user?.assignedKingdom || localStorage.getItem(`fk_assigned_kingdom_${normEmail}`)
      const savedCoordRaw = user?.baseCoord || localStorage.getItem(`fk_base_coord_${normEmail}`)
      const savedCoord = authService.normalizeBaseCoord ? authService.normalizeBaseCoord(savedCoordRaw) : (typeof savedCoordRaw === 'string' ? JSON.parse(savedCoordRaw) : savedCoordRaw)

      if (savedKingdom && savedCoord) {
        if (isMounted) {
          setAssigned({
            kingdomKey: savedKingdom,
            baseCoord: savedCoord,
            kingdomData: REGIONAL_KINGDOMS[savedKingdom] || REGIONAL_KINGDOMS.north,
          })
          setLoading(false)
          setTimeout(() => setRevealed(true), 400)
        }
        return
      }

      // Asignar aleatoriamente por la suerte
      setLoading(true)
      const res = await authService.assignRandomKingdom(user?.email)
      if (isMounted) {
        setAssigned(res)
        setLoading(false)
        setTimeout(() => setRevealed(true), 600)
      }
    }

    assign()
    return () => {
      isMounted = false
    }
  }, [user])

  const kInfo = assigned ? KINGDOM_DETAILS[assigned.kingdomKey] : null

  return (
    <div className="modal-overlay forced-modal">
      <div
        className="kingdom-assign-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="assign-header">
          <div className="assign-badge-pulse">
            <Compass size={32} className="spin-slow" />
          </div>
          <p className="auth-eyebrow">LA RUEDA DEL DESTINO HA HABLADO</p>
          <h2>Asignación Territorial</h2>
          <p className="assign-subtitle">
            Cada nuevo soberano es destinado por la suerte a una de las cuatro grandes regiones del continente.
          </p>
        </div>

        {loading ? (
          <div className="assign-loading-box">
            <Sparkles size={28} className="gold-icon pulse" />
            <p>Los dioses están decidiendo tu destino entre los 4 Reinos...</p>
          </div>
        ) : (
          kInfo && (
            <div
              className={`assign-result-box ${revealed ? 'revealed' : ''}`}
              style={{
                background: kInfo.gradient,
                borderColor: kInfo.borderColor,
              }}
            >
              <div className="assign-crest-row">
                <span className="assign-crest-icon">{kInfo.banner}</span>
                <div>
                  <small style={{ color: kInfo.textColor, fontWeight: 800 }}>¡HAS SIDO ASIGNADO AL!</small>
                  <h3 style={{ color: '#ffffff' }}>{kInfo.title}</h3>
                </div>
              </div>

              <p className="assign-lore">{kInfo.lore}</p>

              <div className="assign-stats-grid">
                <div className="assign-stat-item">
                  <MapPin size={16} style={{ color: kInfo.borderColor }} />
                  <div>
                    <strong>Tus Coordenadas:</strong>
                    <span>({assigned.baseCoord.x}, {assigned.baseCoord.y})</span>
                  </div>
                </div>

                <div className="assign-stat-item">
                  <Shield size={16} style={{ color: kInfo.borderColor }} />
                  <div>
                    <strong>Región / Cuadrante:</strong>
                    <span>{kInfo.quadrantName}</span>
                  </div>
                </div>

                <div className="assign-stat-item full-width">
                  <Crown size={16} style={{ color: '#fbbf24' }} />
                  <div>
                    <strong>Capital Regional de Protección:</strong>
                    <span>{kInfo.capital}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="assign-confirm-btn"
                onClick={() => onKingdomConfirmed(assigned)}
              >
                <span>🏰 Tomar Mando de mi Reino y Ver Tutorial</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
