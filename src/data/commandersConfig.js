/**
 * FourKingdom — Configuración de Guardia de Comandantes y Temporadas
 * Inspirado en la psicología gaming: unidad gratuita de inicio, ticker de yield en vivo,
 * invocación por token (50% burn / 50% pozo de temporada), roadmap de 45 días y NFTs.
 */

export const SEASON_CONFIG = {
  seasonNumber: 1,
  seasonName: 'Guerra de las Cuatro Coronas',
  durationDays: 45,
  startDateUtc: '2026-09-28T00:00:00Z',
  endDateUtc: '2026-11-12T00:00:00Z',
  basePoolKing: 10_000,
  maxCommandersPerPlayer: 50,
  summonCostKing: 25,
  burnPercentage: 0.50, // 50% se quema para siempre
  seasonPoolPercentage: 0.50, // 50% engrosa el pozo de premios de la temporada
}

// Rarezas, probabilidades y rendimientos
export const RARITY_TIERS = {
  starter: {
    id: 'starter',
    label: 'Starter Gratuito',
    color: '#94a3b8',
    bgBadge: 'rgba(148, 163, 184, 0.15)',
    border: '#64748b',
    dropRate: 0.0,
    yieldPerHour: 0.80, // Producción pasiva continua
    militaryBonusLabel: '+5% Ataque Infantería / +5% Carga',
  },
  common: {
    id: 'common',
    label: 'Común',
    color: '#38bdf8',
    bgBadge: 'rgba(56, 189, 248, 0.15)',
    border: '#0284c7',
    dropRate: 0.45, // 45%
    yieldPerHour: 1.50,
    militaryBonusLabel: '+10% Ataque General',
  },
  uncommon: {
    id: 'uncommon',
    label: 'Poco Común',
    color: '#4ade80',
    bgBadge: 'rgba(74, 222, 128, 0.15)',
    border: '#16a34a',
    dropRate: 0.30, // 30%
    yieldPerHour: 3.20,
    militaryBonusLabel: '+15% Velocidad de Marcha',
  },
  rare: {
    id: 'rare',
    label: 'Raro',
    color: '#f87171',
    bgBadge: 'rgba(248, 113, 113, 0.15)',
    border: '#dc2626',
    dropRate: 0.15, // 15%
    yieldPerHour: 7.50, // Se amortiza en ~7 días
    militaryBonusLabel: '+25% Daño a Distancia / Balistas',
  },
  epic: {
    id: 'epic',
    label: 'Épico',
    color: '#c084fc',
    bgBadge: 'rgba(192, 132, 252, 0.15)',
    border: '#9333ea',
    dropRate: 0.07, // 7%
    yieldPerHour: 16.00,
    militaryBonusLabel: '+40% Absorción de Muralla y Asedio',
  },
  legendary: {
    id: 'legendary',
    label: 'Legendario',
    color: '#fbbf24',
    bgBadge: 'rgba(251, 191, 36, 0.18)',
    border: '#d97706',
    dropRate: 0.03, // 3%
    yieldPerHour: 38.00,
    militaryBonusLabel: '+75% Poder Bélico Global del Reino',
  },
}

// Unidad gratuita otorgada a todo jugador (Equivalente al auto "Beater" de Hood Cars)
export const STARTER_COMMANDER = {
  id: 'cmd_starter_veteran',
  name: 'Veterano de la Nieve',
  title: 'Capitán de Milicia',
  rarity: 'starter',
  image: '/assets/troops/infantry.png',
  yieldPerHour: 0.80,
  powerBonus: 120,
  description: 'Un viejo sargento de la guardia del norte. Rústico y leal, organiza las patrullas del reino y recoge botín continuo.',
  obtainedAt: 0, // Se asigna al iniciar
  isStarter: true,
}

// Pool de Comandantes Invocables
export const SUMMONABLE_COMMANDERS = [
  // Comunes (45%)
  {
    id: 'cmd_c1',
    name: 'Sargento Vigía',
    title: 'Custodio del Muro',
    rarity: 'common',
    image: '/assets/troops/infantry.png',
    yieldPerHour: 1.50,
    powerBonus: 250,
    description: 'Guía a la infantería en formación cerrada para resistir cargas frontales.',
  },
  {
    id: 'cmd_c2',
    name: 'Tirador Fronterizo',
    title: 'Arquero de Escarcha',
    rarity: 'common',
    image: '/assets/troops/archer.png',
    yieldPerHour: 1.50,
    powerBonus: 250,
    description: 'Vigila las torres exteriores y recolecta madera y suministros de exploración.',
  },
  // Poco Comunes (30%)
  {
    id: 'cmd_u1',
    name: 'Explorador del Viento',
    title: 'Jinete del Alba',
    rarity: 'uncommon',
    image: '/assets/troops/cavalry.png',
    yieldPerHour: 3.20,
    powerBonus: 500,
    description: 'Acelera las marchas de expedición por los terrenos escarpados del mapa.',
  },
  {
    id: 'cmd_u2',
    name: 'Capitán de Asalto',
    title: 'Ariete Humano',
    rarity: 'uncommon',
    image: '/assets/landing/pack-basic.png',
    yieldPerHour: 3.20,
    powerBonus: 520,
    description: 'Organiza las líneas de combate para quebrar campamentos bandidos.',
  },
  // Raros (15%)
  {
    id: 'cmd_r1',
    name: 'Maestro Ballestero Imperial',
    title: 'Ojo de Águila',
    rarity: 'rare',
    image: '/assets/landing/pack-advanced.png',
    yieldPerHour: 7.50,
    powerBonus: 1100,
    description: 'Experto en proyectiles perforantes. Amortiza el coste de invocación en ~7 días.',
  },
  {
    id: 'cmd_r2',
    name: 'Caballero Templario',
    title: 'Escudo Sagrado',
    rarity: 'rare',
    image: '/assets/landing/pack-conqueror.png',
    yieldPerHour: 7.50,
    powerBonus: 1150,
    description: 'Absorbe daño en asedios y genera tributo pasivo de las provincias conquistadas.',
  },
  // Épicos (7%)
  {
    id: 'cmd_e1',
    name: 'Paladín de la Corona',
    title: 'Baluarte de Hierro',
    rarity: 'epic',
    image: '/assets/landing/pack-elite.png',
    yieldPerHour: 16.00,
    powerBonus: 2600,
    description: 'Líder nato de rallies de clan. Eleva la moral y la defensa masiva de murallas.',
  },
  // Legendarios (3%)
  {
    id: 'cmd_l1',
    name: 'Señor de la Guerra Glacial',
    title: 'El Devorador de Reinos',
    rarity: 'legendary',
    image: '/assets/landing/pack-sovereign.png',
    yieldPerHour: 38.00,
    powerBonus: 6500,
    description: 'Comandante legendario que domina el campo de batalla. Máximo poder bélico y generación estelar de KING.',
  },
]

