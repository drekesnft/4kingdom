import { useState, useEffect } from 'react'
import {
  Check,
  Coins,
  Crown,
  Flame,
  Home,
  LogOut,
  Pickaxe,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
  TrendingUp,
  User,
} from 'lucide-react'
import '../landing.css'
import AuthModal from './AuthModal'
import { authService } from '../services/authService'

export default function LandingPage({ onPlay }) {
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser())
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser())
  }, [])

  const handlePlayClick = () => {
    if (currentUser) {
      onPlay(currentUser)
    } else {
      setShowAuthModal(true)
    }
  }

  const handleLogout = () => {
    authService.logout()
    setCurrentUser(null)
  }

  const kingdomLabel = currentUser?.assignedKingdom === 'north'
    ? '❄️ Reino del Norte'
    : currentUser?.assignedKingdom === 'south'
    ? '☀️ Reino del Sur'
    : currentUser?.assignedKingdom === 'east'
    ? '🌅 Reino del Este'
    : currentUser?.assignedKingdom === 'west'
    ? '🌑 Reino del Oeste'
    : '⏳ Reino Pendiente'

  return (
    <div className="landing-page">
      {/* Top Header */}
      <header className="landing-header">
        <div className="landing-logo">
          <img
            src="/assets/landing/logo-fourkingdoms.png"
            alt="FourKingdoms"
            className="header-logo-img"
          />
        </div>
        <nav className="landing-nav">
          <a href="#gameplay">Gameplay</a>
          <a href="#reinos">Cuatro Reinos</a>
          <a href="#economia">Economía</a>
          <a href="#guerra">Guerra de Clanes</a>
          <a href="#packs">Packs de Inicio</a>
        </nav>
        {currentUser ? (
          <div className="landing-user-badge">
            <div className="user-info-text">
              <span className="user-email-tag">{currentUser.email}</span>
              <span className="user-kingdom-tag">{kingdomLabel}</span>
            </div>
            <button type="button" className="btn-gold" onClick={handlePlayClick}>
              Continuar Partida
            </button>
            <button
              type="button"
              className="btn-logout-landing"
              onClick={handleLogout}
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button type="button" className="btn-gold" onClick={() => setShowAuthModal(true)}>
            Iniciar Sesión
          </button>
        )}
      </header>

      <main className="landing-wrap">
        {/* Hero Banner */}
        <section className="hero-banner">
          <img
            src="/assets/landing/hero-castle.png"
            alt="FourKingdoms Castle"
            className="hero-banner-image"
          />
          <div className="hero-banner-overlay">
            <div className="hero-content">
              <div className="hero-logo-frame">
                <img
                  src="/assets/landing/logo-fourkingdoms.png"
                  alt="FourKingdoms Logo"
                  className="hero-logo-img"
                />
              </div>
              <div className="hero-subtitle">CONQUISTA · CONSTRUYE · GOBIERNA</div>
              <p className="hero-description">
                Un juego de estrategia medieval en tiempo real. Cuatro reinos en guerra constante.
                Funda tu reino, entrena macroejércitos y compite por el trono supremo.
              </p>
              <div className="hero-actions">
                <button type="button" className="btn-gold" onClick={handlePlayClick}>
                  Jugar ahora
                </button>
                <button type="button" className="btn-outline" onClick={handlePlayClick}>
                  <Play size={16} fill="currentColor" />
                  Ver Gameplay
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 1. Gameplay / Features */}
        <section id="gameplay" className="section-container">
          <div className="section-header">
            <div className="eyebrow">ESTRATEGIA TOTAL</div>
            <h2>Mecánicas de Juego</h2>
            <p>
              Gestiona tu ciudadela, entrena divisiones militares y lidera asedios estratégicos en
              un mundo dinámico y persistente.
            </p>
          </div>

          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-media">
                <img src="/assets/landing/feature-build.png" alt="Construye tu reino" />
              </div>
              <div className="feature-info">
                <div className="feature-icon-box">
                  <Home size={19} />
                </div>
                <div className="feature-text">
                  <h3>Construye</h3>
                  <p>Mejora Castillo, Cuartel, Granero, Tesorería y Murallas defensivas.</p>
                </div>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-media">
                <img src="/assets/landing/feature-train.png" alt="Entrena tu ejército" />
              </div>
              <div className="feature-info">
                <div className="feature-icon-box">
                  <Swords size={19} />
                </div>
                <div className="feature-text">
                  <h3>Entrena</h3>
                  <p>Infantería pesada, Arqueros de precisión y Caballería de choque.</p>
                </div>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-media">
                <img src="/assets/landing/feature-gather.png" alt="Recolecta recursos" />
              </div>
              <div className="feature-info">
                <div className="feature-icon-box">
                  <Coins size={19} />
                </div>
                <div className="feature-text">
                  <h3>Recolecta</h3>
                  <p>Asegura madera, piedra y comida para sustentar a tu población.</p>
                </div>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-media">
                <img src="/assets/landing/feature-conquer.png" alt="Conquista fortalezas" />
              </div>
              <div className="feature-info">
                <div className="feature-icon-box">
                  <Shield size={19} />
                </div>
                <div className="feature-text">
                  <h3>Conquista</h3>
                  <p>Derriba murallas enemigas con maquinaria de asedio y toma el control.</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* 2. Cuatro Reinos (GRAN PROTAGONISMO) */}
        <section id="reinos" className="section-container">
          <div className="section-header">
            <div className="eyebrow">TERRITORIOS & CLANES</div>
            <h2>Los Cuatro Reinos</h2>
            <p>
              Cuatro facciones ancestrales dominan el continente. Cada reino posee su propia
              filosofía de combate, geografía y ventajas económicas.
            </p>
          </div>

          <div className="kingdoms-showcase">
            <div className="kingdoms-cards-list">
              <div className="kingdom-card norte" onClick={handlePlayClick}>
                <div className="kingdom-badge-icon">🦁</div>
                <div className="kingdom-details">
                  <h3>Reino del Norte · Clan del León</h3>
                  <p>Disciplina militar inquebrantable en las fortalezas de hielo.</p>
                  <span className="kingdom-bonus-pill">+15% Resistencia en Muralla</span>
                </div>
                <ShieldCheck size={20} color="#60a5fa" />
              </div>

              <div className="kingdom-card este" onClick={handlePlayClick}>
                <div className="kingdom-badge-icon">🐉</div>
                <div className="kingdom-details">
                  <h3>Reino del Este · Clan del Dragón</h3>
                  <p>Fuerza agresiva y vanguardia ofensiva para expansión territorial.</p>
                  <span className="kingdom-bonus-pill">+10% Daño en Asedios</span>
                </div>
                <Flame size={20} color="#f87171" />
              </div>

              <div className="kingdom-card sur" onClick={handlePlayClick}>
                <div className="kingdom-badge-icon">🦌</div>
                <div className="kingdom-details">
                  <h3>Reino del Sur · Clan del Ciervo</h3>
                  <p>Tierras fértiles, abundancia natural y crecimiento demográfico.</p>
                  <span className="kingdom-bonus-pill">+20% Producción de Recursos</span>
                </div>
                <Sparkles size={20} color="#34d399" />
              </div>

              <div className="kingdom-card oeste" onClick={handlePlayClick}>
                <div className="kingdom-badge-icon">☀️</div>
                <div className="kingdom-details">
                  <h3>Reino del Oeste · Clan del Sol</h3>
                  <p>Rutas de comercio marítimo, diplomacia y poder financiero.</p>
                  <span className="kingdom-bonus-pill">+15% Eficiencia de KING</span>
                </div>
                <Coins size={20} color="#fbbf24" />
              </div>
            </div>

            <div className="kingdoms-map-showcase">
              <img
                src="/assets/landing/map-kingdoms.png"
                alt="Mapa Isométrico de los Cuatro Reinos"
              />
              <div className="map-tag-overlay">
                <span>Mapa Continental Persistente</span>
                <small>4 Capitales · 8 Fortalezas Estratégicas</small>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Economía Real & El Poder del KING (GRAN PROTAGONISMO) */}
        <section id="economia" className="section-container">
          <div className="section-header">
            <div className="eyebrow">SISTEMA FINANCIERO</div>
            <h2>Economía Real · El Poder del KING</h2>
            <p>
              Un ecosistema impulsado por la actividad real de los jugadores. Construye, combate y
              comercia para acumular riqueza y prestigio.
            </p>
          </div>

          <div className="economy-showcase">
            <div className="economy-monument-col">
              <div className="economy-coin-glow">
                <img src="/assets/landing/coin-king.png" alt="Moneda KING Real" />
              </div>
              <strong>TOKEN KING</strong>
              <span>El motor económico de FourKingdoms</span>
            </div>

            <div className="economy-pillars-grid">
              <div className="economy-pillar-card">
                <div className="economy-pillar-icon">
                  <Swords size={22} />
                </div>
                <div className="economy-pillar-text">
                  <h4>Tropas Productivas</h4>
                  <p>
                    Hasta 40 tropas de combate computan para tu participación diaria en
                    recompensas.
                  </p>
                </div>
              </div>

              <div className="economy-pillar-card">
                <div className="economy-pillar-icon">
                  <Pickaxe size={22} />
                </div>
                <div className="economy-pillar-text">
                  <h4>Farming y Botín</h4>
                  <p>
                    Obtén recompensas derrotando campamentos NPC, conquistando minas y venciendo
                    rivales.
                  </p>
                </div>
              </div>

              <div className="economy-pillar-card">
                <div className="economy-pillar-icon">
                  <Store size={22} />
                </div>
                <div className="economy-pillar-text">
                  <h4>Tesorería Protegida</h4>
                  <p>
                    Sistema de bóveda para salvaguardar tus fondos principales ante posibles
                    ataques.
                  </p>
                </div>
              </div>

              <div className="economy-pillar-card">
                <div className="economy-pillar-icon">
                  <TrendingUp size={22} />
                </div>
                <div className="economy-pillar-text">
                  <h4>Utilidad de Crecimiento</h4>
                  <p>
                    Acelera mejoras, desbloquea planos legendarios y activa escudos de paz para tu
                    reino.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Guerra de Clanes (GRAN PROTAGONISMO) */}
        <section id="guerra" className="section-container">
          <div className="section-header">
            <div className="eyebrow">CONQUISTA TOTAL</div>
            <h2>Guerra de Clanes & Rallies</h2>
            <p>
              Únete a un clan, coordina ataques masivos y asedia las Capitales en asaltos
              multijugador sincronizados.
            </p>
          </div>

          <div className="war-showcase">
            <div className="war-art-frame">
              <img src="/assets/landing/war-clans.png" alt="Guerra de Clanes y Asedios" />
            </div>
            <div className="war-info-col">
              <h3>Macroejércitos y Dominio</h3>
              <p>
                El comandante del rally que derribe la puerta y conquiste la Capital del sector se
                corona como Rey territorial. Las tropas supervivientes asumen la guarnición
                defensiva inmediata.
              </p>
              <div className="war-stats-grid">
                <div className="war-stat-box">
                  <span>Tiempo de Rally</span>
                  <strong>5 min</strong>
                </div>
                <div className="war-stat-box">
                  <span>Grandes Capitales</span>
                  <strong>4 Reales</strong>
                </div>
                <div className="war-stat-box">
                  <span>Fortalezas Menores</span>
                  <strong>8 Puntos</strong>
                </div>
                <div className="war-stat-box">
                  <span>Tropas en Batalla</span>
                  <strong>Sin Límite Duro</strong>
                </div>
              </div>
              <button type="button" className="btn-gold" onClick={handlePlayClick}>
                Unirse a la Batalla
              </button>
            </div>
          </div>
        </section>

        {/* 5. Packs de Inicio (PROTAGONISMO MÁXIMO) */}
        <section id="packs" className="section-container">
          <div className="section-header">
            <div className="eyebrow">TIENDA DE FUNDADORES</div>
            <h2>Elige Tu Pack de Inicio</h2>
            <p>
              Comienza tu reinado con ventaja estratégica. Tropas preparadas, almacenes llenos y
              protección garantizada para expandirte sin interrupciones.
            </p>
          </div>

          <div className="packs-showcase">
            {/* Pack Básico */}
            <article className="pack-card-premium">
              <div className="pack-tier-header">
                <h3>Explorador</h3>
                <span>Pack Básico</span>
              </div>
              <div className="pack-chest-display">
                <img src="/assets/landing/pack-basic.png" alt="Cofre Explorador" />
              </div>
              <div className="pack-price-tag">
                <span className="amount">$4.99</span>
                <small>Pago único · Acceso inmediato</small>
              </div>
              <ul className="pack-perks-list">
                <li>
                  <Check size={16} />
                  <span>Fundación de reino y estandarte</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>500 Tropas de Infantería listas</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>5,000 Madera, Piedra y Comida</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>Escudo de protección de 24 horas</span>
                </li>
              </ul>
              <button type="button" className="pack-action-btn" onClick={handlePlayClick}>
                Elegir Explorador
              </button>
            </article>

            {/* Pack Avanzado (Destacado) */}
            <article className="pack-card-premium featured">
              <div className="pack-featured-badge">👑 MÁS RECOMENDADO</div>
              <div className="pack-tier-header">
                <h3>Conquistador</h3>
                <span>Pack Avanzado</span>
              </div>
              <div className="pack-chest-display">
                <img src="/assets/landing/pack-advanced.png" alt="Cofre Conquistador" />
              </div>
              <div className="pack-price-tag">
                <span className="amount">$9.99</span>
                <small>Pago único · Mayor valor</small>
              </div>
              <ul className="pack-perks-list">
                <li>
                  <Check size={16} />
                  <span>Todo lo incluido en Explorador</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>1,500 Tropas (Infantería + Arqueros)</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>15,000 Recursos de cada tipo</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>Escudo de protección de 48 horas</span>
                </li>
                <li>
                  <Check size={16} />
                  <span><strong>+100 KING</strong> de bono Fundador</span>
                </li>
              </ul>
              <button type="button" className="pack-action-btn" onClick={handlePlayClick}>
                Elegir Conquistador
              </button>
            </article>

            {/* Pack Élite */}
            <article className="pack-card-premium">
              <div className="pack-tier-header">
                <h3>Soberano</h3>
                <span>Pack Élite</span>
              </div>
              <div className="pack-chest-display">
                <img src="/assets/landing/pack-elite.png" alt="Cofre Soberano" />
              </div>
              <div className="pack-price-tag">
                <span className="amount">$19.99</span>
                <small>Pago único · Máximo poder</small>
              </div>
              <ul className="pack-perks-list">
                <li>
                  <Check size={16} />
                  <span>Todo lo de packs anteriores</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>4,000 Tropas (Infantería, Arqueros, Caballería)</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>40,000 Recursos masivos</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>Escudo de protección de 72 horas</span>
                </li>
                <li>
                  <Check size={16} />
                  <span><strong>+300 KING</strong> de bono Fundador</span>
                </li>
                <li>
                  <Check size={16} />
                  <span>Título exclusivo y marco de avatar</span>
                </li>
              </ul>
              <button type="button" className="pack-action-btn" onClick={handlePlayClick}>
                Elegir Soberano
              </button>
            </article>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="cta-banner">
          <div>
            <h2>Funda tu reino y entra en la guerra por el KING</h2>
            <p>
              Los cuatro reinos esperan a su próximo líder. Construye, forja alianzas y demuestra tu
              fuerza en el mapa.
            </p>
          </div>
          <button type="button" className="btn-gold" onClick={handlePlayClick}>
            Comenzar Ahora
          </button>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="landing-logo">
            <img
              src="/assets/landing/logo-fourkingdoms.png"
              alt="FourKingdoms"
              className="footer-logo-img"
            />
          </div>
          <span>Temporada 0 · Alpha · Todos los derechos reservados</span>
        </footer>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user)
          setShowAuthModal(false)
          onPlay(user)
        }}
      />
    </div>
  )
}
