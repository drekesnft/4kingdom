import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  Crown,
  Flame,
  Home,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Wheat,
} from 'lucide-react'
import { authService } from '../services/authService'

const TUTORIAL_STEPS = [
  {
    id: 'castle',
    stepNumber: 1,
    category: 'EDIFICIO PRINCIPAL',
    icon: <Home size={32} className="gold-icon" />,
    title: '🏰 El Castillo (Ciudadela)',
    subtitle: 'El corazón neurálgico y político de tu reino',
    badge: 'Nv.1 Inicial',
    color: '#f59e0b',
    keyPoints: [
      {
        title: 'Nivel Máximo del Reino',
        desc: 'El nivel del Castillo es el límite supremo: ningún otro edificio puede superar el nivel actual de tu Castillo.',
      },
      {
        title: 'Producción Pasiva Continua',
        desc: 'Genera recursos pasivos de Madera, Piedra y Comida automáticamente cada hora, incrementando con cada nivel (hasta +280W / +225S / +335F por hora).',
      },
      {
        title: 'Marchas Militares Simultáneas',
        desc: 'Aumenta el número de escuadrones simultáneos en el mapa: 1 marcha a Nv.1, 2 marchas a Nv.2 y 3 marchas a Nv.4.',
      },
    ],
  },
  {
    id: 'barracks',
    stepNumber: 2,
    category: 'FUERZAS MILITARES',
    icon: <Swords size={32} style={{ color: '#ef4444' }} />,
    title: '⚔️ El Cuartel Militar',
    subtitle: 'Entrena y comanda a los ejércitos de tu soberanía',
    badge: 'Comienza en Nv.0',
    color: '#ef4444',
    keyPoints: [
      {
        title: '¡Requiere Construcción Inicial!',
        desc: 'Empiezas con el Cuartel en Nivel 0. Debes construirlo primero con recursos para poder reclutar tus tropas.',
      },
      {
        title: 'Infantería (Desbloquea en Nv.1)',
        desc: 'Primera línea defensiva. Gran absorción de daño (20%), económica de entrenar y excelente capacidad de carga (50 uds) para saquear y recolectar.',
      },
      {
        title: 'Arqueros (Nv.3) y Caballería (Nv.5)',
        desc: 'Arqueros de retaguardia con daño devastador a distancia y Caballería veloz de segunda línea con gran resistencia y velocidad de marcha.',
      },
    ],
  },
  {
    id: 'granary',
    stepNumber: 3,
    category: 'LOGÍSTICA Y SUSTENTO',
    icon: <Wheat size={32} style={{ color: '#84cc16' }} />,
    title: '🌾 El Granero y Logística',
    subtitle: 'Almacena provisiones y previene la deserción del ejército',
    badge: 'Gestión Vital',
    color: '#84cc16',
    keyPoints: [
      {
        title: 'Mantenimiento de Alimentos',
        desc: 'Tus tropas consumen comida por hora en la base (Infantería: 1/h, Arquero: 1/h, Caballería: 2/h). Vigila siempre que tu balance neto sea positivo.',
      },
      {
        title: 'Deserción por Hambruna',
        desc: 'Si acumulas más de 1 hora continua con balance de comida en 0, tus tropas empezarán a desertar progresivamente hasta restaurar el balance.',
      },
      {
        title: 'Capacidad Logística y Tropas Productivas',
        desc: 'Define el límite de tropas que pueden sostenerse con máxima eficiencia para minería y generación de tokens KING.',
      },
    ],
  },
  {
    id: 'treasury',
    stepNumber: 4,
    category: 'ECONOMÍA Y BÓVEDA',
    icon: <Coins size={32} style={{ color: '#fbbf24' }} />,
    title: '🏛️ La Tesorería (Bóveda)',
    subtitle: 'Protege tu riqueza y administra tus tokens KING',
    badge: 'Seguridad Financiera',
    color: '#fbbf24',
    keyPoints: [
      {
        title: 'Protección Anti-Saqueo PvP',
        desc: 'El KING guardado en tu Tesorería está protegido bajo candado: si otro jugador asalta tu reino, tus fondos protegidos no pueden ser robados (hasta 700 KING protegidos a Nv.5).',
      },
      {
        title: 'Capacidad de Retiro Diario',
        desc: 'Determina el tope de tokens KING que puedes retirar o transferir de forma segura cada 24 horas.',
      },
      {
        title: 'Acumulación de Recompensas',
        desc: 'Reúne las ganancias de expediciones, combates y bonificaciones de clan listas para reclamar.',
      },
    ],
  },
  {
    id: 'wall',
    stepNumber: 5,
    category: 'DEFENSA PERIMETRAL',
    icon: <Shield size={32} style={{ color: '#38bdf8' }} />,
    title: '🛡️ La Muralla Defensiva',
    subtitle: 'Fortificación perimetral contra asaltos e invasiones',
    badge: 'Blindaje del Reino',
    color: '#38bdf8',
    keyPoints: [
      {
        title: 'Absorción Defensiva en Asedios',
        desc: 'Proporciona una bonificación pasiva que reduce el daño que reciben tus tropas defensoras (desde +10% a Nv.1 hasta +50% a Nv.5).',
      },
      {
        title: 'Mitigación de Saqueo de Recursos',
        desc: 'Incluso si un asaltante logra vencer a tu guarnición, la muralla reduce hasta en un 25% el botín de madera, piedra y comida que pueden robarte.',
      },
      {
        title: 'Disuasión Militar',
        desc: 'Una muralla de nivel alto incrementa notablemente tu Poder de Reino (⭐), desincentivando ataques de jugadores rivales.',
      },
    ],
  },
  {
    id: 'king_token',
    stepNumber: 6,
    category: 'ECONOMÍA WEB3',
    icon: <Sparkles size={32} className="gold-icon" />,
    title: '💎 ¿Cómo se genera el Token KING?',
    subtitle: 'Las 4 fuentes oficiales para acumular KING jugando',
    badge: 'Tokenomics',
    color: '#eab308',
    keyPoints: [
      {
        title: '1. Producción Pasiva por Ejército Activo',
        desc: 'Tus tropas entrenadas y alimentadas dentro de la capacidad de tu Granero generan un saldo estimado diario de KING acumulable.',
      },
      {
        title: '2. Asaltos a Campamentos Hostiles (NPC Nv.1 a 5)',
        desc: 'Derrotar bandidos y señores de la guerra en el mapa tiene una probabilidad de soltar tokens KING de forma directa (hasta 5 KING en Nv.5).',
      },
      {
        title: '3. Expediciones Legendarias del Héroe',
        desc: 'Envía a tu héroe en misiones de alto riesgo a ruinas remotas para conseguir recompensas y la probabilidad de 1 token KING directo.',
      },
      {
        title: '4. Conquista de Fortalezas y Capitales con tu Clan',
        desc: 'El control de las capitales de los 4 Reinos y las fortalezas fronterizas otorga regalías colectivas en KING a los miembros del clan.',
      },
    ],
  },
  {
    id: 'rankings',
    stepNumber: 7,
    category: 'COMPETICIÓN DIARIA',
    icon: <Trophy size={32} style={{ color: '#f59e0b' }} />,
    title: '🏆 Top 5 del Reparto Diario de Poder',
    subtitle: 'Distribución cada 24 horas del pool de recompensa en KING',
    badge: 'Ranking Continental',
    color: '#f59e0b',
    keyPoints: [
      {
        title: 'Pool Diario de Clasificación (70,000 KING)',
        desc: 'Cada 24 horas, el sistema toma una instantánea del Poder Militar Total (⭐) de todos los reinos y premia a los 5 mejores del continente:',
      },
      {
        title: 'Premios del Top 5 Diario',
        desc: '🥇 1º Lugar: 15 KING · 🥈 2º Lugar: 10 KING · 🥉 3º Lugar: 7 KING · 🎖️ 4º Lugar: 5 KING · 🎖️ 5º Lugar: 3 KING directamente acreditados a su saldo.',
      },
      {
        title: '¿Cómo escalar posiciones en el Top 5?',
        desc: 'Mejora tu Castillo a niveles superiores, construye y fortifica tus 4 estructuras de apoyo y entrena macroejércitos en el Cuartel para disparar tu Poder ⭐.',
      },
    ],
  },
]

