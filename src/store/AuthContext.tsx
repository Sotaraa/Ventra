import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
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
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string, userEmail?: string | null) {
    // 1. Try exact ID match — covers returning users whose profile is already claimed
    const { data: byId } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (byId) {
      // Update last_login silently (fire-and-forget, no await)
      supabase.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('id', userId)
      setProfile(byId)
      setLoading(false)
      return
    }

    // 2. Not found by ID — check if an admin pre-created a profile for this email
    const email = userEmail?.toLowerCase()
    if (!email) {
      setProfile(null)
      setLoading(false)
      return
    }

    const { data: byEmail } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (byEmail) {
      // Stamp last_login; we intentionally leave the profile id as-is
      // (the random UUID from pre-creation). This avoids a risky PK update.
      supabase.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('email', email)
      setProfile(byEmail)
    } else {
      setProfile(null)
    }

    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
