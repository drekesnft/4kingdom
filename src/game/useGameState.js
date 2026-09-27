/**
 * FourKingdom — Hook principal de lógica y estado reactivo del juego
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  KING_CONFIG,
  INITIAL_PLAYER_DATA,
  TROOPS_CONFIG,
  BUILDINGS_CONFIG,
  LOGISTICS_PENALTIES,
  RESOURCE_TIERS,
  NPC_TIERS,
  HERO_MISSIONS,
  REGIONAL_KINGDOMS,
  STORE_ITEMS,
} from './config'
import {
  simulateBattle,
  calculateArmyCarry,
  generateCombatReport,
  totalTroopCount,
} from './combat'

const STORAGE_KEY = 'fourkingdoms_alpha_save_v1'

export function useGameState(baseCoord = { worldX: 4, worldY: -3 }) {
  // Estado persistente o inicial
  const [resources, setResources] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).resources } catch {}
    }
    return { ...INITIAL_PLAYER_DATA.resources }
  })

  const [king, setKing] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).king } catch {}
    }
    return { ...INITIAL_PLAYER_DATA.king }
  })

  const [buildings, setBuildings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).buildings } catch {}
    }
    return { ...INITIAL_PLAYER_DATA.buildings }
  })

  const [buildingUnderConstruction, setBuildingUnderConstruction] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).buildingUnderConstruction } catch {}
    }
    return null // { buildingId, targetLevel, finishTime, totalSec }
  })

  const [troops, setTroops] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).troops } catch {}
    }
    return { ...INITIAL_PLAYER_DATA.troops }
  })

  const [trainingQueue, setTrainingQueue] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).trainingQueue } catch {}
    }
    return [] // [{ id, troopId, count, finishTime, totalSec }]
  })

  const [marches, setMarches] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).marches } catch {}
    }
    return []
  })

  const [hero, setHero] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).hero } catch {}
    }
    return {
      energy: 3,
      maxEnergy: 3,
      nextEnergyAt: null,
      activeMission: null, // { id, missionId, finishTime, totalSec }
    }
  })

  const [shieldUntil, setShieldUntil] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).shieldUntil } catch {}
    }
    return Date.now() + 24 * 3600 * 1000 // 24h inicial
  })

  const [battleReports, setBattleReports] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { return JSON.parse(saved).battleReports } catch {}
    }
    return []
  })

  const [dailyWithdrawnKing, setDailyWithdrawnKing] = useState(0)
  const [pvpCooldowns, setPvpCooldowns] = useState({}) // { [targetId]: timestamp }
  const [activeRally, setActiveRally] = useState(null)
  const [recentNotification, setRecentNotification] = useState(null)
  const [speedMultiplier, setSpeedMultiplier] = useState(1) // 1x normal, configurable para testing
  const [hungerStartTime, setHungerStartTime] = useState(null)

  // Guardar estado
  useEffect(() => {
    const stateToSave = {
      resources,
      king,
      buildings,
      buildingUnderConstruction,
      troops,
      trainingQueue,
      marches,
      hero,
      shieldUntil,
      battleReports: battleReports.slice(0, 30),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
  }, [resources, king, buildings, buildingUnderConstruction, troops, trainingQueue, marches, hero, shieldUntil, battleReports])

  // --- CÁLCULOS DINÁMICOS DERIVADOS ---

  // 1. Capacidad Logística y Tropas Productivas para KING (Granero)
  const granaryLevel = buildings.granary
  const granaryDef = BUILDINGS_CONFIG.granary.levels[granaryLevel]
  const logisticsCapacity = granaryDef.logisticsCapacity
  const maxKingProductiveTroops = granaryDef.kingProductiveCap

  // Tropas totales del jugador (en casa + en marchas)
  const troopsInMarches = useMemo(() => {
    const count = { infantry: 0, archer: 0, cavalry: 0 }
    for (const m of marches) {
      count.infantry += m.army.infantry || 0
      count.archer += m.army.archer || 0
      count.cavalry += m.army.cavalry || 0
    }
    return count
  }, [marches])

  const totalTroopsOwned = useMemo(() => ({
    infantry: troops.infantry + troopsInMarches.infantry,
    archer: troops.archer + troopsInMarches.archer,
    cavalry: troops.cavalry + troopsInMarches.cavalry,
  }), [troops, troopsInMarches])

  const totalTroopsCount = useMemo(() => totalTroopCount(totalTroopsOwned), [totalTroopsOwned])

  // Multiplicador por exceso logístico (Sección 9)
  const logisticsRatio = logisticsCapacity > 0 ? (totalTroopsCount / logisticsCapacity) : 1
  const logisticsMultiplier = useMemo(() => {
    for (const step of LOGISTICS_PENALTIES) {
      if (logisticsRatio <= step.threshold) return step.multiplier
    }
    return 3.00
  }, [logisticsRatio])

  // Consumo de comida por hora (Infantería: 1, Arquero: 1, Caballería: 2)
  const baseFoodUpkeepPerHour = useMemo(() => {
    return (
      totalTroopsOwned.infantry * TROOPS_CONFIG.infantry.foodUpkeepPerHour +
      totalTroopsOwned.archer * TROOPS_CONFIG.archer.foodUpkeepPerHour +
      totalTroopsOwned.cavalry * TROOPS_CONFIG.cavalry.foodUpkeepPerHour
    )
  }, [totalTroopsOwned])

  const totalFoodUpkeepPerHour = Math.round(baseFoodUpkeepPerHour * logisticsMultiplier)

  // Producción pasiva del reino (Sección 24)
  const castleDef = BUILDINGS_CONFIG.castle.levels[buildings.castle]
  const passiveProductionPerHour = castleDef.passivePerHour

  // Estado de Hambre (Sección 9)
  const isHungry = resources.food <= 0

  // 2. Tropas productivas para KING (Sección 10):
  // Cuentan automáticamente las tropas elegibles con mayor Poder que estén ESTACIONADAS EN CASA.
  const productiveTroopsCount = useMemo(() => {
    // Ordenar de mayor poder a menor poder: Caballería (50) -> Arquero (32) -> Infantería (30)
    let remainingCap = maxKingProductiveTroops
    let count = 0

    // Caballería en casa
    const cavUsed = Math.min(troops.cavalry, remainingCap)
    count += cavUsed
    remainingCap -= cavUsed

    // Arquero en casa
    const arcUsed = Math.min(troops.archer, remainingCap)
    count += arcUsed
    remainingCap -= arcUsed

    // Infantería en casa
    const infUsed = Math.min(troops.infantry, remainingCap)
    count += infUsed

    return count
  }, [troops, maxKingProductiveTroops])

  // Estimación de farming diario de KING (Sección 34)
  // poolDiario = 2488.89, estimando mundo inicial = 2000 tropas productivas
  const estimatedDailyKing = useMemo(() => {
    const worldProductiveTroops = 2000
    const pool = KING_CONFIG.DAILY_FARMING_POOL_INITIAL
    return Number(((pool * productiveTroopsCount) / (worldProductiveTroops + productiveTroopsCount)).toFixed(2))
  }, [productiveTroopsCount])

  // 3. Tesorería: Protegido vs Expuesto (Sección 11)
  const treasuryDef = BUILDINGS_CONFIG.treasury.levels[buildings.treasury]
  const treasuryProtectionLimit = treasuryDef.protectedKing
  const treasuryPendingLimit = treasuryDef.pendingMax
  const treasuryDailyWithdrawLimit = treasuryDef.dailyWithdrawMax

  const kingProtected = Math.min(king.claimed, treasuryProtectionLimit)
  const kingExposed = Math.max(0, king.claimed - treasuryProtectionLimit)

  // 4. Poder del Reino total (Sección 38)
  const kingdomPower = useMemo(() => {
    let power = 0
    // Edificios
    for (const [bId, level] of Object.entries(buildings)) {
      power += BUILDINGS_CONFIG[bId].levels[level]?.power || 0
    }
    // Tropas
    power += totalTroopsOwned.infantry * TROOPS_CONFIG.infantry.power
    power += totalTroopsOwned.archer * TROOPS_CONFIG.archer.power
    power += totalTroopsOwned.cavalry * TROOPS_CONFIG.cavalry.power
    return power
  }, [buildings, totalTroopsOwned])

  // 5. Límites de marchas simultáneas (Sección 6)
  const maxSimultaneousMarches = castleDef.marches
  const activeMarchesCount = marches.length

  // --- TICKS EN TIEMPO REAL (1s) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      // A. Producción Pasiva & Consumo de Comida por segundo
      let isZeroFood = false
      setResources((prev) => {
        const deltaSec = 1
        const woodAdd = (passiveProductionPerHour.wood / 3600) * deltaSec
        const stoneAdd = (passiveProductionPerHour.stone / 3600) * deltaSec
        const foodNetDelta = ((passiveProductionPerHour.food - totalFoodUpkeepPerHour) / 3600) * deltaSec
        const nextFood = Math.max(0, Math.round((prev.food + foodNetDelta) * 100) / 100)

        if (nextFood <= 0) isZeroFood = true
        return {
          wood: Math.round((prev.wood + woodAdd) * 100) / 100,
          stone: Math.round((prev.stone + stoneAdd) * 100) / 100,
          food: nextFood,
        }
      })

      // Control de hambre y deserción progresiva tras más de 1 hora (3600s)
      setHungerStartTime((currentStart) => {
        if (isZeroFood) {
          if (!currentStart) return now
          const elapsedMs = now - currentStart
          // Si pasa más de 1 hora (3600s) con saldo negativo, desertan tropas hasta balancear
          if (elapsedMs >= (3600 * 1000) / speedMultiplier) {
            const netRate = passiveProductionPerHour.food - totalFoodUpkeepPerHour
            if (netRate < 0) {
              setTroops((t) => {
                if (t.cavalry > 0) return { ...t, cavalry: t.cavalry - 1 }
                if (t.archer > 0) return { ...t, archer: t.archer - 1 }
                if (t.infantry > 0) return { ...t, infantry: t.infantry - 1 }
                return t
              })
              setRecentNotification('¡Deserción por hambre! Tras más de 1 hora sin comida, tropas abandonan el reino hasta equilibrar el consumo a 0.')
            }
          }
          return currentStart
        }
        return null
      })

      // B. Acumulación pasiva de KING pendiente (farming cada tick)
      if (productiveTroopsCount > 0) {
        setKing((prev) => {
          const kingPerSec = estimatedDailyKing / 86400
          const maxOverflow = treasuryPendingLimit * 1.25 // Overflow de 25%
          const newPending = Math.min(maxOverflow, prev.pending + kingPerSec)
          return { ...prev, pending: Number(newPending.toFixed(4)) }
        })
      }

      // C. Verificación de Construcción completada
      setBuildingUnderConstruction((current) => {
        if (!current) return null
        if (now >= current.finishTime) {
          setBuildings((b) => ({ ...b, [current.buildingId]: current.targetLevel }))
          setRecentNotification(`¡${BUILDINGS_CONFIG[current.buildingId].name} ha subido al Nivel ${current.targetLevel}!`)
          return null
        }
        return current
      })

      // D. Verificación de Cola de Reclutamiento
      setTrainingQueue((prevQueue) => {
        if (!prevQueue.length) return prevQueue
        const currentBatch = prevQueue[0]
        if (now >= currentBatch.finishTime) {
          // Finalizó este lote de tropas
          setTroops((t) => ({ ...t, [currentBatch.troopId]: t[currentBatch.troopId] + currentBatch.count }))
          setRecentNotification(`¡Entrenamiento completado: +${currentBatch.count} ${TROOPS_CONFIG[currentBatch.troopId].name}!`)
          const nextQueue = prevQueue.slice(1)
          // Si hay otro lote, ajustar su finishTime si no había comenzado
          if (nextQueue.length > 0) {
            nextQueue[0] = {
              ...nextQueue[0],
              finishTime: now + nextQueue[0].totalSec * 1000,
            }
          }
          return nextQueue
        }
        return prevQueue
      })

      // E. Verificación de Misión de Héroe
      setHero((prevHero) => {
        let updated = { ...prevHero }
        // Regeneración de energía cada 4h (14400s)
        if (updated.energy < updated.maxEnergy) {
          if (!updated.nextEnergyAt) {
            updated.nextEnergyAt = now + 14400 * 1000
          } else if (now >= updated.nextEnergyAt) {
            updated.energy += 1
            updated.nextEnergyAt = updated.energy < updated.maxEnergy ? now + 14400 * 1000 : null
          }
        }

        // Misión activa
        if (updated.activeMission && now >= updated.activeMission.finishTime) {
          const missionDef = HERO_MISSIONS[updated.activeMission.missionId]
          const roll = Math.random()
          const isSuccess = roll <= missionDef.successRate

          if (isSuccess) {
            const rewardRes = Math.floor(Math.random() * (missionDef.rewardMax - missionDef.rewardMin + 1)) + missionDef.rewardMin
            const split = Math.floor(rewardRes / 3)
            setResources((r) => ({
              wood: r.wood + split,
              stone: r.stone + split,
              food: r.food + split,
            }))

            let kingReward = 0
            if (missionDef.hasKingDrop && Math.random() <= missionDef.kingDropChance) {
              kingReward = missionDef.kingAmount
              setKing((k) => ({ ...k, pending: k.pending + kingReward }))
            }

            setRecentNotification(`¡Héroe: ${missionDef.name} EXITOSA! +${split}W, +${split}S, +${split}F ${kingReward > 0 ? `y +${kingReward} KING` : ''}`)
          } else {
            setRecentNotification(`Héroe: ${missionDef.name} fracasó. No hubo recompensas.`)
          }
          updated.activeMission = null
        }
        return updated
      })

      // F. Verificación y Progreso de Marchas en curso
      setMarches((prevMarches) => {
        if (!prevMarches.length) return prevMarches

        const updated = []
        for (const march of prevMarches) {
          // Fase 1: Viaje de ida completado -> Combate o inicio de recolección
          if (march.status === 'traveling' && now >= march.arriveTime) {
            if (march.type === 'gather') {
              // Empieza a recolectar
              updated.push({
                ...march,
                status: 'gathering',
              })
              setRecentNotification(`Tus tropas llegaron a (${march.targetX}, ${march.targetY}) y han comenzado a recolectar.`)
            } else if (march.type === 'npc') {
              // Combate instantáneo contra NPC
              const npcDef = NPC_TIERS[march.targetLevel || 1]
              const battle = simulateBattle(march.army, npcDef.army, 0, isHungry, false)

              let loot = { wood: 0, stone: 0, food: 0 }
              let kingDrop = 0

              if (battle.isAttackerVictory) {
                // Cálculo de botín dentro de la capacidad de carga de los supervivientes
                const carryCapacity = calculateArmyCarry(battle.attackerSurviving)
                const rawLoot = Math.floor(Math.random() * (npcDef.maxResourceReward - npcDef.minResourceReward + 1)) + npcDef.minResourceReward
                const actualLoot = Math.min(rawLoot, carryCapacity)
                const split = Math.floor(actualLoot / 3)
                loot = { wood: split, stone: split, food: split }

                if (Math.random() <= npcDef.kingDropRate) {
                  kingDrop = npcDef.kingDropAmount
                }
              }

              const report = generateCombatReport(battle, loot, kingDrop, npcDef.name)
              setBattleReports((reps) => [report, ...reps])

              if (totalTroopCount(battle.attackerSurviving) > 0) {
                // Viaje de regreso con supervivientes
                const travelBackDuration = march.oneWayDurationMs
                updated.push({
                  ...march,
                  status: 'returning',
                  army: battle.attackerSurviving,
                  returnTime: now + travelBackDuration,
                  loot,
                  kingLoot: kingDrop,
                })
                setRecentNotification(`¡Batalla contra ${npcDef.name}: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}! Supervivientes regresando.`)
              } else {
                setRecentNotification(`Derrota total ante ${npcDef.name}. Todas las tropas enviadas fueron aniquiladas.`)
              }
            } else if (march.type === 'pvp') {
              // Combate contra otro jugador
              const defenderWall = 2
              const defenderSimulatedArmy = { infantry: 15, archer: 8, cavalry: 2 }
              const battle = simulateBattle(march.army, defenderSimulatedArmy, defenderWall, isHungry, false)

              let loot = { wood: 0, stone: 0, food: 0 }
              let kingStolen = 0

              if (battle.isAttackerVictory) {
                const carryCapacity = calculateArmyCarry(battle.attackerSurviving)
                // Saqueo base 30% reducido por Muralla (Wall 2 = -10% => 27%)
                const baseLoot = Math.min(1200, carryCapacity)
                const split = Math.floor(baseLoot / 3)
                loot = { wood: split, stone: split, food: split }
                kingStolen = 5 // 20% de KING expuesto
              }

              const report = generateCombatReport(battle, loot, kingStolen, march.targetName || 'Jugador Rival')
              setBattleReports((reps) => [report, ...reps])

              if (totalTroopCount(battle.attackerSurviving) > 0) {
                updated.push({
                  ...march,
                  status: 'returning',
                  army: battle.attackerSurviving,
                  returnTime: now + march.oneWayDurationMs,
                  loot,
                  kingLoot: kingStolen,
                })
                setRecentNotification(`¡Asalto PvP: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}! Regresando con el botín.`)
              } else {
                setRecentNotification(`Tus tropas fueron derrotadas en el asalto PvP contra ${march.targetName}.`)
              }
            } else if (march.type === 'fortress' || march.type === 'capital') {
              // Combate contra guarnición de Fortaleza o Capital
              const garrisonArmy = { infantry: 40, archer: 20, cavalry: 10 }
              const battle = simulateBattle(march.army, garrisonArmy, 3, isHungry, false)
              const report = generateCombatReport(battle, { wood: 1000, stone: 1000, food: 1000 }, 15, march.targetName)
              setBattleReports((reps) => [report, ...reps])

              if (battle.isAttackerVictory) {
                setRecentNotification(`¡Conquista gloriosa de ${march.targetName}! Has reclamado el bastión.`)
              } else if (totalTroopCount(battle.attackerSurviving) > 0) {
                updated.push({
                  ...march,
                  status: 'returning',
                  army: battle.attackerSurviving,
                  returnTime: now + march.oneWayDurationMs,
                  loot: { wood: 0, stone: 0, food: 0 },
                  kingLoot: 0,
                })
              }
            }
          }
          // Fase 2: Recolección terminada -> Emprender viaje de regreso
          else if (march.status === 'gathering' && now >= march.gatherUntil) {
            const carry = calculateArmyCarry(march.army)
            const mined = Math.min(carry, march.nodeResourceMax || 500)
            const split = Math.floor(mined / 3)
            const loot = { wood: 0, stone: 0, food: 0 }
            if (march.resourceType === 'wood') loot.wood = mined
            else if (march.resourceType === 'stone') loot.stone = mined
            else if (march.resourceType === 'food') loot.food = mined
            else { loot.wood = split; loot.stone = split; loot.food = split }

            updated.push({
              ...march,
              status: 'returning',
              returnTime: now + march.oneWayDurationMs,
              loot,
            })
            setRecentNotification(`Recolección finalizada en (${march.targetX}, ${march.targetY}). Marcha regresando a casa.`)
          }
          // Fase 3: Regreso completado -> Tropas vuelven a casa y se acredita el botín
          else if (march.status === 'returning' && now >= march.returnTime) {
            // Acreditar tropas supervivientes
            setTroops((t) => ({
              infantry: t.infantry + (march.army.infantry || 0),
              archer: t.archer + (march.army.archer || 0),
              cavalry: t.cavalry + (march.army.cavalry || 0),
            }))

            // Acreditar recursos
            if (march.loot) {
              setResources((r) => ({
                wood: r.wood + (march.loot.wood || 0),
                stone: r.stone + (march.loot.stone || 0),
                food: r.food + (march.loot.food || 0),
              }))
            }

            // Acreditar KING obtenido
            if (march.kingLoot > 0) {
              setKing((k) => ({ ...k, pending: k.pending + march.kingLoot }))
            }

            setRecentNotification(`Marcha de regreso completada. Recursos y tropas descargados en la ciudad.`)
          } else {
            updated.push(march)
          }
        }

        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [
    passiveProductionPerHour,
    totalFoodUpkeepPerHour,
    productiveTroopsCount,
    estimatedDailyKing,
    treasuryPendingLimit,
    isHungry,
  ])

  // --- ACCIONES DEL JUGADOR ---

  // 1. Mejorar Edificio (con chequeo de prerrequisitos)
  const canUpgradeBuilding = useCallback((buildingId) => {
    if (buildingUnderConstruction) return { can: false, reason: 'El constructor está ocupado.' }
    const currentLvl = buildings[buildingId]
    if (currentLvl >= 5) return { can: false, reason: 'Nivel máximo alcanzado para Alpha (Nv.5).' }

    const targetLvl = currentLvl + 1
    const conf = BUILDINGS_CONFIG[buildingId].levels[targetLvl]

    // Requisito del Castillo (Sección 6):
    // "Para subir el Castillo a un nivel, los otros 4 edificios deben estar al nivel anterior"
    if (buildingId === 'castle') {
      const requiredLvl = currentLvl // N-1 relativo al target
      const others = ['barracks', 'granary', 'treasury', 'wall']
      for (const other of others) {
        if (buildings[other] < requiredLvl) {
          return {
            can: false,
            reason: `Castillo Nv.${targetLvl} requiere ${BUILDINGS_CONFIG[other].name} Nv.${requiredLvl}.`,
          }
        }
      }
    } else {
      // Otros edificios no pueden superar el nivel del Castillo
      if (currentLvl >= buildings.castle) {
        return {
          can: false,
          reason: `Requiere subir el Castillo a Nv.${targetLvl} primero.`,
        }
      }
    }

    // Recursos suficientes
    if (
      resources.wood < conf.cost.wood ||
      resources.stone < conf.cost.stone ||
      resources.food < conf.cost.food
    ) {
      return { can: false, reason: 'Recursos insuficientes.' }
    }

    return { can: true, cost: conf.cost, timeSec: conf.upgradeTimeSec }
  }, [buildingUnderConstruction, buildings, resources])

  const upgradeBuilding = useCallback((buildingId) => {
    const check = canUpgradeBuilding(buildingId)
    if (!check.can) return check

    const currentLvl = buildings[buildingId]
    const targetLvl = currentLvl + 1
    const cost = check.cost
    const durationSec = Math.max(5, check.timeSec / speedMultiplier)

    // Deducción de recursos
    setResources((r) => ({
      wood: r.wood - cost.wood,
      stone: r.stone - cost.stone,
      food: r.food - cost.food,
    }))

    setBuildingUnderConstruction({
      buildingId,
      targetLevel: targetLvl,
      finishTime: Date.now() + durationSec * 1000,
      totalSec: durationSec,
    })

    setRecentNotification(`Construcción iniciada: ${BUILDINGS_CONFIG[buildingId].name} Nv.${targetLvl}.`)
    return { success: true }
  }, [canUpgradeBuilding, buildings, speedMultiplier])

  // 2. Aceleración Universal con KING (Sección 4: 1 KING = 30 segundos, con decimales según exactitud)
  const calculateKingCostForSec = (secRemaining) => Math.max(0.01, Number((secRemaining / KING_CONFIG.SEC_PER_KING).toFixed(2)))

  const speedupBuilding = useCallback(() => {
    if (!buildingUnderConstruction) return
    const remainingSec = Math.max(1, Math.ceil((buildingUnderConstruction.finishTime - Date.now()) / 1000))
    const cost = calculateKingCostForSec(remainingSec)

    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING.`)
      return
    }

    setKing((k) => ({ ...k, claimed: Math.max(0, Number((k.claimed - cost).toFixed(2))) }))
    setBuildings((b) => ({ ...b, [buildingUnderConstruction.buildingId]: buildingUnderConstruction.targetLevel }))
    setRecentNotification(`¡Construcción acelerada con ${cost} KING! ${BUILDINGS_CONFIG[buildingUnderConstruction.buildingId].name} Nv.${buildingUnderConstruction.targetLevel}.`)
    setBuildingUnderConstruction(null)
  }, [buildingUnderConstruction, king.claimed])

  // 3. Reclutamiento de Tropas
  const recruitTroops = useCallback((troopId, count) => {
    const barracksLvl = buildings.barracks
    const barracksDef = BUILDINGS_CONFIG.barracks.levels[barracksLvl]

    // Comprobar si la tropa está desbloqueada
    if (!barracksDef.unlockedTroops.includes(troopId)) {
      return { success: false, reason: `Desbloquea ${TROOPS_CONFIG[troopId].name} subiendo el Cuartel.` }
    }

    // Comprobar espacio en cola
    const currentQueueCount = trainingQueue.reduce((acc, b) => acc + b.count, 0)
    if (currentQueueCount + count > barracksDef.maxQueue) {
      return { success: false, reason: `Capacidad de cola del Cuartel excedida (máx ${barracksDef.maxQueue}).` }
    }

    // Costes
    const conf = TROOPS_CONFIG[troopId]
    const totalCost = {
      wood: conf.cost.wood * count,
      stone: conf.cost.stone * count,
      food: conf.cost.food * count,
    }

    if (
      resources.wood < totalCost.wood ||
      resources.stone < totalCost.stone ||
      resources.food < totalCost.food
    ) {
      return { success: false, reason: 'Recursos insuficientes para entrenar.' }
    }

    // Tiempo con bonus del Cuartel (0% a 40%)
    const rawTimeSec = conf.trainTimeSec * count
    const discountedSec = Math.round(rawTimeSec * (1 - barracksDef.speedBonus))
    const finalSec = Math.max(4, discountedSec / speedMultiplier)

    // Deducción
    setResources((r) => ({
      wood: r.wood - totalCost.wood,
      stone: r.stone - totalCost.stone,
      food: r.food - totalCost.food,
    }))

    const now = Date.now()
    const lastQueueTime = trainingQueue.length > 0 ? trainingQueue[trainingQueue.length - 1].finishTime : now
    const finishTime = lastQueueTime + finalSec * 1000

    const newBatch = {
      id: `queue_${Date.now()}_${Math.random()}`,
      troopId,
      count,
      finishTime,
      totalSec: finalSec,
    }

    setTrainingQueue((q) => [...q, newBatch])
    setRecentNotification(`Reclutando ${count} ${conf.name}...`)
    return { success: true }
  }, [buildings.barracks, trainingQueue, resources, speedMultiplier])

  const speedupTraining = useCallback(() => {
    if (!trainingQueue.length) return
    const currentBatch = trainingQueue[0]
    const remainingSec = Math.max(1, Math.ceil((currentBatch.finishTime - Date.now()) / 1000))
    const cost = calculateKingCostForSec(remainingSec)

    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING.`)
      return
    }

    setKing((k) => ({ ...k, claimed: Math.max(0, Number((k.claimed - cost).toFixed(2))) }))
    setTroops((t) => ({ ...t, [currentBatch.troopId]: t[currentBatch.troopId] + currentBatch.count }))
    setRecentNotification(`¡Entrenamiento acelerado con ${cost} KING! +${currentBatch.count} ${TROOPS_CONFIG[currentBatch.troopId].name}`)

    const nextQueue = trainingQueue.slice(1)
    if (nextQueue.length > 0) {
      nextQueue[0] = {
        ...nextQueue[0],
        finishTime: Date.now() + nextQueue[0].totalSec * 1000,
      }
    }
    setTrainingQueue(nextQueue)
  }, [trainingQueue, king.claimed])

  // 4. Despacho de Marchas (Distancia Chebyshev + Velocidad)
  const dispatchMarch = useCallback(({ type, targetX, targetY, targetName, army, resourceType = null, nodeResourceMax = 500, targetLevel = 1 }) => {
    if (marches.length >= maxSimultaneousMarches) {
      return { success: false, reason: `Límite de marchas simultáneas alcanzado (${maxSimultaneousMarches}). Sube el Castillo.` }
    }

    const marchTroopCount = totalTroopCount(army)
    if (marchTroopCount === 0) {
      return { success: false, reason: 'Debes enviar al menos una tropa.' }
    }

    // Comprobar tropas disponibles en casa
    for (const [tId, count] of Object.entries(army)) {
      if ((troops[tId] || 0) < count) {
        return { success: false, reason: `No tienes suficientes tropas de ${TROOPS_CONFIG[tId]?.name || tId} en casa.` }
      }
    }

    // Si es PvP y el atacante tiene escudo de paz, el ataque rompe el escudo (Sección 43)
    if (type === 'pvp' && shieldUntil > Date.now()) {
      setShieldUntil(0)
      setRecentNotification('¡Al iniciar un asalto PvP has roto tu Escudo de Paz!')
    }

    // Distancia Chebyshev: max(|x2-x1|, |y2-y1|)
    const dx = Math.abs(targetX - baseCoord.worldX)
    const dy = Math.abs(targetY - baseCoord.worldY)
    const distanceTiles = Math.max(dx, dy, 1)

    // Velocidad: Si solo Caballería -> 2 casillas/min (30s/tile); sino 1 casilla/min (60s/tile)
    const isOnlyCavalry = army.cavalry > 0 && (army.infantry || 0) === 0 && (army.archer || 0) === 0
    let secPerTile = isOnlyCavalry ? 30 : 60

    // Si hay hambre: -25% velocidad => +33% tiempo
    if (isHungry) {
      secPerTile = Math.round(secPerTile * 1.33)
    }

    // Para dinamismo en prototipo aplicamos escala
    const oneWaySec = Math.max(6, Math.round((distanceTiles * secPerTile) / speedMultiplier))
    const oneWayDurationMs = oneWaySec * 1000

    // Tiempo de recolección si es gather (Sección 27)
    let gatherDurationMs = 0
    if (type === 'gather') {
      const carry = calculateArmyCarry(army)
      const ratio = Math.min(1, carry / (nodeResourceMax || 250))
      const baseDrainSec = 300 // 5 min base
      const actualGatherSec = Math.max(10, Math.round((baseDrainSec * ratio) / speedMultiplier))
      gatherDurationMs = actualGatherSec * 1000
    }

    const now = Date.now()
    const arriveTime = now + oneWayDurationMs
    const gatherUntil = type === 'gather' ? arriveTime + gatherDurationMs : null

    // Restar tropas de casa
    setTroops((t) => ({
      infantry: t.infantry - (army.infantry || 0),
      archer: t.archer - (army.archer || 0),
      cavalry: t.cavalry - (army.cavalry || 0),
    }))

    const newMarch = {
      id: `march_${now}_${Math.random()}`,
      type,
      targetX,
      targetY,
      targetName,
      army: { ...army },
      resourceType,
      nodeResourceMax,
      targetLevel,
      startTime: now,
      arriveTime,
      gatherUntil,
      returnTime: null,
      oneWayDurationMs,
      status: 'traveling',
      distanceTiles,
    }

    setMarches((m) => [...m, newMarch])
    setRecentNotification(`Marcha despachada hacia (${targetX}, ${targetY}). Distancia: ${distanceTiles} casillas.`)
    return { success: true }
  }, [marches.length, maxSimultaneousMarches, troops, shieldUntil, baseCoord, isHungry, speedMultiplier])

  // Acelerar Marcha con KING
  const speedupMarch = useCallback((marchId) => {
    const march = marches.find((m) => m.id === marchId)
    if (!march) return

    let targetTime = march.arriveTime
    if (march.status === 'gathering') targetTime = march.gatherUntil
    if (march.status === 'returning') targetTime = march.returnTime

    const remainingSec = Math.max(1, Math.ceil((targetTime - Date.now()) / 1000))
    const cost = calculateKingCostForSec(remainingSec)

    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING.`)
      return
    }

    setKing((k) => ({ ...k, claimed: Math.max(0, Number((k.claimed - cost).toFixed(2))) }))
    setMarches((prev) => prev.map((m) => {
      if (m.id !== marchId) return m
      const now = Date.now()
      if (m.status === 'traveling') return { ...m, arriveTime: now }
      if (m.status === 'gathering') return { ...m, gatherUntil: now }
      if (m.status === 'returning') return { ...m, returnTime: now }
      return m
    }))
    setRecentNotification(`¡Marcha acelerada con ${cost} KING!`)
  }, [marches, king.claimed])

  // 5. Tesorería: Claim (sin fee) y Withdraw (5% fee)
  const claimPendingKing = useCallback(() => {
    if (king.pending <= 0) return
    const amount = king.pending
    setKing((prev) => ({
      ...prev,
      claimed: Number((prev.claimed + amount).toFixed(2)),
      pending: 0,
    }))
    setRecentNotification(`¡Reclamados ${amount.toFixed(2)} KING a la Tesorería sin comisiones!`)
  }, [king.pending])

  const withdrawKingToVault = useCallback((amount) => {
    const amt = Number(amount)
    if (amt <= 0 || amt > king.claimed) {
      setRecentNotification('Cantidad inválida o saldo insuficiente en tesorería.')
      return
    }

    if (dailyWithdrawnKing + amt > treasuryDailyWithdrawLimit) {
      setRecentNotification(`Límite diario de retiro excedido (${treasuryDailyWithdrawLimit} KING/día).`)
      return
    }

    // Fee del 5% (2% quema, 2% pool recompensas, 1% reino)
    const fee = amt * KING_CONFIG.WITHDRAW_FEE_PERCENT
    const netVaultAmount = amt - fee

    setKing((prev) => ({
      ...prev,
      claimed: Number((prev.claimed - amt).toFixed(2)),
      vault: Number((prev.vault + netVaultAmount).toFixed(2)),
    }))
    setDailyWithdrawnKing((prev) => prev + amt)
    setRecentNotification(`Retiro de ${amt} KING procesado. Neto recibido en Vault: ${netVaultAmount.toFixed(2)} (Fee 5%: ${fee.toFixed(2)} KING).`)
  }, [king.claimed, dailyWithdrawnKing, treasuryDailyWithdrawLimit])

  // 6. Héroe: Iniciar Misión
  const startHeroMission = useCallback((missionId) => {
    const mission = HERO_MISSIONS[missionId]
    if (!mission) return
    if (hero.activeMission) {
      setRecentNotification('El Héroe ya se encuentra en una misión activa.')
      return
    }
    if (hero.energy < mission.energyCost) {
      setRecentNotification(`Energía insuficiente. Requiere ${mission.energyCost}⚡.`)
      return
    }

    const durationSec = Math.max(5, mission.durationSec / speedMultiplier)
    setHero((h) => ({
      ...h,
      energy: h.energy - mission.energyCost,
      activeMission: {
        id: `h_miss_${Date.now()}`,
        missionId,
        finishTime: Date.now() + durationSec * 1000,
        totalSec: durationSec,
      },
    }))
    setRecentNotification(`Héroe partió en misión: ${mission.name}.`)
  }, [hero, speedMultiplier])

  const speedupHeroMission = useCallback(() => {
    if (!hero.activeMission) return
    const remainingSec = Math.max(1, Math.ceil((hero.activeMission.finishTime - Date.now()) / 1000))
    const cost = calculateKingCostForSec(remainingSec)

    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING.`)
      return
    }

    setKing((k) => ({ ...k, claimed: Math.max(0, Number((k.claimed - cost).toFixed(2))) }))
    setHero((h) => ({
      ...h,
      activeMission: { ...h.activeMission, finishTime: Date.now() },
    }))
    setRecentNotification(`¡Misión del Héroe acelerada con ${cost} KING!`)
  }, [hero.activeMission, king.claimed])

  // 7. Tienda de KING: Escudos, Planos, Founder Packs
  const buyPeaceShield = useCallback((shieldItem) => {
    if (king.claimed < shieldItem.kingCost) {
      setRecentNotification(`KING insuficiente para comprar ${shieldItem.name}.`)
      return
    }
    setKing((k) => ({ ...k, claimed: k.claimed - shieldItem.kingCost }))
    const currentShieldEnd = Math.max(Date.now(), shieldUntil)
    const newEnd = currentShieldEnd + shieldItem.durationSec * 1000
    setShieldUntil(newEnd)
    setRecentNotification(`¡${shieldItem.name} activado! Tu reino está protegido.`)
  }, [king.claimed, shieldUntil])

  const buyFounderPack = useCallback((pack) => {
    // Simular compra de Founder Pack
    setResources((r) => ({
      wood: r.wood + pack.resources.wood,
      stone: r.stone + pack.resources.stone,
      food: r.food + pack.resources.food,
    }))
    setKing((k) => ({ ...k, claimed: k.claimed + pack.kingBonus }))
    setTroops((t) => ({
      infantry: t.infantry + pack.troops.infantry,
      archer: t.archer + pack.troops.archer,
      cavalry: t.cavalry + pack.troops.cavalry,
    }))
    setShieldUntil((s) => Math.max(Date.now(), s) + pack.shieldHours * 3600 * 1000)
    setRecentNotification(`¡${pack.name} canjeado con éxito! Recompensas añadidas a tu reino.`)
  }, [])

  // Reiniciar partida a valores limpios de cuenta nueva (Alpha v0.1)
  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setResources({ ...INITIAL_PLAYER_DATA.resources })
    setKing({ ...INITIAL_PLAYER_DATA.king })
    setBuildings({ ...INITIAL_PLAYER_DATA.buildings })
    setBuildingUnderConstruction(null)
    setTroops({ ...INITIAL_PLAYER_DATA.troops })
    setTrainingQueue([])
    setMarches([])
    setHero({
      energy: 3,
      maxEnergy: 3,
      nextEnergyAt: null,
      activeMission: null,
    })
    setShieldUntil(Date.now() + 24 * 3600 * 1000)
    setBattleReports([])
    setDailyWithdrawnKing(0)
    setPvpCooldowns({})
    setHungerStartTime(null)
    setRecentNotification('¡Cuenta reiniciada a los valores iniciales de Alpha v0.1!')
  }, [])

  // Bono Sandbox para pruebas inmediatas de funciones avanzadas
  const grantTestResources = useCallback(() => {
    setResources((r) => ({
      wood: r.wood + 20000,
      stone: r.stone + 20000,
      food: r.food + 25000,
    }))
    setKing((k) => ({ ...k, claimed: Number((k.claimed + 500).toFixed(2)) }))
    setTroops((t) => ({
      infantry: t.infantry + 30,
      archer: t.archer + 20,
      cavalry: t.cavalry + 10,
    }))
    setRecentNotification('⚡ ¡Pack Sandbox activado: +20K Madera, +20K Piedra, +25K Comida, +500 KING y 60 tropas!')
  }, [])

  return {
    // Estado
    resources,
    king,
    buildings,
    buildingUnderConstruction,
    troops,
    trainingQueue,
    marches,
    hero,
    shieldUntil,
    battleReports,
    recentNotification,
    setRecentNotification,
    speedMultiplier,
    setSpeedMultiplier,
    // Derivados
    totalTroopsOwned,
    totalTroopsCount,
    logisticsCapacity,
    logisticsRatio,
    logisticsMultiplier,
    baseFoodUpkeepPerHour,
    totalFoodUpkeepPerHour,
    passiveProductionPerHour,
    isHungry,
    hungerStartTime,
    productiveTroopsCount,
    maxKingProductiveTroops,
    estimatedDailyKing,
    treasuryProtectionLimit,
    treasuryPendingLimit,
    treasuryDailyWithdrawLimit,
    kingProtected,
    kingExposed,
    kingdomPower,
    maxSimultaneousMarches,
    // Acciones
    canUpgradeBuilding,
    upgradeBuilding,
    speedupBuilding,
    recruitTroops,
    speedupTraining,
    dispatchMarch,
    speedupMarch,
    claimPendingKing,
    withdrawKingToVault,
    startHeroMission,
    speedupHeroMission,
    buyPeaceShield,
    buyFounderPack,
    calculateKingCostForSec,
    resetGame,
    grantTestResources,
  }
}
