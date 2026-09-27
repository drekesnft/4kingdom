/**
 * FourKingdom — Documento Maestro de Diseño (Alpha v0.1)
 * Configuración centralizada de datos y balance (Regla 77)
 */

export const KING_CONFIG = {
  SEC_PER_KING: 30, // 1 KING = 30 segundos
  REFERENCE_PRICE_USD: 0.005,
  MAX_SUPPLY: 1_000_000,
  POOLS: {
    farming: 420_000,
    npc: 80_000,
    fortresses: 150_000,
    expeditions: 80_000,
    rankings: 70_000,
    initialLiquidity: 100_000,
    gameReserve: 100_000,
  },
  DAILY_FARMING_POOL_INITIAL: 2488.89, // Primeros 90 días
  HALVING_SCHEDULE: [
    { period: 'Días 1–90', poolTotal: 224_000, daily: 2488.89 },
    { period: 'Días 91–180', poolTotal: 112_000, daily: 1244.44 },
    { period: 'Días 181–270', poolTotal: 56_000, daily: 622.22 },
    { period: 'Días 271–360', poolTotal: 28_000, daily: 311.11 },
  ],
  NPC_DAILY_BUDGET: 220,
  RANKING_DAILY_REWARDS: [15, 10, 7, 5, 3], // #1 a #5 base
  RANKING_CONFIG: {
    START_DATE_UTC: '2026-09-29T00:00:00Z',
    PAYOUT_HOUR_UTC: 0, // 00:00 UTC
    TOTAL_POOL: 70_000,
    BASE_DAILY_POOL: 40,
    TIERS: [
      { rank: 1, percent: 0.375, percentLabel: '37.5%', baseKing: 15, label: '🥇 Top 1' },
      { rank: 2, percent: 0.250, percentLabel: '25.0%', baseKing: 10, label: '🥈 Top 2' },
      { rank: 3, percent: 0.175, percentLabel: '17.5%', baseKing: 7, label: '🥉 Top 3' },
      { rank: 4, percent: 0.125, percentLabel: '12.5%', baseKing: 5, label: '🎖️ Top 4' },
      { rank: 5, percent: 0.075, percentLabel: '7.5%', baseKing: 3, label: '🎖️ Top 5' },
    ],
  },
  WITHDRAW_FEE_PERCENT: 0.05,
  FEE_DISTRIBUTION: { burn: 0.02, rewardPools: 0.02, kingdomSystem: 0.01 },
  FOUNDATION_COST_KING: 1000,
}

/**
 * Calcula el tiempo exacto restante hacia el siguiente corte a las 00:00 UTC
 * o hacia la fecha de inicio oficial (29/09/2026 a las 00:00 UTC).
 */
export function getRankingPayoutSchedule() {
  const START_DATE = new Date('2026-09-29T00:00:00Z')
  const now = new Date()

  // Siguiente corte diario a las 00:00:00 UTC
  const nextPayoutUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ))

  const targetDate = now < START_DATE ? START_DATE : nextPayoutUtc
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime())
  const diffSec = Math.floor(diffMs / 1000)

  const days = Math.floor(diffSec / 86400)
  const hours = Math.floor((diffSec % 86400) / 3600)
  const minutes = Math.floor((diffSec % 3600) / 60)
  const seconds = diffSec % 60

  return {
    startDateUtc: START_DATE.toISOString(),
    isLive: now >= START_DATE,
    targetDateUtc: targetDate.toISOString(),
    diffSec,
    days,
    hours,
    minutes,
    seconds,
    formattedCountdown: days > 0
      ? `${days}d ${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
      : `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
  }
}

export const INITIAL_PLAYER_DATA = {
  resources: {
    wood: 1500,
    stone: 1500,
    food: 1800,
  },
  king: {
    pending: 0,
    claimed: 120, // Inicial en tesorería
    vault: 0,
  },
  troops: {
    infantry: 10,
    archer: 0,
    cavalry: 0,
  },
  buildings: {
    castle: 1,
    barracks: 0, // Inicia sin construir
    granary: 0,  // Inicia sin construir
    treasury: 0, // Inicia sin construir
    wall: 0,     // Inicia sin construir
  },
  builders: 1,
  shieldHours: 24, // 24h protección inicial
}

