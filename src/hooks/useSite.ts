import { useEffect, useState } from 'react'
import { supabaseKiosk } from '@/lib/supabase'
import { useAuth } from '@/store/AuthContext'
import type { Site } from '@/types'

const SESSION_KEY = 'ventra:kiosk:slug'

// Returns the kiosk site slug, checking URL param first, then sessionStorage.
// Persists to sessionStorage whenever found in the URL so navigation doesn't lose it.
// Returns null (with found=false) if no slug is available anywhere — caller must handle this.
function getKioskSlug(): { slug: string | null; found: boolean } {
  const urlSlug = new URLSearchParams(window.location.search).get('site')
  if (urlSlug) {
    sessionStorage.setItem(SESSION_KEY, urlSlug)
    return { slug: urlSlug, found: true }
  }
  const stored = sessionStorage.getItem(SESSION_KEY)
  return { slug: stored, found: !!stored }
}

// Admin: returns currentSite from AuthContext (RLS-scoped, no extra DB call).
// Kiosk (anon): reads slug from ?site=<slug> or sessionStorage to pick the right school.
// noSlug=true means no site identifier was provided — show an error, not a random school.
export function useSite() {
  const auth = useAuth()
  const [kioskSite, setKioskSite] = useState<Site | null>(null)
  const [kioskLoading, setKioskLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noSlug, setNoSlug] = useState(false)

  const isAuthenticated = !!auth.user

  useEffect(() => {
    if (isAuthenticated) return

    const { slug, found } = getKioskSlug()

    if (!found || !slug) {
      // No site identifier at all — don't fall back to a random school
      setNoSlug(true)
      setKioskLoading(false)
      return
    }

    setKioskLoading(true)
    supabaseKiosk
      .from('sites')
      .select('*')
      .eq('is_active', true)
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setKioskSite(data as Site | null)
        setKioskLoading(false)
      })
  }, [isAuthenticated])

  if (isAuthenticated) {
    return { site: auth.currentSite, loading: auth.loading, error: null, noSlug: false }
  }

  return { site: kioskSite, loading: kioskLoading, error, noSlug }
}
