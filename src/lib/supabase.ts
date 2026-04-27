import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// Admin client — persists session for authenticated staff/admin users
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Kiosk client — never persists auth state, always runs as anon role.
// This prevents any expired admin JWT from leaking into kiosk requests
// and causing 401s on INSERT/UPDATE operations.
export const supabaseKiosk = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // Unique key prevents GoTrueClient "multiple instances" collision warning
    storageKey: 'ventra-kiosk-isolated',
    // Null storage: this client can NEVER load or store any session.
    // Guarantees all kiosk requests use only the anon key — no admin JWT leakage.
    storage: {
      getItem: (_key: string) => null,
      setItem: (_key: string, _value: string) => {},
      removeItem: (_key: string) => {},
    },
  },
})