export const TROOPS_CONFIG = {
  infantry: {
    id: 'infantry',
    name: 'Infantería',
    line: 'Frente',
    order: 1,
    image: '/assets/troops/infantry.png',
    attack: 10,
    defense: 0.20, // 20% absorción
    hp: 20,
    power: 30,
    carry: 50,
    foodUpkeepPerHour: 1,
    trainTimeSec: 360, // 6 min
    requiredBarracksLevel: 1,
    cost: { wood: 110, stone: 80, food: 130 },
    description: 'Primera línea. Barata, resistente, buena relación coste/poder y buena carga.',
  },
  archer: {
    id: 'archer',
    name: 'Arquero',
    line: 'Retaguardia',
    order: 3,
    image: '/assets/troops/archer.png',
    attack: 18,
    defense: 0.10, // 10% absorción
    hp: 12,
    power: 32,
    carry: 35,
    foodUpkeepPerHour: 1,
    trainTimeSec: 480, // 8 min
    requiredBarracksLevel: 3,
    cost: { wood: 180, stone: 60, food: 170 },
    description: 'Retaguardia. Alto daño ofensivo a distancia pero frágil en combate cuerpo a cuerpo.',
  },
  cavalry: {
    id: 'cavalry',
    name: 'Caballería',
    line: 'Segunda línea',
    order: 2,
    image: '/assets/troops/cavalry.jpg',
    attack: 24,
    defense: 0.25, // 25% absorción
    hp: 26,
    power: 50,
    carry: 80,
    foodUpkeepPerHour: 2,
    trainTimeSec: 720, // 12 min
    requiredBarracksLevel: 5,
    cost: { wood: 160, stone: 180, food: 310 },
    description: 'Segunda línea. Rápida, alta fuerza, gran carga y alta vida. Mayor consumo de comida.',
  },
}

