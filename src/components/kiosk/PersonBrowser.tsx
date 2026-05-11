import { useEffect, useState, useMemo } from 'react'
import { supabaseKiosk as supabase } from '@/lib/supabase'
import { Search, ChevronLeft } from 'lucide-react'
import type { Person, PersonGroup } from '@/types'

interface PersonBrowserProps {
  siteId: string
  groups: PersonGroup[]
  title: string
  subtitle?: string
  onSelect: (person: Person) => void
  onBack: () => void
  onlySignedIn?: boolean
}

const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']

export default function PersonBrowser({ siteId, groups, title, subtitle, onSelect, onBack, onlySignedIn }: PersonBrowserProps) {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      if (onlySignedIn) {
        const today = new Date().toISOString().slice(0, 10)
        const { data: records } = await supabase
          .from('attendance_records')
          .select('person_id')
          .eq('site_id', siteId)
          .eq('date', today)
          .eq('status', 'present')
          .is('signed_out_at', null)

        const ids = records?.map(r => r.person_id) ?? []

        if (ids.length === 0) {
          setPersons([])
          setLoading(false)
          return
        }

        const { data } = await supabase
          .from('persons')
          .select('*')
          .eq('site_id', siteId)
          .in('id', ids)
          .in('group', groups)
          .eq('is_active', true)
          .order('last_name')

        setPersons((data as Person[]) ?? [])
      } else {
        const { data } = await supabase
          .from('persons')
          .select('*')
          .eq('site_id', siteId)
          .in('group', groups)
          .eq('is_active', true)
          .order('last_name')
        setPersons((data as Person[]) ?? [])
      }

      setLoading(false)
    }
    if (siteId) load()
  }, [siteId, groups.join(','), onlySignedIn])

  // Which letters actually have people — so we can dim the empty ones
  const availableLetters = useMemo(() => {
    const set = new Set<string>()
    persons.forEach(p => {
      const ch = (p.first_name || p.full_name || '').charAt(0).toUpperCase()
      if (ch) set.add(ch)
    })
    return set
  }, [persons])

  // Search results (shown inline when typing, overrides letter step)
  const searchResults = useMemo(() => {
    if (!search) return []
    return persons.filter(p =>
      p.full_name.toLowerCase().includes(search.toLowerCase())
    )
  }, [search, persons])

  // People for the selected letter
  const letterResults = useMemo(() => {
    if (!selectedLetter) return []
    return persons.filter(p =>
      (p.first_name || p.full_name || '').toUpperCase().startsWith(selectedLetter)
    )
  }, [selectedLetter, persons])

  // ── Step 2: person card grid (after letter tap) ──────────────────────────────
  if (selectedLetter && !search) {
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedLetter(null)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-brand-200 text-sm">
              Names starting with <span className="font-bold text-white">{selectedLetter}</span>
              {' '}· {letterResults.length} {letterResults.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>

        {/* 2-column card grid */}
        {letterResults.length === 0 ? (
          <div className="bg-white rounded-2xl text-center py-12 text-gray-400">
            <p className="font-medium">Nobody found for &ldquo;{selectedLetter}&rdquo;</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {letterResults.map(person => (
              <PersonCard key={person.id} person={person} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Step 1: letter picker (+ search bar) ─────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-brand-200 text-sm">{subtitle}</p>}
        </div>
      </div>

      {/* Search — escape hatch for quick lookup */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
          placeholder="Or search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Search results (inline, when typing) */}
      {search ? (
        <div className="bg-white rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="font-medium">No results for &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {searchResults.map(person => (
                <li key={person.id}>
                  <button
                    onClick={() => onSelect(person)}
                    className="w-full text-left px-5 py-4 hover:bg-brand-50 active:bg-brand-100 transition-colors flex items-center gap-4 min-h-[64px]"
                  >
                    <Avatar person={person} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-base">{person.full_name}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {person.year_group ?? person.department ?? person.form_group ?? ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : loading ? (
        /* Loading state */
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : persons.length === 0 && onlySignedIn ? (
        <div className="bg-white rounded-2xl text-center py-12 text-gray-400 px-4">
          <p className="font-medium">Nobody is currently signed in</p>
          <p className="text-sm mt-1">You need to sign in before you can sign out</p>
        </div>
      ) : (
        /* Big letter grid */
        <>
          <p className="text-white/40 text-xs text-center tracking-wide uppercase">Tap your first name initial</p>
          <div className="grid grid-cols-6 gap-2">
            {LETTERS.map(letter => {
              const hasPersons = availableLetters.has(letter)
              return (
                <button
                  key={letter}
                  disabled={!hasPersons}
                  onClick={() => setSelectedLetter(letter)}
                  className={`
                    aspect-square rounded-2xl flex items-center justify-center
                    text-2xl font-bold transition-all
                    ${hasPersons
                      ? 'bg-white/15 text-white hover:bg-white hover:text-brand-600 active:scale-95 shadow-sm'
                      : 'bg-white/[0.04] text-white/15 cursor-not-allowed'
                    }
                  `}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Person card (step 2 grid) ────────────────────────────────────────────────

function PersonCard({ person, onSelect }: { person: Person; onSelect: (p: Person) => void }) {
  const sub = person.year_group ?? person.department ?? person.form_group ?? ''
  return (
    <button
      onClick={() => onSelect(person)}
      className="bg-white rounded-2xl px-4 py-5 flex flex-col items-center gap-3 hover:bg-brand-50 active:bg-brand-100 transition-colors shadow-sm text-center"
    >
      <Avatar person={person} size="lg" />
      <div className="min-w-0 w-full">
        <p className="font-bold text-gray-900 text-base leading-tight truncate">{person.full_name}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </button>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ person, size }: { person: Person; size: 'sm' | 'lg' }) {
  const initials = `${person.first_name?.[0] ?? person.full_name?.[0] ?? '?'}${person.last_name?.[0] ?? ''}`
  return (
    <div className={`rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold flex-shrink-0
      ${size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'}`}>
      {initials}
    </div>
  )
}
