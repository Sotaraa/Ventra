# Ventra — System Architecture

> Last updated: April 2026  
> Stack: React + Vite + TypeScript · Supabase (Postgres + Auth + Realtime) · Microsoft Graph API · Vercel

---

## High-Level Overview

```
Browser (Admin / Reception)          Browser (Kiosk — iPad)
        │                                      │
        │ Supabase Auth (OAuth / password)      │ Supabase anon key
        ▼                                      ▼
   ┌──────────────────────────────────────────────┐
   │            Supabase (eu-central-1)           │
   │  PostgreSQL · Auth · Realtime · Storage      │
   └──────────────────────────────────────────────┘
        │
        │ Microsoft Graph API (MSAL popup)
        ▼
   Azure AD / Entra ID  (Azure Sync, staff import)
```

---

## Multi-Tenancy Model

```
tenants           ← the company / trust that signed up (e.g. Gardener Schools Group)
  └── sites       ← each physical school (e.g. Kew House School, RPPS)
        └── persons, attendance_records, visit_logs, visitors,
            watchlist_entries, dbs_records, evacuation_events,
            badge_templates, report_schedules, user_profiles, audit_log
```

Every data table has a `site_id` column. All data is fully isolated at the
database level via Row Level Security — no application-level tenant filtering
is relied upon alone.

### Key IDs

| Column | Where | Purpose |
|---|---|---|
| `tenant_id` | tenants, sites, user_profiles | Groups schools under one company |
| `site_id` | all data tables | Isolates data to one school |
| `auth_user_id` | user_profiles | Links a Supabase auth user to their profile |
| `azure_oid` | persons, user_profiles | Azure AD object ID for sync matching |

---

## Row Level Security (RLS) Strategy

Three tiers of access, enforced entirely in Postgres:

### 1. Anonymous (Kiosk)

The kiosk uses the Supabase **anon** key. Anon users can:
- `SELECT` on `sites` where `is_active = true` (slug lookup)
- `SELECT / INSERT / UPDATE` on `persons`, `attendance_records`, `visit_logs`,
  `visitors`, `evacuation_events`, `evacuation_roll_calls`, `watchlist_entries`, `audit_log`
  — **only for records whose `site_id` belongs to an active site**

Key helper function:
```sql
-- Blocks any cross-tenant write — site_id must be a real active site
site_id IN (SELECT id FROM public.sites WHERE is_active = true)
```

### 2. Authenticated (Admin / Reception / Teacher)

Authenticated users have two sub-tiers:

**Site admin** (`site_id` set in user_profiles):
```sql
-- Only sees / writes records for their own site
site_id = current_user_site_id()
```

**Trust admin** (`site_id = NULL`, `tenant_id` set):
```sql
-- Sees / writes records for ALL sites in their tenant
site_id = current_user_site_id()
OR (
  is_trust_admin()
  AND site_id IN (SELECT id FROM sites WHERE tenant_id = current_user_tenant_id())
)
```

Helper functions (all `SECURITY DEFINER`, in `public` schema):
```sql
current_user_site_id()    -- returns user_profiles.site_id for auth.uid()
current_user_tenant_id()  -- returns user_profiles.tenant_id for auth.uid()
is_trust_admin()          -- true if site_id IS NULL AND tenant_id IS NOT NULL
is_super_admin()          -- true if role = 'super_admin'
```

### 3. Super Admin (SOTARA internal)

`is_super_admin()` bypasses all site/tenant scoping. SOTARA staff use this
role to access the Customers page and manage all tenants.

---

## Authentication Flow

```
User visits /login
    │
    ├── Microsoft 365 login (primary)
    │     supabase.auth.signInWithOAuth({ provider: 'azure' })
    │     → OAuth redirect → Supabase creates/updates auth.users
    │     → Root redirect catches the callback → /admin
    │
    └── Email/password (fallback, non-M365 customers)
          supabase.auth.signInWithPassword()

AuthContext.fetchProfile(userId, email):
    │
    ├── Path 1: Returning user
    │     SELECT FROM user_profiles WHERE auth_user_id = userId
    │     → found → resolveSite(profile)
    │
    └── Path 2: First login
          SELECT FROM user_profiles WHERE email = userEmail
          → found → AWAIT UPDATE { auth_user_id, last_login }
                     (must await — RLS helpers read auth_user_id)
          → resolveSite(profile)

resolveSite(profile):
    ├── profile.site_id set   → fetch that one site → setCurrentSite
    └── profile.site_id NULL  → fetch all sites for tenant_id
                                 → restore localStorage selection
                                 → setAvailableSites + setCurrentSite
```