export default function OnboardingModal({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const step = TUTORIAL_STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === TUTORIAL_STEPS.length - 1

  const handleNext = async () => {
    if (isLast) {
      setLoading(true)
      try {
        await authService.completeOnboarding(user?.email)
      } catch (err) {
        console.warn('Error saving onboarding in backend:', err)
      } finally {
        setLoading(false)
        onComplete()
      }
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  return (
    <div className="modal-overlay forced-modal">
      <div
        className="onboarding-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* Barra superior con progreso */}
        <div className="onboarding-top-bar">
          <div className="onboarding-step-indicator">
            <span className="step-pill">
              PASO {step.stepNumber} DE {TUTORIAL_STEPS.length}
            </span>
            <span className="category-pill" style={{ color: step.color }}>
              {step.category}
            </span>
          </div>

          <div className="onboarding-dots">
            {TUTORIAL_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`dot-btn ${idx === currentStep ? 'active' : ''} ${
                  idx < currentStep ? 'completed' : ''
                }`}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Encabezado del paso */}
        <div className="onboarding-header">
          <div
            className="onboarding-icon-box"
            style={{ borderColor: step.color, background: `${step.color}15` }}
          >
            {step.icon}
          </div>
          <div>
            <div className="onboarding-title-wrap">
              <h2 id="onboarding-title">{step.title}</h2>
              <span className="onboarding-badge">{step.badge}</span>
            </div>
            <p className="onboarding-subtitle">{step.subtitle}</p>
          </div>
        </div>

        {/* Lista de Puntos Clave */}
        <div className="onboarding-content-scroll">
          <div className="onboarding-points-list">
            {step.keyPoints.map((pt, idx) => (
              <div key={idx} className="onboarding-point-card">
                <div className="point-icon-col">
                  <CheckCircle2 size={18} style={{ color: step.color }} />
                </div>
                <div className="point-text-col">
                  <strong>{pt.title}</strong>
                  <p>{pt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controles de Navegación Inferiores */}
        <div className="onboarding-footer">
          <button
            type="button"
            className="btn-onboard-nav prev"
            onClick={handlePrev}
            disabled={isFirst}
          >
            <ArrowLeft size={16} />
            <span>Anterior</span>
          </button>

          <button
            type="button"
            className={`btn-onboard-nav next ${isLast ? 'finish' : ''}`}
            onClick={handleNext}
            disabled={loading}
          >
            <span>
              {loading
                ? 'Sincronizando Backend...'
                : isLast
                ? '⚔️ ¡Comenzar Conquista en FourKingdoms!'
                : 'Siguiente'}
            </span>
            {!isLast && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
