import { useEffect, useState } from 'react'
import { supabaseKiosk } from '@/lib/supabase'
import { useAuth } from '@/store/AuthContext'
import type { Site } from '@/types'

// Admin: returns the site from AuthContext (no extra DB call, already scoped by RLS).
// Kiosk (anon): falls back to a direct query using the anon client.
export function useSite() {
  const auth = useAuth()
  const [kioskSite, setKioskSite] = useState<Site | null>(null)
  const [kioskLoading, setKioskLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!auth.user

  useEffect(() => {
    if (isAuthenticated) return  // auth context already has the site

    setKioskLoading(true)
    supabaseKiosk
      .from('sites')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setKioskSite(data as Site)
        setKioskLoading(false)
      })
  }, [isAuthenticated])

  if (isAuthenticated) {
    return { site: auth.currentSite, loading: auth.loading, error: null }
  }

  return { site: kioskSite, loading: kioskLoading, error }
}
