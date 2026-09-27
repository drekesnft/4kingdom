/**
 * FourKingdom — Servicio de Autenticación y Control de Usuarios (Alpha v0.1)
 * Gestiona el acceso por email con contraseñas temporales, forzado de cambio de clave,
 * asignación aleatoria a uno de los 4 Reinos y progreso de Onboarding.
 * Validado tanto con Supabase Backend como con sincronización persistente.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient'
import { REGIONAL_KINGDOMS } from '../game/config'

const AUTH_STORAGE_KEY = 'fourkingdoms_alpha_accounts_v1'
const SESSION_STORAGE_KEY = 'fourkingdoms_alpha_session_v1'

// Cuentas semilla de prueba Alpha
const DEFAULT_ACCOUNTS = [
  {
    email: 'antoniox4253@gmail.com',
    tempPassword: 'k9t4m', // 5 caracteres aleatorios asignados
    passwordHash: 'k9t4m',
    mustChangePassword: true,
    assignedKingdom: null,
    baseCoord: null,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  },
]

function getStoredAccounts() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Asegurar que antoniox4253 esté presente si es la primera vez
      if (!parsed.find((a) => a.email.toLowerCase() === 'antoniox4253@gmail.com')) {
        parsed.push(DEFAULT_ACCOUNTS[0])
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch {}
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS))
  return [...DEFAULT_ACCOUNTS]
}

function saveStoredAccounts(accounts) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(accounts))
  } catch (err) {
    console.warn('[authService] Error al guardar cuentas locales:', err)
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

        if (!error && data) {
          const isValidPass = data.password_hash === password || data.temp_password === password
          if (!isValidPass) {
            return { success: false, error: 'Contraseña incorrecta. Verifica tu clave temporal.' }
          }

          const user = {
            email: data.email,
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
        console.warn('[authService] Error al consultar Supabase:', err)
      }
    }

    // 2. Validación con almacenamiento sincronizado
    const accounts = getStoredAccounts()
    const found = accounts.find((a) => a.email.toLowerCase() === email)

    if (!found) {
      return {
        success: false,
        error: 'Este correo no está registrado en la lista de evaluadores Alpha. Solicita acceso.',
      }
    }

    const valid = found.passwordHash === password || found.tempPassword === password
    if (!valid) {
      return {
        success: false,
        error: 'Contraseña incorrecta. Usa la clave temporal asignada.',
      }
    }

    const user = {
      email: found.email,
      mustChangePassword: Boolean(found.mustChangePassword),
      assignedKingdom: found.assignedKingdom || null,
      baseCoord: found.baseCoord || null,
      onboardingCompleted: Boolean(found.onboardingCompleted),
    }

    this.setCurrentUser(user)
    return { success: true, user }
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
        await supabase
          .from('user_accounts')
          .update({
            password_hash: newPassword,
            temp_password: null,
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
      } catch (err) {
        console.warn('[authService] Error actualizando clave en Supabase:', err)
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
      // Noroeste: X negativo, Y positivo
      baseCoord = {
        x: -Math.floor(Math.random() * 12 + 6),
        y: Math.floor(Math.random() * 12 + 6),
      }
    } else if (chosenKey === 'south') {
      // Sureste: X positivo, Y negativo
      baseCoord = {
        x: Math.floor(Math.random() * 12 + 6),
        y: -Math.floor(Math.random() * 12 + 6),
      }
    } else if (chosenKey === 'east') {
      // Noreste: X positivo, Y positivo
      baseCoord = {
        x: Math.floor(Math.random() * 12 + 6),
        y: Math.floor(Math.random() * 12 + 6),
      }
    } else {
      // Oeste (Suroeste): X negativo, Y negativo
      baseCoord = {
        x: -Math.floor(Math.random() * 12 + 6),
        y: -Math.floor(Math.random() * 12 + 6),
      }
    }

    // 1. Guardar en Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('user_accounts')
          .update({
            assigned_kingdom: chosenKey,
            base_coord: baseCoord,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)

        // Registrar o actualizar reino
        await supabase.from('kingdoms').upsert({
          id: email,
          username: email.split('@')[0],
          coord_x: baseCoord.x,
          coord_y: baseCoord.y,
        })
      } catch (err) {
        console.warn('[authService] Error al guardar asignación de reino en Supabase:', err)
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
        await supabase
          .from('user_accounts')
          .update({
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
      } catch (err) {
        console.warn('[authService] Error marcando onboarding en Supabase:', err)
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