---

## Kiosk Routing

Each school gets a unique kiosk URL via the `?site=<slug>` query parameter.

```
https://app.ventra.co.uk/kiosk?site=kew-house
https://app.ventra.co.uk/kiosk?site=rpps
```

**Slug persistence across navigation** (React Router drops query params):
```ts
// useSite hook — kiosk path
const SESSION_KEY = 'ventra:kiosk:slug'
const urlSlug = new URLSearchParams(window.location.search).get('site')
if (urlSlug) sessionStorage.setItem(SESSION_KEY, urlSlug)  // save on entry
const slug = urlSlug ?? sessionStorage.getItem(SESSION_KEY) // read on deeper pages
```

The kiosk uses `supabaseKiosk` (anon key) for all queries, never the
authenticated client.

---

## Trust Admin (Multi-School)

A trust admin manages multiple schools under one login.

```
user_profiles row:
  site_id   = NULL           ← not tied to one school
  tenant_id = <gsg-uuid>     ← scoped to Gardener Schools Group
  role      = 'site_admin'
```

In the sidebar, trust admins see a **school switcher** dropdown (only shown
when `availableSites.length > 1`). The selected site is persisted to
`localStorage` keyed by `tenant_id`.

All admin data queries use `currentSite.id` from `AuthContext`, so switching
schools immediately scopes the entire admin panel to the new school.

---

## Key Frontend Patterns

### `useSite()` hook

Single source of truth for "which site am I operating on":

```ts
// Admin path: reads currentSite from AuthContext (no DB call)
// Kiosk path: reads slug from URL param or sessionStorage → DB lookup
const { site, loading } = useSite()
```

Every admin page and kiosk flow uses this hook. Any query missing
`.eq('site_id', site.id)` is a bug.

### `AuthContext` exports

```ts
user          // Supabase auth user
profile       // user_profiles row
currentSite   // currently active Site object
availableSites // all sites for trust admins (length > 1 = show switcher)
switchSite    // (site: Site) => void — updates currentSite + localStorage
loading       // true while profile/site are being fetched
signOut
```

### Supabase clients

| Client | Key | Used by |
|---|---|---|
| `supabase` | `VITE_SUPABASE_ANON_KEY` | Admin panel (authenticated requests) |
| `supabaseKiosk` | same anon key | Kiosk flows (explicit anon context) |

Both use the same key — the separation is conceptual, ensuring kiosk code
never accidentally uses an authenticated session.

---

## Azure AD Integration

- **Auth**: Supabase OAuth (`provider: 'azure'`) — minimal permissions (User.Read)
- **Graph API sync**: MSAL.js popup — requires admin consent for Group.Read.All + User.Read.All
- **Consent URL**: `https://login.microsoftonline.com/common/adminconsent?client_id=<VITE_AZURE_CLIENT_ID>`
- **Pagination**: `graphFetchAll()` follows `@odata.nextLink` automatically — handles tenants with 100+ groups

Azure Sync maps AD groups → Ventra `PersonGroup` (teaching_staff, student, etc.)
and upserts by `azure_oid`, scoped to `site_id` to prevent cross-tenant matches.

---

## Environment Variables

```env
VITE_SUPABASE_URL=          # Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Supabase anon/public key
VITE_AZURE_CLIENT_ID=       # Azure App Registration client ID
```

---

## Database Migrations Applied (in order)

| Migration | What it does |
|---|---|
| `add_tenants_multitenancy` | tenants table, tenant_id on sites/user_profiles |
| `rls_site_scoped_helper` | `current_user_site_id()`, authenticated RLS policies |
| `fix_sites_rls_and_anon_kiosk` | anon read on sites, drop unscoped policy |
| `add_sites_ad_sync_config` | `sites.ad_sync_config jsonb` column |
| `add_sites_slug` | `sites.slug`, unique constraint, seed values |
| `super_admin_rls_and_tenants_policies` | `is_super_admin()`, tenants RLS |
| `tighten_anon_rls_site_scoped` | All anon policies scoped to active sites |
| `trust_admin_architecture` | `site_id` nullable, `is_trust_admin()`, `current_user_tenant_id()`, trust RLS bypass |
