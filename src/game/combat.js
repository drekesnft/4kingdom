/**
 * FourKingdom — Motor de Combate (Alpha v0.1)
 * 3 rondas simultáneas, formación por líneas, muralla, defensa de tropa,
 * daño acumulativo y regla de victoria estricta.
 */

import { TROOPS_CONFIG, BUILDINGS_CONFIG } from './config'

// Orden de formación para recibir daño: 1. Infantería, 2. Caballería, 3. Arquero
const FORMATION_DAMAGE_ORDER = ['infantry', 'cavalry', 'archer']

/**
 * Calcula el daño total de ataque de un ejército
 */
export function calculateArmyAttack(army, hasHunger = false) {
  let attack = 0
  for (const type of ['infantry', 'cavalry', 'archer']) {
    const count = army[type] || 0
    if (count > 0) {
      attack += count * TROOPS_CONFIG[type].attack
    }
  }
  if (hasHunger) {
    attack *= 0.80 // -20% por hambre
  }
  return Math.round(attack)
}

/**
 * Cuenta total de tropas
 */
export function totalTroopCount(army) {
  return (army.infantry || 0) + (army.cavalry || 0) + (army.archer || 0)
}

/**
 * Aplica daño entrante a la formación
 * Devuelve el nuevo estado del ejército y el daño sobrante acumulado
 */
function applyDamageToArmy(army, incomingDamage, existingLeftoverDamage, hasHunger = false) {
  const currentArmy = { ...army }
  let remainingRawDamage = incomingDamage
  let leftoverDmg = existingLeftoverDamage

  for (const troopType of FORMATION_DAMAGE_ORDER) {
    const count = currentArmy[troopType] || 0
    if (count <= 0 || remainingRawDamage <= 0) continue

    const conf = TROOPS_CONFIG[troopType]
    // Defensa reducida si hay hambre
    const defenseRate = hasHunger ? conf.defense * 0.80 : conf.defense
    const hpPerUnit = conf.hp

    // El daño absorbible por esta unidad
    // daño_neto = daño_crudo * (1 - defensa)
    const netDamageFactor = 1 - defenseRate

    // Si ya teníamos daño previo sobre este tipo de tropa
    let netDamageNeededToKillFirst = hpPerUnit - leftoverDmg
    let rawNeededForFirst = netDamageNeededToKillFirst / netDamageFactor

    if (remainingRawDamage >= rawNeededForFirst) {
      // Se mata la primera tropa dañada
      currentArmy[troopType] -= 1
      remainingRawDamage -= rawNeededForFirst
      leftoverDmg = 0

      // Matar tantas tropas enteras adicionales como alcance el daño restante
      const rawPerUnit = hpPerUnit / netDamageFactor
      const additionalKills = Math.min(currentArmy[troopType], Math.floor(remainingRawDamage / rawPerUnit))

      currentArmy[troopType] -= additionalKills
      remainingRawDamage -= additionalKills * rawPerUnit

      // Si quedan tropas vivas de este tipo, el daño restante hiere a una de ellas
      if (currentArmy[troopType] > 0 && remainingRawDamage > 0) {
        const netDmgDealt = remainingRawDamage * netDamageFactor
        leftoverDmg = Math.min(hpPerUnit - 1, netDmgDealt)
        remainingRawDamage = 0
      }
    } else {
      // No alcanza a matar una tropa, se acumula el daño
      leftoverDmg += remainingRawDamage * netDamageFactor
      remainingRawDamage = 0
    }
  }

  return { army: currentArmy, leftoverDamage: leftoverDmg }
}

/**
 * Simula el combate de hasta 3 rondas
 * @param {Object} attackerArmy { infantry, archer, cavalry }
 * @param {Object} defenderArmy { infantry, archer, cavalry }
 * @param {number} wallLevel Nivel de muralla del defensor (0 si no aplica)
 * @param {boolean} attackerHunger Penalización de hambre
 * @param {boolean} defenderHunger Penalización de hambre
 */