export const BUILDINGS_CONFIG = {
  castle: {
    id: 'castle',
    name: 'Castillo',
    description: 'Edificio principal del reino. Define el nivel máximo de otros edificios, marchas y poder.',
    icon: '🏰',
    levels: {
      1: { power: 100, marches: 1, passivePerHour: { wood: 50, stone: 40, food: 60 }, upgradeTimeSec: 0, cost: { wood: 0, stone: 0, food: 0 } },
      2: { power: 250, marches: 2, passivePerHour: { wood: 80, stone: 65, food: 95 }, upgradeTimeSec: 28800, cost: { wood: 3000, stone: 2500, food: 2000 } }, // 8h
      3: { power: 500, marches: 2, passivePerHour: { wood: 125, stone: 100, food: 150 }, upgradeTimeSec: 86400, cost: { wood: 8000, stone: 7000, food: 5000 } }, // 24h
      4: { power: 900, marches: 3, passivePerHour: { wood: 190, stone: 150, food: 225 }, upgradeTimeSec: 259200, cost: { wood: 18000, stone: 16000, food: 12000 } }, // 72h
      5: { power: 1500, marches: 3, passivePerHour: { wood: 280, stone: 225, food: 335 }, upgradeTimeSec: 604800, cost: { wood: 40000, stone: 36000, food: 28000 } }, // 168h
    },
  },
  barracks: {
    id: 'barracks',
    name: 'Cuartel',
    description: 'Entrena y prepara las fuerzas militares. Desbloquea tropas y acelera el reclutamiento.',
    icon: '⚔️',
    levels: {
      0: { power: 0, maxQueue: 0, speedBonus: 0.00, unlockedTroops: [], upgradeTimeSec: 600, cost: { wood: 500, stone: 300, food: 600 } },
      1: { power: 50, maxQueue: 5, speedBonus: 0.00, unlockedTroops: ['infantry'], upgradeTimeSec: 600, cost: { wood: 500, stone: 300, food: 600 } }, // 10 min
      2: { power: 120, maxQueue: 10, speedBonus: 0.10, unlockedTroops: ['infantry'], upgradeTimeSec: 7200, cost: { wood: 1500, stone: 900, food: 1800 } }, // 2h
      3: { power: 220, maxQueue: 15, speedBonus: 0.20, unlockedTroops: ['infantry', 'archer'], upgradeTimeSec: 28800, cost: { wood: 4200, stone: 2200, food: 4800 } }, // 8h
      4: { power: 350, maxQueue: 20, speedBonus: 0.30, unlockedTroops: ['infantry', 'archer'], upgradeTimeSec: 86400, cost: { wood: 9000, stone: 5000, food: 10500 } }, // 24h
      5: { power: 550, maxQueue: 25, speedBonus: 0.40, unlockedTroops: ['infantry', 'archer', 'cavalry'], upgradeTimeSec: 259200, cost: { wood: 18000, stone: 10000, food: 21000 } }, // 72h
    },
  },
  granary: {
    id: 'granary',
    name: 'Granero',
    description: 'Logística militar. Sostiene el mantenimiento del ejército y define tropas productivas para KING.',
    icon: '🌾',
    levels: {
      0: { power: 0, logisticsCapacity: 100, kingProductiveCap: 20, upgradeTimeSec: 480, cost: { wood: 600, stone: 150, food: 800 } },
      1: { power: 40, logisticsCapacity: 100, kingProductiveCap: 20, upgradeTimeSec: 480, cost: { wood: 600, stone: 150, food: 800 } }, // 8 min
      2: { power: 100, logisticsCapacity: 250, kingProductiveCap: 25, upgradeTimeSec: 5400, cost: { wood: 1800, stone: 500, food: 2400 } }, // 1.5h
      3: { power: 180, logisticsCapacity: 500, kingProductiveCap: 30, upgradeTimeSec: 21600, cost: { wood: 5000, stone: 1400, food: 6500 } }, // 6h
      4: { power: 300, logisticsCapacity: 1000, kingProductiveCap: 35, upgradeTimeSec: 64800, cost: { wood: 11000, stone: 3000, food: 14500 } }, // 18h
      5: { power: 450, logisticsCapacity: 2000, kingProductiveCap: 40, upgradeTimeSec: 172800, cost: { wood: 22000, stone: 6000, food: 30000 } }, // 48h
    },
  },
  treasury: {
    id: 'treasury',
    name: 'Tesorería',
    description: 'Custodia el KING obtenido jugando. Protege fondos ante saqueos PvP y gestiona retiros.',
    icon: '🏛️',
    levels: {
      0: { power: 0, pendingMax: 20, protectedKing: 25, dailyWithdrawMax: 25, upgradeTimeSec: 900, cost: { wood: 300, stone: 700, food: 200 } },
      1: { power: 60, pendingMax: 20, protectedKing: 25, dailyWithdrawMax: 25, upgradeTimeSec: 900, cost: { wood: 300, stone: 700, food: 200 } }, // 15 min
      2: { power: 140, pendingMax: 50, protectedKing: 75, dailyWithdrawMax: 75, upgradeTimeSec: 10800, cost: { wood: 900, stone: 2100, food: 600 } }, // 3h
      3: { power: 260, pendingMax: 120, protectedKing: 175, dailyWithdrawMax: 175, upgradeTimeSec: 36000, cost: { wood: 2500, stone: 6000, food: 1600 } }, // 10h
      4: { power: 420, pendingMax: 250, protectedKing: 350, dailyWithdrawMax: 350, upgradeTimeSec: 108000, cost: { wood: 5500, stone: 13500, food: 3500 } }, // 30h
      5: { power: 650, pendingMax: 500, protectedKing: 700, dailyWithdrawMax: 700, upgradeTimeSec: 259200, cost: { wood: 12000, stone: 28000, food: 8000 } }, // 72h
    },
  },
  wall: {
    id: 'wall',
    name: 'Muralla',
    description: 'Defensa fortificada. Reduce el daño entrante en combates defensivos y reduce el saqueo PvP.',
    icon: '🛡️',
    levels: {
      0: { power: 0, defenseBonus: 0.00, lootReduction: 0.00, upgradeTimeSec: 720, cost: { wood: 350, stone: 900, food: 250 } },
      1: { power: 80, defenseBonus: 0.10, lootReduction: 0.05, upgradeTimeSec: 720, cost: { wood: 350, stone: 900, food: 250 } }, // 12 min
      2: { power: 180, defenseBonus: 0.20, lootReduction: 0.10, upgradeTimeSec: 7200, cost: { wood: 1000, stone: 2800, food: 700 } }, // 2h
      3: { power: 320, defenseBonus: 0.30, lootReduction: 0.15, upgradeTimeSec: 28800, cost: { wood: 2800, stone: 8000, food: 2200 } }, // 8h
      4: { power: 500, defenseBonus: 0.40, lootReduction: 0.20, upgradeTimeSec: 86400, cost: { wood: 6500, stone: 18000, food: 5000 } }, // 24h
      5: { power: 750, defenseBonus: 0.50, lootReduction: 0.25, upgradeTimeSec: 216000, cost: { wood: 14000, stone: 38000, food: 11000 } }, // 60h
    },
  },
}