// Roadmap de la Temporada (Equivalente al Roadmap visual de Hood Cars)
export const SEASON_ROADMAP = [
  {
    id: 1,
    dateLabel: 'Día 1 – 5',
    title: 'FUNDACIÓN Y ASENTAMIENTO DE REINOS',
    status: 'done', // 'done' | 'next' | 'locked'
    statusLabel: 'COMPLETADO',
    description: 'Despliegue del mapa de 50×50, sistema de 4 cuadrantes regionales, recolección pasiva y primeras murallas.',
  },
  {
    id: 2,
    dateLabel: 'Día 6 – 14',
    title: 'GUARDIA DE COMANDANTES & YIELD EN VIVO',
    status: 'active',
    statusLabel: 'EN CURSO',
    description: 'Comandante starter gratuito para cada gobernador, invocación con 50% burn / 50% al pozo, y ticker dinámico de botín.',
  },
  {
    id: 3,
    dateLabel: 'Día 15',
    title: 'GUERRA DE FRONTERAS & FORTALEZAS',
    status: 'next',
    statusLabel: 'PRÓXIMO',
    description: 'Apertura de las 8 Fortalezas Regionales. Los clanes depositan Fondos de Asedio en KING para conquistar territorio.',
  },
  {
    id: 4,
    dateLabel: 'Día 25',
    title: 'MERCADO P2P DE COMANDANTES Y PLANOS',
    status: 'locked',
    statusLabel: 'BLOQUEADO',
    description: 'Libro de órdenes P2P entre gobernantes. Venta de recursos, planos raros y comandantes con tasa de quema del 5%.',
  },
  {
    id: 5,
    dateLabel: 'Día 38',
    title: 'EL ASEDIO AL TRONO CENTRAL',
    status: 'locked',
    statusLabel: 'BLOQUEADO',
    description: 'Apertura de la Gran Capital del Imperio en el centro del mapa. Guerra total de los 4 Reinos por el control absoluto.',
  },
  {
    id: 6,
    dateLabel: 'Día 45',
    title: 'JUICIO FINAL, POZO GLOBAL & MEDALLAS NFT',
    status: 'locked',
    statusLabel: 'GRAN FINAL',
    description: 'Distribución del Pozo de Guerra acumulado entre el Top 100 de gobernantes y entrega de Títulos NFT de Conquista T1.',
  },
]

// Estructura de Premiación del Pozo de Temporada
export const SEASON_PRIZES = {
  distribution: [
    { rank: 'Top 1 (Emperador Supremo)', sharePercent: 30, nftTitle: 'NFT "Corona Imperial T1"', badge: '🥇' },
    { rank: 'Top 2 (Rey Consorte)', sharePercent: 18, nftTitle: 'NFT "Estandarte Real T1"', badge: '🥈' },
    { rank: 'Top 3 (Gran Señor de la Guerra)', sharePercent: 12, nftTitle: 'NFT "Estandarte Real T1"', badge: '🥉' },
    { rank: 'Top 4 a 10 (Consejo Imperial)', sharePercent: 15, nftTitle: 'NFT "Insignia del Alto Mando T1"', badge: '🎖️' },
    { rank: 'Top 11 a 50 (Mariscales Veteranos)', sharePercent: 15, nftTitle: 'NFT "Medalla de Veterano T1"', badge: '⚔️' },
    { rank: 'Top 51 a 100 (Caballeros de Élite)', sharePercent: 10, nftTitle: 'Título de Honor en Perfil T1', badge: '🛡️' },
  ],
  rules: [
    'El 50% de cada Invocación de Comandante ingresa directamente al Pozo de Temporada.',
    'El pozo está garantizado y crece en tiempo real con cada gobernante que fortalece su guardia.',
    'No es juego de azar: es pura competencia estratégica donde el 10% más táctico conquista el botín.',
    'Los NFTs entregados son transferibles en el marketplace y otorgan prestigio perpetuo en futuras temporadas.',
  ],
}
