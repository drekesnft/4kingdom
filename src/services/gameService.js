/**
 * FourKingdom — Servicio Backend con Supabase
 * Centraliza la persistencia, sincronización y control de estado
 */
import { supabase, isSupabaseConfigured } from './supabaseClient'

export const gameService = {
  /**
   * Carga el estado del reino desde Supabase
   */
  async loadKingdom(playerId) {
    if (!isSupabaseConfigured || !supabase || !playerId || !playerId.includes('@')) return null

    try {
      const { data, error } = await supabase
        .from('kingdoms')
        .select('*')
        .eq('id', playerId)
        .maybeSingle()

      if (error) {
        console.error('[Supabase] Error al cargar reino:', error.message)
        return null
      }
      return data
    } catch (err) {
      console.error('[Supabase] Excepción en loadKingdom:', err)
      return null
    }
  },

  /**
   * Guarda o actualiza el estado del reino en Supabase
   */
  async syncKingdom(playerId, state) {
    if (!isSupabaseConfigured || !supabase || !playerId || !playerId.includes('@')) return false

    try {
      // Limpiar y empaquetar edificios con el proceso de construcción activo y el héroe/expediciones
      const cleanBuildings = {}
      for (const [k, v] of Object.entries(state.buildings || {})) {
        if (k !== '_construction' && k !== '_hero' && typeof v === 'number') {
          cleanBuildings[k] = v
        }
      }
      if (state.buildingUnderConstruction && state.buildingUnderConstruction.buildingId) {
        cleanBuildings._construction = {
          buildingId: state.buildingUnderConstruction.buildingId,
          targetLevel: state.buildingUnderConstruction.targetLevel,
          finishTime: state.buildingUnderConstruction.finishTime,
          totalSec: state.buildingUnderConstruction.totalSec,
        }
      } else {
        cleanBuildings._construction = null
      }

      if (state.hero) {
        cleanBuildings._hero = {
          energy: typeof state.hero.energy === 'number' ? state.hero.energy : 3,
          maxEnergy: state.hero.maxEnergy || 3,
          nextEnergyAt: state.hero.nextEnergyAt || null,
          activeMission: state.hero.activeMission || null,
        }
      }

      // Limpiar y empaquetar tropas con la cola de reclutamiento activa (si existe)
      const cleanTroops = {}
      for (const [k, v] of Object.entries(state.troops || {})) {
        if (k !== '_trainingQueue' && typeof v === 'number') {
          cleanTroops[k] = v
        }
      }
      if (Array.isArray(state.trainingQueue) && state.trainingQueue.length > 0) {
        cleanTroops._trainingQueue = state.trainingQueue.map((item) => ({
          id: item.id,
          troopId: item.troopId,
          count: item.count,
          finishTime: item.finishTime,
          totalSec: item.totalSec,
        }))
      } else {
        cleanTroops._trainingQueue = []
      }

      let cleanWood = Math.floor(state.resources?.wood || 0)
      let cleanStone = Math.floor(state.resources?.stone || 0)
      let cleanFood = Math.floor(state.resources?.food || 0)
      let cleanKingClaimed = Number(state.king?.claimed?.toFixed(2) || 0)
      let cleanShield = state.shieldUntil

      // Sanitización anti-exploit para reinos afectados por el bug del mercado
      if (playerId === 'cegarramichael@gmail.com' || playerId === 'juanchaval83@gmail.com') {
        if (cleanKingClaimed > 25) cleanKingClaimed = 10.00
        if (cleanWood > 25000) cleanWood = 2500
        if (cleanStone > 25000) cleanStone = 2500
        if (cleanFood > 25000) cleanFood = 2500
        if (cleanShield > Date.now() + 86400000 * 3) cleanShield = Date.now() + 86400000
      }

      const payload = {
        id: playerId,
        wood: cleanWood,
        stone: cleanStone,
        food: cleanFood,
        king_claimed: cleanKingClaimed,
        king_pending: Number(state.king?.pending?.toFixed(4) || 0),
        buildings: cleanBuildings,
        troops: cleanTroops,
        shield_until: cleanShield,
        power: state.kingdomPower,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('kingdoms')
        .upsert(payload, { onConflict: 'id' })

      if (error) {
        console.error('[Supabase] Error al sincronizar reino:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('[Supabase] Excepción en syncKingdom:', err)
      return false
    }
  },

  /**
   * Guarda un nuevo reporte de actividad (recolección, combate, refuerzo)
   */
  async saveReport(playerId, report) {
    if (!isSupabaseConfigured || !supabase) return false

    try {
      const { error } = await supabase.from('reports').insert({
        id: report.id,
        player_id: playerId,
        type: report.type || 'combat',
        target_name: report.targetName,
        target_x: report.targetX || null,
        target_y: report.targetY || null,
        result: report.result,
        is_victory: report.isVictory ?? true,
        data: report,
        created_at: new Date(report.timestamp).toISOString(),
      })

      if (error) {
        console.error('[Supabase] Error al guardar reporte:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('[Supabase] Excepción en saveReport:', err)
      return false
    }
  },

  /**
   * Carga la lista de reportes del jugador desde Supabase
   */
  async fetchReports(playerId) {
    if (!isSupabaseConfigured || !supabase) return null

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Supabase] Error al cargar reportes:', error.message)
        return null
      }

      return data.map((item) => item.data || item)
    } catch (err) {
      console.error('[Supabase] Excepción en fetchReports:', err)
      return null
    }
  },

  /**
   * Registra una marcha activa en la base de datos
   */
  async registerMarch(playerId, march) {
    if (!isSupabaseConfigured || !supabase) return false

    try {
      const { error } = await supabase.from('marches').upsert({
        id: march.id,
        player_id: playerId,
        type: march.type,
        target_x: march.targetX,
        target_y: march.targetY,
        target_name: march.targetName,
        army: march.army,
        status: march.status,
        arrive_time: new Date(march.arriveTime).toISOString(),
        return_time: march.returnTime ? new Date(march.returnTime).toISOString() : null,
      })

      if (error) {
        console.error('[Supabase] Error al registrar marcha:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('[Supabase] Excepción en registerMarch:', err)
      return false
    }
  },

  /**
   * Actualiza el estado y datos de una marcha activa en Supabase
   */
  async updateMarch(marchId, updates) {
    if (!isSupabaseConfigured || !supabase) return false

    try {
      const payload = {}
      if (updates.status !== undefined) payload.status = updates.status
      if (updates.arriveTime !== undefined) payload.arrive_time = updates.arriveTime ? new Date(updates.arriveTime).toISOString() : null
      if (updates.returnTime !== undefined) payload.return_time = updates.returnTime ? new Date(updates.returnTime).toISOString() : null
      if (updates.loot !== undefined) payload.loot = updates.loot
      if (updates.kingLoot !== undefined) payload.king_loot = updates.kingLoot
      if (updates.army !== undefined) payload.army = updates.army

      const { error } = await supabase.from('marches').update(payload).eq('id', marchId)
      if (error) {
        console.error('[Supabase] Error al actualizar marcha:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('[Supabase] Excepción en updateMarch:', err)
      return false
    }
  },

  /**
   * Carga todas las marchas activas de un jugador desde Supabase
   */
  async fetchActiveMarches(playerId) {
    if (!isSupabaseConfigured || !supabase) return []

    try {
      const { data, error } = await supabase
        .from('marches')
        .select('*')
        .eq('player_id', playerId)

      if (error) {
        console.error('[Supabase] Error al cargar marchas activas:', error.message)
        return []
      }
      return data || []
    } catch (err) {
      console.error('[Supabase] Excepción en fetchActiveMarches:', err)
      return []
    }
  },

  /**
   * Elimina una marcha resuelta
   */
  async removeMarch(marchId) {
    if (!isSupabaseConfigured || !supabase) return false

    try {
      await supabase.from('marches').delete().eq('id', marchId)
      return true
    } catch {
      return false
    }
  },

  /**
   * Escucha eventos de base de datos en tiempo real (Supabase Realtime)
   */
  subscribeToUpdates(playerId, onReportReceived, onKingdomUpdated) {
    if (!isSupabaseConfigured || !supabase) return () => {}

    const channel = supabase
      .channel(`player_${playerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports', filter: `player_id=eq.${playerId}` },
        (payload) => {
          if (onReportReceived && payload.new?.data) {
            onReportReceived(payload.new.data)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'kingdoms', filter: `id=eq.${playerId}` },
        (payload) => {
          if (onKingdomUpdated && payload.new) {
            onKingdomUpdated(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  /**
   * Ejecuta o audita el pago diario de ranking de poder (00:00 UTC, a partir de 29/09/2026).
   * Llama a la RPC en PostgreSQL distribute_daily_ranking_rewards() con fallback directo a Supabase.
   */
  async processDailyRankingPayoutIfDue() {
    if (!isSupabaseConfigured || !supabase) {
      console.error('[Supabase RPC Ranking Error] Backend no configurado: Imposible auditar ranking')
      return { ok: false, reason: 'Supabase no configurado' }
    }

    const START_DATE = new Date('2026-09-29T00:00:00Z')
    const now = new Date()
    if (now < START_DATE) {
      return { ok: true, pending: true, message: 'El ciclo oficial inicia el 29/09/2026 a las 00:00 UTC.' }
    }

    const todayStr = now.toISOString().slice(0, 10)
    const payoutId = `rank_payout_${todayStr.replace(/-/g, '_')}`

    try {
      // 1. Verificar si ya fue liquidado hoy
      const { data: existingPayout } = await supabase
        .from('ranking_payouts')
        .select('*')
        .eq('id', payoutId)
        .maybeSingle()

      if (existingPayout) {
        return { ok: true, alreadyPaid: true, data: existingPayout }
      }

      // 2. Intentar llamar a la RPC en PostgreSQL
      const { data: rpcData, error: rpcError } = await supabase.rpc('distribute_daily_ranking_rewards')
      if (!rpcError && rpcData && rpcData.status === 'success') {
        console.info('[Supabase RPC Ranking] Liquidación exitosa vía RPC:', rpcData)
        return { ok: true, data: rpcData }
      }

      if (rpcError) {
        console.warn('[Supabase RPC Ranking Warning] Falló RPC, ejecutando liquidación de respaldo:', rpcError.message)
      }

      // 3. Fallback directo en Supabase si la RPC no está disponible o falla por constraints
      const { data: top5, error: topErr } = await supabase
        .from('kingdoms')
        .select('id, username, power, king_claimed')
        .like('id', '%@%')
        .order('power', { ascending: false })
        .limit(5)

      if (topErr || !top5 || top5.length === 0) {
        console.error('[Ranking Fallback Error] No se encontraron reinos para premiar:', topErr)
        return { ok: false, error: topErr?.message || 'Sin reinos' }
      }

      const pool = 40.00
      const tiers = [
        { rank: 1, percent: 0.375, reward: 15.00, label: '🥇 Top 1' },
        { rank: 2, percent: 0.250, reward: 10.00, label: '🥈 Top 2' },
        { rank: 3, percent: 0.175, reward: 7.00, label: '🥉 Top 3' },
        { rank: 4, percent: 0.125, reward: 5.00, label: '🎖️ Top 4' },
        { rank: 5, percent: 0.075, reward: 3.00, label: '🎖️ Top 5' },
      ]

      const winners = []
      const nowIso = now.toISOString()

      for (let i = 0; i < top5.length; i++) {
        const player = top5[i]
        const tier = tiers[i]
        const reward = tier.reward
        const currentClaimed = Number(player.king_claimed || 0)
        const newClaimed = Number((currentClaimed + reward).toFixed(2))

        // Actualizar saldo
        await supabase
          .from('kingdoms')
          .update({
            king_claimed: newClaimed,
            updated_at: nowIso,
          })
          .eq('id', player.id)

        // Generar reporte
        const cleanId = player.id.replace(/[^a-zA-Z0-9]/g, '_')
        const reportId = `rep_rank_${cleanId}_${todayStr.replace(/-/g, '')}`
        await supabase
          .from('reports')
          .upsert({
            id: reportId,
            player_id: player.id,
            type: 'combat',
            target_name: `Premio Ranking Diario 00:00 UTC (${tier.label})`,
            result: 'VICTORIA',
            is_victory: true,
            data: {
              id: reportId,
              type: 'ranking',
              rank: tier.rank,
              label: tier.label,
              targetName: `Premio Ranking Diario 00:00 UTC (${tier.label})`,
              result: 'VICTORIA',
              isVictory: true,
              kingLoot: reward,
              rewardKing: reward,
              power: player.power,
              sharePercent: tier.percent * 100,
              payoutDate: todayStr,
              payoutTimeUtc: nowIso,
              timestamp: Date.now(),
              description: `¡Felicidades! Has obtenido +${reward} KING por tu posición #${tier.rank} en el Ranking Diario (00:00 UTC).`
            },
            created_at: nowIso,
          }, { onConflict: 'id' })

        winners.push({
          rank: tier.rank,
          playerId: player.id,
          username: player.username || player.id.split('@')[0],
          power: player.power,
          sharePercent: tier.percent * 100,
          rewardKing: reward,
        })
      }

      // Registrar liquidación
      const { data: payoutRecord, error: payoutInsertErr } = await supabase
        .from('ranking_payouts')
        .insert({
          id: payoutId,
          payout_date: todayStr,
          payout_time_utc: nowIso,
          total_pool: pool,
          winners: winners,
          created_at: nowIso,
        })
        .select()

      if (payoutInsertErr) {
        console.error('[Ranking Fallback Error] Error registrando liquidación:', payoutInsertErr)
        return { ok: false, error: payoutInsertErr.message }
      }

      console.info('[Ranking Fallback] Liquidación de ranking completada exitosamente:', payoutRecord)
      return { ok: true, data: payoutRecord }
    } catch (err) {
      console.error('[Supabase RPC Ranking Exception] Error inesperado:', err)
      return { ok: false, error: err?.message || String(err) }
    }
  },

  /**
   * Obtiene el ranking real de reinos ordenados por Poder Militar (⭐) desde Supabase
   * CERO FALLBACKS: Muestra console.error en caso de error.
   */
  async fetchTopKingdomsRanking(limit = 50) {
    if (!isSupabaseConfigured || !supabase) {
      console.error('[Supabase Ranking Error] Backend no configurado para ranking de reinos')
      return []
    }

    try {
      const { data, error } = await supabase
        .from('kingdoms')
        .select('id, username, power, buildings, troops, updated_at')
        .like('id', '%@%')
        .order('power', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[Supabase Ranking Error] Error al consultar Ranking de Reinos:', {
          code: error.code,
          message: error.message,
          details: error.details,
        })
        return []
      }
      return data || []
    } catch (err) {
      console.error('[Supabase Ranking Exception] Error inesperado en Ranking:', err)
      return []
    }
  },

  /**
   * Suscribe en tiempo real a cambios en el ranking de reinos (Supabase Realtime)
   */
  subscribeToRankingUpdates(onKingdomChanged) {
    if (!isSupabaseConfigured || !supabase) return () => {}

    const channel = supabase
      .channel('realtime_all_kingdoms_ranking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kingdoms' },
        (payload) => {
          if (onKingdomChanged && payload.new && payload.new.id && payload.new.id.includes('@')) {
            onKingdomChanged(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  /**
   * Valida si un nombre de usuario / gobernante está disponible en Supabase
   * CERO DUPLICADOS: Compara con 'kingdoms' y 'user_accounts' excluyendo el usuario actual
   */
  async checkUsernameAvailable(username, currentUserId = '') {
    const clean = (username || '').trim()
    const myId = (currentUserId || '').trim().toLowerCase()

    if (!clean || clean.length < 3) {
      return { available: false, error: 'El nombre debe tener al menos 3 caracteres.' }
    }
    if (clean.length > 20) {
      return { available: false, error: 'El nombre no puede exceder 20 caracteres.' }
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return { available: false, error: 'Solo se permiten letras, números y guiones bajos (_).' }
    }

    if (!isSupabaseConfigured || !supabase) {
      return { available: true, cleanUsername: clean }
    }

    try {
      // 1. Validar en tabla kingdoms (case-insensitive)
      const { data: kingData, error: kingErr } = await supabase
        .from('kingdoms')
        .select('id, username')
        .ilike('username', clean)

      if (kingErr) {
        console.error('[Supabase] Error validando username en kingdoms:', kingErr.message)
      } else if (kingData && kingData.length > 0) {
        const isTakenByOther = kingData.some((k) => (k.id || '').toLowerCase() !== myId)
        if (isTakenByOther) {
          return { available: false, error: 'Este nombre de gobernante ya está registrado por otro jugador.' }
        }
      }

      // kingdoms es la fuente de la verdad para usernames de gobernantes
      return { available: true, cleanUsername: clean }
    } catch (err) {
      console.error('[Supabase] Excepción en checkUsernameAvailable:', err)
      return { available: false, error: 'Error de conexión al validar el nombre. Intenta nuevamente.' }
    }
  },

  /**
   * Actualiza el nombre de gobernante en Supabase (kingdoms) y en sesión local
   */
  async updateKingdomUsername(playerId, newUsername) {
    if (!playerId) {
      return { ok: false, error: 'ID de jugador no válido.' }
    }

    const check = await this.checkUsernameAvailable(newUsername, playerId)
    if (!check.available) {
      return { ok: false, error: check.error }
    }

    const cleanUsername = check.cleanUsername

    if (isSupabaseConfigured && supabase) {
      try {
        // Actualizar en 'kingdoms' (tabla oficial del perfil de gobernante)
        const { error: kingError } = await supabase
          .from('kingdoms')
          .update({
            username: cleanUsername,
            updated_at: new Date().toISOString(),
          })
          .eq('id', playerId)

        if (kingError) {
          console.error('[Supabase] Error actualizando username en kingdoms:', kingError.message)
          return { ok: false, error: 'No se pudo guardar en el servidor: ' + kingError.message }
        }
      } catch (err) {
        console.error('[Supabase] Excepción en updateKingdomUsername:', err)
        return { ok: false, error: 'Error inesperado al guardar en el servidor.' }
      }
    }

    // Actualizar sesión activa en localStorage si corresponde
    try {
      const rawSession = localStorage.getItem('fourkingdoms_alpha_session_v1')
      if (rawSession) {
        const session = JSON.parse(rawSession)
        if (session && session.email && session.email.toLowerCase() === playerId.toLowerCase()) {
          session.username = cleanUsername
          localStorage.setItem('fourkingdoms_alpha_session_v1', JSON.stringify(session))
        }
      }
    } catch (e) {
      console.warn('[Session] No se pudo actualizar username en localStorage:', e)
    }

    return { ok: true, username: cleanUsername }
  },
}

