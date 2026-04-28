import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Site, UserProfile } from '@/types'

// localStorage key for trust admin's last selected site, keyed by tenant id
const trustSiteKey = (tenantId: string) => `ventra:trust:${tenantId}:site`

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  currentSite: Site | null
  availableSites: Site[]          // >1 entry = trust admin with a school switcher
  loading: boolean
  signOut: () => Promise<void>
  switchSite: (site: Site) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
  const [availableSites, setAvailableSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user.email)
      else {
        setProfile(null)
        setCurrentSite(null)
        setAvailableSites([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string, userEmail?: string | null) {
    const now = new Date().toISOString()

    // 1. Returning user — already linked to auth.users via auth_user_id
    const { data: byAuthId } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (byAuthId) {
      supabase.from('user_profiles').update({ last_login: now }).eq('auth_user_id', userId)
      setProfile(byAuthId)
      await resolveSite(byAuthId)
      setLoading(false)
      return
    }

    // 2. First login — find a pre-created profile by email and claim it
    const email = userEmail?.toLowerCase()
    if (!email) {
      setProfile(null)
      setCurrentSite(null)
      setAvailableSites([])
      setLoading(false)
      return
    }

    const { data: byEmail } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (byEmail) {
      // Await this — current_user_site_id() RLS helper needs auth_user_id
      // committed before resolveSite queries the sites table.
      await supabase.from('user_profiles')
        .update({ auth_user_id: userId, last_login: now })
        .eq('email', email)
      setProfile(byEmail)
      await resolveSite(byEmail)
    } else {
      setProfile(null)
      setCurrentSite(null)
      setAvailableSites([])
    }

    setLoading(false)
  }

  // Resolves which site(s) to load for this profile:
  // - Regular site admin  → fetch their single site
  // - Trust admin (site_id = null, tenant_id set) → fetch all tenant sites, restore last selection
  async function resolveSite(p: UserProfile) {
    if (p.site_id) {
      // Standard single-site user
      const { data } = await supabase
        .from('sites')
        .select('*')
        .eq('id', p.site_id)
        .maybeSingle()
      setCurrentSite(data ?? null)
      setAvailableSites(data ? [data] : [])
      return
    }

    if (p.tenant_id) {
      // Trust admin — load all active sites for this tenant
      const { data } = await supabase
        .from('sites')
        .select('*')
        .eq('tenant_id', p.tenant_id)
        .eq('is_active', true)
        .order('name')
      const sites = (data as Site[]) ?? []
      setAvailableSites(sites)

      // Restore the last school they were managing
      const savedId = localStorage.getItem(trustSiteKey(p.tenant_id))
      const saved   = sites.find(s => s.id === savedId)
      setCurrentSite(saved ?? sites[0] ?? null)
      return
    }

    setCurrentSite(null)
    setAvailableSites([])
  }

  function switchSite(site: Site) {
    setCurrentSite(site)
    if (profile?.tenant_id && !profile?.site_id) {
      localStorage.setItem(trustSiteKey(profile.tenant_id), site.id)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      currentSite, availableSites,
      loading, signOut, switchSite,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
