/**
 * FourKingdom — Cliente Supabase y Configuración de Conexión Backend
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null

/**
 * Obtiene o crea un ID persistente de jugador/perfil
 */
export function getOrCreatePlayerId() {
  const STORAGE_PLAYER_KEY = 'fourkingdoms_player_uid'
  let uid = localStorage.getItem(STORAGE_PLAYER_KEY)
  if (!uid) {
    uid = 'player_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36)
    localStorage.setItem(STORAGE_PLAYER_KEY, uid)
  }
  return uid
}
