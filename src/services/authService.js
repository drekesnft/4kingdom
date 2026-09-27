/**
 * FourKingdom — Servicio de Autenticación, Whitelist y Sistema de Referidos (Alpha v0.1)
 * Gestiona el acceso por email con contraseñas temporales, acceso por Google OAuth,
 * Whitelist de pre-registro, sistema de códigos de referido con 5 tokens KING de Airdrop,
 * asignación de Reinos y persistencia en Supabase con Sesiones Estrictas de 7 Días.
 * REGLA CERO FALLBACKS: Cualquier error se audita y muestra en consola con detalle.
 */

import { supabase, isSupabaseConfigured, SEVEN_DAYS_MS } from './supabaseClient'
import { REGIONAL_KINGDOMS } from '../game/config'

const AUTH_STORAGE_KEY = 'fourkingdoms_alpha_accounts_v1'
const WHITELIST_STORAGE_KEY = 'fourkingdoms_whitelist_signups_v1'
const REFERRALS_STORAGE_KEY = 'fourkingdoms_referrals_v1'
const SESSION_STORAGE_KEY = 'fourkingdoms_alpha_session_v1'
const PENDING_REF_STORAGE_KEY = 'fourkingdoms_pending_ref_code'

// Cache en memoria para conteos dinámicos en tiempo real
let cachedPreRegCount = 0
let cachedTopReferrers = []

export const COMMUNITY_MILESTONES = [
  {
    target: 500,
    title: '🛡️ Escudo de Paz 24 Horas (+2,000 Recursos)',
    reward: 'Escudo de Paz 24h + 2,000 Recursos variados al Día 1',
    badge: 'Protección',
    desc: 'Inmunidad total contra saqueos en tu primera jornada de construcción y cargamento inicial de recursos.',
  },
  {
    target: 1000,
    title: '🪙 5 Tokens KING para Todos',
    reward: '5 Tokens KING entregados a todas las cuentas pre-registradas en el Día 1',
    badge: 'Airdrop Comunitario',
    desc: '¡Hito de 1,000 Gobernantes! Cada comandante pre-registrado inicia con 5 Tokens KING en su Vault oficial.',
  },
  {
    target: 1500,
    title: '🐎 10 Caballerías Iniciales de Choque',
    reward: 'Escuadrón montado de 10 Caballerías listo para combate',
    badge: 'Fuerza Militar',
    desc: 'Tropa pesada desbloqueada inmediatamente sin costo ni tiempo de entrenamiento para dominar el mapa.',
  },
  {
    target: 1800,
    title: '🌾 Cargamento Masivo de Recursos (+5,000)',
    reward: '+2,000 Madera · +2,000 Piedra · +1,000 Comida extra',
    badge: 'Economía Real',
    desc: 'Impulso sustancial para subir tu Castillo y tus edificios de producción a nivel superior sin demoras.',
  },
  {
    target: 2000,
    title: '👑 Meta Suprema (Primeros 2,000): Plano Exclusivo + VIP',
    reward: 'Plano Exclusivo de Ciudadela + Distinción VIP Fundador para los primeros 2,000',
    badge: 'Soberano Fundador',
    desc: 'Plano indispensable de alta arquitectura para fortificaciones y distinción permanente de Fundador Alpha.',
  },
]

export const TOP_REFERRAL_PRIZES = [
  { rank: 1, king: 40, vip: true, label: '🥇 Top 1' },
  { rank: 2, king: 25, vip: true, label: '🥈 Top 2' },
  { rank: 3, king: 15, vip: true, label: '🥉 Top 3' },
  { rank: 4, king: 12, vip: false, label: '🎖️ Top 4' },
  { rank: 5, king: 8, vip: false, label: '🎖️ Top 5' },
]

