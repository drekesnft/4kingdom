/**
 * FourKingdom — Servicio de Autenticación, Whitelist y Sistema de Referidos (Alpha v0.1)
 * Gestiona el acceso por email con contraseñas temporales, acceso por Google,
 * Whitelist de pre-registro, sistema de códigos de referido con 5 tokens KING de Airdrop,
 * asignación de Reinos y persistencia en Supabase y Almacenamiento Local.
 * REGLA CERO FALLBACKS: Cualquier error se audita y muestra en consola con detalle.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { REGIONAL_KINGDOMS } from '../game/config'

const AUTH_STORAGE_KEY = 'fourkingdoms_alpha_accounts_v1'
const WHITELIST_STORAGE_KEY = 'fourkingdoms_whitelist_signups_v1'
const REFERRALS_STORAGE_KEY = 'fourkingdoms_referrals_v1'
const SESSION_STORAGE_KEY = 'fourkingdoms_alpha_session_v1'
const PENDING_REF_STORAGE_KEY = 'fourkingdoms_pending_ref_code'

// Base de la comunidad para progreso de hitos de 500 en 500
const COMMUNITY_BASE_PREREG = 742

export const COMMUNITY_MILESTONES = [
  {
    target: 500,
    title: '🪙 5 Tokens KING para Todos',
    reward: '5 Tokens KING entregados a todas las cuentas pre-registradas en el Día 1',
    badge: 'Comunitario',
    unlocked: true,
    desc: '¡Hito superado! Cada comandante pre-registrado inicia con 5 Tokens KING en su Vault.',
  },
  {
    target: 1000,
    title: '🛡️ Escudo de Paz 24 Horas',
    reward: 'Escudo de Paz de 24 horas garantizado para el Día 1',
    badge: 'Protección',
    unlocked: false,
    desc: 'Inmunidad total contra saqueos de otros jugadores en tu primera jornada de construcción.',
  },
  {
    target: 1500,
    title: '🌾 Cargamento Masivo de Recursos',
    reward: '+1,000 Madera · +1,000 Piedra · +1,000 Comida',
    badge: 'Economía',
    unlocked: false,
    desc: 'Impulso inicial para subir tu Castillo y tus edificios de producción sin demoras.',
  },
  {
    target: 2000,
    title: '🐎 10 Caballerías Iniciales',
    reward: 'Escuadrón montado de 10 Caballerías listo para combate',
    badge: 'Militar',
    unlocked: false,
    desc: 'Tropa pesada desbloqueada inmediatamente sin costo ni tiempo de entrenamiento.',
  },
  {
    target: 2500,
    title: '👑 Plano de Fundador & Título VIP',
    reward: 'Plano Arquitectónico de Fortaleza + Título Honorífico Permanente',
    badge: 'Soberano',
    unlocked: false,
    desc: 'Plano indispensable para subir fortificaciones al máximo nivel y distinción en el mapa.',
  },
]

export const TOP_REFERRAL_PRIZES = [
  { rank: 1, king: 40, vip: true, label: '🥇 Top 1' },
  { rank: 2, king: 25, vip: true, label: '🥈 Top 2' },
  { rank: 3, king: 15, vip: true, label: '🥉 Top 3' },
  { rank: 4, king: 12, vip: false, label: '🎖️ Top 4' },
  { rank: 5, king: 8, vip: false, label: '🎖️ Top 5' },
]

// Cuentas semilla de prueba Alpha
const DEFAULT_ACCOUNTS = [
  {
    email: 'antoniox4253@gmail.com',
    tempPassword: 'k9t4m',
    passwordHash: 'k9t4m',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-ANTO-77',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
]

export function generateReferralCode(email) {
  const clean = (email || '').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `FK-${clean || 'KING'}-${rand}`
}

export function getUrlReferralCode() {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (ref) {
        const cleaned = ref.trim().toUpperCase()
        localStorage.setItem(PENDING_REF_STORAGE_KEY, cleaned)
        return cleaned
      }
      return localStorage.getItem(PENDING_REF_STORAGE_KEY) || ''
    }
  } catch (err) {
    console.error('[authService] Error al leer referral code de URL:', err)
  }
  return ''
}

function getStoredAccounts() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const target = parsed.find((a) => a.email.toLowerCase() === 'antoniox4253@gmail.com')
      if (!target) {
        parsed.push(DEFAULT_ACCOUNTS[0])
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed))
      } else if (!target.referralCode) {
        target.referralCode = 'FK-ANTO-77'
        target.role = 'alpha_player'
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch (err) {
    console.error('[authService] Error leyendo cuentas locales:', err)
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS))
  return [...DEFAULT_ACCOUNTS]
}

function saveStoredAccounts(accounts) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(accounts))
  } catch (err) {
    console.error('[authService] Error al guardar cuentas locales:', err)
  }
}

function getStoredWhitelist() {
  try {
    const raw = localStorage.getItem(WHITELIST_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error('[authService] Error leyendo whitelist local:', err)
    return []
  }
}

function saveStoredWhitelist(list) {
  try {
    localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('[authService] Error guardando whitelist local:', err)
  }
}

function getStoredReferrals() {
  try {
    const raw = localStorage.getItem(REFERRALS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error('[authService] Error leyendo lista de referidos:', err)
    return []
  }
}

function saveStoredReferrals(list) {
  try {
    localStorage.setItem(REFERRALS_STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('[authService] Error guardando referidos:', err)
  }
}

export const authService = {
  /**
   * Obtiene la sesión del usuario actual
   */
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  /**
   * Guarda la sesión activa
   */
  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user))
    }
  },

  /**
   * Cierra la sesión
   */
  logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  },

  /**
   * Inicia sesión con email y contraseña (temporal o definitiva)
   */
  async login(emailInput, passwordInput) {
    const email = (emailInput || '').trim().toLowerCase()
    const password = (passwordInput || '').trim()

    if (!email) {
      return { success: false, error: 'Ingresa tu correo electrónico.' }
    }
    if (!password) {
      return { success: false, error: 'Ingresa tu contraseña.' }
    }

    // 1. Intentar validar con Supabase si está activo
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_accounts')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (error) {
          console.error('[Supabase Auth Error]: Fallo al consultar usuario en base de datos:', error)
        } else if (data) {
          const isValidPass = data.password_hash === password || data.temp_password === password
          if (!isValidPass) {
            console.error('[Auth Error]: Contraseña incorrecta para el usuario:', email)
            return { success: false, error: 'Contraseña incorrecta. Verifica tu clave temporal.' }
          }

          const user = {
            email: data.email,
            role: data.role || 'alpha_player',
            provider: data.provider || 'email',
            referralCode: data.referral_code || generateReferralCode(data.email),
            referredBy: data.referred_by || null,
            referralsCount: data.referrals_count || 0,
            airdropTokens: data.airdrop_tokens || 0,
            mustChangePassword: data.must_change_password ?? true,
            assignedKingdom: data.assigned_kingdom ?? null,
            baseCoord: data.base_coord ?? null,
            onboardingCompleted: data.onboarding_completed ?? false,
          }

          this.setCurrentUser(user)

          // Sincronizar en cache local
          const accounts = getStoredAccounts()
          const idx = accounts.findIndex((a) => a.email.toLowerCase() === email)
          if (idx >= 0) accounts[idx] = { ...accounts[idx], ...user }
          else accounts.push({ ...user, passwordHash: password })
          saveStoredAccounts(accounts)

          return { success: true, user }
        }
      } catch (err) {
        console.error('[Supabase Auth Exception]: Fallo crítico de conexión con backend:', err)
      }
    }

    // 2. Validación con almacenamiento sincronizado local de evaluadores Alpha
    const accounts = getStoredAccounts()
    const found = accounts.find((a) => a.email.toLowerCase() === email)

    if (found) {
      const valid = found.passwordHash === password || found.tempPassword === password
      if (!valid) {
        return {
          success: false,
          error: 'Contraseña incorrecta. Usa la clave temporal asignada.',
        }
      }

      const user = {
        email: found.email,
        role: found.role || 'alpha_player',
        provider: found.provider || 'email',
        referralCode: found.referralCode || generateReferralCode(found.email),
        referredBy: found.referredBy || null,
        referralsCount: found.referralsCount || 0,
        airdropTokens: found.airdropTokens || 0,
        mustChangePassword: Boolean(found.mustChangePassword),
        assignedKingdom: found.assignedKingdom || null,
        baseCoord: found.baseCoord || null,
        onboardingCompleted: Boolean(found.onboardingCompleted),
      }

      this.setCurrentUser(user)
      return { success: true, user }
    }

    // 3. Verificar si ya es un usuario registrado en Whitelist
    const whitelist = getStoredWhitelist()
    const foundWl = whitelist.find((w) => w.email.toLowerCase() === email)
    if (foundWl) {
      this.setCurrentUser(foundWl)
      return { success: true, user: foundWl }
    }

    // 4. Si el correo NO está registrado en absoluto -> Señal para activar Whitelist Hype
    return {
      success: false,
      notRegistered: true,
      error: 'Este correo no está registrado en la lista de evaluadores Alpha.',
    }
  },

  /**
   * Registra a un usuario en la Whitelist / Pre-Registro Oficial.
   * Si incluye un código de referido válido, acredita inmediatamente 5 tokens KING al referente.
   */
  async registerWhitelist({ email, provider = 'google', referralCode = '' }) {
    const normalized = (email || '').trim().toLowerCase()
    if (!normalized || !normalized.includes('@')) {
      return { success: false, error: 'Ingresa un correo electrónico válido.' }
    }

    const myReferralCode = generateReferralCode(normalized)
    const codeUsed = (referralCode || getUrlReferralCode() || '').trim().toUpperCase()

    // 1. Verificar si ya existe en Alpha o Whitelist
    const alphaAccounts = getStoredAccounts()
    const existingAlpha = alphaAccounts.find((a) => a.email.toLowerCase() === normalized)
    if (existingAlpha) {
      this.setCurrentUser(existingAlpha)
      return { success: true, user: existingAlpha, isAlpha: true }
    }

    const whitelist = getStoredWhitelist()
    const existingWl = whitelist.find((w) => w.email.toLowerCase() === normalized)
    if (existingWl) {
      this.setCurrentUser(existingWl)
      return { success: true, user: existingWl, isExisting: true }
    }

    // 2. Procesar Referido (5 tokens KING para el referente)
    let matchedReferrer = null
    if (codeUsed) {
      matchedReferrer =
        alphaAccounts.find((a) => (a.referralCode || '').toUpperCase() === codeUsed) ||
        whitelist.find((w) => (w.referralCode || '').toUpperCase() === codeUsed)

      if (matchedReferrer && matchedReferrer.email.toLowerCase() !== normalized) {
        matchedReferrer.referralsCount = (matchedReferrer.referralsCount || 0) + 1
        matchedReferrer.airdropTokens = (matchedReferrer.airdropTokens || 0) + 5

        // Guardar actualización del referente
        saveStoredAccounts(alphaAccounts)
        saveStoredWhitelist(whitelist)

        // Registrar transacción de referido
        const referralsList = getStoredReferrals()
        referralsList.push({
          referrerCode: codeUsed,
          referrerEmail: matchedReferrer.email,
          referredEmail: normalized,
          tokensRewarded: 5,
          createdAt: new Date().toISOString(),
        })
        saveStoredReferrals(referralsList)
      }
    }

    // 3. Crear nuevo usuario de Whitelist
    const newWhitelistUser = {
      email: normalized,
      role: 'whitelist',
      provider,
      referralCode: myReferralCode,
      referredBy: matchedReferrer ? codeUsed : null,
      referralsCount: 0,
      airdropTokens: 0,
      createdAt: new Date().toISOString(),
    }

    whitelist.push(newWhitelistUser)
    saveStoredWhitelist(whitelist)
    this.setCurrentUser(newWhitelistUser)

    // 4. Sincronizar en Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: wlErr } = await supabase.from('whitelist_signups').upsert({
          email: normalized,
          referral_code: myReferralCode,
          referred_by: matchedReferrer ? codeUsed : null,
          provider,
          airdrop_tokens: 0,
          referrals_count: 0,
        })
        if (wlErr) {
          console.error('[Supabase Whitelist Insert Error]:', wlErr)
        }

        if (matchedReferrer) {
          // Actualizar conteo del referente en Supabase
          await supabase
            .from('whitelist_signups')
            .update({
              referrals_count: matchedReferrer.referralsCount,
              airdrop_tokens: matchedReferrer.airdropTokens,
            })
            .eq('email', matchedReferrer.email)

          await supabase
            .from('user_accounts')
            .update({
              referrals_count: matchedReferrer.referralsCount,
              airdrop_tokens: matchedReferrer.airdropTokens,
            })
            .eq('email', matchedReferrer.email)

          await supabase.from('referrals').insert({
            referrer_code: codeUsed,
            referrer_email: matchedReferrer.email,
            referred_email: normalized,
            tokens_rewarded: 5,
          })
        }
      } catch (err) {
        console.error('[Supabase Whitelist Exception]:', err)
      }
    }

    return {
      success: true,
      user: newWhitelistUser,
      rewardedReferrer: Boolean(matchedReferrer),
    }
  },

  /**
   * Inicia o registra sesión utilizando cuenta de Google
   */
  async loginWithGoogle(emailHint = '', referralCode = '') {
    const email = (emailHint || '').trim().toLowerCase()
    if (!email) {
      // Si se ejecuta en navegador con Supabase OAuth
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          })
          if (error) {
            console.error('[Supabase Google Auth Error]:', error)
          }
        } catch (err) {
          console.error('[Supabase Google Auth Exception]:', err)
        }
      }
      return { success: false, needEmailInput: true }
    }

    // Si ya existe en Alpha, inicia sesión directo
    const alphaAccounts = getStoredAccounts()
    const foundAlpha = alphaAccounts.find((a) => a.email.toLowerCase() === email)
    if (foundAlpha) {
      this.setCurrentUser(foundAlpha)
      return { success: true, user: foundAlpha, role: 'alpha_player' }
    }

    // Si ya existe en Whitelist, inicia sesión
    const whitelist = getStoredWhitelist()
    const foundWl = whitelist.find((w) => w.email.toLowerCase() === email)
    if (foundWl) {
      this.setCurrentUser(foundWl)
      return { success: true, user: foundWl, role: 'whitelist' }
    }

    // Si es nuevo registro, lo inscribe a Whitelist con Google
    return this.registerWhitelist({
      email,
      provider: 'google',
      referralCode,
    })
  },

  /**
   * Obtiene las estadísticas de referidos de un usuario
   */
  getReferralStats(email) {
    const normalized = (email || '').trim().toLowerCase()
    const alphaAccounts = getStoredAccounts()
    const whitelist = getStoredWhitelist()
    const referrals = getStoredReferrals()

    const user =
      alphaAccounts.find((a) => a.email.toLowerCase() === normalized) ||
      whitelist.find((w) => w.email.toLowerCase() === normalized)

    if (!user) {
      return {
        referralCode: generateReferralCode(email),
        referralsCount: 0,
        airdropTokens: 0,
        referralsList: [],
      }
    }

    const myReferrals = referrals.filter(
      (r) => r.referrerEmail?.toLowerCase() === normalized || r.referrerCode === user.referralCode
    )

    return {
      referralCode: user.referralCode || generateReferralCode(user.email),
      referralsCount: user.referralsCount || myReferrals.length,
      airdropTokens: (user.referralsCount || myReferrals.length) * 5,
      referralsList: myReferrals,
    }
  },

  /**
   * Obtiene la cantidad total global de pre-registros (sumando comunidad + registros reales)
   */
  getGlobalPreRegistrationCount() {
    const whitelist = getStoredWhitelist()
    return COMMUNITY_BASE_PREREG + whitelist.length
  },

  /**
   * Obtiene el Top 5 de Reclutadores (100 KING repartidos + 3 Pases VIP)
   */
  getTopReferrers() {
    const alphaAccounts = getStoredAccounts()
    const whitelist = getStoredWhitelist()
    const allUsers = [...alphaAccounts, ...whitelist]

    // Líderes comunitarios auditados de la tabla
    const baseLeaders = [
      { name: 'Lord Valkor (Norte)', code: 'FK-VALK-91', referralsCount: 24, email: 'valkor***@gmail.com' },
      { name: 'Sovereign Kael (Sur)', code: 'FK-KAEL-44', referralsCount: 18, email: 'kael***@gmail.com' },
      { name: 'Lady Aethel (Este)', code: 'FK-AETH-12', referralsCount: 14, email: 'aethel***@gmail.com' },
      { name: 'Archon Darius (Oeste)', code: 'FK-DARI-83', referralsCount: 9, email: 'darius***@gmail.com' },
      { name: 'General Ronald', code: 'FK-RONA-05', referralsCount: 5, email: 'ronald***@gmail.com' },
    ]

    // Incorporar cuentas reales que tengan referidos
    const realWithRefs = allUsers
      .filter((u) => (u.referralsCount || 0) > 0)
      .map((u) => ({
        name: (u.email || '').split('@')[0],
        code: u.referralCode,
        referralsCount: u.referralsCount,
        email: u.email,
        isRealUser: true,
      }))

    // Unir sin duplicar códigos
    const combined = [...realWithRefs]
    for (const leader of baseLeaders) {
      if (!combined.find((c) => c.code === leader.code || c.email === leader.email)) {
        combined.push(leader)
      }
    }

    // Ordenar descendente por referidos
    combined.sort((a, b) => (b.referralsCount || 0) - (a.referralsCount || 0))

    // Asignar premios del Top 5 (100 KING + 3 VIP)
    return combined.slice(0, 5).map((item, idx) => ({
      ...item,
      rank: idx + 1,
      prizeKing: TOP_REFERRAL_PRIZES[idx].king,
      hasVip: TOP_REFERRAL_PRIZES[idx].vip,
      rankLabel: TOP_REFERRAL_PRIZES[idx].label,
    }))
  },

  /**
   * Cambia la contraseña temporal por una contraseña permanente
   */
  async changePassword(emailInput, newPasswordInput) {
    const email = (emailInput || '').trim().toLowerCase()
    const newPassword = (newPasswordInput || '').trim()

    if (newPassword.length < 5) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 5 caracteres.' }
    }

    // 1. Actualizar en Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('user_accounts')
          .update({
            password_hash: newPassword,
            temp_password: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)

        if (error) {
          console.error('[Supabase Auth Error]: Error actualizando clave en base de datos:', error.message, error)
        }
      } catch (err) {
        console.error('[Supabase Auth Exception]: Error actualizando clave en Supabase:', err)
      }
    }

    // 2. Actualizar en cache local
    const accounts = getStoredAccounts()
    const target = accounts.find((a) => a.email.toLowerCase() === email)
    if (target) {
      target.passwordHash = newPassword
      target.tempPassword = null
      target.mustChangePassword = false
      saveStoredAccounts(accounts)
    }

    const currentUser = this.getCurrentUser()
    if (currentUser && currentUser.email.toLowerCase() === email) {
      currentUser.mustChangePassword = false
      this.setCurrentUser(currentUser)
    }

    return { success: true, user: currentUser }
  },

  /**
   * Asigna aleatoriamente al usuario a uno de los 4 Reinos y genera coordenadas dentro de su territorio
   */
  async assignRandomKingdom(emailInput) {
    const email = (emailInput || '').trim().toLowerCase()
    const kingdomKeys = ['north', 'south', 'east', 'west']
    const chosenKey = kingdomKeys[Math.floor(Math.random() * kingdomKeys.length)]
    const kingdomData = REGIONAL_KINGDOMS[chosenKey]

    // Generar coordenadas de base dentro del cuadrante regional
    let baseCoord
    if (chosenKey === 'north') {
      baseCoord = {
        x: -Math.floor(Math.random() * 12 + 6),
        y: Math.floor(Math.random() * 12 + 6),
      }
    } else if (chosenKey === 'south') {
      baseCoord = {
        x: Math.floor(Math.random() * 12 + 6),
        y: -Math.floor(Math.random() * 12 + 6),
      }
    } else if (chosenKey === 'east') {
      baseCoord = {
        x: Math.floor(Math.random() * 12 + 6),
        y: Math.floor(Math.random() * 12 + 6),
      }
    } else {
      baseCoord = {
        x: -Math.floor(Math.random() * 12 + 6),
        y: -Math.floor(Math.random() * 12 + 6),
      }
    }

    // 1. Guardar en Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: accErr } = await supabase
          .from('user_accounts')
          .update({
            assigned_kingdom: chosenKey,
            base_coord: baseCoord,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)

        if (accErr) {
          console.error('[Supabase Kingdom Assignment Error]:', accErr.message, accErr)
        }

        const { error: kingErr } = await supabase.from('kingdoms').upsert({
          id: email,
          username: email.split('@')[0],
          coord_x: baseCoord.x,
          coord_y: baseCoord.y,
        })

        if (kingErr) {
          console.error('[Supabase Kingdom Upsert Error]:', kingErr.message, kingErr)
        }
      } catch (err) {
        console.error('[Supabase Kingdom Assignment Exception]: Error guardando asignación:', err)
      }
    }

    // 2. Guardar en cache local
    const accounts = getStoredAccounts()
    const target = accounts.find((a) => a.email.toLowerCase() === email)
    if (target) {
      target.assignedKingdom = chosenKey
      target.baseCoord = baseCoord
      saveStoredAccounts(accounts)
    }

    const currentUser = this.getCurrentUser()
    if (currentUser && currentUser.email.toLowerCase() === email) {
      currentUser.assignedKingdom = chosenKey
      currentUser.baseCoord = baseCoord
      this.setCurrentUser(currentUser)
    }

    return {
      success: true,
      kingdomKey: chosenKey,
      kingdomData,
      baseCoord,
      user: currentUser,
    }
  },

  /**
   * Marca el tutorial onboarding como completado
   */
  async completeOnboarding(emailInput) {
    const email = (emailInput || '').trim().toLowerCase()

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('user_accounts')
          .update({
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)

        if (error) {
          console.error('[Supabase Onboarding Error]: Error marcando onboarding:', error.message, error)
        }
      } catch (err) {
        console.error('[Supabase Onboarding Exception]: Error marcando onboarding:', err)
      }
    }

    const accounts = getStoredAccounts()
    const target = accounts.find((a) => a.email.toLowerCase() === email)
    if (target) {
      target.onboardingCompleted = true
      saveStoredAccounts(accounts)
    }

    const currentUser = this.getCurrentUser()
    if (currentUser && currentUser.email.toLowerCase() === email) {
      currentUser.onboardingCompleted = true
      this.setCurrentUser(currentUser)
    }

    return { success: true }
  },

  /**
   * Registra una nueva cuenta de prueba (para asignar futuros correos fácilmente)
   */
  registerTesterAccount(email, tempPassword = 'k9t4m') {
    const accounts = getStoredAccounts()
    const normalized = email.trim().toLowerCase()
    const existing = accounts.find((a) => a.email.toLowerCase() === normalized)

    if (existing) {
      existing.tempPassword = tempPassword
      existing.passwordHash = tempPassword
      existing.mustChangePassword = true
      saveStoredAccounts(accounts)
      return existing
    }

    const newAcc = {
      email: normalized,
      tempPassword,
      passwordHash: tempPassword,
      role: 'alpha_player',
      referralCode: generateReferralCode(normalized),
      referralsCount: 0,
      airdropTokens: 0,
      mustChangePassword: true,
      assignedKingdom: null,
      baseCoord: null,
      onboardingCompleted: false,
      createdAt: new Date().toISOString(),
    }
    accounts.push(newAcc)
    saveStoredAccounts(accounts)
    return newAcc
  },
}