export const LOGISTICS_PENALTIES = [
  { threshold: 1.00, multiplier: 1.00 },
  { threshold: 1.25, multiplier: 1.25 },
  { threshold: 1.50, multiplier: 1.50 },
  { threshold: 2.00, multiplier: 2.00 },
  { threshold: Infinity, multiplier: 3.00 },
]

export const RESOURCE_TIERS = {
  1: { reserve: 250, drainTimeSec: 300, respawnSec: 3600 },    // 5 min / 1 h
  2: { reserve: 500, drainTimeSec: 600, respawnSec: 7200 },    // 10 min / 2 h
  3: { reserve: 900, drainTimeSec: 1200, respawnSec: 14400 },  // 20 min / 4 h
  4: { reserve: 1400, drainTimeSec: 2100, respawnSec: 28800 }, // 35 min / 8 h
  5: { reserve: 2200, drainTimeSec: 3600, respawnSec: 57600 }, // 60 min / 16 h
}

export const NPC_TIERS = {
  1: {
    level: 1,
    name: 'Bandidos de la Nieve',
    power: 150,
    army: { infantry: 5, archer: 0, cavalry: 0 },
    recommended: '8 Infanterías',
    minResourceReward: 800,
    maxResourceReward: 1000,
    kingDropRate: 0.02,
    kingDropAmount: 1,
    respawnSec: 3600,
  },
  2: {
    level: 2,
    name: 'Campamento Renegado',
    power: 488,
    army: { infantry: 12, archer: 4, cavalry: 0 },
    recommended: '18 Inf. + 6 Arq.',
    minResourceReward: 3700,
    maxResourceReward: 4500,
    kingDropRate: 0.05,
    kingDropAmount: 1,
    respawnSec: 7200,
  },
  3: {
    level: 3,
    name: 'Guardia Fronteriza Hostil',
    power: 1220,
    army: { infantry: 25, archer: 10, cavalry: 3 },
    recommended: '35 Inf. + 15 Arq. + 5 Cab.',
    minResourceReward: 10000,
    maxResourceReward: 12000,
    kingDropRate: 0.10,
    kingDropAmount: 2,
    respawnSec: 14400,
  },
  4: {
    level: 4,
    name: 'Bastión Mercenario',
    power: 2640,
    army: { infantry: 50, archer: 20, cavalry: 10 },
    recommended: '70 Inf. + 30 Arq. + 15 Cab.',
    minResourceReward: 22000,
    maxResourceReward: 26000,
    kingDropRate: 0.15,
    kingDropAmount: 3,
    respawnSec: 28800,
  },
  5: {
    level: 5,
    name: 'Señor de la Guerra Glacial',
    power: 4980,
    army: { infantry: 90, archer: 40, cavalry: 20 },
    recommended: '130 Inf. + 60 Arq. + 30 Cab.',
    minResourceReward: 38000,
    maxResourceReward: 45000,
    kingDropRate: 0.25,
    kingDropAmount: 5,
    respawnSec: 57600,
  },
}

export const HERO_MISSIONS = {
  exploration: {
    id: 'exploration',
    name: 'Exploración',
    energyCost: 1,
    durationSec: 600, // 10 min
    successRate: 0.90,
    rewardMin: 40,
    rewardMax: 70,
    hasKingDrop: false,
    description: 'Exploración de reconocimiento cercana. Rápida y de muy bajo riesgo.',
  },
  incursion: {
    id: 'incursion',
    name: 'Incursión',
    energyCost: 1,
    durationSec: 1800, // 30 min
    successRate: 0.75,
    rewardMin: 100,
    rewardMax: 160,
    hasKingDrop: false,
    description: 'Incursión a campamentos abandonados. Buen botín con riesgo moderado.',
  },
  expedition: {
    id: 'expedition',
    name: 'Expedición Legendaria',
    energyCost: 2,
    durationSec: 3600, // 60 min
    successRate: 0.60,
    rewardMin: 200,
    rewardMax: 300,
    hasKingDrop: true,
    kingDropChance: 0.08,
    kingAmount: 1,
    description: 'Expedición a ruinas remotas. Oportunidad de encontrar 1 KING si tiene éxito.',
  },
}

