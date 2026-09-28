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
  generateGatherReport,
  generateReinforceReport,
  generateHeroReport,
  totalTroopCount,
} from './combat'
import { gameService } from '../services/gameService'
import { getOrCreatePlayerId, isSupabaseConfigured } from '../services/supabaseClient'

const STORAGE_KEY = 'fourkingdoms_alpha_save_v2'

export function useGameState(baseCoord = { worldX: -12, worldY: 12, x: -12, y: 12 }, userEmail = null) {
  const normalizedBase = useMemo(() => {
    const bx = baseCoord?.worldX ?? baseCoord?.x ?? -12
    const by = baseCoord?.worldY ?? baseCoord?.y ?? 12
    return { worldX: bx, worldY: by, x: bx, y: by }
  }, [baseCoord?.worldX, baseCoord?.x, baseCoord?.worldY, baseCoord?.y])

  const resolvedPlayerId = (userEmail && typeof userEmail === 'string' && userEmail.includes('@'))
    ? userEmail.trim().toLowerCase()
    : getOrCreatePlayerId()

  const playerId = useMemo(() => resolvedPlayerId, [resolvedPlayerId])
  const userStorageKey = useMemo(() => `fourkingdoms_alpha_save_${playerId}`, [playerId])

  const loadSavedState = () => {
    try {
      if (typeof window === 'undefined') return null
      const perUser = localStorage.getItem(`fourkingdoms_alpha_save_${resolvedPlayerId}`)
      if (perUser) return JSON.parse(perUser)
      const fallback = localStorage.getItem(STORAGE_KEY)
      if (fallback) return JSON.parse(fallback)
    } catch {}
    return null
  }

  // Estado persistente o inicial
  const [resources, setResources] = useState(() => {
    try {
      localStorage.removeItem('fourkingdoms_alpha_save_v1')
    } catch {}
    const saved = loadSavedState()
    return saved?.resources || { ...INITIAL_PLAYER_DATA.resources }
  })

  const [king, setKing] = useState(() => {
    const saved = loadSavedState()
    if (saved?.king) {
      if (saved.king.claimed === 120) {
        saved.king.claimed = INITIAL_PLAYER_DATA.king.claimed
      }
      return saved.king
    }
    return { ...INITIAL_PLAYER_DATA.king }
  })

  const [buildings, setBuildings] = useState(() => {
    const saved = loadSavedState()
    if (saved?.buildings && typeof saved.buildings.castle === 'number') {
      return saved.buildings
    }
    return { ...INITIAL_PLAYER_DATA.buildings }
  })

  const [buildingUnderConstruction, setBuildingUnderConstruction] = useState(() => {
    return loadSavedState()?.buildingUnderConstruction || null
  })

  const [troops, setTroops] = useState(() => {
    return loadSavedState()?.troops || { ...INITIAL_PLAYER_DATA.troops }
  })

  const [trainingQueue, setTrainingQueue] = useState(() => {
    return loadSavedState()?.trainingQueue || []
  })

  const [marches, setMarches] = useState(() => {
    const saved = loadSavedState()
    if (saved && Array.isArray(saved.marches)) {
      const bx = baseCoord?.worldX ?? baseCoord?.x ?? -12
      const by = baseCoord?.worldY ?? baseCoord?.y ?? 12
      return saved.marches.map((m) => ({
        ...m,
        originX: typeof m.originX === 'number' ? m.originX : bx,
        originY: typeof m.originY === 'number' ? m.originY : by,
      }))
    }
    return []
  })

  // Sincronizar origen de marchas existentes si la base se actualiza
  useEffect(() => {
    setMarches((prevMarches) => {
      let changed = false
      const updated = prevMarches.map((m) => {
        if (typeof m.originX !== 'number' || (m.originX === 4 && m.originY === -3 && (normalizedBase.worldX !== 4 || normalizedBase.worldY !== -3))) {
          changed = true
          return { ...m, originX: normalizedBase.worldX, originY: normalizedBase.worldY }
        }
        return m
      })
      return changed ? updated : prevMarches
    })
  }, [normalizedBase.worldX, normalizedBase.worldY])

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
    const saved = loadSavedState()
    return saved?.shieldUntil || (Date.now() + 24 * 3600 * 1000) // 24h inicial
  })

  const [battleReports, setBattleReports] = useState(() => {
    const saved = loadSavedState()
    return saved?.battleReports || []
  })

  // Cero Fallbacks: el jugador no pertenece a ningún clan hasta crearlo o unirse
  const [clan, setClan] = useState(() => {
    const saved = loadSavedState()
    if (saved?.clan && saved.clan.id !== 'clan_valyria') return saved.clan
    return null
  })

  // Cero Fallbacks: sin rallies bots simulados
  const [clanRallies, setClanRallies] = useState(() => {
    const saved = loadSavedState()
    if (saved?.clanRallies) return saved.clanRallies.filter((r) => r.id !== 'rally_demo_1')
    return []
  })

  const [dailyWithdrawnKing, setDailyWithdrawnKing] = useState(0)
  const [pvpCooldowns, setPvpCooldowns] = useState({}) // { [targetId]: timestamp }
  const [activeRally, setActiveRally] = useState(null)
  const [recentNotification, setRecentNotification] = useState(null)
  const [speedMultiplier, setSpeedMultiplier] = useState(1) // 1x normal, configurable para testing
  const [hungerStartTime, setHungerStartTime] = useState(null)
  const resourceAccRef = useRef({ wood: 0, stone: 0, food: 0 })
  const lastLocalSaveTimeRef = useRef(0)
  const latestStateRef = useRef(null)

  // Guardar estado local
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
      clan,
      clanRallies,
      battleReports: battleReports.slice(0, 30),
    }
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(stateToSave))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch {}
  }, [userStorageKey, resources, king, buildings, buildingUnderConstruction, troops, trainingQueue, marches, hero, shieldUntil, clan, clanRallies, battleReports])

  // Sincronización y Realtime con Supabase Backend (PC y Celular sincronizados sin feedback loop)
  useEffect(() => {
    if (!isSupabaseConfigured || !playerId) return
    let isCancelled = false

    // 1. Cargar Reino Oficial desde Supabase
    gameService.loadKingdom(playerId).then((remoteKingdom) => {
      if (isCancelled || !remoteKingdom) return

      // Cargar edificios fusionando con el progreso más avanzado
      if (remoteKingdom.buildings && typeof remoteKingdom.buildings === 'object') {
        setBuildings((prev) => {
          const merged = { ...prev }
          for (const [bId, lvl] of Object.entries(remoteKingdom.buildings)) {
            merged[bId] = Math.max(prev[bId] || 0, Number(lvl) || 0)
          }
          return merged
        })
      }

      // Cargar recursos respetando progreso local si es mayor
      if (remoteKingdom.wood !== undefined && remoteKingdom.stone !== undefined && remoteKingdom.food !== undefined) {
        setResources((prev) => {
          const localTotal = (prev.wood || 0) + (prev.stone || 0) + (prev.food || 0)
          const remoteTotal = (Number(remoteKingdom.wood) || 0) + (Number(remoteKingdom.stone) || 0) + (Number(remoteKingdom.food) || 0)
          if (localTotal > remoteTotal && localTotal > 0) return prev
          return {
            wood: Math.floor(Number(remoteKingdom.wood) || 0),
            stone: Math.floor(Number(remoteKingdom.stone) || 0),
            food: Math.floor(Number(remoteKingdom.food) || 0),
          }
        })
      }

      if (remoteKingdom.troops && typeof remoteKingdom.troops === 'object') {
        setTroops((prev) => {
          const localCount = totalTroopCount(prev)
          const remoteCount = totalTroopCount(remoteKingdom.troops)
          return remoteCount >= localCount ? { ...prev, ...remoteKingdom.troops } : prev
        })
      }

      if (remoteKingdom.king_claimed !== undefined) {
        setKing((prev) => ({
          ...prev,
          claimed: Number(remoteKingdom.king_claimed || 0),
          pending: Number(remoteKingdom.king_pending || 0),
        }))
      }

      if (remoteKingdom.shield_until !== undefined && remoteKingdom.shield_until > 0) {
        setShieldUntil(Number(remoteKingdom.shield_until))
      }
    })

    // 2. Cargar reportes de combate y recolección
    gameService.fetchReports(playerId).then((remoteReports) => {
      if (isCancelled || !remoteReports || remoteReports.length === 0) return
      setBattleReports((prev) => {
        const ids = new Set(prev.map((r) => r.id))
        const merged = [...prev]
        for (const rep of remoteReports) {
          if (!ids.has(rep.id)) {
            merged.push(rep)
            ids.add(rep.id)
          }
        }
        return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      })
    })

    // 3. Suscripción en Tiempo Real para cambios simultáneos entre PC y Celular
    const unsubscribe = gameService.subscribeToUpdates(
      playerId,
      (newReport) => {
        setBattleReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)])
      },
      (remoteKingdom) => {
        if (!remoteKingdom) return
        // Evitar loop de eco si acabamos de guardar nosotros mismos
        if (Date.now() - lastLocalSaveTimeRef.current < 5000) {
          return
        }

        console.info('[Supabase Realtime] Actualización de reino desde otro dispositivo:', remoteKingdom)
        if (remoteKingdom.wood !== undefined && remoteKingdom.stone !== undefined && remoteKingdom.food !== undefined) {
          setResources({
            wood: Math.floor(Number(remoteKingdom.wood) || 0),
            stone: Math.floor(Number(remoteKingdom.stone) || 0),
            food: Math.floor(Number(remoteKingdom.food) || 0),
          })
        }
        if (remoteKingdom.buildings && typeof remoteKingdom.buildings === 'object') {
          setBuildings((prev) => {
            const merged = { ...prev }
            for (const [bId, lvl] of Object.entries(remoteKingdom.buildings)) {
              merged[bId] = Math.max(prev[bId] || 0, Number(lvl) || 0)
            }
            return merged
          })
        }
        if (remoteKingdom.troops && typeof remoteKingdom.troops === 'object') {
          setTroops((prev) => ({ ...prev, ...remoteKingdom.troops }))
        }
        if (remoteKingdom.king_claimed !== undefined) {
          setKing((prev) => ({
            ...prev,
            claimed: Number(remoteKingdom.king_claimed || 0),
            pending: Number(remoteKingdom.king_pending || 0),
          }))
        }
      }
    )

    return () => {
      isCancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [playerId])


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

  // KING no se genera pasivamente con el tiempo
  const estimatedDailyKing = 0

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

  latestStateRef.current = {
    resources,
    king,
    buildings,
    troops,
    shieldUntil,
    kingdomPower,
  }

  // Sincronización periódica con Supabase Backend cada 30 segundos (estable, sin re-montar en cada tick)
  useEffect(() => {
    if (!isSupabaseConfigured || !playerId) return

    const timer = setInterval(() => {
      if (latestStateRef.current) {
        lastLocalSaveTimeRef.current = Date.now()
        gameService.syncKingdom(playerId, latestStateRef.current)
      }
    }, 30000)

    return () => {
      clearInterval(timer)
      if (latestStateRef.current) {
        lastLocalSaveTimeRef.current = Date.now()
        gameService.syncKingdom(playerId, latestStateRef.current)
      }
    }
  }, [playerId])

  // --- TICKS EN TIEMPO REAL (1s) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      // A. Producción Pasiva & Consumo de Comida por segundo (acumulación exacta en enteros)
      const deltaSec = 1
      const woodRate = (passiveProductionPerHour.wood / 3600) * deltaSec
      const stoneRate = (passiveProductionPerHour.stone / 3600) * deltaSec
      const netFoodRate = ((passiveProductionPerHour.food - totalFoodUpkeepPerHour) / 3600) * deltaSec

      resourceAccRef.current.wood += woodRate
      resourceAccRef.current.stone += stoneRate
      resourceAccRef.current.food += netFoodRate

      let woodAdd = 0
      if (resourceAccRef.current.wood >= 1) {
        woodAdd = Math.floor(resourceAccRef.current.wood)
        resourceAccRef.current.wood -= woodAdd
      }

      let stoneAdd = 0
      if (resourceAccRef.current.stone >= 1) {
        stoneAdd = Math.floor(resourceAccRef.current.stone)
        resourceAccRef.current.stone -= stoneAdd
      }

      let foodAdd = 0
      if (resourceAccRef.current.food >= 1) {
        foodAdd = Math.floor(resourceAccRef.current.food)
        resourceAccRef.current.food -= foodAdd
      } else if (resourceAccRef.current.food <= -1) {
        foodAdd = Math.ceil(resourceAccRef.current.food)
        resourceAccRef.current.food -= foodAdd
      }

      let isZeroFood = false
      if (woodAdd !== 0 || stoneAdd !== 0 || foodAdd !== 0) {
        setResources((prev) => {
          const nextFood = Math.max(0, prev.food + foodAdd)
          if (nextFood <= 0 && foodAdd < 0) isZeroFood = true
          return {
            wood: prev.wood + woodAdd,
            stone: prev.stone + stoneAdd,
            food: nextFood,
          }
        })
      }

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

            const rep = generateHeroReport({
              missionId: updated.activeMission.missionId,
              missionName: missionDef.name,
              isSuccess: true,
              loot: { wood: split, stone: split, food: split },
              kingReward,
            })
            setBattleReports((reps) => [rep, ...reps])
            gameService.saveReport(playerId, rep)
          } else {
            setRecentNotification(`Héroe: ${missionDef.name} fracasó. No hubo recompensas.`)
            const rep = generateHeroReport({
              missionId: updated.activeMission.missionId,
              missionName: missionDef.name,
              isSuccess: false,
              loot: { wood: 0, stone: 0, food: 0 },
              kingReward: 0,
            })
            setBattleReports((reps) => [rep, ...reps])
            gameService.saveReport(playerId, rep)
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

              const report = generateCombatReport(battle, loot, kingDrop, npcDef.name, 'npc', march.targetX, march.targetY)
              setBattleReports((reps) => [report, ...reps])
              gameService.saveReport(playerId, report)

              // Si es Rally de Clan: prorratear bajas y botín proporcionalmente entre aportantes
              const initialTotal = totalTroopCount(march.army)
              const survivingTotal = totalTroopCount(battle.attackerSurviving)
              const survivalRatio = initialTotal > 0 ? (survivingTotal / initialTotal) : 0

              let returningArmy = battle.attackerSurviving
              let returningLoot = loot
              let returningKingLoot = kingDrop

              if (march.isRally && march.playerContributionArmy) {
                const pContrib = march.playerContributionArmy
                const pInitialCount = totalTroopCount(pContrib)
                const pRatio = initialTotal > 0 ? pInitialCount / initialTotal : 1

                returningArmy = {
                  infantry: Math.round((pContrib.infantry || 0) * survivalRatio),
                  archer: Math.round((pContrib.archer || 0) * survivalRatio),
                  cavalry: Math.round((pContrib.cavalry || 0) * survivalRatio),
                }

                returningLoot = {
                  wood: Math.round((loot.wood || 0) * pRatio),
                  stone: Math.round((loot.stone || 0) * pRatio),
                  food: Math.round((loot.food || 0) * pRatio),
                }

                returningKingLoot = Math.round(kingDrop * pRatio)

                if (march.rallyId) {
                  setClanRallies((rallies) => rallies.map((r) => r.id === march.rallyId ? { ...r, status: 'resolved' } : r))
                }
              }

              if (totalTroopCount(returningArmy) > 0) {
                // Viaje de regreso con supervivientes
                const travelBackDuration = march.oneWayDurationMs
                updated.push({
                  ...march,
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + travelBackDuration,
                  loot: returningLoot,
                  kingLoot: returningKingLoot,
                })
                setRecentNotification(`¡Batalla contra ${npcDef.name}: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}! ${march.isRally ? 'Tropas del Rally' : 'Supervivientes'} regresando.`)
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

              const report = generateCombatReport(battle, loot, kingStolen, march.targetName || 'Jugador Rival', 'pvp', march.targetX, march.targetY)
              setBattleReports((reps) => [report, ...reps])
              gameService.saveReport(playerId, report)

              const initialTotal = totalTroopCount(march.army)
              const survivingTotal = totalTroopCount(battle.attackerSurviving)
              const survivalRatio = initialTotal > 0 ? (survivingTotal / initialTotal) : 0

              let returningArmy = battle.attackerSurviving
              let returningLoot = loot
              let returningKingLoot = kingStolen

              if (march.isRally && march.playerContributionArmy) {
                const pContrib = march.playerContributionArmy
                const pInitialCount = totalTroopCount(pContrib)
                const pRatio = initialTotal > 0 ? pInitialCount / initialTotal : 1

                returningArmy = {
                  infantry: Math.round((pContrib.infantry || 0) * survivalRatio),
                  archer: Math.round((pContrib.archer || 0) * survivalRatio),
                  cavalry: Math.round((pContrib.cavalry || 0) * survivalRatio),
                }

                returningLoot = {
                  wood: Math.round((loot.wood || 0) * pRatio),
                  stone: Math.round((loot.stone || 0) * pRatio),
                  food: Math.round((loot.food || 0) * pRatio),
                }

                returningKingLoot = Math.round(kingStolen * pRatio)

                if (march.rallyId) {
                  setClanRallies((rallies) => rallies.map((r) => r.id === march.rallyId ? { ...r, status: 'resolved' } : r))
                }
              }

              if (totalTroopCount(returningArmy) > 0) {
                updated.push({
                  ...march,
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + march.oneWayDurationMs,
                  loot: returningLoot,
                  kingLoot: returningKingLoot,
                })
                setRecentNotification(`¡Asalto PvP: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}! Regresando con el botín.`)
              } else {
                setRecentNotification(`Tus tropas fueron derrotadas en el asalto PvP contra ${march.targetName}.`)
              }
            } else if (march.type === 'fortress' || march.type === 'capital') {
              // Combate contra guarnición de Fortaleza o Capital
              const garrisonArmy = { infantry: 40, archer: 20, cavalry: 10 }
              const battle = simulateBattle(march.army, garrisonArmy, 3, isHungry, false)
              const report = generateCombatReport(battle, { wood: 1000, stone: 1000, food: 1000 }, 15, march.targetName, march.type, march.targetX, march.targetY)
              setBattleReports((reps) => [report, ...reps])
              gameService.saveReport(playerId, report)

              const initialTotal = totalTroopCount(march.army)
              const survivingTotal = totalTroopCount(battle.attackerSurviving)
              const survivalRatio = initialTotal > 0 ? (survivingTotal / initialTotal) : 0

              let returningArmy = battle.attackerSurviving
              let returningLoot = { wood: 1000, stone: 1000, food: 1000 }
              let returningKingLoot = 15

              if (march.isRally && march.playerContributionArmy) {
                const pContrib = march.playerContributionArmy
                const pInitialCount = totalTroopCount(pContrib)
                const pRatio = initialTotal > 0 ? pInitialCount / initialTotal : 1

                returningArmy = {
                  infantry: Math.round((pContrib.infantry || 0) * survivalRatio),
                  archer: Math.round((pContrib.archer || 0) * survivalRatio),
                  cavalry: Math.round((pContrib.cavalry || 0) * survivalRatio),
                }

                returningLoot = {
                  wood: Math.round(1000 * pRatio),
                  stone: Math.round(1000 * pRatio),
                  food: Math.round(1000 * pRatio),
                }

                returningKingLoot = Math.round(15 * pRatio)

                if (march.rallyId) {
                  setClanRallies((rallies) => rallies.map((r) => r.id === march.rallyId ? { ...r, status: 'resolved' } : r))
                }
              }

              if (battle.isAttackerVictory) {
                setRecentNotification(`¡Conquista gloriosa de ${march.targetName}! Has reclamado el bastión.`)
              }
              if (totalTroopCount(returningArmy) > 0) {
                updated.push({
                  ...march,
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + march.oneWayDurationMs,
                  loot: battle.isAttackerVictory ? returningLoot : { wood: 0, stone: 0, food: 0 },
                  kingLoot: battle.isAttackerVictory ? returningKingLoot : 0,
                })
              }
            } else if (march.type === 'reinforce') {
              // Marcha de refuerzo a base aliada del mismo clan
              const reinforceReport = generateReinforceReport({
                targetPlayerName: march.targetPlayer || march.targetName || 'Aliado',
                targetClanTag: march.targetClanTag || clan?.tag || 'VAL',
                targetX: march.targetX,
                targetY: march.targetY,
                army: march.army,
              })
              setBattleReports((reps) => [reinforceReport, ...reps])
              gameService.saveReport(playerId, reinforceReport)

              setRecentNotification(`¡Refuerzos entregados con éxito en la base de ${march.targetPlayer || 'tu aliado'} [${march.targetClanTag || 'VAL'}]!`)

              // Regreso de la marcha de transporte de tropas
              updated.push({
                ...march,
                status: 'returning',
                returnTime: now + march.oneWayDurationMs,
                loot: { wood: 0, stone: 0, food: 0 },
                kingLoot: 0,
              })
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
            setRecentNotification(`Recolección finalizada en (${march.targetX}, ${march.targetY}). Marcha regresando a casa con el cargamento.`)
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

            // Generar Reporte de Recolección formal al regresar con el botín
            if (march.type === 'gather') {
              const carry = calculateArmyCarry(march.army)
              const gatherRep = generateGatherReport({
                targetName: march.targetName || 'Nodo de Recursos',
                targetX: march.targetX,
                targetY: march.targetY,
                resourceType: march.resourceType || 'wood',
                loot: march.loot || { wood: 0, stone: 0, food: 0 },
                army: march.army,
                carryCapacity: carry,
                nodeResourceMax: march.nodeResourceMax || 500,
              })
              setBattleReports((reps) => [gatherRep, ...reps])
              gameService.saveReport(playerId, gatherRep)
            }

            gameService.removeMarch(march.id)
            setRecentNotification(`Marcha de regreso completada. Recursos y tropas descargados en la ciudad.`)
          } else {
            updated.push(march)
          }
        }

        return updated
      })

      // G. Verificación de Rallies de Clan (5 minutos de concentración de tropas)
      setClanRallies((prevRallies) => {
        if (!prevRallies || !prevRallies.length) return prevRallies
        const updatedRallies = []

        for (const rally of prevRallies) {
          if (rally.status === 'gathering') {
            // Compañero NPC aliado se une si el jugador convocó el rally
            if (
              rally.isPlayerCreator &&
              rally.participants.length === 1 &&
              now - rally.createdAt > 15000 / speedMultiplier
            ) {
              const allyArmy = { infantry: 10, archer: 6, cavalry: 4 }
              rally.participants.push({ name: 'Sir Ronald [VAL]', army: allyArmy, isPlayer: false })
              rally.totalArmy.infantry = (rally.totalArmy.infantry || 0) + allyArmy.infantry
              rally.totalArmy.archer = (rally.totalArmy.archer || 0) + allyArmy.archer
              rally.totalArmy.cavalry = (rally.totalArmy.cavalry || 0) + allyArmy.cavalry
              setRecentNotification('¡Aliado Sir Ronald [VAL] se unió a tu Rally con 20 tropas!')
            }

            if (now >= rally.launchTime) {
              // El Rally parte hacia el objetivo
              const playerParticipant = rally.participants.find((p) => p.isPlayer)
              const hasPlayerTroops = playerParticipant && totalTroopCount(playerParticipant.army) > 0

              if (hasPlayerTroops) {
                const originX = normalizedBase.worldX
                const originY = normalizedBase.worldY
                const dx = Math.abs(rally.targetX - originX)
                const dy = Math.abs(rally.targetY - originY)
                const distanceTiles = Math.max(dx, dy, 1)
                const oneWaySec = Math.max(6, Math.round((distanceTiles * 60) / speedMultiplier))
                const oneWayDurationMs = oneWaySec * 1000

                const rallyMarch = {
                  id: `march_rally_${now}_${Math.random().toString(36).substr(2, 4)}`,
                  type: rally.targetType,
                  originX,
                  originY,
                  targetX: rally.targetX,
                  targetY: rally.targetY,
                  targetName: `🚩 Rally: ${rally.targetName}`,
                  army: { ...rally.totalArmy },
                  isRally: true,
                  rallyId: rally.id,
                  playerContributionArmy: { ...playerParticipant.army },
                  resourceType: rally.resourceType,
                  nodeResourceMax: 500,
                  targetLevel: rally.targetLevel || 1,
                  startTime: now,
                  arriveTime: now + oneWayDurationMs,
                  gatherUntil: null,
                  returnTime: null,
                  oneWayDurationMs,
                  status: 'traveling',
                  distanceTiles,
                }
                setMarches((m) => [...m, rallyMarch])
                setRecentNotification(`¡El Rally contra ${rally.targetName} ha partido con ${totalTroopCount(rally.totalArmy)} tropas combinadas!`)
                updatedRallies.push({ ...rally, status: 'marching' })
              } else {
                updatedRallies.push({ ...rally, status: 'resolved' })
                setRecentNotification(`El Rally de Clan contra ${rally.targetName} concluyó.`)
              }
            } else {
              updatedRallies.push(rally)
            }
          } else {
            updatedRallies.push(rally)
          }
        }
        return updatedRallies
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
    normalizedBase,
    speedMultiplier,
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
    const barracksLvl = buildings.barracks || 0
    if (barracksLvl < 1) {
      return { success: false, reason: 'Debes construir el Cuartel Militar (Nivel 1) en Mi Base antes de entrenar tropas.' }
    }
    const barracksDef = BUILDINGS_CONFIG.barracks.levels[barracksLvl]

    // Comprobar si la tropa está desbloqueada
    if (!barracksDef.unlockedTroops.includes(troopId)) {
      return { success: false, reason: `Desbloquea ${TROOPS_CONFIG[troopId].name} subiendo el Cuartel a Nv.${TROOPS_CONFIG[troopId].requiredBarracksLevel}.` }
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
  const dispatchMarch = useCallback(({
    type,
    targetX,
    targetY,
    targetName,
    army,
    resourceType = null,
    nodeResourceMax = 500,
    targetLevel = 1,
    targetPlayer = null,
    targetClanTag = null,
  }) => {
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

    // Validación de refuerzos: Solo a miembros del mismo clan
    if (type === 'reinforce') {
      if (!clan) {
        return { success: false, reason: 'Debes pertenecer a un clan para enviar refuerzos defensivos.' }
      }
      if (targetClanTag && clan.tag && targetClanTag !== clan.tag) {
        return { success: false, reason: `Solo puedes enviar refuerzos a jugadores de tu mismo clan [${clan.tag}].` }
      }
    }

    // Si es PvP y el atacante tiene escudo de paz, el ataque rompe el escudo (Sección 43)
    if (type === 'pvp' && shieldUntil > Date.now()) {
      setShieldUntil(0)
      setRecentNotification('¡Al iniciar un asalto PvP has roto tu Escudo de Paz!')
    }

    // Distancia Chebyshev: max(|x2-x1|, |y2-y1|)
    const originX = normalizedBase.worldX
    const originY = normalizedBase.worldY
    const dx = Math.abs(targetX - originX)
    const dy = Math.abs(targetY - originY)
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
      originX,
      originY,
      targetX,
      targetY,
      targetName,
      targetPlayer,
      targetClanTag,
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
    gameService.registerMarch(playerId, newMarch)
    setRecentNotification(
      type === 'reinforce'
        ? `🛡️ Refuerzos despachados hacia la base de ${targetPlayer || 'tu aliado'} [${targetClanTag || 'VAL'}].`
        : `Marcha despachada hacia (${targetX}, ${targetY}). Distancia: ${distanceTiles} casillas.`
    )
    return { success: true }
  }, [marches.length, maxSimultaneousMarches, troops, shieldUntil, normalizedBase, isHungry, speedMultiplier, clan, playerId])

  // 4b. Convocar Rally de Clan (5 minutos de preparación)
  const createRally = useCallback(({ targetX, targetY, targetName, targetType = 'npc', army, targetLevel = 1, resourceType = null }) => {
    if (!clan) {
      return { success: false, reason: 'Debes pertenecer a un clan para convocar un Rally.' }
    }

    const rallyTroopCount = totalTroopCount(army)
    if (rallyTroopCount === 0) {
      return { success: false, reason: 'Debes aportar al menos una tropa para convocar el Rally.' }
    }

    for (const [tId, count] of Object.entries(army)) {
      if ((troops[tId] || 0) < count) {
        return { success: false, reason: `No tienes suficientes tropas de ${TROOPS_CONFIG[tId]?.name || tId} en casa.` }
      }
    }

    const rallyGatherSec = Math.max(10, Math.round(300 / speedMultiplier))
    const now = Date.now()
    const launchTime = now + rallyGatherSec * 1000

    // Restar tropas de casa
    setTroops((t) => ({
      infantry: t.infantry - (army.infantry || 0),
      archer: t.archer - (army.archer || 0),
      cavalry: t.cavalry - (army.cavalry || 0),
    }))

    const newRally = {
      id: `rally_${now}_${Math.random().toString(36).substr(2, 5)}`,
      creator: 'Mi Base',
      isPlayerCreator: true,
      targetX,
      targetY,
      targetName,
      targetType,
      targetLevel,
      resourceType,
      createdAt: now,
      launchTime,
      totalGatherSec: 300,
      status: 'gathering',
      participants: [
        { name: 'Mi Base (Tú)', army: { ...army }, isPlayer: true }
      ],
      totalArmy: { ...army },
    }

    setClanRallies((prev) => [newRally, ...prev])
    setRecentNotification(`¡Rally de Clan convocado contra ${targetName}! Salida en 5 min. Las tropas se concentran.`)
    return { success: true, rallyId: newRally.id }
  }, [clan, troops, speedMultiplier])

  // Unirse a un Rally existente
  const joinRally = useCallback((rallyId, army) => {
    const rally = clanRallies.find((r) => r.id === rallyId)
    if (!rally) return { success: false, reason: 'Rally no encontrado.' }
    if (rally.status !== 'gathering') return { success: false, reason: 'El Rally ya ha partido o finalizado.' }

    const count = totalTroopCount(army)
    if (count === 0) return { success: false, reason: 'Debes enviar al menos una tropa.' }

    for (const [tId, c] of Object.entries(army)) {
      if ((troops[tId] || 0) < c) {
        return { success: false, reason: `No tienes suficientes tropas de ${TROOPS_CONFIG[tId]?.name || tId}.` }
      }
    }

    setTroops((t) => ({
      infantry: t.infantry - (army.infantry || 0),
      archer: t.archer - (army.archer || 0),
      cavalry: t.cavalry - (army.cavalry || 0),
    }))

    setClanRallies((prev) => prev.map((r) => {
      if (r.id !== rallyId) return r
      const existingPart = r.participants.find((p) => p.isPlayer)
      let newParticipants = [...r.participants]
      if (existingPart) {
        newParticipants = newParticipants.map((p) => p.isPlayer ? {
          ...p,
          army: {
            infantry: (p.army.infantry || 0) + (army.infantry || 0),
            archer: (p.army.archer || 0) + (army.archer || 0),
            cavalry: (p.army.cavalry || 0) + (army.cavalry || 0),
          }
        } : p)
      } else {
        newParticipants.push({ name: 'Mi Base (Tú)', army: { ...army }, isPlayer: true })
      }

      const newTotalArmy = {
        infantry: (r.totalArmy.infantry || 0) + (army.infantry || 0),
        archer: (r.totalArmy.archer || 0) + (army.archer || 0),
        cavalry: (r.totalArmy.cavalry || 0) + (army.cavalry || 0),
      }

      return {
        ...r,
        participants: newParticipants,
        totalArmy: newTotalArmy,
      }
    }))

    setRecentNotification(`¡Aportaste ${count} tropas al Rally contra ${rally.targetName}!`)
    return { success: true }
  }, [clanRallies, troops])

  // Donar al tesoro del Clan
  const donateToClan = useCallback((resourceType, amount) => {
    const amt = Number(amount)
    if (amt <= 0 || (resources[resourceType] || 0) < amt) {
      setRecentNotification('Recursos insuficientes para donar.')
      return { success: false }
    }

    setResources((r) => ({ ...r, [resourceType]: r[resourceType] - amt }))
    setClan((c) => {
      if (!c) return c
      const currentDonations = c.donations || {}
      return {
        ...c,
        donations: {
          ...currentDonations,
          [resourceType]: (currentDonations[resourceType] || 0) + amt,
        },
      }
    })

    setRecentNotification(`¡Donaste ${amt} de ${resourceType} al Clan!`)
    return { success: true }
  }, [resources])

  // Cancelar marcha en el mapa y devolver tropas inmediatamente a casa
  const cancelMarch = useCallback((marchId) => {
    const march = marches.find((m) => m.id === marchId)
    if (!march) return

    // Devolver las tropas al castillo de inmediato
    setTroops((t) => ({
      infantry: t.infantry + (march.army.infantry || 0),
      archer: t.archer + (march.army.archer || 0),
      cavalry: t.cavalry + (march.army.cavalry || 0),
    }))

    // Si la marcha ya tenía botín cargado, ingresarlo a recursos
    if (march.loot) {
      setResources((r) => ({
        wood: Math.floor(r.wood + (march.loot.wood || 0)),
        stone: Math.floor(r.stone + (march.loot.stone || 0)),
        food: Math.floor(r.food + (march.loot.food || 0)),
      }))
    }
    if (march.kingLoot) {
      setKing((k) => ({ ...k, pending: Number((k.pending + march.kingLoot).toFixed(4)) }))
    }

    setMarches((prev) => prev.filter((m) => m.id !== marchId))
    setRecentNotification('¡Marcha cancelada! Tus tropas han regresado de inmediato a tu castillo.')
  }, [marches])

  // Acelerar Marcha con KING:
  // Fase 1: Si status === 'traveling', acelera el viaje de IDA.
  //   - Se resuelve el combate o llegada a la casilla al instante.
  //   - Se genera el reporte correspondiente en el buzón y backend.
  //   - La marcha cambia VISIBLEMENTE a status: 'returning' (o 'gathering' si es recolección).
  //   - El jugador puede ver sus tropas volviendo y, si lo desea, acelerar nuevamente el regreso.
  // Fase 2: Si status === 'gathering', acelera la MINERÍA.
  //   - Finaliza la extracción y las tropas inician el regreso cargadas con recursos (status: 'returning').
  // Fase 3: Si status === 'returning', acelera el viaje de VENIDA (Regreso).
  //   - Llega inmediatamente a tu reino, se acreditan tropas y botín, y la marcha desaparece del mapa.
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

    // Descontar KING
    setKing((k) => ({ ...k, claimed: Math.max(0, Number((k.claimed - cost).toFixed(2))) }))

    const now = Date.now()

    // 1. SI ESTÁ REGRESANDO: Acelera el regreso y deposita tropas y botín en el castillo
    if (march.status === 'returning') {
      setTroops((t) => ({
        infantry: t.infantry + (march.army.infantry || 0),
        archer: t.archer + (march.army.archer || 0),
        cavalry: t.cavalry + (march.army.cavalry || 0),
      }))
      if (march.loot) {
        setResources((r) => ({
          wood: Math.floor(r.wood + (march.loot.wood || 0)),
          stone: Math.floor(r.stone + (march.loot.stone || 0)),
          food: Math.floor(r.food + (march.loot.food || 0)),
        }))
      }
      if (march.kingLoot) {
        setKing((k) => ({ ...k, pending: Number((k.pending + march.kingLoot).toFixed(4)) }))
      }

      // Si fue recolección y aún no se generó reporte al regresar
      if (march.type === 'gather' && march.loot) {
        const carry = calculateArmyCarry(march.army)
        const gatherRep = generateGatherReport({
          targetName: march.targetName || 'Nodo de Recursos',
          targetX: march.targetX,
          targetY: march.targetY,
          resourceType: march.resourceType || 'wood',
          loot: march.loot || { wood: 0, stone: 0, food: 0 },
          army: march.army,
          carryCapacity: carry,
          nodeResourceMax: march.nodeResourceMax || 500,
        })
        setBattleReports((reps) => [gatherRep, ...reps])
        gameService.saveReport(playerId, gatherRep)
      }

      setMarches((prev) => prev.filter((m) => m.id !== marchId))
      gameService.removeMarch(marchId)
      setRecentNotification(`¡Regreso acelerado al 100%! Tropas y botín en tu reino (-${cost} KING).`)
      return
    }

    // 2. SI ESTÁ RECOLECTANDO: Acelera la minería e inicia el regreso de inmediato
    if (march.status === 'gathering') {
      const carry = calculateArmyCarry(march.army)
      const mined = Math.min(carry, march.nodeResourceMax || 500)
      const split = Math.floor(mined / 3)
      const loot = { wood: 0, stone: 0, food: 0 }
      if (march.resourceType === 'wood') loot.wood = mined
      else if (march.resourceType === 'stone') loot.stone = mined
      else if (march.resourceType === 'food') loot.food = mined
      else { loot.wood = split; loot.stone = split; loot.food = split }

      const returnDuration = march.oneWayDurationMs || 30000

      setMarches((prev) =>
        prev.map((m) =>
          m.id === marchId
            ? {
                ...m,
                status: 'returning',
                returnTime: now + returnDuration,
                loot,
              }
            : m
        )
      )

      setRecentNotification(`¡Minería acelerada al 100% (-${cost} KING)! Cargamento listo. Tropas regresando (puedes acelerar el regreso si deseas).`)
      return
    }

    // 3. SI ESTÁ VIAJANDO (IDA): Acelera la llegada y resuelve el combate/nodo, cambiando a 'returning' (o 'gathering')
    if (march.status === 'traveling') {
      const returnDuration = march.oneWayDurationMs || 30000

      if (march.type === 'gather') {
        // Llega a la casilla e inicia recolección de inmediato
        const gatherDuration = march.gatherDurationMs || 60000
        setMarches((prev) =>
          prev.map((m) =>
            m.id === marchId
              ? {
                  ...m,
                  status: 'gathering',
                  gatherUntil: now + gatherDuration,
                }
              : m
          )
        )
        setRecentNotification(`¡Ida acelerada (-${cost} KING)! Tus tropas llegaron a (${march.targetX}, ${march.targetY}) e inician recolección.`)
        return
      }

      if (march.type === 'npc') {
        const npcDef = NPC_TIERS[march.targetLevel || 1]
        const battle = simulateBattle(march.army, npcDef.army, 0, isHungry, false)
        let loot = { wood: 0, stone: 0, food: 0 }
        let kingDrop = 0

        if (battle.isAttackerVictory) {
          const carryCapacity = calculateArmyCarry(battle.attackerSurviving)
          const rawLoot = Math.floor(Math.random() * (npcDef.maxResourceReward - npcDef.minResourceReward + 1)) + npcDef.minResourceReward
          const actualLoot = Math.min(rawLoot, carryCapacity)
          const split = Math.floor(actualLoot / 3)
          loot = { wood: split, stone: split, food: split }
          if (Math.random() <= npcDef.kingDropRate) {
            kingDrop = npcDef.kingDropAmount
          }
        }

        const report = generateCombatReport(battle, loot, kingDrop, npcDef.name, 'npc', march.targetX, march.targetY)
        setBattleReports((reps) => [report, ...reps])
        gameService.saveReport(playerId, report)

        const initialTotal = totalTroopCount(march.army)
        const survivingTotal = totalTroopCount(battle.attackerSurviving)
        const survivalRatio = initialTotal > 0 ? survivingTotal / initialTotal : 0

        let returningArmy = battle.attackerSurviving
        let returningLoot = loot
        let returningKingLoot = kingDrop

        if (march.isRally && march.playerContributionArmy) {
          const pContrib = march.playerContributionArmy
          const pInitialCount = totalTroopCount(pContrib)
          const pRatio = initialTotal > 0 ? pInitialCount / initialTotal : 1

          returningArmy = {
            infantry: Math.round((pContrib.infantry || 0) * survivalRatio),
            archer: Math.round((pContrib.archer || 0) * survivalRatio),
            cavalry: Math.round((pContrib.cavalry || 0) * survivalRatio),
          }

          returningLoot = {
            wood: Math.round((loot.wood || 0) * pRatio),
            stone: Math.round((loot.stone || 0) * pRatio),
            food: Math.round((loot.food || 0) * pRatio),
          }

          returningKingLoot = Math.round(kingDrop * pRatio)

          if (march.rallyId) {
            setClanRallies((rallies) => rallies.map((r) => (r.id === march.rallyId ? { ...r, status: 'resolved' } : r)))
          }
        }

        if (totalTroopCount(returningArmy) > 0) {
          setMarches((prev) =>
            prev.map((m) =>
              m.id === marchId
                ? {
                    ...m,
                    status: 'returning',
                    army: returningArmy,
                    returnTime: now + returnDuration,
                    loot: returningLoot,
                    kingLoot: returningKingLoot,
                  }
                : m
            )
          )
          setRecentNotification(`¡Ida acelerada (-${cost} KING)! Batalla resuelta (${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}). Tropas regresando con el botín.`)
        } else {
          setMarches((prev) => prev.filter((m) => m.id !== marchId))
          gameService.removeMarch(marchId)
          setRecentNotification(`¡Ida acelerada (-${cost} KING)! Derrota total ante ${npcDef.name}. Todas las tropas cayeron en combate.`)
        }
        return
      }

      if (march.type === 'pvp') {
        const defenderWall = 2
        const defenderSimulatedArmy = { infantry: 15, archer: 8, cavalry: 2 }
        const battle = simulateBattle(march.army, defenderSimulatedArmy, defenderWall, isHungry, false)
        let loot = { wood: 0, stone: 0, food: 0 }
        let kingStolen = 0

        if (battle.isAttackerVictory) {
          const carryCapacity = calculateArmyCarry(battle.attackerSurviving)
          const baseLoot = Math.min(1200, carryCapacity)
          const split = Math.floor(baseLoot / 3)
          loot = { wood: split, stone: split, food: split }
          kingStolen = 5
        }

        const report = generateCombatReport(battle, loot, kingStolen, march.targetName || 'Jugador Rival', 'pvp', march.targetX, march.targetY)
        setBattleReports((reps) => [report, ...reps])
        gameService.saveReport(playerId, report)

        const initialTotal = totalTroopCount(march.army)
        const survivingTotal = totalTroopCount(battle.attackerSurviving)
        const survivalRatio = initialTotal > 0 ? survivingTotal / initialTotal : 0

        let returningArmy = battle.attackerSurviving
        let returningLoot = loot
        let returningKingLoot = kingStolen

        if (march.isRally && march.playerContributionArmy) {
          const pContrib = march.playerContributionArmy
          const pInitialCount = totalTroopCount(pContrib)
          const pRatio = initialTotal > 0 ? pInitialCount / initialTotal : 1

          returningArmy = {
            infantry: Math.round((pContrib.infantry || 0) * survivalRatio),
            archer: Math.round((pContrib.archer || 0) * survivalRatio),
            cavalry: Math.round((pContrib.cavalry || 0) * survivalRatio),
          }

          returningLoot = {
            wood: Math.round((loot.wood || 0) * pRatio),
            stone: Math.round((loot.stone || 0) * pRatio),
            food: Math.round((loot.food || 0) * pRatio),
          }

          returningKingLoot = Math.round(kingStolen * pRatio)

          if (march.rallyId) {
            setClanRallies((rallies) => rallies.map((r) => (r.id === march.rallyId ? { ...r, status: 'resolved' } : r)))
          }
        }

        if (totalTroopCount(returningArmy) > 0) {
          setMarches((prev) =>
            prev.map((m) =>
              m.id === marchId
                ? {
                    ...m,
                    status: 'returning',
                    army: returningArmy,
                    returnTime: now + returnDuration,
                    loot: returningLoot,
                    kingLoot: returningKingLoot,
                  }
                : m
            )
          )
          setRecentNotification(`¡Ida acelerada (-${cost} KING)! Asalto PvP: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}. Tropas regresando a tu reino.`)
        } else {
          setMarches((prev) => prev.filter((m) => m.id !== marchId))
          gameService.removeMarch(marchId)
          setRecentNotification(`¡Ida acelerada (-${cost} KING)! Derrota en asalto PvP contra ${march.targetName}.`)
        }
        return
      }

      if (march.type === 'fortress' || march.type === 'capital') {
        const garrisonArmy = { infantry: 40, archer: 20, cavalry: 10 }
        const battle = simulateBattle(march.army, garrisonArmy, 3, isHungry, false)
        const loot = battle.isAttackerVictory ? { wood: 1000, stone: 1000, food: 1000 } : { wood: 0, stone: 0, food: 0 }
        const kingLoot = battle.isAttackerVictory ? 15 : 0

        const report = generateCombatReport(battle, loot, kingLoot, march.targetName, march.type, march.targetX, march.targetY)
        setBattleReports((reps) => [report, ...reps])
        gameService.saveReport(playerId, report)

        const initialTotal = totalTroopCount(march.army)
        const survivingTotal = totalTroopCount(battle.attackerSurviving)
        const survivalRatio = initialTotal > 0 ? survivingTotal / initialTotal : 0

        let returningArmy = battle.attackerSurviving
        let returningLoot = loot
        let returningKingLoot = kingLoot

        if (march.isRally && march.playerContributionArmy) {
          const pContrib = march.playerContributionArmy
          const pInitialCount = totalTroopCount(pContrib)
          const pRatio = initialTotal > 0 ? pInitialCount / initialTotal : 1

          returningArmy = {
            infantry: Math.round((pContrib.infantry || 0) * survivalRatio),
            archer: Math.round((pContrib.archer || 0) * survivalRatio),
            cavalry: Math.round((pContrib.cavalry || 0) * survivalRatio),
          }

          returningLoot = {
            wood: Math.round((loot.wood || 0) * pRatio),
            stone: Math.round((loot.stone || 0) * pRatio),
            food: Math.round((loot.food || 0) * pRatio),
          }

          returningKingLoot = Math.round(kingLoot * pRatio)

          if (march.rallyId) {
            setClanRallies((rallies) => rallies.map((r) => (r.id === march.rallyId ? { ...r, status: 'resolved' } : r)))
          }
        }

        if (totalTroopCount(returningArmy) > 0) {
          setMarches((prev) =>
            prev.map((m) =>
              m.id === marchId
                ? {
                    ...m,
                    status: 'returning',
                    army: returningArmy,
                    returnTime: now + returnDuration,
                    loot: returningLoot,
                    kingLoot: returningKingLoot,
                  }
                : m
            )
          )
          setRecentNotification(`¡Ida acelerada (-${cost} KING)! Asalto resuelto. Tropas regresando a tu bastión.`)
        } else {
          setMarches((prev) => prev.filter((m) => m.id !== marchId))
          gameService.removeMarch(marchId)
          setRecentNotification(`¡Ida acelerada (-${cost} KING)! Asalto fallido ante ${march.targetName}.`)
        }
        return
      }

      if (march.type === 'reinforce') {
        const reinforceReport = generateReinforceReport({
          targetPlayerName: march.targetPlayer || march.targetName || 'Aliado',
          targetClanTag: march.targetClanTag || 'VAL',
          targetX: march.targetX,
          targetY: march.targetY,
          army: march.army,
        })
        setBattleReports((reps) => [reinforceReport, ...reps])
        gameService.saveReport(playerId, reinforceReport)

        setMarches((prev) =>
          prev.map((m) =>
            m.id === marchId
              ? {
                  ...m,
                  status: 'returning',
                  returnTime: now + returnDuration,
                  loot: { wood: 0, stone: 0, food: 0 },
                  kingLoot: 0,
                }
              : m
          )
        )
        setRecentNotification(`¡Ida acelerada (-${cost} KING)! Refuerzos entregados inmediatamente. Transporte regresando a casa.`)
        return
      }
    }
  }, [marches, king.claimed, isHungry, playerId])

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
    try {
      localStorage.removeItem('fourkingdoms_alpha_save_v1')
    } catch {}
    setResources({ ...INITIAL_PLAYER_DATA.resources })
    setKing({ ...INITIAL_PLAYER_DATA.king })
    setBuildings({ ...INITIAL_PLAYER_DATA.buildings })
    setBuildingUnderConstruction(null)
    setTroops({ ...INITIAL_PLAYER_DATA.troops })
    setTrainingQueue([])
    setMarches([])
    setClan(null)
    setClanRallies([])
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
    baseCoord: normalizedBase,
    resources,
    king,
    buildings,
    buildingUnderConstruction,
    troops,
    trainingQueue,
    marches,
    hero,
    shieldUntil,
    clan,
    setClan,
    clanRallies,
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
    cancelMarch,
    createRally,
    joinRally,
    donateToClan,
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
