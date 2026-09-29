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

export function useGameState(baseCoord = { worldX: -12, worldY: 12, x: -12, y: 12 }, userEmail = null, options = {}) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const isLoadedRef = useRef(false)

  const normalizedBase = useMemo(() => {
    const bx = baseCoord?.worldX ?? baseCoord?.x ?? -12
    const by = baseCoord?.worldY ?? baseCoord?.y ?? 12
    return { worldX: bx, worldY: by, x: bx, y: by }
  }, [baseCoord?.worldX, baseCoord?.x, baseCoord?.worldY, baseCoord?.y])

  const resolvedPlayerId = (userEmail && typeof userEmail === 'string' && userEmail.includes('@'))
    ? userEmail.trim().toLowerCase()
    : getOrCreatePlayerId()

  const playerId = useMemo(() => resolvedPlayerId, [resolvedPlayerId])
  // Estado 100% en memoria: Supabase Backend es la ÚNICA fuente de verdad
  const [resources, setResources] = useState(() => ({ ...INITIAL_PLAYER_DATA.resources }))
  const [king, setKing] = useState(() => ({ ...INITIAL_PLAYER_DATA.king }))
  const [buildings, setBuildings] = useState(() => ({ ...INITIAL_PLAYER_DATA.buildings }))
  const [buildingUnderConstruction, setBuildingUnderConstruction] = useState(null)
  const [troops, setTroops] = useState(() => ({ ...INITIAL_PLAYER_DATA.troops }))
  const [trainingQueue, setTrainingQueue] = useState([])
  const [marches, setMarches] = useState(() => {
    try {
      if (typeof window !== 'undefined' && playerId) {
        const raw = localStorage.getItem(`fk_marches_${playerId.toLowerCase()}`)
        if (raw) return JSON.parse(raw)
      }
    } catch {}
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

  // Persistir marchas en localStorage para evitar pérdida al cerrar/recargar navegador
  useEffect(() => {
    if (typeof window !== 'undefined' && playerId) {
      try {
        localStorage.setItem(`fk_marches_${playerId.toLowerCase()}`, JSON.stringify(marches))
      } catch {}
    }
  }, [marches, playerId])

  const [hero, setHero] = useState(() => {
    try {
      if (typeof window !== 'undefined' && playerId) {
        const raw = localStorage.getItem(`fk_hero_${playerId.toLowerCase()}`)
        if (raw) {
          const p = JSON.parse(raw)
          return {
            energy: typeof p.energy === 'number' ? p.energy : 3,
            maxEnergy: p.maxEnergy || 3,
            nextEnergyAt: p.nextEnergyAt || null,
            activeMission: p.activeMission || null,
          }
        }
      }
    } catch {}
    return {
      energy: 3,
      maxEnergy: 3,
      nextEnergyAt: null,
      activeMission: null, // { id, missionId, finishTime, totalSec }
    }
  })

  // Persistir héroe y expediciones tácticas en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && playerId) {
      try {
        localStorage.setItem(`fk_hero_${playerId.toLowerCase()}`, JSON.stringify(hero))
      } catch {}
    }
  }, [hero, playerId])

  const [shieldUntil, setShieldUntil] = useState(0)
  const [battleReports, setBattleReports] = useState([])
  const [clan, setClan] = useState(null)
  const [clanRallies, setClanRallies] = useState([])

  // Limpieza defensiva de cualquier residuo en local storage (Solo Backend)
  useEffect(() => {
    try {
      localStorage.removeItem('fourkingdoms_alpha_save_v1')
      localStorage.removeItem(STORAGE_KEY)
      if (playerId) {
        localStorage.removeItem(`fourkingdoms_alpha_save_${playerId}`)
        localStorage.removeItem(`fk_save_${playerId.toLowerCase()}`)
      }
    } catch {}
  }, [playerId])

  const [dailyWithdrawnKing, setDailyWithdrawnKing] = useState(0)
  const [pvpCooldowns, setPvpCooldowns] = useState({}) // { [targetId]: timestamp }
  const [activeRally, setActiveRally] = useState(null)
  const [recentNotification, setRecentNotification] = useState(null)
  const [speedMultiplier, setSpeedMultiplier] = useState(1) // 1x normal, configurable para testing
  const [hungerStartTime, setHungerStartTime] = useState(null)
  const resourceAccRef = useRef({ wood: 0, stone: 0, food: 0 })
  const lastLocalSaveTimeRef = useRef(0)
  const lastTickTimeRef = useRef(Date.now())
  const latestStateRef = useRef(null)

  // Sincronización y Realtime con Supabase Backend (PC y Celular sincronizados sin feedback loop)
  useEffect(() => {
    if (!isSupabaseConfigured || !playerId || !playerId.includes('@')) return
    let isCancelled = false

    // 1. Cargar Reino Oficial y Marchas Activas directamente desde Supabase Backend (100% Backend)
    Promise.all([
      gameService.loadKingdom(playerId),
      gameService.fetchActiveMarches(playerId),
    ]).then(async ([remoteKingdom, remoteMarches]) => {
      if (isCancelled) return

      if (!remoteKingdom) {
        console.info('[Supabase Backend] Creando reino oficial inicial en backend para:', playerId)
        const initialPayload = {
          resources: INITIAL_PLAYER_DATA.resources,
          king: INITIAL_PLAYER_DATA.king,
          buildings: INITIAL_PLAYER_DATA.buildings,
          troops: INITIAL_PLAYER_DATA.troops,
          shieldUntil: Date.now() + 24 * 3600 * 1000,
          kingdomPower: 300,
        }
        await gameService.syncKingdom(playerId, initialPayload)
        setShieldUntil(initialPayload.shieldUntil)
        return
      }

      console.info('[Supabase Backend] Reino cargado 100% desde backend:', playerId, remoteKingdom)

      // Cargar edificios y proceso de construcción activo directamente del backend
      const rawBuildings = (remoteKingdom.buildings && typeof remoteKingdom.buildings === 'object')
        ? remoteKingdom.buildings
        : {}
      const loadedBuildings = {}
      for (const [key, val] of Object.entries(rawBuildings)) {
        if (key !== '_construction' && key !== '_hero' && typeof val === 'number') {
          loadedBuildings[key] = val
        }
      }
      for (const [key, val] of Object.entries(INITIAL_PLAYER_DATA.buildings)) {
        if (loadedBuildings[key] === undefined) {
          loadedBuildings[key] = val
        }
      }

      let activeConstruction = (rawBuildings._construction && typeof rawBuildings._construction === 'object' && rawBuildings._construction.buildingId)
        ? rawBuildings._construction
        : null

      // Cargar tropas y cola de entrenamiento activa directamente del backend
      const rawTroops = (remoteKingdom.troops && typeof remoteKingdom.troops === 'object')
        ? remoteKingdom.troops
        : {}
      const loadedTroops = {}
      for (const [key, val] of Object.entries(rawTroops)) {
        if (key !== '_trainingQueue' && typeof val === 'number') {
          loadedTroops[key] = val
        }
      }
      for (const [key, val] of Object.entries(INITIAL_PLAYER_DATA.troops)) {
        if (loadedTroops[key] === undefined) {
          loadedTroops[key] = val
        }
      }

      let activeQueue = Array.isArray(rawTroops._trainingQueue) ? [...rawTroops._trainingQueue] : []

      let baseWood = Math.floor(Number(remoteKingdom.wood) || 0)
      let baseStone = Math.floor(Number(remoteKingdom.stone) || 0)
      let baseFood = Math.floor(Number(remoteKingdom.food) || 0)
      let baseKingPending = Number(remoteKingdom.king_pending || 0)

      // Sanitización anti-exploit para reinos afectados por el bug del mercado
      if (playerId === 'cegarramichael@gmail.com' || playerId === 'juanchaval83@gmail.com') {
        if (baseWood > 25000) {
          baseWood = 2500
          baseStone = 2500
          baseFood = 2500
        }
        if (Number(remoteKingdom.king_claimed || 0) > 25) {
          remoteKingdom.king_claimed = 10.00
        }
        if (Number(remoteKingdom.shield_until || 0) > Date.now() + 86400000 * 3) {
          remoteKingdom.shield_until = Date.now() + 86400000
        }
        loadedTroops.infantry = Math.min(loadedTroops.infantry || 0, 25)
        loadedTroops.archer = Math.min(loadedTroops.archer || 0, 10)
        loadedTroops.cavalry = Math.min(loadedTroops.cavalry || 0, 5)
      }

      // Cargar y reconciliar Héroe y Expediciones Tácticas (Persistencia Total)
      let localHeroRaw = null
      try {
        if (typeof window !== 'undefined' && playerId) {
          const stored = localStorage.getItem(`fk_hero_${playerId.toLowerCase()}`)
          if (stored) localHeroRaw = JSON.parse(stored)
        }
      } catch {}

      const remoteHeroRaw = (rawBuildings._hero && typeof rawBuildings._hero === 'object') ? rawBuildings._hero : null

      let resolvedHero = {
        energy: 3,
        maxEnergy: 3,
        nextEnergyAt: null,
        activeMission: null,
      }

      if (remoteHeroRaw) {
        resolvedHero = {
          energy: typeof remoteHeroRaw.energy === 'number' ? remoteHeroRaw.energy : 3,
          maxEnergy: remoteHeroRaw.maxEnergy || 3,
          nextEnergyAt: remoteHeroRaw.nextEnergyAt || null,
          activeMission: remoteHeroRaw.activeMission || null,
        }
      } else if (localHeroRaw) {
        resolvedHero = {
          energy: typeof localHeroRaw.energy === 'number' ? localHeroRaw.energy : 3,
          maxEnergy: localHeroRaw.maxEnergy || 3,
          nextEnergyAt: localHeroRaw.nextEnergyAt || null,
          activeMission: localHeroRaw.activeMission || null,
        }
      }

      // Si localHeroRaw tiene una expedición activa más reciente o preservada localmente, conservarla
      if (localHeroRaw?.activeMission && (!resolvedHero.activeMission || localHeroRaw.activeMission.finishTime > (resolvedHero.activeMission?.finishTime || 0))) {
        resolvedHero.activeMission = localHeroRaw.activeMission
        if (typeof localHeroRaw.energy === 'number') resolvedHero.energy = localHeroRaw.energy
      }

      const nowMs = Date.now()
      let heroChangedOffline = false

      // Reconciliación de Expedición del Héroe terminada en ausencia (Offline Resolution)
      if (resolvedHero.activeMission) {
        if (nowMs >= resolvedHero.activeMission.finishTime) {
          const missionDef = HERO_MISSIONS[resolvedHero.activeMission.missionId]
          if (missionDef) {
            heroChangedOffline = true
            const roll = Math.random()
            const isSuccess = roll <= missionDef.successRate

            if (isSuccess) {
              const rewardRes = Math.floor(Math.random() * (missionDef.rewardMax - missionDef.rewardMin + 1)) + missionDef.rewardMin
              const split = Math.floor(rewardRes / 3)
              baseWood += split
              baseStone += split
              baseFood += split

              let kingReward = 0
              if (missionDef.hasKingDrop && Math.random() <= missionDef.kingDropChance) {
                kingReward = missionDef.kingAmount
                baseKingPending += kingReward
              }

              const rep = generateHeroReport({
                missionId: resolvedHero.activeMission.missionId,
                missionName: missionDef.name,
                isSuccess: true,
                loot: { wood: split, stone: split, food: split },
                kingReward,
              })
              setBattleReports((reps) => [rep, ...reps])
              gameService.saveReport(playerId, rep)

              setRecentNotification(`¡Expedición del Héroe completada en tu ausencia! ${missionDef.name} fue EXITOSA (+${split} Madera, +${split} Piedra, +${split} Comida${kingReward > 0 ? ` y +${kingReward} KING` : ''}).`)
              console.info(`[Offline Hero Mission] ${missionDef.name} EXITOSA resuelta offline.`)
            } else {
              const rep = generateHeroReport({
                missionId: resolvedHero.activeMission.missionId,
                missionName: missionDef.name,
                isSuccess: false,
                loot: { wood: 0, stone: 0, food: 0 },
                kingReward: 0,
              })
              setBattleReports((reps) => [rep, ...reps])
              gameService.saveReport(playerId, rep)

              setRecentNotification(`Expedición del Héroe finalizada en tu ausencia: ${missionDef.name} no tuvo éxito.`)
              console.info(`[Offline Hero Mission] ${missionDef.name} FALLIDA resuelta offline.`)
            }
          }
          resolvedHero.activeMission = null
        }
      }

      // Regeneración pasiva de energía del héroe en ausencia (1 cada 4h = 14400s)
      if (resolvedHero.energy < resolvedHero.maxEnergy) {
        if (resolvedHero.nextEnergyAt && nowMs >= resolvedHero.nextEnergyAt) {
          const elapsedAfterFirst = nowMs - resolvedHero.nextEnergyAt
          const additionalCharged = 1 + Math.floor(elapsedAfterFirst / (14400 * 1000))
          resolvedHero.energy = Math.min(resolvedHero.maxEnergy, resolvedHero.energy + additionalCharged)
          if (resolvedHero.energy < resolvedHero.maxEnergy) {
            resolvedHero.nextEnergyAt = resolvedHero.nextEnergyAt + additionalCharged * 14400 * 1000
          } else {
            resolvedHero.nextEnergyAt = null
          }
          heroChangedOffline = true
        } else if (!resolvedHero.nextEnergyAt) {
          resolvedHero.nextEnergyAt = nowMs + 14400 * 1000
        }
      }

      // Reconciliación y Rehidratación de Marchas desde Supabase (evita pérdida de tropas en refresh/offline)
      const ongoingMarches = []
      let marchesChangedState = false

      if (Array.isArray(remoteMarches) && remoteMarches.length > 0) {
        for (const rm of remoteMarches) {
          const createdAt = rm.created_at ? new Date(rm.created_at).getTime() : nowMs
          const arriveTime = rm.arrive_time ? new Date(rm.arrive_time).getTime() : nowMs
          const returnTime = rm.return_time ? new Date(rm.return_time).getTime() : null
          const army = rm.army || { infantry: 0, archer: 0, cavalry: 0 }
          const loot = rm.loot || { wood: 0, stone: 0, food: 0 }
          let kingLoot = Number(rm.king_loot || 0)

          const oneWayMs = Math.max(10000, arriveTime - createdAt)
          const carry = calculateArmyCarry(army)
          const gatherMs = Math.max(15000, Math.min(180000, carry * 500))

          let estimatedReturnTime = returnTime
          if (!estimatedReturnTime) {
            if (rm.type === 'gather') {
              estimatedReturnTime = arriveTime + gatherMs + oneWayMs
            } else {
              estimatedReturnTime = arriveTime + oneWayMs
            }
          }

          if (nowMs >= estimatedReturnTime) {
            marchesChangedState = true
            let finalLoot = { ...loot }

            if (rm.type === 'npc' && (!rm.loot || (rm.loot.wood === 0 && rm.loot.stone === 0 && rm.loot.food === 0))) {
              // Simular combate offline contra NPC si aún no se había resuelto
              const npcDef = NPC_TIERS[rm.target_level || 1] || NPC_TIERS[1]
              const battle = simulateBattle(army, npcDef.army, 0, false, false)
              if (battle.isAttackerVictory) {
                const rawLoot = Math.floor(Math.random() * (npcDef.maxResourceReward - npcDef.minResourceReward + 1)) + npcDef.minResourceReward
                const actualLoot = Math.min(rawLoot, carry)
                const split = Math.floor(actualLoot / 3)
                finalLoot = { wood: split, stone: split, food: split }
                if (Math.random() <= npcDef.kingDropRate) {
                  kingLoot = npcDef.kingDropAmount
                }
              }
              loadedTroops.infantry = (loadedTroops.infantry || 0) + (battle.attackerSurviving.infantry || 0)
              loadedTroops.archer = (loadedTroops.archer || 0) + (battle.attackerSurviving.archer || 0)
              loadedTroops.cavalry = (loadedTroops.cavalry || 0) + (battle.attackerSurviving.cavalry || 0)

              const rep = generateCombatReport(battle, finalLoot, kingLoot, npcDef.name, 'npc', rm.target_x, rm.target_y)
              setBattleReports((reps) => [rep, ...reps])
              gameService.saveReport(playerId, rep)
              setRecentNotification(`¡Expedición de combate contra ${npcDef.name} completada en tu ausencia (${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'})!`)
            } else {
              loadedTroops.infantry = (loadedTroops.infantry || 0) + (army.infantry || 0)
              loadedTroops.archer = (loadedTroops.archer || 0) + (army.archer || 0)
              loadedTroops.cavalry = (loadedTroops.cavalry || 0) + (army.cavalry || 0)
            }

            if (rm.type === 'gather' && finalLoot.wood === 0 && finalLoot.stone === 0 && finalLoot.food === 0) {
              const mined = Math.min(carry, 500)
              const tName = (rm.target_name || '').toLowerCase()
              if (tName.includes('madera') || tName.includes('bosque')) finalLoot.wood = mined
              else if (tName.includes('piedra') || tName.includes('cantera')) finalLoot.stone = mined
              else finalLoot.food = mined
            }
            baseWood += (finalLoot.wood || 0)
            baseStone += (finalLoot.stone || 0)
            baseFood += (finalLoot.food || 0)
            baseKingPending += kingLoot

            await gameService.removeMarch(rm.id)

            if (rm.type === 'gather') {
              const gatherRep = generateGatherReport({
                targetName: rm.target_name || 'Nodo de Recursos',
                targetX: rm.target_x,
                targetY: rm.target_y,
                resourceType: finalLoot.wood > 0 ? 'wood' : (finalLoot.stone > 0 ? 'stone' : 'food'),
                loot: finalLoot,
                army: army,
                carryCapacity: carry,
                nodeResourceMax: 500,
              })
              setBattleReports((prev) => [gatherRep, ...prev])
              gameService.saveReport(playerId, gatherRep)
            }
          } else {
            let currentStatus = rm.status || 'traveling'
            let gatherUntil = null
            if (rm.type === 'gather') {
              gatherUntil = arriveTime + gatherMs
              if (nowMs >= gatherUntil) {
                currentStatus = 'returning'
              } else if (nowMs >= arriveTime) {
                currentStatus = 'gathering'
              } else {
                currentStatus = 'traveling'
              }
            } else {
              if (nowMs >= arriveTime) {
                currentStatus = 'returning'
              } else {
                currentStatus = 'traveling'
              }
            }

            ongoingMarches.push({
              id: rm.id,
              type: rm.type || 'gather',
              originX: normalizedBase.worldX,
              originY: normalizedBase.worldY,
              targetX: rm.target_x,
              targetY: rm.target_y,
              targetName: rm.target_name || 'Objetivo',
              army: army,
              resourceType: rm.type === 'gather' ? (rm.target_name?.toLowerCase().includes('madera') ? 'wood' : rm.target_name?.toLowerCase().includes('piedra') ? 'stone' : 'food') : null,
              nodeResourceMax: 500,
              startTime: createdAt,
              arriveTime: arriveTime,
              gatherUntil: gatherUntil,
              returnTime: estimatedReturnTime,
              oneWayDurationMs: oneWayMs,
              status: currentStatus,
              loot: loot,
              kingLoot: kingLoot,
              distanceTiles: Math.max(Math.abs(rm.target_x - normalizedBase.worldX), Math.abs(rm.target_y - normalizedBase.worldY), 1),
            })
          }
        }
      }

      // Combinar con marchas locales pendientes si no estaban en backend
      let localMarches = []
      try {
        if (typeof window !== 'undefined' && playerId) {
          const raw = localStorage.getItem(`fk_marches_${playerId.toLowerCase()}`)
          if (raw) localMarches = JSON.parse(raw)
        }
      } catch {}

      if (Array.isArray(localMarches) && localMarches.length > 0) {
        for (const lm of localMarches) {
          if (!ongoingMarches.some((m) => m.id === lm.id)) {
            const estReturn = lm.returnTime || (lm.arriveTime + (lm.oneWayDurationMs || 30000) * 2)
            if (nowMs < estReturn) {
              ongoingMarches.push(lm)
              gameService.registerMarch(playerId, lm)
            }
          }
        }
      }

      // CÁLCULO DE PROCESOS ACTIVOS OFFLINE (Construcción y Entrenamiento en ausencia)
      let constructionChangedOffline = false
      if (activeConstruction && activeConstruction.finishTime) {
        if (nowMs >= activeConstruction.finishTime) {
          const bId = activeConstruction.buildingId
          const targetLvl = activeConstruction.targetLevel
          if (BUILDINGS_CONFIG[bId]) {
            loadedBuildings[bId] = targetLvl
            constructionChangedOffline = true
            const bName = BUILDINGS_CONFIG[bId].name
            setRecentNotification(`¡Construcción finalizada en tu ausencia! ${bName} ha subido al Nivel ${targetLvl}.`)
            console.info(`[Offline Construction] Completado en backend: ${bName} Nv.${targetLvl}`)
          }
          activeConstruction = null
        } else {
          console.info(`[Offline Construction] Construcción activa continuada: ${activeConstruction.buildingId} Nv.${activeConstruction.targetLevel}, restan ${Math.ceil((activeConstruction.finishTime - nowMs) / 1000)}s`)
        }
      }

      let queueChangedOffline = false
      if (activeQueue.length > 0) {
        const remainingQueue = []
        for (const batch of activeQueue) {
          if (nowMs >= batch.finishTime) {
            const tId = batch.troopId
            const count = batch.count
            if (TROOPS_CONFIG[tId]) {
              loadedTroops[tId] = (loadedTroops[tId] || 0) + count
              queueChangedOffline = true
              setRecentNotification(`¡Entrenamiento completado en tu ausencia! +${count} ${TROOPS_CONFIG[tId].name}.`)
              console.info(`[Offline Training] Tropas entrenadas offline: +${count} ${TROOPS_CONFIG[tId].name}`)
            }
          } else {
            remainingQueue.push(batch)
          }
        }
        activeQueue = remainingQueue
      }

      // CÁLCULO DE PRODUCCIÓN OFFLINE (Recursos acumulados mientras el jugador estuvo ausente)
      let offlineProductionAdded = false
      if (remoteKingdom.updated_at) {
        const lastUpdatedMs = new Date(remoteKingdom.updated_at).getTime()
        const nowMs = Date.now()
        // Tiempo transcurrido en segundos (tope máximo 24h = 86400s)
        const elapsedSec = Math.max(0, Math.min(86400, Math.floor((nowMs - lastUpdatedMs) / 1000)))

        if (elapsedSec >= 5) {
          const castleLvl = loadedBuildings.castle || 1
          const castleDef = BUILDINGS_CONFIG.castle.levels[castleLvl] || BUILDINGS_CONFIG.castle.levels[1]
          const passiveRates = castleDef.passivePerHour || { wood: 300, stone: 240, food: 360 }

          // Consumo de comida según tropas y capacidad logística
          const granaryLvl = loadedBuildings.granary || 1
          const granaryDef = BUILDINGS_CONFIG.granary.levels[granaryLvl] || BUILDINGS_CONFIG.granary.levels[1]
          const logCap = granaryDef.logisticsCapacity || 100
          const troopTotal = (loadedTroops.infantry || 0) + (loadedTroops.archer || 0) + (loadedTroops.cavalry || 0)
          const logRatio = logCap > 0 ? (troopTotal / logCap) : 1
          let logMult = 1
          for (const step of LOGISTICS_PENALTIES) {
            if (logRatio <= step.threshold) {
              logMult = step.multiplier
              break
            }
          }
          if (logRatio > 2.00) logMult = 3.00

          const baseUpkeep = (loadedTroops.infantry || 0) * 1 + (loadedTroops.archer || 0) * 1 + (loadedTroops.cavalry || 0) * 2
          const foodUpkeepPerHour = Math.round(baseUpkeep * logMult)

          const hoursElapsed = elapsedSec / 3600
          const offlineWood = Math.floor(passiveRates.wood * hoursElapsed)
          const offlineStone = Math.floor(passiveRates.stone * hoursElapsed)
          const netFoodPerHour = passiveRates.food - foodUpkeepPerHour
          const offlineFood = Math.floor(netFoodPerHour * hoursElapsed)

          baseWood += offlineWood
          baseStone += offlineStone
          baseFood = Math.max(0, baseFood + offlineFood)
          offlineProductionAdded = true

          console.info(`[Offline Production] Transcurrieron ${elapsedSec}s offline. Producido: +${offlineWood}W, +${offlineStone}S, ${offlineFood >= 0 ? '+' : ''}${offlineFood}F`)

          if (offlineWood > 0 || offlineStone > 0) {
            const timeDesc = elapsedSec >= 3600
              ? `${(elapsedSec / 3600).toFixed(1)}h`
              : `${Math.round(elapsedSec / 60)} min`
            setRecentNotification(`¡Bienvenido de vuelta! Tu reino acumuló +${offlineWood} Madera, +${offlineStone} Piedra y ${offlineFood >= 0 ? '+' : ''}${offlineFood} Comida en tu ausencia (${timeDesc}).`)
          }
        }
      }

      setBuildings(loadedBuildings)
      setBuildingUnderConstruction(activeConstruction)
      setTroops(loadedTroops)
      setTrainingQueue(activeQueue)
      setMarches(ongoingMarches)
      setHero(resolvedHero)
      if (typeof window !== 'undefined' && playerId) {
        try {
          localStorage.setItem(`fk_hero_${playerId.toLowerCase()}`, JSON.stringify(resolvedHero))
          localStorage.setItem(`fk_marches_${playerId.toLowerCase()}`, JSON.stringify(ongoingMarches))
        } catch {}
      }
      setResources({
        wood: baseWood,
        stone: baseStone,
        food: baseFood,
      })

      if (marchesChangedState || constructionChangedOffline || queueChangedOffline || offlineProductionAdded || heroChangedOffline) {
        lastLocalSaveTimeRef.current = Date.now()
        gameService.syncKingdom(playerId, {
          resources: { wood: baseWood, stone: baseStone, food: baseFood },
          king: {
            claimed: Number(remoteKingdom.king_claimed || 0),
            pending: Number(baseKingPending.toFixed(4)),
            vault: Number(remoteKingdom.king_vault || 0),
          },
          buildings: loadedBuildings,
          troops: loadedTroops,
          shieldUntil: Number(remoteKingdom.shield_until || 0),
          kingdomPower: (loadedBuildings.castle || 1) * 300 + (loadedTroops.infantry || 0) * 10 + (loadedTroops.archer || 0) * 15 + (loadedTroops.cavalry || 0) * 20,
          buildingUnderConstruction: activeConstruction,
          trainingQueue: activeQueue,
          hero: resolvedHero,
        })
      }

      isLoadedRef.current = true

      // Cargar KING directamente del backend (cero generación pasiva de KING)
      let initialClaimed = Number(remoteKingdom.king_claimed || 0)

      // Reconciliar premio de ranking diario (00:00 UTC) si aún no ha sido reflejado en la cuenta
      try {
        const todayUtc = new Date().toISOString().slice(0, 10)
        const payoutId = `rank_payout_${todayUtc.replace(/-/g, '_')}`
        const storageKey = `fk_rank_reward_acknowledged_${payoutId}_${playerId}`
        const acknowledged = localStorage.getItem(storageKey)

        if (!acknowledged && supabase) {
          supabase
            .from('ranking_payouts')
            .select('winners')
            .eq('id', payoutId)
            .maybeSingle()
            .then(({ data: payoutToday }) => {
              if (payoutToday && Array.isArray(payoutToday.winners)) {
                const winner = payoutToday.winners.find((w) => (w.playerId || '').toLowerCase() === playerId.toLowerCase())
                if (winner && winner.rewardKing > 0) {
                  localStorage.setItem(storageKey, 'true')
                  setKing((prev) => {
                    const target = Math.max(prev.claimed, Number((initialClaimed + (prev.claimed <= 11 ? winner.rewardKing : 0)).toFixed(2)))
                    supabase.from('kingdoms').update({ king_claimed: target }).eq('id', playerId).then(() => {})
                    return { ...prev, claimed: target }
                  })
                }
              }
            })
            .catch(() => {})
        }
      } catch (err) {
        console.warn('[Ranking Reconcile]', err)
      }

      if (remoteKingdom.king_claimed !== undefined) {
        setKing((prev) => ({
          ...prev,
          claimed: initialClaimed,
          pending: Number(baseKingPending ?? remoteKingdom.king_pending ?? 0),
          vault: Number(remoteKingdom.king_vault || 0),
        }))
      }

      // Cargar escudo de paz directamente del backend
      if (remoteKingdom.shield_until !== undefined) {
        setShieldUntil(Number(remoteKingdom.shield_until || 0))
      }
    })

    // 2. Cargar reportes de combate y recolección directamente desde Supabase
    gameService.fetchReports(playerId).then((remoteReports) => {
      if (isCancelled || !remoteReports || remoteReports.length === 0) return
      setBattleReports(remoteReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    })

    // 3. Suscripción en Tiempo Real para cambios simultáneos entre PC y Celular
    const unsubscribe = gameService.subscribeToUpdates(
      playerId,
      (newReport) => {
        setBattleReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)])
      },
      (remoteKingdom) => {
        if (!remoteKingdom) return

        // 1. Sincronización instantánea de KING:
        // Si el backend incrementó el saldo (premios de ranking, compras, airdrops),
        // actualizar SIEMPRE el estado de KING sin bloquearlo por la ventana de 15s
        if (remoteKingdom.king_claimed !== undefined) {
          const remoteClaimed = Number(remoteKingdom.king_claimed || 0)
          setKing((prev) => {
            if (remoteClaimed !== prev.claimed) {
              console.info('[Supabase Realtime] Saldo KING actualizado en vivo desde servidor:', remoteClaimed)
              return {
                ...prev,
                claimed: remoteClaimed,
                pending: Number(remoteKingdom.king_pending ?? prev.pending ?? 0),
                vault: Number(remoteKingdom.king_vault ?? prev.vault ?? 0),
              }
            }
            return prev
          })
        }

        // Evitar bucle de eco si acabamos de guardar nosotros mismos (ventana de 15s) para recursos/tropas
        if (Date.now() - lastLocalSaveTimeRef.current < 15000) {
          return
        }

        console.info('[Supabase Realtime] Sincronización instantánea desde otro dispositivo:', remoteKingdom)
        if (remoteKingdom.wood !== undefined && remoteKingdom.stone !== undefined && remoteKingdom.food !== undefined) {
          setResources((prev) => {
            const diffWood = Math.abs(prev.wood - remoteKingdom.wood)
            const diffStone = Math.abs(prev.stone - remoteKingdom.stone)
            const diffFood = Math.abs(prev.food - remoteKingdom.food)
            // Solo sobrescribir si el cambio es significativo (> 5), representando acciones en otro dispositivo
            if (diffWood > 5 || diffStone > 5 || diffFood > 5) {
              return {
                wood: Math.floor(Number(remoteKingdom.wood) || 0),
                stone: Math.floor(Number(remoteKingdom.stone) || 0),
                food: Math.floor(Number(remoteKingdom.food) || 0),
              }
            }
            return prev
          })
        }
        if (remoteKingdom.buildings && typeof remoteKingdom.buildings === 'object') {
          const rawB = remoteKingdom.buildings
          const cleanB = {}
          for (const [k, v] of Object.entries(rawB)) {
            if (k !== '_construction' && typeof v === 'number') cleanB[k] = v
          }
          setBuildings((prev) => ({ ...prev, ...cleanB }))
          if (rawB._construction !== undefined) {
            setBuildingUnderConstruction(rawB._construction)
          }
        }
        if (remoteKingdom.troops && typeof remoteKingdom.troops === 'object') {
          const rawT = remoteKingdom.troops
          const cleanT = {}
          for (const [k, v] of Object.entries(rawT)) {
            if (k !== '_trainingQueue' && typeof v === 'number') cleanT[k] = v
          }
          setTroops((prev) => ({ ...prev, ...cleanT }))
          if (Array.isArray(rawT._trainingQueue)) {
            setTrainingQueue(rawT._trainingQueue)
          }
        }
        if (remoteKingdom.king_claimed !== undefined) {
          setKing((prev) => ({
            ...prev,
            claimed: Number(remoteKingdom.king_claimed || 0),
            pending: Number(remoteKingdom.king_pending || 0),
            vault: Number(remoteKingdom.king_vault || 0),
          }))
        }
        if (remoteKingdom.shield_until !== undefined) {
          setShieldUntil(Number(remoteKingdom.shield_until || 0))
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
    buildingUnderConstruction,
    trainingQueue,
    hero,
  }

  // Disparador de sincronización directa con Supabase Backend (Cero almacenamiento local)
  const triggerBackendSync = useCallback((override = null) => {
    if (!isSupabaseConfigured || !playerId || !isLoadedRef.current) return
    const stateToSync = override || latestStateRef.current
    if (stateToSync) {
      lastLocalSaveTimeRef.current = Date.now()
      gameService.syncKingdom(playerId, stateToSync)
    }
  }, [playerId])

  // Sincronización periódica con Supabase Backend cada 10 segundos
  useEffect(() => {
    if (!isSupabaseConfigured || !playerId) return

    const timer = setInterval(() => {
      triggerBackendSync()
    }, 10000)

    return () => {
      clearInterval(timer)
      triggerBackendSync()
    }
  }, [playerId, triggerBackendSync])

  // Guardado inmediato en Supabase al cerrar pestaña, cambiar de aplicación en móvil o bloquear pantalla
  useEffect(() => {
    if (!isSupabaseConfigured || !playerId) return

    const handleExitSync = () => {
      triggerBackendSync()
    }

    window.addEventListener('beforeunload', handleExitSync)
    window.addEventListener('pagehide', handleExitSync)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleExitSync()
      } else if (document.visibilityState === 'visible') {
        // Al regresar del segundo plano en móvil o PC, recuperar producción y chequear construcciones de inmediato
        const now = Date.now()

        // 1. Evaluar si la construcción en curso finalizó mientras la pestaña estuvo en segundo plano
        setBuildingUnderConstruction((current) => {
          if (!current) return null
          if (now >= current.finishTime) {
            setBuildings((b) => {
              const nextB = { ...b, [current.buildingId]: current.targetLevel }
              triggerBackendSync({
                ...latestStateRef.current,
                buildings: nextB,
                buildingUnderConstruction: null,
              })
              return nextB
            })
            setRecentNotification(`¡${BUILDINGS_CONFIG[current.buildingId]?.name || 'Edificio'} ha subido al Nivel ${current.targetLevel}!`)
            return null
          }
          return current
        })

        // 2. Evaluar si algún lote de reclutamiento finalizó mientras la pestaña estuvo en segundo plano
        setTrainingQueue((prevQueue) => {
          if (!prevQueue.length) return prevQueue
          const currentBatch = prevQueue[0]
          if (now >= currentBatch.finishTime) {
            let nextTroops = null
            setTroops((t) => {
              nextTroops = { ...t, [currentBatch.troopId]: (t[currentBatch.troopId] || 0) + currentBatch.count }
              return nextTroops
            })
            setRecentNotification(`¡Entrenamiento completado: +${currentBatch.count} ${TROOPS_CONFIG[currentBatch.troopId]?.name || 'tropas'}!`)
            const nextQueue = prevQueue.slice(1)
            triggerBackendSync({
              ...latestStateRef.current,
              troops: nextTroops || latestStateRef.current.troops,
              trainingQueue: nextQueue,
            })
            return nextQueue
          }
          return prevQueue
        })

        const lastTick = lastTickTimeRef.current || now
        const elapsedSec = (now - lastTick) / 1000
        if (elapsedSec >= 2) {
          const deltaSec = Math.max(0.1, Math.min(86400, elapsedSec))
          lastTickTimeRef.current = now

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

          if (woodAdd !== 0 || stoneAdd !== 0 || foodAdd !== 0) {
            setResources((prev) => ({
              wood: prev.wood + woodAdd,
              stone: prev.stone + stoneAdd,
              food: Math.max(0, prev.food + foodAdd),
            }))
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleExitSync)
      window.removeEventListener('pagehide', handleExitSync)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [playerId, triggerBackendSync, passiveProductionPerHour, totalFoodUpkeepPerHour])

  // Sincronizar inmediatamente al completar o cambiar edificios, tropas, construcciones o escudo
  useEffect(() => {
    if (!isSupabaseConfigured || !playerId) return
    const debounceTimer = setTimeout(() => {
      triggerBackendSync()
    }, 1000)
    return () => clearTimeout(debounceTimer)
  }, [playerId, buildings, troops, shieldUntil, buildingUnderConstruction, trainingQueue, triggerBackendSync])

  // --- TICKS EN TIEMPO REAL (1s) ---
  useEffect(() => {
    lastTickTimeRef.current = Date.now()
    const interval = setInterval(() => {
      const now = Date.now()

      // A. Producción Pasiva & Consumo de Comida por segundo (acumulación con delta real)
      const lastTick = lastTickTimeRef.current || now
      lastTickTimeRef.current = now
      const rawDeltaSec = (now - lastTick) / 1000
      // Absorbe retrasos del navegador o suspensión en móviles (máx 86400s = 24h)
      const deltaSec = Math.max(0.1, Math.min(86400, rawDeltaSec))
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
          let updatedBuildings = null
          setBuildings((b) => {
            updatedBuildings = { ...b, [current.buildingId]: current.targetLevel }
            triggerBackendSync({
              ...latestStateRef.current,
              buildings: updatedBuildings,
              buildingUnderConstruction: null,
            })
            return updatedBuildings
          })
          setRecentNotification(`¡${BUILDINGS_CONFIG[current.buildingId]?.name || 'Edificio'} ha subido al Nivel ${current.targetLevel}!`)
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
          let updatedTroops = null
          setTroops((t) => {
            updatedTroops = { ...t, [currentBatch.troopId]: (t[currentBatch.troopId] || 0) + currentBatch.count }
            return updatedTroops
          })
          setRecentNotification(`¡Entrenamiento completado: +${currentBatch.count} ${TROOPS_CONFIG[currentBatch.troopId]?.name || 'tropas'}!`)
          const nextQueue = prevQueue.slice(1)
          // Si hay otro lote, ajustar su finishTime si no había comenzado
          if (nextQueue.length > 0) {
            nextQueue[0] = {
              ...nextQueue[0],
              finishTime: now + nextQueue[0].totalSec * 1000,
            }
          }
          triggerBackendSync({
            ...latestStateRef.current,
            troops: updatedTroops || { ...latestStateRef.current.troops, [currentBatch.troopId]: (latestStateRef.current.troops[currentBatch.troopId] || 0) + currentBatch.count },
            trainingQueue: nextQueue,
          })
          return nextQueue
        }
        return prevQueue
      })

      // E. Verificación de Misión de Héroe
      setHero((prevHero) => {
        let updated = { ...prevHero }
        let changed = false
        // Regeneración de energía cada 4h (14400s)
        if (updated.energy < updated.maxEnergy) {
          if (!updated.nextEnergyAt) {
            updated.nextEnergyAt = now + 14400 * 1000
            changed = true
          } else if (now >= updated.nextEnergyAt) {
            updated.energy += 1
            updated.nextEnergyAt = updated.energy < updated.maxEnergy ? now + 14400 * 1000 : null
            changed = true
          }
        }

        // Misión activa
        if (updated.activeMission && now >= updated.activeMission.finishTime) {
          changed = true
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

        if (changed) {
          if (typeof window !== 'undefined' && playerId) {
            try {
              localStorage.setItem(`fk_hero_${playerId.toLowerCase()}`, JSON.stringify(updated))
            } catch {}
          }
          triggerBackendSync({ ...latestStateRef.current, hero: updated })
          return updated
        }
        return prevHero
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
              gameService.updateMarch(march.id, { status: 'gathering' })
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
                gameService.updateMarch(march.id, {
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + travelBackDuration,
                  loot: returningLoot,
                  kingLoot: returningKingLoot,
                })
                setRecentNotification(`¡Batalla contra ${npcDef.name}: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}! ${march.isRally ? 'Tropas del Rally' : 'Supervivientes'} regresando.`)
              } else {
                gameService.removeMarch(march.id)
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
                gameService.updateMarch(march.id, {
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + march.oneWayDurationMs,
                  loot: returningLoot,
                  kingLoot: returningKingLoot,
                })
                setRecentNotification(`¡Asalto PvP: ${battle.isAttackerVictory ? 'VICTORIA' : 'DERROTA'}! Regresando con el botín.`)
              } else {
                gameService.removeMarch(march.id)
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
                const fLoot = battle.isAttackerVictory ? returningLoot : { wood: 0, stone: 0, food: 0 }
                const fKing = battle.isAttackerVictory ? returningKingLoot : 0
                updated.push({
                  ...march,
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + march.oneWayDurationMs,
                  loot: fLoot,
                  kingLoot: fKing,
                })
                gameService.updateMarch(march.id, {
                  status: 'returning',
                  army: returningArmy,
                  returnTime: now + march.oneWayDurationMs,
                  loot: fLoot,
                  kingLoot: fKing,
                })
              } else {
                gameService.removeMarch(march.id)
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
              gameService.updateMarch(march.id, {
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
            gameService.updateMarch(march.id, {
              status: 'returning',
              returnTime: now + march.oneWayDurationMs,
              loot,
            })
            if (optionsRef.current?.onNodeDepleted) {
              optionsRef.current.onNodeDepleted({
                targetX: march.targetX,
                targetY: march.targetY,
                resourceType: march.resourceType,
                targetLevel: march.targetLevel || 1,
              })
            }
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
                gameService.registerMarch(playerId, rallyMarch)
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
    const nextResources = {
      wood: resources.wood - cost.wood,
      stone: resources.stone - cost.stone,
      food: resources.food - cost.food,
    }
    setResources(nextResources)

    const newConstruction = {
      buildingId,
      targetLevel: targetLvl,
      finishTime: Date.now() + durationSec * 1000,
      totalSec: durationSec,
    }

    setBuildingUnderConstruction(newConstruction)

    triggerBackendSync({
      ...latestStateRef.current,
      resources: nextResources,
      buildingUnderConstruction: newConstruction,
    })

    setRecentNotification(`Construcción iniciada: ${BUILDINGS_CONFIG[buildingId].name} Nv.${targetLvl}.`)
    return { success: true }
  }, [canUpgradeBuilding, buildings, resources, speedMultiplier, triggerBackendSync])

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

    const nextKing = { ...king, claimed: Math.max(0, Number((king.claimed - cost).toFixed(2))) }
    const nextBuildings = { ...buildings, [buildingUnderConstruction.buildingId]: buildingUnderConstruction.targetLevel }

    setKing(nextKing)
    setBuildings(nextBuildings)
    setRecentNotification(`¡Construcción acelerada con ${cost} KING! ${BUILDINGS_CONFIG[buildingUnderConstruction.buildingId].name} Nv.${buildingUnderConstruction.targetLevel}.`)
    setBuildingUnderConstruction(null)

    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
      buildings: nextBuildings,
      buildingUnderConstruction: null,
    })
  }, [buildingUnderConstruction, king, buildings, triggerBackendSync])

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
    const nextResources = {
      wood: resources.wood - totalCost.wood,
      stone: resources.stone - totalCost.stone,
      food: resources.food - totalCost.food,
    }
    setResources(nextResources)

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

    const nextQueue = [...trainingQueue, newBatch]
    setTrainingQueue(nextQueue)
    triggerBackendSync({
      ...latestStateRef.current,
      resources: nextResources,
      trainingQueue: nextQueue,
    })
    setRecentNotification(`Reclutando ${count} ${conf.name}...`)
    return { success: true }
  }, [buildings.barracks, trainingQueue, resources, speedMultiplier, triggerBackendSync])

  const speedupTraining = useCallback(() => {
    if (!trainingQueue.length) return
    const currentBatch = trainingQueue[0]
    const remainingSec = Math.max(1, Math.ceil((currentBatch.finishTime - Date.now()) / 1000))
    const cost = calculateKingCostForSec(remainingSec)

    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING.`)
      return
    }

    const nextKing = { ...king, claimed: Math.max(0, Number((king.claimed - cost).toFixed(2))) }
    const nextTroops = { ...troops, [currentBatch.troopId]: (troops[currentBatch.troopId] || 0) + currentBatch.count }
    setRecentNotification(`¡Entrenamiento acelerado con ${cost} KING! +${currentBatch.count} ${TROOPS_CONFIG[currentBatch.troopId].name}`)

    const nextQueue = trainingQueue.slice(1)
    if (nextQueue.length > 0) {
      nextQueue[0] = {
        ...nextQueue[0],
        finishTime: Date.now() + nextQueue[0].totalSec * 1000,
      }
    }
    setKing(nextKing)
    setTroops(nextTroops)
    setTrainingQueue(nextQueue)
    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
      troops: nextTroops,
      trainingQueue: nextQueue,
    })
  }, [trainingQueue, king, troops, triggerBackendSync])

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

    setMarches((m) => {
      const next = [...m, newMarch]
      if (typeof window !== 'undefined' && playerId) {
        try {
          localStorage.setItem(`fk_marches_${playerId.toLowerCase()}`, JSON.stringify(next))
        } catch {}
      }
      return next
    })
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
    gameService.removeMarch(marchId)
    setRecentNotification('¡Marcha cancelada! Tus tropas han regresado de inmediato a tu castillo.')
  }, [marches, playerId])

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
      gameService.updateMarch(marchId, {
        status: 'returning',
        returnTime: now + returnDuration,
        loot,
      })

      if (optionsRef.current?.onNodeDepleted) {
        optionsRef.current.onNodeDepleted({
          targetX: march.targetX,
          targetY: march.targetY,
          resourceType: march.resourceType,
          targetLevel: march.targetLevel || 1,
        })
      }

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
        gameService.updateMarch(marchId, {
          status: 'gathering',
        })
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
          gameService.updateMarch(marchId, {
            status: 'returning',
            army: returningArmy,
            returnTime: now + returnDuration,
            loot: returningLoot,
            kingLoot: returningKingLoot,
          })
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
          gameService.updateMarch(marchId, {
            status: 'returning',
            army: returningArmy,
            returnTime: now + returnDuration,
            loot: returningLoot,
            kingLoot: returningKingLoot,
          })
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
          gameService.updateMarch(marchId, {
            status: 'returning',
            army: returningArmy,
            returnTime: now + returnDuration,
            loot: returningLoot,
            kingLoot: returningKingLoot,
          })
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
        gameService.updateMarch(marchId, {
          status: 'returning',
          returnTime: now + returnDuration,
          loot: { wood: 0, stone: 0, food: 0 },
          kingLoot: 0,
        })
        setRecentNotification(`¡Ida acelerada (-${cost} KING)! Refuerzos entregados inmediatamente. Transporte regresando a casa.`)
        return
      }
    }
  }, [marches, king.claimed, isHungry, playerId])

  // 5. Tesorería: Claim (sin fee) y Withdraw (5% fee)
  const claimPendingKing = useCallback(() => {
    if (king.pending <= 0) return
    const amount = king.pending
    const nextKing = {
      ...king,
      claimed: Number((king.claimed + amount).toFixed(2)),
      pending: 0,
    }
    setKing(nextKing)
    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
    })
    setRecentNotification(`¡Reclamados ${amount.toFixed(2)} KING a la Tesorería sin comisiones!`)
  }, [king, triggerBackendSync])

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

    const nextKing = {
      ...king,
      claimed: Number((king.claimed - amt).toFixed(2)),
      vault: Number(((king.vault || 0) + netVaultAmount).toFixed(2)),
    }
    setKing(nextKing)
    setDailyWithdrawnKing((prev) => prev + amt)
    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
    })
    setRecentNotification(`Retiro de ${amt} KING procesado. Neto recibido en Vault: ${netVaultAmount.toFixed(2)} (Fee 5%: ${fee.toFixed(2)} KING).`)
  }, [king, dailyWithdrawnKing, treasuryDailyWithdrawLimit, triggerBackendSync])

  // 6. Héroe: Iniciar Misión
  const startHeroMission = useCallback((missionId) => {
    const mission = HERO_MISSIONS[missionId]
    if (!mission) return
    if (hero.activeMission) {
      setRecentNotification('El Héroe ya se encuentra en una expedición activa.')
      return
    }
    if (hero.energy < mission.energyCost) {
      setRecentNotification(`Energía insuficiente. Requiere ${mission.energyCost}⚡.`)
      return
    }

    const durationSec = Math.max(5, mission.durationSec / speedMultiplier)
    const newHeroState = {
      ...hero,
      energy: hero.energy - mission.energyCost,
      activeMission: {
        id: `h_miss_${Date.now()}`,
        missionId,
        finishTime: Date.now() + durationSec * 1000,
        totalSec: durationSec,
      },
    }
    setHero(newHeroState)
    if (typeof window !== 'undefined' && playerId) {
      try {
        localStorage.setItem(`fk_hero_${playerId.toLowerCase()}`, JSON.stringify(newHeroState))
      } catch {}
    }
    triggerBackendSync({ ...latestStateRef.current, hero: newHeroState })
    setRecentNotification(`¡Héroe partió en expedición: ${mission.name}! Regresará en ${Math.round(durationSec / 60)} min.`)
  }, [hero, speedMultiplier, playerId, triggerBackendSync])

  const speedupHeroMission = useCallback(() => {
    if (!hero.activeMission) return
    const remainingSec = Math.max(1, Math.ceil((hero.activeMission.finishTime - Date.now()) / 1000))
    const cost = calculateKingCostForSec(remainingSec)

    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING.`)
      return
    }

    setKing((k) => ({ ...k, claimed: Math.max(0, Number((k.claimed - cost).toFixed(2))) }))
    const updatedHero = {
      ...hero,
      activeMission: { ...hero.activeMission, finishTime: Date.now() },
    }
    setHero(updatedHero)
    if (typeof window !== 'undefined' && playerId) {
      try {
        localStorage.setItem(`fk_hero_${playerId.toLowerCase()}`, JSON.stringify(updatedHero))
      } catch {}
    }
    triggerBackendSync({ ...latestStateRef.current, hero: updatedHero })
    setRecentNotification(`¡Expedición del Héroe acelerada con ${cost} KING!`)
  }, [hero, king.claimed, playerId, triggerBackendSync])

  // 7. Tienda de KING: Escudos, Planos, Founder Packs
  const buyPeaceShield = useCallback((shieldItem) => {
    if (king.claimed < shieldItem.kingCost) {
      setRecentNotification(`KING insuficiente para comprar ${shieldItem.name}.`)
      return
    }
    const nextKing = { ...king, claimed: Math.max(0, Number((king.claimed - shieldItem.kingCost).toFixed(2))) }
    const currentShieldEnd = Math.max(Date.now(), shieldUntil)
    const newEnd = currentShieldEnd + shieldItem.durationSec * 1000
    setKing(nextKing)
    setShieldUntil(newEnd)
    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
      shieldUntil: newEnd,
    })
    setRecentNotification(`¡${shieldItem.name} activado! Tu reino está protegido.`)
  }, [king, shieldUntil, triggerBackendSync])

  const buyFounderPack = useCallback((pack) => {
    const cost = pack.kingCost || 50
    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING en Tesorería para ${pack.name}.`)
      return
    }

    const nextKing = {
      ...king,
      claimed: Math.max(0, Number((king.claimed - cost).toFixed(2))),
    }
    const nextResources = {
      wood: resources.wood + (pack.resources?.wood || 0),
      stone: resources.stone + (pack.resources?.stone || 0),
      food: resources.food + (pack.resources?.food || 0),
    }
    const nextTroops = {
      infantry: (troops.infantry || 0) + (pack.troops?.infantry || 0),
      archer: (troops.archer || 0) + (pack.troops?.archer || 0),
      cavalry: (troops.cavalry || 0) + (pack.troops?.cavalry || 0),
    }
    const nextShield = Math.max(Date.now(), shieldUntil) + (pack.shieldHours || 0) * 3600 * 1000

    setKing(nextKing)
    setResources(nextResources)
    setTroops(nextTroops)
    setShieldUntil(nextShield)

    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
      resources: nextResources,
      troops: nextTroops,
      shieldUntil: nextShield,
    })

    setRecentNotification(`¡${pack.name} adquirido con éxito! Se descontaron ${cost} KING de tu Tesorería.`)
  }, [king, resources, troops, shieldUntil, triggerBackendSync])

  const buyBlueprint = useCallback((bp) => {
    const cost = bp.kingCost || 80
    if (king.claimed < cost) {
      setRecentNotification(`KING insuficiente. Requiere ${cost} KING para ${bp.name}.`)
      return
    }

    const nextKing = {
      ...king,
      claimed: Math.max(0, Number((king.claimed - cost).toFixed(2))),
    }

    setKing(nextKing)
    triggerBackendSync({
      ...latestStateRef.current,
      king: nextKing,
    })

    setRecentNotification(`¡${bp.name} adquirido! Se descontaron ${cost} KING de tu Tesorería.`)
  }, [king, triggerBackendSync])

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
    const nextResources = {
      wood: resources.wood + 20000,
      stone: resources.stone + 20000,
      food: resources.food + 25000,
    }
    const nextKing = { ...king, claimed: Number((king.claimed + 500).toFixed(2)) }
    const nextTroops = {
      infantry: troops.infantry + 30,
      archer: troops.archer + 20,
      cavalry: troops.cavalry + 10,
    }
    setResources(nextResources)
    setKing(nextKing)
    setTroops(nextTroops)
    triggerBackendSync({
      ...latestStateRef.current,
      resources: nextResources,
      king: nextKing,
      troops: nextTroops,
    })
    setRecentNotification('⚡ ¡Pack Sandbox activado: +20K Madera, +20K Piedra, +25K Comida, +500 KING y 60 tropas!')
  }, [resources, king, troops, triggerBackendSync])

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
    buyBlueprint,
    calculateKingCostForSec,
    resetGame,
    grantTestResources,
  }
}
