# Ventra — Trust Admin & Multi-School Setup

A **trust** is an organisation that manages multiple schools under one company.
Example: Gardener Schools Group (GSG) operates Kew House School and RPPS.

---

## The Model

```
Tenant: Gardener Schools Group (GSG)
  ├── Site: Kew House School    slug: kew-house    kiosk: /kiosk?site=kew-house
  └── Site: RPPS                slug: rpps         kiosk: /kiosk?site=rpps
```

- **One Microsoft 365 tenant** — same IT admin, same Azure AD, same consent URL (accepted once)
- **Different school domains** — `@kewhouseschool.com`, `@rpps.co.uk` — both work fine
- **Isolated data** — each school's students, staff, visitors, and attendance are completely separate
- **One login** — the trust IT admin logs in once and sees a school switcher in the sidebar

---

## Onboarding a Trust's First School

Follow the standard onboarding process in `CUSTOMER_ONBOARDING.md`.
Use the **company/trust name** for the tenant (e.g. `Gardener Schools Group`)
and the **school name** for the first site (e.g. `Kew House School`).

---

## Adding a Second School to an Existing Trust

1. Log in as `super_admin`
2. Go to **Customers** → find the trust's card (e.g. Gardener Schools Group)
3. Click **Add School** on the right
4. Fill in:
   - **School Name**: e.g. `RPPS`
   - **Site Slug**: e.g. `rpps` (auto-generated, editable)
   - **School Admin** (optional): leave blank if the trust IT admin manages all schools
5. Tick **"Promote existing admins to trust admin"**
   — this sets `site_id = NULL` on all existing site admins in this tenant,
   giving them access to all schools + the sidebar switcher
6. Click **Add School**
7. Send the new kiosk URL to the school: `[domain]/kiosk?site=rpps`

The trust IT admin will see the school switcher on their next page load (or after logout/login).

---

## How the School Switcher Works

When a trust admin logs in:
- Ventra detects `site_id = NULL` on their profile
- Fetches all active sites for their `tenant_id`
- Shows a dropdown at the top of the sidebar
- Their last selected school is remembered in `localStorage`

Switching schools:
- Instantly scopes the entire admin panel (Dashboard, People, Attendance, etc.) to the selected school
- The admin sees only that school's data — no cross-contamination
- Each school has its own Azure Sync configuration

---

## Azure Sync Per School

Each school syncs independently:

1. Trust admin switches to the school in the sidebar
2. Goes to **Settings → Azure AD Sync**
3. Loads groups — shows all groups from the shared Azure AD tenant
4. Maps the groups relevant to **this school** (e.g. `RPPS-Students`, `RPPS-Staff`)
5. Runs sync — imports only those members, scoped to the RPPS site

Kew House has its own group mappings and its own sync. RPPS has its own.
The same Azure AD group (e.g. `All-Teaching-Staff`) can be mapped at both schools
if appropriate — they'll each get their own copy of the person records under their site.

---

## Trust Admin vs Site Admin

| | Site Admin | Trust Admin |
|---|---|---|
| `user_profiles.site_id` | Set to a specific site | `NULL` |
| `user_profiles.tenant_id` | Set | Set |
| Sees school switcher | No | Yes |
| Data access | One school only | All schools in their tenant |
| Role label in sidebar | `site admin` | `trust admin` |

---

## Promoting an Existing Admin to Trust Admin

If a site admin needs to become a trust admin (e.g. after adding a second school
but forgetting to tick the "promote" checkbox):

**Option 1 — Re-run Add School** and tick the checkbox.

**Option 2 — Supabase SQL Editor:**
```sql
UPDATE public.user_profiles
SET site_id = NULL
WHERE email = 'itadmin@gardenerschools.com'
  AND tenant_id = '<gsg-tenant-id>';
```

The change takes effect on their next login.

---

## Creating a School-Specific Admin

If a school within a trust has its own dedicated admin (not the trust IT admin):

1. **Add School** → fill in the optional admin name + email
   — creates a new `user_profiles` row with `site_id = <that school's id>`
2. Or go to Supabase and insert manually (see SQL below)
3. The school admin logs in with their own email → sees only their school

```sql
INSERT INTO public.user_profiles (site_id, tenant_id, email, full_name, role, is_active)
VALUES (
  '<rpps-site-id>',
  '<gsg-tenant-id>',
  'principal@rpps.co.uk',
  'Jane Smith',
  'site_admin',
  true
);
```

---

## Current Trusts

| Trust | Tenant ID | Schools |
|---|---|---|
| Gardener Schools Group | (see Supabase) | Kew House School (`kew-house`), RPPS (`rpps` — pending) |

> Update this table as schools are added.
