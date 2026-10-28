import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authStorage } from './auth-storage'
import type { Database } from './database.types'

/**
 * Cliente do Supabase. Só os arquivos de `lib/db/` usam isto — as telas chamam funções com
 * nome de gente (`fetchProfile`, `templateRepository.list`), nunca `supabase.from`.
 *
 * É criado na primeira chamada, e não ao importar: assim as telas que nem falam com o
 * banco (e os testes) não precisam do `.env` preenchido para subir.
 */

export type DbClient = SupabaseClient<Database>

export interface SupabaseConfig {
  url: string
  anonKey: string
}

let client: DbClient | null = null

/** Lê o `.env`. Só a chave pública (anon) vem para o app; a secreta fica nas Edge Functions. */
export function supabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (url === '' || anonKey === '') return null
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null
}

export function getSupabase(): DbClient {
  if (client !== null) return client

  const config = supabaseConfig()
  if (config === null) {
    throw new Error(
      'Supabase sem configuração: preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.'
    )
  }

  client = createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: authStorage.storage,
      persistSession: true,
      autoRefreshToken: true,
      // O app não recebe login por link (não há e-mail de confirmação nem OAuth).
      detectSessionInUrl: false
    }
  })
  return client
}