export const REGIONAL_KINGDOMS = {
  north: {
    id: 'north',
    name: 'Reino del Norte',
    quadrant: 2, // NW
    capital: { name: 'Capital de Escarcha', coord: { x: -12, y: 12 }, king: 'Lord Frost' },
    fortresses: [
      { id: 'north_f1', name: 'Fortaleza del Viento', coord: { x: -6, y: 18 }, controller: 'Clan Vórtice' },
      { id: 'north_f2', name: 'Fortaleza de la Ventisca', coord: { x: -18, y: 6 }, controller: 'Clan Vórtice' },
    ],
  },
  east: {
    id: 'east',
    name: 'Reino del Este',
    quadrant: 1, // NE
    capital: { name: 'Capital del Sol Naciente', coord: { x: 12, y: 12 }, king: 'Emperador Alba' },
    fortresses: [
      { id: 'east_f1', name: 'Fortaleza del Alba', coord: { x: 18, y: 6 }, controller: 'Legión Dorada' },
      { id: 'east_f2', name: 'Fortaleza de la Aurora', coord: { x: 6, y: 18 }, controller: 'Legión Dorada' },
    ],
  },
  west: {
    id: 'west',
    name: 'Reino del Oeste',
    quadrant: 3, // SW
    capital: { name: 'Capital del Ocaso', coord: { x: -12, y: -12 }, king: 'Reina Sombría' },
    fortresses: [
      { id: 'west_f1', name: 'Fortaleza de las Rocas', coord: { x: -18, y: -6 }, controller: 'Hijos del Hierro' },
      { id: 'west_f2', name: 'Fortaleza Crepúsculo', coord: { x: -6, y: -18 }, controller: 'Hijos del Hierro' },
    ],
  },
  south: {
    id: 'south',
    name: 'Reino del Sur',
    quadrant: 4, // SE
    capital: { name: 'Capital de la Corona', coord: { x: 12, y: -12 }, king: 'Rey Solarius' },
    fortresses: [
      { id: 'south_f1', name: 'Fortaleza del Mediodía', coord: { x: 18, y: -6 }, controller: 'Guardia Solar' },
      { id: 'south_f2', name: 'Fortaleza Fluvial', coord: { x: 6, y: -18 }, controller: 'Guardia Solar' },
    ],
  },
}

export const STORE_ITEMS = {
  shields: [
    { id: 'shield_4h', name: 'Escudo de Paz (4h)', durationSec: 14400, kingCost: 15, icon: '🛡️' },
    { id: 'shield_12h', name: 'Escudo de Paz (12h)', durationSec: 43200, kingCost: 40, icon: '🛡️' },
    { id: 'shield_24h', name: 'Escudo de Paz (24h)', durationSec: 86400, kingCost: 75, icon: '🛡️' },
  ],
  blueprints: [
    { id: 'bp_castle', name: 'Plano del Castillo Nv.5', kingCost: 120, description: 'Permite saltar requisitos previos para construir el Castillo Nv.5.', icon: '📜' },
    { id: 'bp_barracks', name: 'Plano de Cuartel Avanzado', kingCost: 80, description: 'Desbloquea entrenamiento de Caballería sin esperar nivel de muralla.', icon: '📜' },
  ],
  founderPacks: [
    {
      id: 'pack_explorer',
      name: 'Pack Explorador ($5)',
      priceUsd: 5,
      kingBonus: 250,
      resources: { wood: 5000, stone: 5000, food: 6000 },
      troops: { infantry: 20, archer: 10, cavalry: 0 },
      shieldHours: 48,
      builders: 1,
      image: '/assets/landing/pack-explorer.png',
    },
    {
      id: 'pack_conqueror',
      name: 'Pack Conquistador ($15)',
      priceUsd: 15,
      kingBonus: 850,
      resources: { wood: 16000, stone: 16000, food: 20000 },
      troops: { infantry: 50, archer: 25, cavalry: 10 },
      shieldHours: 72,
      builders: 2,
      image: '/assets/landing/pack-conqueror.png',
    },
    {
      id: 'pack_sovereign',
      name: 'Pack Soberano ($25)',
      priceUsd: 25,
      kingBonus: 1600,
      resources: { wood: 35000, stone: 35000, food: 45000 },
      troops: { infantry: 100, archer: 60, cavalry: 30 },
      shieldHours: 120,
      builders: 2,
      title: 'Título Fundador Imperial',
      image: '/assets/landing/pack-sovereign.png',
    },
  ],
}
