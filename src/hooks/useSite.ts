import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Site } from '@/types'

export function useSite() {
  const [site, setSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('sites')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setSite(data as Site)
        setLoading(false)
      })
  }, [])

  return { site, loading, error }
}