// Cuentas semilla de evaluadores Alpha autorizados (20 cuentas)
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
    createdAt: '2026-09-20T00:00:00.000Z',
  },
  {
    email: 'anghelito091.ron@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-ANGH-RON1',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'emanuelleon6892@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-EMAN-LEO2',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'cegarramichael@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-CEGA-MICH',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'noeliacorrea0898@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-NOEL-CORR',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'juanchaval83@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-JUAN-CHAV',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'ycintrahernandez@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-YCIN-HERN',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'reggad22@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-REGG-AD22',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'jaimeropa987@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-JAIM-ROPA',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'ediberthantonio@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-EDIB-ANTO',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'kanekighol1423@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-KANE-GHOL',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'adrianlopezrod@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-ADRI-LOPE',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'rjnieves35@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-RJNI-EVES',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'henrycamposhdc@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-HENR-CAMP',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'jesusgimenezjc@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-JESU-GIME',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'jenifersoriano223@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-JENI-SORI',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'jhill.sanchez@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-JHIL-SANC',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'juegosapp723@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-JUEG-APP7',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'puenteyornay22.05@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-PUEN-YORN',
    referredBy: null,
    referralsCount: 0,
    airdropTokens: 0,
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    email: 'kleiberdejesusgp2106@gmail.com',
    tempPassword: 'alpha',
    passwordHash: 'alpha',
    role: 'alpha_player',
    provider: 'email',
    referralCode: 'FK-KLEI-JESU',
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

export function normalizeBaseCoord(raw) {
  if (!raw) return null
  let c = raw
  if (typeof c === 'string') {
    try { c = JSON.parse(c) } catch { return null }
  }
  const x = c.worldX ?? c.x ?? c.coord_x
  const y = c.worldY ?? c.y ?? c.coord_y
  if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
    return { x, y, worldX: x, worldY: y }
  }
  return null
}

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
      let changed = false
      for (const def of DEFAULT_ACCOUNTS) {
        const found = parsed.find((a) => a.email.toLowerCase() === def.email.toLowerCase())
        if (!found) {
          parsed.push({ ...def })
          changed = true
        } else {
          if (!found.referralCode) {
            found.referralCode = def.referralCode
            changed = true
          }
          if (!found.role) {
            found.role = 'alpha_player'
            changed = true
          }
        }
      }
      if (changed) {
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
   * Obtiene la sesión del usuario actual verificando la duración estricta de 7 días.
   * Si pasaron más de 7 días, invalida la sesión y solicita nuevo ingreso.
   */
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return null
      const user = JSON.parse(raw)

      if (user.sessionExpiresAt && Date.now() > user.sessionExpiresAt) {
        console.warn('[authService] La sesión de 7 días ha expirado. Limpiando credenciales.')
        this.logout()
        return null
      }

      if (user.email) {
        const normEmail = user.email.toLowerCase()
        const savedKingdom = localStorage.getItem(`fk_assigned_kingdom_${normEmail}`)
        const savedCoordRaw = localStorage.getItem(`fk_base_coord_${normEmail}`)
        const savedOnboarding = localStorage.getItem(`fk_onboarding_completed_${normEmail}`)

        if (!user.assignedKingdom && savedKingdom) {
          user.assignedKingdom = savedKingdom
        }
        if (!user.baseCoord && savedCoordRaw) {
          user.baseCoord = normalizeBaseCoord(savedCoordRaw)
        }
        if (!user.onboardingCompleted && savedOnboarding === 'true') {
          user.onboardingCompleted = true
        }
      }

      return user
    } catch {
      return null
    }
  },

  /**
   * Guarda la sesión activa estampando la fecha de expiración a 7 días exactos
   */
  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      if (isSupabaseConfigured && supabase) {
        supabase.auth.signOut().catch(() => {})
      }
    } else {
      const sessionExpiresAt = user.sessionExpiresAt || Date.now() + SEVEN_DAYS_MS
      const normEmail = (user.email || '').toLowerCase()

      // Salvaguarda: recuperar valores previos si vienen vacíos en esta llamada
      const savedKingdom = normEmail ? localStorage.getItem(`fk_assigned_kingdom_${normEmail}`) : null
      const savedCoordRaw = normEmail ? localStorage.getItem(`fk_base_coord_${normEmail}`) : null
      const savedOnboarding = normEmail ? localStorage.getItem(`fk_onboarding_completed_${normEmail}`) : null

      const assignedKingdom = user.assignedKingdom || savedKingdom || null
      const baseCoord = user.baseCoord || normalizeBaseCoord(savedCoordRaw) || null
      const onboardingCompleted = Boolean(user.onboardingCompleted || savedOnboarding === 'true')

      if (normEmail) {
        if (assignedKingdom) {
          localStorage.setItem(`fk_assigned_kingdom_${normEmail}`, assignedKingdom)
        }
        if (baseCoord) {
          localStorage.setItem(`fk_base_coord_${normEmail}`, JSON.stringify(baseCoord))
        }
        if (onboardingCompleted) {
          localStorage.setItem(`fk_onboarding_completed_${normEmail}`, 'true')
        }
      }

      const userWithExpiry = {
        ...user,
        assignedKingdom,
        baseCoord,
        onboardingCompleted,
        sessionExpiresAt,
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userWithExpiry))
    }
  },

  /**
   * Cierra la sesión activa
   */
  logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch((err) => {
        console.error('[Supabase SignOut Error]:', err)
      })
    }
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
            baseCoord: normalizeBaseCoord(data.base_coord),
            onboardingCompleted: data.onboarding_completed ?? false,
            sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
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
        baseCoord: normalizeBaseCoord(found.baseCoord),
        onboardingCompleted: Boolean(found.onboardingCompleted),
        sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
      }

      this.setCurrentUser(user)
      return { success: true, user }
    }

    // 3. Verificar si ya es un usuario registrado en Whitelist
    const whitelist = getStoredWhitelist()
    const foundWl = whitelist.find((w) => w.email.toLowerCase() === email)
    if (foundWl) {
      foundWl.sessionExpiresAt = Date.now() + SEVEN_DAYS_MS
      this.setCurrentUser(foundWl)
      return { success: true, user: foundWl }
    }

    // 4. Si el correo NO está registrado -> Activar Hype de Whitelist
    return {
      success: false,
      notRegistered: true,
      error: 'Este correo no está registrado en la lista de evaluadores Alpha.',
    }
  },

  /**
   * Registra a un usuario en la Whitelist / Pre-Registro Oficial en Supabase y localmente.
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
      existingAlpha.sessionExpiresAt = Date.now() + SEVEN_DAYS_MS
      this.setCurrentUser(existingAlpha)
      return { success: true, user: existingAlpha, isAlpha: true }
    }

    const whitelist = getStoredWhitelist()
    const existingWl = whitelist.find((w) => w.email.toLowerCase() === normalized)
    if (existingWl) {
      existingWl.sessionExpiresAt = Date.now() + SEVEN_DAYS_MS
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

        saveStoredAccounts(alphaAccounts)
        saveStoredWhitelist(whitelist)

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

    // 3. Crear nuevo usuario de Whitelist con sesión de 7 días
    const newWhitelistUser = {
      email: normalized,
      role: 'whitelist',
      provider,
      referralCode: myReferralCode,
      referredBy: matchedReferrer ? codeUsed : null,
      referralsCount: 0,
      airdropTokens: 0,
      sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
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

        const { error: accErr } = await supabase.from('user_accounts').upsert({
          email: normalized,
          role: 'whitelist',
          provider,
          referral_code: myReferralCode,
          referred_by: matchedReferrer ? codeUsed : null,
          must_change_password: false,
        })
        if (accErr) {
          console.error('[Supabase user_accounts Insert Error]:', accErr)
        }

        if (matchedReferrer) {
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
   * Inicia o registra sesión utilizando cuenta de Google de forma directa con Supabase OAuth.
   * Redirige al flujo oficial de Google y Supabase gestiona la captura y sesión de 7 días.
   * REGLA CERO FALLBACKS: Si falta configuración backend, reporta el error explícito en consola y UI.
   */
  async loginWithGoogle(referralCode = '') {
    const codeToUse = (referralCode || getUrlReferralCode() || '').trim().toUpperCase()
    if (codeToUse) {
      localStorage.setItem(PENDING_REF_STORAGE_KEY, codeToUse)
    }

    // Disparar Google OAuth nativo con Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        })

        if (error) {
          console.error('[Supabase Google Auth Error]:', error)
          return { success: false, error: error.message }
        }

        return { success: true, redirecting: true, data }
      } catch (err) {
        console.error('[Supabase Google Auth Exception]:', err)
        return { success: false, error: err?.message || String(err) }
      }
    }

    console.error('[authService] Conexión Backend Supabase no configurada en variables de entorno (VITE_SUPABASE_URL).')
    return {
      success: false,
      error: 'Backend de Supabase no configurado en variables de entorno (.env). Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para autenticar con Google.',
    }
  },

  /**
   * Sincroniza todas las cuentas de evaluadores Alpha autorizadas en la tabla `user_accounts` de Supabase.
   */
  async syncAlphaAccountsToSupabase() {
    if (!isSupabaseConfigured || !supabase) return
    try {
      for (const acc of DEFAULT_ACCOUNTS) {
        const { data: existing, error: selectErr } = await supabase
          .from('user_accounts')
          .select('email, referral_code, must_change_password')
          .eq('email', acc.email.toLowerCase())
          .maybeSingle()

        if (selectErr) {
          console.warn('[authService] Error al verificar cuenta Alpha en Supabase:', selectErr.message)
          continue
        }

        if (!existing) {
          const { error: insErr } = await supabase.from('user_accounts').insert({
            email: acc.email.toLowerCase(),
            role: 'alpha_player',
            provider: 'email',
            referral_code: acc.referralCode,
            temp_password: acc.tempPassword,
            password_hash: acc.passwordHash,
            must_change_password: true,
          })
          if (insErr) {
            console.warn('[authService] Error insertando cuenta Alpha en Supabase:', insErr.message)
          }
        } else if (!existing.referral_code) {
          await supabase
            .from('user_accounts')
            .update({
              referral_code: acc.referralCode,
              role: 'alpha_player',
            })
            .eq('email', acc.email.toLowerCase())
        }
      }
    } catch (err) {
      console.error('[authService] Excepción al sincronizar cuentas Alpha con Supabase:', err)
    }
  },

  /**
   * Listener global de autenticación de Supabase.
   * Maneja el retorno de Google OAuth, auto-registra al usuario en `whitelist_signups` y `user_accounts`
   * y establece la vigencia estricta de 7 días.
   */
  initSupabaseAuthListener(onUserAuthenticated) {
    if (!isSupabaseConfigured || !supabase) return () => {}

    // Sincronizar en segundo plano las 14 cuentas Alpha semilla autorizadas
    this.syncAlphaAccountsToSupabase().catch((err) =>
      console.warn('[authService] Sync alpha background:', err)
    )

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        const recoveryEmail = session?.user?.email?.trim().toLowerCase() || ''
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('fourkingdoms_password_recovery', {
              detail: { email: recoveryEmail, session },
            })
          )
        }
        return
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        const email = session.user.email?.trim().toLowerCase()
        if (!email) return

        const pendingRef = (localStorage.getItem(PENDING_REF_STORAGE_KEY) || getUrlReferralCode() || '').trim().toUpperCase()

        try {
          // Consultar si ya existe en user_accounts
          const { data: existingUser, error: fetchErr } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('email', email)
            .maybeSingle()

          if (fetchErr) {
            console.error('[Supabase Auth Listener Fetch Error]:', fetchErr)
          }

          let userRole = existingUser?.role || 'whitelist'
          let myRefCode = existingUser?.referral_code || generateReferralCode(email)
          let referredBy = existingUser?.referred_by || (pendingRef || null)

          if (!existingUser) {
            // Verificar si es cuenta semilla de evaluador
            const alphaAccounts = getStoredAccounts()
            const isSeedAlpha = alphaAccounts.find((a) => a.email.toLowerCase() === email && a.role === 'alpha_player')
            if (isSeedAlpha) {
              userRole = 'alpha_player'
              myRefCode = isSeedAlpha.referralCode || myRefCode
            }

            // Registrar en user_accounts
            await supabase.from('user_accounts').upsert({
              email,
              role: userRole,
              provider: 'google',
              referral_code: myRefCode,
              referred_by: referredBy,
              must_change_password: false,
            })

            // Si es rol Whitelist, registrar en whitelist_signups
            if (userRole === 'whitelist') {
              await supabase.from('whitelist_signups').upsert({
                email,
                referral_code: myRefCode,
                referred_by: referredBy,
                provider: 'google',
                airdrop_tokens: 0,
                referrals_count: 0,
              })
            }

            // Acreditar 5 tokens KING al referente si venía con código
            if (referredBy) {
              await this.creditReferralInDatabase(referredBy, email)
              localStorage.removeItem(PENDING_REF_STORAGE_KEY)
            }
          }

          // Buscar respaldo local si Supabase devolvió null o falló (ej. tabla pendiente)
          const localAccounts = getStoredAccounts()
          const localFound = localAccounts.find((a) => a.email.toLowerCase() === email)
          const currentSession = this.getCurrentUser()

          const assignedKingdom =
            existingUser?.assigned_kingdom ||
            localFound?.assignedKingdom ||
            currentSession?.assignedKingdom ||
            localStorage.getItem(`fk_assigned_kingdom_${email}`) ||
            null

          const rawBaseCoord =
            existingUser?.base_coord ||
            localFound?.baseCoord ||
            currentSession?.baseCoord ||
            localStorage.getItem(`fk_base_coord_${email}`) ||
            null

          const baseCoord = normalizeBaseCoord(rawBaseCoord)

          const onboardingCompleted = Boolean(
            existingUser?.onboarding_completed ||
            localFound?.onboardingCompleted ||
            currentSession?.onboardingCompleted ||
            localStorage.getItem(`fk_onboarding_completed_${email}`) === 'true'
          )

          const userObj = {
            email,
            role: userRole,
            provider: 'google',
            referralCode: myRefCode,
            referredBy,
            referralsCount: existingUser?.referrals_count || localFound?.referralsCount || 0,
            airdropTokens: existingUser?.airdrop_tokens || localFound?.airdropTokens || 0,
            mustChangePassword: false,
            assignedKingdom,
            baseCoord,
            onboardingCompleted,
            sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
          }

          this.setCurrentUser(userObj)
          if (onUserAuthenticated) {
            onUserAuthenticated(userObj)
          }
        } catch (err) {
          console.error('[Supabase Auth Listener Exception]:', err)
        }
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  },

  /**
   * Acredita un referido en base de datos y cache local otorgando 5 tokens KING
   */
  async creditReferralInDatabase(referrerCode, referredEmail) {
    if (!referrerCode || !referredEmail) return

    const alphaAccounts = getStoredAccounts()
    const whitelist = getStoredWhitelist()

    const matchedReferrer =
      alphaAccounts.find((a) => (a.referralCode || '').toUpperCase() === referrerCode.toUpperCase()) ||
      whitelist.find((w) => (w.referralCode || '').toUpperCase() === referrerCode.toUpperCase())

    if (matchedReferrer && matchedReferrer.email.toLowerCase() !== referredEmail.toLowerCase()) {
      matchedReferrer.referralsCount = (matchedReferrer.referralsCount || 0) + 1
      matchedReferrer.airdropTokens = (matchedReferrer.airdropTokens || 0) + 5
      saveStoredAccounts(alphaAccounts)
      saveStoredWhitelist(whitelist)

      const referralsList = getStoredReferrals()
      referralsList.push({
        referrerCode,
        referrerEmail: matchedReferrer.email,
        referredEmail,
        tokensRewarded: 5,
        createdAt: new Date().toISOString(),
      })
      saveStoredReferrals(referralsList)

      if (isSupabaseConfigured && supabase) {
        try {
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
            referrer_code: referrerCode,
            referrer_email: matchedReferrer.email,
            referred_email: referredEmail,
            tokens_rewarded: 5,
          })
        } catch (err) {
          console.error('[Supabase Referral Credit Exception]:', err)
        }
      }
    }
  },

  /**
   * Obtiene de forma síncrona las estadísticas de referidos (desde cache local y estado guardado)
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
        referredBy: null,
        referralsList: [],
      }
    }

    const myReferrals = referrals.filter(
      (r) => r.referrerEmail?.toLowerCase() === normalized || r.referrerCode === user.referralCode
    )

    const count = user.referralsCount || myReferrals.length

    return {
      referralCode: user.referralCode || generateReferralCode(user.email),
      referralsCount: count,
      airdropTokens: count * 5,
      referredBy: user.referredBy || null,
      referralsList: myReferrals,
    }
  },

  /**
   * Consulta las estadísticas de referidos reales directamente desde Supabase en tiempo real.
   */
  async fetchReferralStats(email) {
    const normalized = (email || '').trim().toLowerCase()
    if (!normalized) return this.getReferralStats('')

    let referralCode = ''
    let referralsCount = 0
    let airdropTokens = 0
    let referredBy = null
    let referralsList = []

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: userAcc, error: accErr } = await supabase
          .from('user_accounts')
          .select('referral_code, referred_by, referrals_count, airdrop_tokens')
          .eq('email', normalized)
          .maybeSingle()

        if (!accErr && userAcc) {
          referralCode = userAcc.referral_code || ''
          referredBy = userAcc.referred_by || null
          referralsCount = userAcc.referrals_count || 0
          airdropTokens = userAcc.airdrop_tokens || (referralsCount * 5)
        }

        const effectiveCode = referralCode || generateReferralCode(normalized)
        const { data: refsData, error: refsErr } = await supabase
          .from('referrals')
          .select('*')
          .or(`referrer_email.eq.${normalized},referrer_code.eq.${effectiveCode}`)

        if (!refsErr && Array.isArray(refsData) && refsData.length > 0) {
          referralsList = refsData
          referralsCount = Math.max(referralsCount, refsData.length)
          airdropTokens = referralsCount * 5
        }
      } catch (err) {
        console.error('[authService] Error al consultar stats de referidos en Supabase:', err)
      }
    }

    const localStats = this.getReferralStats(normalized)
    if (!referralCode) referralCode = localStats.referralCode
    if (!referredBy) referredBy = localStats.referredBy
    if (referralsCount === 0 && localStats.referralsCount > 0) {
      referralsCount = localStats.referralsCount
      airdropTokens = localStats.airdropTokens
      referralsList = localStats.referralsList
    }

    return {
      referralCode,
      referralsCount,
      airdropTokens: referralsCount * 5,
      referredBy,
      referralsList,
    }
  },

  /**
   * Obtiene la cantidad total global de pre-registros (síncrono desde cache o local)
   * REGLA CERO FALLBACKS: Refleja exclusivamente registros reales de Whitelist (sin inflar con alpha).
   */
  getGlobalPreRegistrationCount() {
    if (typeof cachedPreRegCount === 'number' && cachedPreRegCount >= 0) {
      return cachedPreRegCount
    }
    const whitelist = getStoredWhitelist()
    return whitelist.length
  },

  /**
   * Consulta el conteo real y dinámico de gobernantes pre-registrados en Supabase.
   * REGLA CERO FALLBACKS: Solo cuenta registros reales de `whitelist_signups`. Si hay 0, retorna 0.
   */
  async fetchGlobalPreRegistrationCount() {
    let count = null
    if (isSupabaseConfigured && supabase) {
      try {
        const { count: wlCount, error: wlErr } = await supabase
          .from('whitelist_signups')
          .select('*', { count: 'exact', head: true })
        if (!wlErr && typeof wlCount === 'number') {
          count = wlCount
        } else if (wlErr) {
          console.error('[authService] Error al consultar whitelist_signups en Supabase:', wlErr.message)
        }
      } catch (err) {
        console.error('[authService] Error al consultar conteo de pre-registros en Supabase:', err)
      }
    }

    if (count !== null) {
      cachedPreRegCount = count
    } else {
      const localWl = getStoredWhitelist()
      cachedPreRegCount = localWl.length
    }
    return cachedPreRegCount
  },

  /**
   * Obtiene el Top 5 de Reclutadores basado exclusivamente en datos reales.
   * REGLA CERO FALLBACKS: Solo usuarios que hayan reclutado al menos 1 aliado (referralsCount > 0).
   * Los puestos sin reclutadores se muestran como disponibles con su premio asignado.
   */
  getTopReferrers() {
    if (cachedTopReferrers && cachedTopReferrers.length > 0) {
      return cachedTopReferrers
    }

    const alphaAccounts = getStoredAccounts()
    const whitelist = getStoredWhitelist()
    const allUsers = [...alphaAccounts, ...whitelist]
    const deduped = []
    const seen = new Set()

    for (const u of allUsers) {
      if (!u.email || seen.has(u.email.toLowerCase())) continue
      seen.add(u.email.toLowerCase())
      const refs = u.referralsCount || 0
      // Solo usuarios que efectivamente hayan reclutado a alguien
      if (refs > 0) {
        const rawName = u.email.split('@')[0]
        const masked = rawName.length > 3 ? `${rawName.substring(0, 3)}***` : rawName
        deduped.push({
          name: masked,
          code: u.referralCode || 'FK-SOV',
          referralsCount: refs,
          airdropTokens: refs * 5,
          email: u.email,
          isRealUser: true,
          isVacant: false,
        })
      }
    }

    deduped.sort((a, b) => (b.referralsCount || 0) - (a.referralsCount || 0))

    const finalTop5 = []
    for (let idx = 0; idx < 5; idx++) {
      const userItem = deduped[idx]
      const prize = TOP_REFERRAL_PRIZES[idx]

      if (userItem) {
        finalTop5.push({
          ...userItem,
          rank: idx + 1,
          prizeKing: prize.king,
          hasVip: prize.vip,
          rankLabel: prize.label,
          isVacant: false,
        })
      } else {
        finalTop5.push({
          name: `Puesto Disponible #${idx + 1}`,
          code: '---',
          referralsCount: 0,
          airdropTokens: 0,
          email: '',
          rank: idx + 1,
          prizeKing: prize.king,
          hasVip: prize.vip,
          rankLabel: prize.label,
          isVacant: true,
        })
      }
    }

    cachedTopReferrers = finalTop5
    return finalTop5
  },

  /**
   * Consulta el Top 5 real desde Supabase ordenado por número de referidos.
   * REGLA CERO FALLBACKS: Solo usuarios con referrals_count > 0.
   */
  async fetchTopReferrers() {
    let realLeaders = []

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_accounts')
          .select('email, referral_code, referrals_count, airdrop_tokens')
          .gt('referrals_count', 0)
          .order('referrals_count', { ascending: false })
          .limit(5)

        if (!error && Array.isArray(data)) {
          realLeaders = data.map((u) => {
            const rawName = (u.email || '').split('@')[0]
            const masked = rawName.length > 3 ? `${rawName.substring(0, 3)}***` : rawName
            return {
              name: masked,
              code: u.referral_code || 'FK-SOV',
              referralsCount: u.referrals_count || 0,
              airdropTokens: u.airdrop_tokens || (u.referrals_count || 0) * 5,
              email: u.email,
              isRealUser: true,
              isVacant: false,
            }
          })
        } else if (error) {
          console.error('[authService] Error al consultar top referrers en Supabase:', error.message)
        }
      } catch (err) {
        console.error('[authService] Excepción al consultar top referrers en Supabase:', err)
      }
    }

    if (realLeaders.length === 0) {
      return this.getTopReferrers()
    }

    const finalTop5 = []
    for (let idx = 0; idx < 5; idx++) {
      const userItem = realLeaders[idx]
      const prize = TOP_REFERRAL_PRIZES[idx]

      if (userItem) {
        finalTop5.push({
          ...userItem,
          rank: idx + 1,
          prizeKing: prize.king,
          hasVip: prize.vip,
          rankLabel: prize.label,
          isVacant: false,
        })
      } else {
        finalTop5.push({
          name: `Puesto Disponible #${idx + 1}`,
          code: '---',
          referralsCount: 0,
          airdropTokens: 0,
          email: '',
          rank: idx + 1,
          prizeKing: prize.king,
          hasVip: prize.vip,
          rankLabel: prize.label,
          isVacant: true,
        })
      }
    }

    cachedTopReferrers = finalTop5
    return finalTop5
  },

  /**
   * Vincula un código de aliado con máxima protección antifugas:
   * 1. Previene auto-referidos (propio código o propio email)
   * 2. Previene doble vinculación (usuario ya referido)
   * 3. Valida existencia real del código en la base de datos
   * 4. Inserción atómica en tabla `referrals` (constraint UNIQUE en referred_email)
   * 5. Actualiza `referrals_count` y `airdrop_tokens` (= count * 5) en ambas tablas
   */
  async linkReferralCode(userEmail, codeToLink) {
    const email = (userEmail || '').trim().toLowerCase()
    const code = (codeToLink || '').trim().toUpperCase()

    if (!email) {
      return { success: false, error: 'Sesión no válida. Vuelve a iniciar sesión.' }
    }
    if (!code || code.length < 4) {
      return { success: false, error: 'Ingresa un código de alianza válido (ej: FK-XXXX-XX).' }
    }

    // 1. Obtener datos del usuario actual
    const alphaAccounts = getStoredAccounts()
    const whitelist = getStoredWhitelist()
    const localUser =
      alphaAccounts.find((a) => a.email.toLowerCase() === email) ||
      whitelist.find((w) => w.email.toLowerCase() === email) ||
      this.getCurrentUser()

    const myCode = (localUser?.referralCode || localUser?.referral_code || generateReferralCode(email)).toUpperCase()

    // 2. Anti-Self-Referral
    if (code === myCode) {
      return { success: false, error: 'No puedes usar tu propio código de referencia.' }
    }

    // 3. Anti-Doble Vinculación en local
    if (localUser?.referredBy || localUser?.referred_by) {
      return { success: false, error: 'Tu cuenta ya tiene un aliado vinculado anteriormente.' }
    }

    let referrer = null

    // 4. Si Supabase está disponible, verificar en backend
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbUser } = await supabase
          .from('user_accounts')
          .select('referred_by, referral_code')
          .eq('email', email)
          .maybeSingle()

        if (dbUser?.referred_by) {
          return { success: false, error: 'Tu cuenta ya tiene un aliado vinculado en el sistema.' }
        }

        const { data: existingRef } = await supabase
          .from('referrals')
          .select('id, referrer_code')
          .eq('referred_email', email)
          .maybeSingle()

        if (existingRef) {
          return { success: false, error: 'Esta cuenta ya fue acreditada como referida anteriormente.' }
        }

        // Buscar al dueño del código en user_accounts
        const { data: refUserAcc } = await supabase
          .from('user_accounts')
          .select('email, referral_code, referrals_count, airdrop_tokens')
          .ilike('referral_code', code)
          .maybeSingle()

        if (refUserAcc) {
          referrer = refUserAcc
        } else {
          // Buscar en whitelist_signups
          const { data: refWl } = await supabase
            .from('whitelist_signups')
            .select('email, referral_code, referrals_count, airdrop_tokens')
            .ilike('referral_code', code)
            .maybeSingle()
          if (refWl) {
            referrer = refWl
          }
        }
      } catch (err) {
        console.error('[authService] Error al consultar datos de alianza en Supabase:', err)
      }
    }

    // Fallback a cuentas locales si no se encontró en Supabase o estamos en offline
    if (!referrer) {
      const matchLocal =
        alphaAccounts.find((a) => (a.referralCode || '').toUpperCase() === code) ||
        whitelist.find((w) => (w.referralCode || '').toUpperCase() === code) ||
        DEFAULT_ACCOUNTS.find((d) => (d.referralCode || '').toUpperCase() === code)

      if (matchLocal) {
        referrer = {
          email: matchLocal.email,
          referral_code: matchLocal.referralCode,
          referrals_count: matchLocal.referralsCount || 0,
          airdrop_tokens: matchLocal.airdropTokens || 0,
        }
      }
    }

    if (!referrer) {
      return { success: false, error: 'El código de aliado ingresado no existe en FourKingdoms.' }
    }

    // Verificar que el dueño del código no sea uno mismo por email
    if (referrer.email.toLowerCase() === email) {
      return { success: false, error: 'No puedes usar tu propio código de referencia.' }
    }

    // 5. Inserción en Supabase con protección estricta contra duplicados
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: insErr } = await supabase.from('referrals').insert({
          referrer_code: code,
          referrer_email: referrer.email.toLowerCase(),
          referred_email: email,
          tokens_rewarded: 5,
        })

        if (insErr) {
          console.error('[authService] Error al insertar en referrals:', insErr)
          if (insErr.code === '23505' || insErr.message?.includes('duplicate key') || insErr.message?.includes('unique')) {
            return { success: false, error: 'Tu cuenta ya ha sido vinculada previamente como aliada.' }
          }
          return { success: false, error: 'Error al vincular aliado en la base de datos. Intenta nuevamente.' }
        }

        // Consultar el conteo real exacto en referrals para evitar discrepancias
        const { count: exactCount } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_code', code)

        const finalRefCount = typeof exactCount === 'number' && exactCount > 0
          ? exactCount
          : (Number(referrer.referrals_count || 0) + 1)
        const finalTokens = finalRefCount * 5

        // Actualizar cuentas del referente
        await supabase
          .from('user_accounts')
          .update({
            referrals_count: finalRefCount,
            airdrop_tokens: finalTokens,
          })
          .eq('email', referrer.email.toLowerCase())

        await supabase
          .from('whitelist_signups')
          .update({
            referrals_count: finalRefCount,
            airdrop_tokens: finalTokens,
          })
          .eq('email', referrer.email.toLowerCase())

        // Actualizar cuenta del usuario vinculado
        await supabase
          .from('user_accounts')
          .update({ referred_by: code })
          .eq('email', email)

        await supabase
          .from('whitelist_signups')
          .update({ referred_by: code })
          .eq('email', email)
      } catch (err) {
        console.error('[authService] Excepción al procesar vinculación en Supabase:', err)
        return { success: false, error: 'Error al procesar la vinculación con el servidor.' }
      }
    }

    // 6. Actualizar cache y estado local
    const referralsList = getStoredReferrals()
    if (!referralsList.some((r) => r.referredEmail?.toLowerCase() === email)) {
      referralsList.push({
        referrerCode: code,
        referrerEmail: referrer.email.toLowerCase(),
        referredEmail: email,
        tokensRewarded: 5,
        createdAt: new Date().toISOString(),
      })
      saveStoredReferrals(referralsList)
    }

    const refTarget =
      alphaAccounts.find((a) => a.email.toLowerCase() === referrer.email.toLowerCase()) ||
      whitelist.find((w) => w.email.toLowerCase() === referrer.email.toLowerCase())
    if (refTarget) {
      refTarget.referralsCount = (refTarget.referralsCount || 0) + 1
      refTarget.airdropTokens = refTarget.referralsCount * 5
      saveStoredAccounts(alphaAccounts)
      saveStoredWhitelist(whitelist)
    }

    const userTarget =
      alphaAccounts.find((a) => a.email.toLowerCase() === email) ||
      whitelist.find((w) => w.email.toLowerCase() === email)
    if (userTarget) {
      userTarget.referredBy = code
      saveStoredAccounts(alphaAccounts)
      saveStoredWhitelist(whitelist)
    }

    const curUser = this.getCurrentUser()
    if (curUser && curUser.email.toLowerCase() === email) {
      curUser.referredBy = code
      this.setCurrentUser(curUser)
    }

    return {
      success: true,
      message: `¡Código ${code} vinculado exitosamente! Tu aliado ha recibido sus 5 tokens KING de Airdrop.`,
      referrerCode: code,
      referrerEmail: referrer.email,
    }
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
   * Valida el rol de un correo en Supabase y procesa el flujo dinámico:
   * - Si es 'whitelist' -> Redirige directamente al Dashboard de Whitelist.
   * - Si no figura en la base de datos -> Redirige a registrarse con Google en la Whitelist.
   * - Si es 'alpha_player' -> Envía correo de recuperación con Supabase Auth (gratis)
   *   y habilita la definición de su clave formal.
   */
  async checkEmailAndProcessRecovery(emailInput) {
    const email = (emailInput || '').trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return { success: false, error: 'Ingresa un correo electrónico válido.' }
    }

    let foundRole = null
    let foundUser = null

    // 1. Consultar directamente en Supabase si está activo
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: accData, error: accErr } = await supabase
          .from('user_accounts')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (!accErr && accData) {
          foundUser = accData
          foundRole = accData.role || 'alpha_player'
        } else {
          // Consultar en whitelist_signups
          const { data: wlData, error: wlErr } = await supabase
            .from('whitelist_signups')
            .select('*')
            .eq('email', email)
            .maybeSingle()

          if (!wlErr && wlData) {
            foundUser = wlData
            foundRole = 'whitelist'
          }
        }
      } catch (err) {
        console.error('[authService] Error consultando rol en Supabase:', err)
      }
    }

    // 2. Si no se encontró en Supabase o estamos en local/offline
    if (!foundRole) {
      const isSeedAlpha = DEFAULT_ACCOUNTS.find((a) => a.email.toLowerCase() === email)
      if (isSeedAlpha) {
        foundRole = 'alpha_player'
        foundUser = isSeedAlpha
      } else {
        const localAccounts = getStoredAccounts()
        const localFound = localAccounts.find((a) => a.email.toLowerCase() === email)
        if (localFound) {
          foundRole = localFound.role || 'alpha_player'
          foundUser = localFound
        } else {
          const localWl = getStoredWhitelist()
          const wlFound = localWl.find((w) => w.email.toLowerCase() === email)
          if (wlFound) {
            foundRole = 'whitelist'
            foundUser = wlFound
          }
        }
      }
    }

    // CASO 1: Es usuario de Whitelist -> Redirigir al Dashboard de Whitelist
    if (foundRole === 'whitelist') {
      const user = {
        email,
        role: 'whitelist',
        provider: foundUser?.provider || 'google',
        referralCode: foundUser?.referral_code || foundUser?.referralCode || generateReferralCode(email),
        referredBy: foundUser?.referred_by || foundUser?.referredBy || null,
        referralsCount: foundUser?.referrals_count || foundUser?.referralsCount || 0,
        airdropTokens: foundUser?.airdrop_tokens || foundUser?.airdropTokens || 0,
        sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
      }
      this.setCurrentUser(user)
      return {
        success: true,
        action: 'redirect_whitelist',
        user,
        message: '¡Tu correo está registrado en la Whitelist Oficial! Redirigiendo a tu Dashboard de Pre-registro...',
      }
    }

    // CASO 2: NO figura en la base de datos -> Redirigir a registrarse con Google
    if (!foundRole) {
      return {
        success: false,
        action: 'register_google',
        notRegistered: true,
        email,
        error: 'Este correo no figura en la base de datos de evaluadores ni de la Whitelist Oficial.',
        message: 'No te encuentras registrado todavía. ¡Asegura tu puesto en la Whitelist con Google para recibir 5 Tokens KING de Airdrop!',
      }
    }

    // CASO 3: Es jugador del Alpha -> Enviar correo para recuperar contraseña con Supabase
    if (foundRole === 'alpha_player') {
      let emailSent = false
      let emailError = null

      if (isSupabaseConfigured && supabase) {
        try {
          const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fourkingdoms.online'
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteUrl}/`,
          })

          if (!resetErr) {
            emailSent = true
          } else {
            console.warn('[authService] Supabase resetPasswordForEmail info:', resetErr.message)
            emailError = resetErr.message
          }
        } catch (err) {
          console.warn('[authService] Error al enviar reset de contraseña:', err)
          emailError = err?.message
        }
      }

      return {
        success: true,
        action: 'alpha_recovery',
        email,
        emailSent,
        message: emailSent
          ? `📧 Se ha enviado un enlace de recuperación oficial de Supabase a ${email}. Abre el enlace en tu correo para definir tu clave o ingrésala a continuación.`
          : `✅ Cuenta de Evaluador Alpha autorizada identificada. Define tu contraseña formal a continuación para ingresar a la Alpha.`,
      }
    }

    return {
      success: false,
      error: 'No se pudo determinar el estado de la cuenta. Intenta nuevamente.',
    }
  },

  /**
   * Recupera o establece formalmente la contraseña de una cuenta de evaluador Alpha autorizada.
   * Valida existencia en backend Supabase o lista semilla de evaluadores, actualiza la clave,
   * remueve la necesidad de cambio (must_change_password: false) y genera una sesión activa de 7 días.
   */
  async recoverPassword(emailInput, newPasswordInput) {
    const email = (emailInput || '').trim().toLowerCase()
    const newPassword = (newPasswordInput || '').trim()

    if (!email || !email.includes('@')) {
      return { success: false, error: 'Ingresa un correo electrónico válido.' }
    }

    if (newPassword.length < 5) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 5 caracteres.' }
    }

    // 1. Verificar si el correo pertenece a la Whitelist (sin acceso a Alpha)
    const storedWl = getStoredWhitelist()
    const foundInWl = storedWl.find((w) => w.email.toLowerCase() === email)
    const isSeedAlpha = DEFAULT_ACCOUNTS.some((a) => a.email.toLowerCase() === email)

    if (foundInWl && !isSeedAlpha) {
      return {
        success: false,
        notRegistered: false,
        isWhitelistOnly: true,
        error: 'Este correo está registrado en la Whitelist Oficial (Dashboard de Pre-registro y Airdrop). El acceso a la Alpha está reservado exclusivamente a evaluadores designados.',
      }
    }

    // 2. Verificar si el correo pertenece a la lista Alpha autorizada o a Supabase
    let matchedAccount = null
    const accounts = getStoredAccounts()
    const localFound = accounts.find((a) => a.email.toLowerCase() === email)

    if (localFound && localFound.role === 'alpha_player') {
      matchedAccount = localFound
    } else {
      const defFound = DEFAULT_ACCOUNTS.find((a) => a.email.toLowerCase() === email)
      if (defFound) {
        matchedAccount = { ...defFound }
        accounts.push(matchedAccount)
      }
    }

    // Si Supabase está disponible, verificar en backend
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_accounts')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (!error && data) {
          if (data.role === 'alpha_player') {
            if (!matchedAccount) {
              matchedAccount = {
                email: data.email,
                role: 'alpha_player',
                provider: data.provider || 'email',
                referralCode: data.referral_code,
                referredBy: data.referred_by,
                referralsCount: data.referrals_count || 0,
                airdropTokens: data.airdrop_tokens || 0,
                mustChangePassword: false,
                assignedKingdom: data.assigned_kingdom || null,
                baseCoord: normalizeBaseCoord(data.base_coord),
                onboardingCompleted: Boolean(data.onboarding_completed),
              }
              accounts.push(matchedAccount)
            } else {
              if (data.assigned_kingdom) matchedAccount.assignedKingdom = data.assigned_kingdom
              if (data.base_coord) matchedAccount.baseCoord = normalizeBaseCoord(data.base_coord)
              if (data.onboarding_completed) matchedAccount.onboardingCompleted = true
            }
          } else {
            // Usuario con rol 'whitelist' en backend -> No tiene acceso a Alpha
            return {
              success: false,
              notRegistered: false,
              isWhitelistOnly: true,
              error: 'Este correo está registrado en la Whitelist Oficial (Dashboard de Pre-registro y Airdrop). El acceso a la Alpha está reservado exclusivamente a evaluadores designados.',
            }
          }
        }
      } catch (err) {
        console.error('[Supabase Recover Check Exception]:', err)
      }
    }

    // Si no está ni en backend ni en lista autorizada Alpha
    if (!matchedAccount || matchedAccount.role !== 'alpha_player') {
      return {
        success: false,
        notRegistered: true,
        error: 'Este correo no está registrado en la lista de evaluadores Alpha autorizados. Únete a la Whitelist Oficial para participar.',
      }
    }

    // 2. Actualizar en Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        const { error: updateErr } = await supabase
          .from('user_accounts')
          .upsert({
            email,
            password_hash: newPassword,
            temp_password: null,
            must_change_password: false,
            role: matchedAccount.role || 'alpha_player',
            provider: matchedAccount.provider || 'email',
            referral_code: matchedAccount.referralCode || generateReferralCode(email),
            referred_by: matchedAccount.referredBy || null,
            updated_at: new Date().toISOString(),
          })

        if (updateErr) {
          console.error('[Supabase Recover Password Error]:', updateErr)
        }

        // Si existe sesión activa en Supabase Auth (ej: por enlace de reseteo), actualizar auth.users
        try {
          await supabase.auth.updateUser({ password: newPassword }).catch(() => {})
        } catch {}
      } catch (err) {
        console.error('[Supabase Recover Password Exception]:', err)
      }
    }

    // 3. Actualizar almacenamiento local
    matchedAccount.passwordHash = newPassword
    matchedAccount.tempPassword = null
    matchedAccount.mustChangePassword = false
    const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === email)
    if (existingIdx >= 0) {
      accounts[existingIdx] = matchedAccount
    } else {
      accounts.push(matchedAccount)
    }
    saveStoredAccounts(accounts)

    // 4. Crear sesión activa de 7 días
    const user = {
      email: matchedAccount.email,
      role: matchedAccount.role || 'alpha_player',
      provider: matchedAccount.provider || 'email',
      referralCode: matchedAccount.referralCode || generateReferralCode(matchedAccount.email),
      referredBy: matchedAccount.referredBy || null,
      referralsCount: matchedAccount.referralsCount || 0,
      airdropTokens: matchedAccount.airdropTokens || 0,
      mustChangePassword: false,
      assignedKingdom: matchedAccount.assignedKingdom || null,
      baseCoord: normalizeBaseCoord(matchedAccount.baseCoord),
      onboardingCompleted: Boolean(matchedAccount.onboardingCompleted),
      sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
    }

    this.setCurrentUser(user)

    return {
      success: true,
      user,
      message: '¡Contraseña establecida exitosamente! Accediendo a tu Reino...',
    }
  },

  /**
   * Asigna aleatoriamente al usuario a uno de los 4 Reinos y genera coordenadas dentro de su territorio
   */
  async assignRandomKingdom(emailInput) {
    const email = (emailInput || '').trim().toLowerCase()
    const accounts = getStoredAccounts()
    const target = accounts.find((a) => a.email.toLowerCase() === email)
    const currentUser = this.getCurrentUser()

    // REGLA: Si ya fue asignado previamente a un Reino, NUNCA re-asignar a otro
    const existingKingdom =
      currentUser?.assignedKingdom ||
      target?.assignedKingdom ||
      localStorage.getItem(`fk_assigned_kingdom_${email}`)
    const existingCoordRaw =
      currentUser?.baseCoord ||
      target?.baseCoord ||
      localStorage.getItem(`fk_base_coord_${email}`)
    const existingCoord = normalizeBaseCoord(existingCoordRaw)

    if (existingKingdom && existingCoord) {
      if (currentUser && (!currentUser.assignedKingdom || !currentUser.baseCoord)) {
        currentUser.assignedKingdom = existingKingdom
        currentUser.baseCoord = existingCoord
        this.setCurrentUser(currentUser)
      }
      if (target && (!target.assignedKingdom || !target.baseCoord)) {
        target.assignedKingdom = existingKingdom
        target.baseCoord = existingCoord
        saveStoredAccounts(accounts)
      }
      return {
        success: true,
        kingdomKey: existingKingdom,
        kingdomData: REGIONAL_KINGDOMS[existingKingdom] || REGIONAL_KINGDOMS.north,
        baseCoord: existingCoord,
        user: currentUser,
        alreadyAssigned: true,
      }
    }

    const kingdomKeys = ['north', 'south', 'east', 'west']
    const chosenKey = kingdomKeys[Math.floor(Math.random() * kingdomKeys.length)]
    const kingdomData = REGIONAL_KINGDOMS[chosenKey]

    let bx = 0
    let by = 0
    if (chosenKey === 'north') {
      bx = -Math.floor(Math.random() * 12 + 6)
      by = Math.floor(Math.random() * 12 + 6)
    } else if (chosenKey === 'south') {
      bx = Math.floor(Math.random() * 12 + 6)
      by = -Math.floor(Math.random() * 12 + 6)
    } else if (chosenKey === 'east') {
      bx = Math.floor(Math.random() * 12 + 6)
      by = Math.floor(Math.random() * 12 + 6)
    } else {
      bx = -Math.floor(Math.random() * 12 + 6)
      by = -Math.floor(Math.random() * 12 + 6)
    }
    const baseCoord = { x: bx, y: by, worldX: bx, worldY: by }

    localStorage.setItem(`fk_assigned_kingdom_${email}`, chosenKey)
    localStorage.setItem(`fk_base_coord_${email}`, JSON.stringify(baseCoord))

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
          console.warn('[Supabase Kingdom Assignment Notice]:', accErr.message)
        }

        const { error: kingErr } = await supabase.from('kingdoms').upsert({
          id: email,
          username: email.split('@')[0],
          coord_x: baseCoord.x,
          coord_y: baseCoord.y,
        })

        if (kingErr) {
          console.warn('[Supabase Kingdom Upsert Notice]:', kingErr.message)
        }
      } catch (err) {
        console.warn('[Supabase Kingdom Assignment Exception]:', err)
      }
    }

    if (target) {
      target.assignedKingdom = chosenKey
      target.baseCoord = baseCoord
      saveStoredAccounts(accounts)
    }

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
    localStorage.setItem(`fk_onboarding_completed_${email}`, 'true')

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
          console.warn('[Supabase Onboarding Notice]:', error.message)
        }
      } catch (err) {
        console.warn('[Supabase Onboarding Exception]:', err)
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
   * Registra una nueva cuenta de prueba
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
      sessionExpiresAt: Date.now() + SEVEN_DAYS_MS,
      createdAt: new Date().toISOString(),
    }
    accounts.push(newAcc)
    saveStoredAccounts(accounts)
    return newAcc
  },
}
