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
    if (!isSupabaseConfigured || !supabase) return null

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
    if (!isSupabaseConfigured || !supabase) return false

    try {
      const payload = {
        id: playerId,
        wood: Math.floor(state.resources.wood),
        stone: Math.floor(state.resources.stone),
        food: Math.floor(state.resources.food),
        king_claimed: Number(state.king.claimed.toFixed(2)),
        king_pending: Number(state.king.pending.toFixed(4)),
        buildings: state.buildings,
        troops: state.troops,
        shield_until: state.shieldUntil,
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
   * Llama a la RPC en PostgreSQL distribute_daily_ranking_rewards().
   * CERO FALLBACKS: Muestra console.error con detalle en caso de error.
   */
  async processDailyRankingPayoutIfDue() {
    if (!isSupabaseConfigured || !supabase) {
      console.error('[Supabase RPC Ranking Error] Backend no configurado: Imposible auditar ranking')
      return { ok: false, reason: 'Supabase no configurado' }
    }

    try {
      const { data, error } = await supabase.rpc('distribute_daily_ranking_rewards')
      if (error) {
        console.error('[Supabase RPC Ranking Error] Fallo al auditar/distribuir ranking diario:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        return { ok: false, error: error.message }
      }
      return { ok: true, data }
    } catch (err) {
      console.error('[Supabase RPC Ranking Exception] Error inesperado:', err)
      return { ok: false, error: err?.message || String(err) }
    }
  },

  /**
   * Obtiene el Top 5 real de reinos ordenados por Poder Militar (⭐)
   * CERO FALLBACKS: Muestra console.error en caso de error.
   */
  async fetchTopKingdomsRanking() {
    if (!isSupabaseConfigured || !supabase) {
      console.error('[Supabase Ranking Error] Backend no configurado para ranking de reinos')
      return []
    }

    try {
      const { data, error } = await supabase
        .from('kingdoms')
        .select('id, username, power, kingdom_id')
        .order('power', { ascending: false })
        .limit(5)

      if (error) {
        console.error('[Supabase Ranking Error] Error al consultar Top 5 Reinos:', {
          code: error.code,
          message: error.message,
          details: error.details,
        })
        return []
      }
      return data || []
    } catch (err) {
      console.error('[Supabase Ranking Exception] Error inesperado en Top 5:', err)
      return []
    }
  },
}

