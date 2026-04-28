# Ventra — Security & RLS Reference

This document covers the Row Level Security (RLS) design, what each
policy protects, and the rationale behind key decisions.

---

## Principles

1. **Database-level enforcement** — RLS policies are the last line of defence.
   Even if a bug in the app code sends a wrong query, Postgres blocks it.

2. **Anon = kiosk only** — The anon key is public (embedded in the frontend).
   Anon users can only read/write to active sites. They cannot read across tenants.

3. **No app-level tenant filter alone** — Every Supabase query in the app also
   includes `.eq('site_id', site.id)`. RLS is a safety net, not the only control.

4. **Least privilege** — Anon has the minimum needed for the kiosk to function.
   Authenticated users see only their site (or their tenant, for trust admins).

---

## RLS Helper Functions

All in `public` schema, `SECURITY DEFINER`:

```sql
current_user_site_id()    -- user_profiles.site_id WHERE auth_user_id = auth.uid()
current_user_tenant_id()  -- user_profiles.tenant_id WHERE auth_user_id = auth.uid()
is_trust_admin()          -- site_id IS NULL AND tenant_id IS NOT NULL AND is_active
is_super_admin()          -- role = 'super_admin' in user_profiles
```

---

## Anonymous (Kiosk) Policies

The kiosk runs entirely on the anon key. Every write policy validates that the
target `site_id` belongs to a real active site.

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `sites` | `is_active = true` | — | — |
| `persons` | active site only | — | — |
| `attendance_records` | active site only | active site only | active site only |
| `visit_logs` | active site only | active site only | active site only |
| `visitors` | active site only | active site only | active site only |
| `audit_log` | — | active site only | — |
| `evacuation_events` | active site only | — | active site only |
| `evacuation_roll_calls` | parent event on active site | parent event on active site | parent event on active site |
| `watchlist_entries` | `is_active = true` AND active site | — | — |
| `storage.objects` (visitor-photos) | public bucket | bucket = visitor-photos | — |

**What anon CANNOT do:**
- Read or write any data for an inactive/deleted site
- Read user_profiles, tenants, dbs_records, report_schedules, or badge_templates
- Delete any records

---

## Authenticated Policies

Two sub-tiers:

### Site Admin (normal user)

```sql
-- All data tables (the *_all policies):
USING (site_id = current_user_site_id())
WITH CHECK (site_id = current_user_site_id())
```

The user sees exactly one school's data. They cannot read or write
another school's records even if they know the site_id.

### Trust Admin (multi-school)

```sql
USING (
  site_id = current_user_site_id()   -- NULL for trust admins (never matches)
  OR (
    is_trust_admin()
    AND site_id IN (SELECT id FROM public.sites WHERE tenant_id = current_user_tenant_id())
  )
)
```

Trust admins can see all schools within their tenant. They cannot see
other tenants' data.

### Super Admin (SOTARA)

```sql
USING (is_super_admin())
WITH CHECK (is_super_admin())
```

Bypasses all site/tenant scoping. Applied to `tenants`, `sites`,
`user_profiles`, and all data tables via separate `*_super_admin_all` policies.

---

## Specific Table Notes

### `user_profiles`
- Site admins see only profiles in their site
- Trust admins see all profiles across their tenant (including other trust admins `site_id IS NULL`)
- Users can always read/update their own profile (`auth_user_id = auth.uid()`)
- Super admin has full access

### `sites`
- Anon: read active sites (needed for kiosk slug lookup)
- Site admin: read + update their own site
- Trust admin: read + update all sites in their tenant
- Super admin: full CRUD

### `tenants`
- Authenticated: read their own tenant only
- Super admin: full CRUD

### `evacuation_roll_calls`
No `site_id` column — scoped via join to `evacuation_events`:
```sql
evacuation_event_id IN (
  SELECT id FROM evacuation_events WHERE site_id IN (active site check)
)
```

---

## Known Intentional Design Decisions

**Why not filter by `tenant_id` everywhere?**  
`site_id` is more granular and is the correct isolation unit. A trust admin
gets `site_id` access to all their schools — the tenant relationship is used
only to enumerate which sites belong to them.

**Why is `sites_anon_read` wide open by slug?**  
The kiosk needs to look up a site by slug (`?site=kew-house`) to get the site ID.
We only expose `id`, `name`, `slug`, `logo_url` — no sensitive data.
The policy is scoped to `is_active = true` so deleted/paused sites aren't accessible.

**Why use `SECURITY DEFINER` on helper functions?**  
RLS policies run as the row owner, not the calling user. Without `SECURITY DEFINER`,
helper functions can't query `user_profiles` to look up the current user's site.

**Why separate `supabase` and `supabaseKiosk` clients?**  
Both use the anon key. The separation ensures kiosk code paths never accidentally
run inside an authenticated session, which could bypass kiosk-specific logic.

---

## Security Checklist for New Features

When adding a new table or query:
- [ ] Add `site_id` column (foreign key to `sites.id`)
- [ ] Add anon policies if the kiosk needs access (scoped to active sites)
- [ ] Add authenticated `*_all` policy with trust admin bypass
- [ ] Add super admin bypass policy
- [ ] In the frontend, always pass `.eq('site_id', site.id)` even though RLS covers it
- [ ] If the table has no `site_id`, scope via a parent table (like `evacuation_roll_calls`)

---

## Azure App Registration Permissions

| Permission | Type | Used for |
|---|---|---|
| `User.Read` | Delegated | Supabase OAuth (sign in) |
| `User.ReadBasic.All` | Delegated | Azure Sync — search users |
| `Group.Read.All` | Delegated | Azure Sync — list and read groups |
| `Mail.Send` | Delegated | Send notification emails via Graph |

All permissions are **delegated** (act on behalf of the signed-in user),
not application permissions. This means the sync runs as the IT admin who
initiated it — not as a background service account.