export function simulateBattle(attackerArmy, defenderArmy, wallLevel = 0, attackerHunger = false, defenderHunger = false) {
  let atkCurrent = { ...attackerArmy }
  let defCurrent = { ...defenderArmy }

  const roundsLog = []
  let atkLeftover = 0
  let defLeftover = 0

  const wallBonus = wallLevel > 0 ? (BUILDINGS_CONFIG.wall.levels[wallLevel]?.defenseBonus || 0) : 0
  // Absorción de ataques ligeros según nivel de muralla (1 a 3 infanterías = 10 a 30 de daño absorbido)
  const wallAbsorptionThreshold = wallLevel > 0 ? Math.min(30, 5 + wallLevel * 5) : 0

  for (let round = 1; round <= 3; round++) {
    const atkTroops = totalTroopCount(atkCurrent)
    const defTroops = totalTroopCount(defCurrent)

    if (atkTroops === 0 || defTroops === 0) break

    // 1. Calcular ataques simultáneos
    const rawAtkDamage = calculateArmyAttack(atkCurrent, attackerHunger)
    const rawDefDamage = calculateArmyAttack(defCurrent, defenderHunger)

    // 2. Aplicar Muralla:
    // A) Neutraliza ataques ligeros equivalentes a 1-3 infanterías según nivel
    const damageAfterWallAbsorption = Math.max(0, rawAtkDamage - wallAbsorptionThreshold)
    // B) Aplica reducción porcentual de daño de la muralla
    const netDamageToDef = Math.round(damageAfterWallAbsorption * (1 - wallBonus))
    const netDamageToAtk = rawDefDamage

    // 3. Aplicar daño simultáneo a formaciones
    const defResult = applyDamageToArmy(defCurrent, netDamageToDef, defLeftover, defenderHunger)
    const atkResult = applyDamageToArmy(atkCurrent, netDamageToAtk, atkLeftover, attackerHunger)

    atkCurrent = atkResult.army
    atkLeftover = atkResult.leftoverDamage

    defCurrent = defResult.army
    defLeftover = defResult.leftoverDamage

    roundsLog.push({
      round,
      attackerDamageDealt: netDamageToDef,
      defenderDamageDealt: netDamageToAtk,
      attackerSurviving: { ...atkCurrent },
      defenderSurviving: { ...defCurrent },
    })

    // Si el defensor llega a 0 en cualquier ronda, termina la batalla
    if (totalTroopCount(defCurrent) === 0 || totalTroopCount(atkCurrent) === 0) {
      break
    }
  }

  // Regla de victoria Sección 22:
  // Si el defensor llega a 0 tropas -> victoria atacante
  // Si después de 3 rondas queda al menos 1 defensor -> defensa exitosa (derrota atacante)
  const defenderRemaining = totalTroopCount(defCurrent)
  const attackerRemaining = totalTroopCount(atkCurrent)

  const isAttackerVictory = defenderRemaining === 0 && attackerRemaining > 0

  // Cálculo de bajas y enemigos eliminados
  const attackerCasualties = {
    infantry: (attackerArmy.infantry || 0) - (atkCurrent.infantry || 0),
    archer: (attackerArmy.archer || 0) - (atkCurrent.archer || 0),
    cavalry: (attackerArmy.cavalry || 0) - (atkCurrent.cavalry || 0),
  }

  const defenderCasualties = {
    infantry: (defenderArmy.infantry || 0) - (defCurrent.infantry || 0),
    archer: (defenderArmy.archer || 0) - (defCurrent.archer || 0),
    cavalry: (defenderArmy.cavalry || 0) - (defCurrent.cavalry || 0),
  }

  return {
    isAttackerVictory,
    roundsCount: roundsLog.length,
    roundsLog,
    attackerInitial: attackerArmy,
    attackerSurviving: atkCurrent,
    attackerCasualties,
    defenderInitial: defenderArmy,
    defenderSurviving: defCurrent,
    defenderCasualties,
    wallBonusApplied: wallBonus,
  }
}

/**
 * Calcula la capacidad de carga total de un ejército
 */
export function calculateArmyCarry(army) {
  let carry = 0
  for (const type of ['infantry', 'cavalry', 'archer']) {
    const count = army[type] || 0
    if (count > 0) {
      carry += count * TROOPS_CONFIG[type].carry
    }
  }
  return carry
}

/**
 * Genera el reporte final de combate según el formato del GDD (Sección 23)
 */
export function generateCombatReport(battleResult, loot = null, kingLoot = 0, targetName = 'Objetivo') {
  const { isAttackerVictory, attackerInitial, attackerSurviving, attackerCasualties, defenderCasualties } = battleResult

  const totalSent = totalTroopCount(attackerInitial)
  const totalReturned = totalTroopCount(attackerSurviving)
  const totalLosses = totalTroopCount(attackerCasualties)
  const totalKills = totalTroopCount(defenderCasualties)

  return {
    id: `rep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    targetName,
    result: isAttackerVictory ? 'VICTORIA' : 'DERROTA',
    isVictory: isAttackerVictory,
    sent: attackerInitial,
    totalSent,
    returned: attackerSurviving,
    totalReturned,
    casualties: attackerCasualties,
    totalLosses,
    enemiesKilled: defenderCasualties,
    totalKills,
    loot: isAttackerVictory ? (loot || { wood: 0, stone: 0, food: 0 }) : { wood: 0, stone: 0, food: 0 },
    kingLoot: isAttackerVictory ? kingLoot : 0,
  }
}
