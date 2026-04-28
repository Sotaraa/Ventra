import { useEffect, useState } from 'react'
import { supabaseKiosk } from '@/lib/supabase'
import { useAuth } from '@/store/AuthContext'
import type { Site } from '@/types'

const SESSION_KEY = 'ventra:kiosk:slug'

// Returns the kiosk site slug, checking URL param first, then sessionStorage.
// Persists to sessionStorage whenever found in the URL so navigation doesn't lose it.
function getKioskSlug(): string | null {
  const urlSlug = new URLSearchParams(window.location.search).get('site')
  if (urlSlug) {
    sessionStorage.setItem(SESSION_KEY, urlSlug)
    return urlSlug
  }
  return sessionStorage.getItem(SESSION_KEY)
}

// Admin: returns currentSite from AuthContext (RLS-scoped, no extra DB call).
// Kiosk (anon): reads slug from ?site=<slug> or sessionStorage to pick the right school.
export function useSite() {
  const auth = useAuth()
  const [kioskSite, setKioskSite] = useState<Site | null>(null)
  const [kioskLoading, setKioskLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!auth.user

  useEffect(() => {
    if (isAuthenticated) return

    setKioskLoading(true)
    const slug = getKioskSlug()

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
