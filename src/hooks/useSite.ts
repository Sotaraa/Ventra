import { useEffect, useState } from 'react'
import { supabaseKiosk } from '@/lib/supabase'
import { useAuth } from '@/store/AuthContext'
import type { Site } from '@/types'

// Admin: returns currentSite from AuthContext (RLS-scoped, no extra DB call).
// Kiosk (anon): reads ?site=<slug> from the URL to pick the right school.
//   Falls back to first active site if no slug provided (single-tenant setups).
export function useSite() {
  const auth = useAuth()
  const [kioskSite, setKioskSite] = useState<Site | null>(null)
  const [kioskLoading, setKioskLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!auth.user

  useEffect(() => {
    if (isAuthenticated) return

    setKioskLoading(true)

    const slug = new URLSearchParams(window.location.search).get('site')
    let query = supabaseKiosk.from('sites').select('*').eq('is_active', true)
    if (slug) query = query.eq('slug', slug)
    else query = query.limit(1)

    query.maybeSingle().then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setKioskSite(data as Site | null)
      setKioskLoading(false)
    })
  }, [isAuthenticated])

  if (isAuthenticated) {
    return { site: auth.currentSite, loading: auth.loading, error: null }
  }

  return { site: kioskSite, loading: kioskLoading, error }
}
