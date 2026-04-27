import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, ChevronLeft } from 'lucide-react'
import type { Person, PersonGroup } from '@/types'

interface PersonBrowserProps {
  groups: PersonGroup[]
  title: string
  subtitle?: string
  onSelect: (person: Person) => void
  onBack: () => void
  onlySignedIn?: boolean  // if true, only show people with an active sign-in today
}

const ALPHABET = ['ALL', 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']

export default function PersonBrowser({ groups, title, subtitle, onSelect, onBack, onlySignedIn }: PersonBrowserProps) {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [letter, setLetter] = useState('ALL')

  useEffect(() => {
    async function load() {
      setLoading(true)

      if (onlySignedIn) {
        // Step 1: get person IDs currently signed in today
        const today = new Date().toISOString().slice(0, 10)
        const { data: records } = await supabase
          .from('attendance_records')
          .select('person_id')
          .eq('date', today)
          .eq('status', 'present')
          .is('signed_out_at', null)

        const ids = records?.map(r => r.person_id) ?? []

        if (ids.length === 0) {
          setPersons([])
          setLoading(false)
          return
        }

        // Step 2: fetch those persons filtered by the relevant groups
        const { data } = await supabase
          .from('persons')
          .select('*')
          .in('id', ids)
          .in('group', groups)
          .eq('is_active', true)
          .order('last_name')

        setPersons((data as Person[]) ?? [])
      } else {
        const { data } = await supabase
          .from('persons')
          .select('*')
          .in('group', groups)
          .eq('is_active', true)
          .order('last_name')
        setPersons((data as Person[]) ?? [])
      }

      setLoading(false)
    }
    load()
  }, [groups.join(','), onlySignedIn])

  const filtered = persons.filter(p => {
    const matchesSearch = search
      ? p.full_name.toLowerCase().includes(search.toLowerCase())
      : true
    const matchesLetter = letter === 'ALL'
      ? true
      : p.last_name.toUpperCase().startsWith(letter)
    return matchesSearch && matchesLetter
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-brand-200 text-sm">{subtitle}</p>}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
          placeholder="Search by name..."
          value={search}
          onChange={e => { setSearch(e.target.value); setLetter('ALL') }}
          autoFocus
        />
      </div>

      {/* A–Z filter */}
      {!search && (
        <div className="flex flex-wrap gap-1.5">
          {ALPHABET.map(l => (
            <button
              key={l}
              onClick={() => setLetter(l)}
              className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-bold transition-colors ${
                letter === l
                  ? 'bg-white text-brand-600'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 px-4">
            <p className="font-medium">
              {onlySignedIn && !search ? 'Nobody is currently signed in' : 'No results found'}
            </p>
            {onlySignedIn && !search && (
              <p className="text-sm mt-1">You need to sign in before you can sign out</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(person => (
              <li key={person.id}>
                <button
                  onClick={() => onSelect(person)}
                  className="w-full text-left px-5 py-4 hover:bg-brand-50 active:bg-brand-100 transition-colors flex items-center gap-4 min-h-[64px]"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                    {person.first_name[0]}{person.last_name[0]}
                  </div>
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

      <p className="text-center text-brand-300 text-xs">{filtered.length} {filtered.length === 1 ? 'person' : 'people'} shown</p>
    </div>
  )
}
