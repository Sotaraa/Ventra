import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Site, UserProfile } from '@/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  currentSite: Site | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
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
      await fetchSite(byAuthId.site_id)
      setLoading(false)
      return
    }

    // 2. First login — find a pre-created profile by email and claim it
    const email = userEmail?.toLowerCase()
    if (!email) {
      setProfile(null)
      setCurrentSite(null)
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
      // committed before fetchSite queries the sites table.
      await supabase.from('user_profiles')
        .update({ auth_user_id: userId, last_login: now })
        .eq('email', email)
      setProfile(byEmail)
      await fetchSite(byEmail.site_id)
    } else {
      setProfile(null)
      setCurrentSite(null)
    }

    setLoading(false)
  }

  async function fetchSite(siteId: string) {
    const { data } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .maybeSingle()
    setCurrentSite(data ?? null)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, currentSite, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
