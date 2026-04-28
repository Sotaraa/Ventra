# Ventra — Build Roadmap

> Platform: Vercel + Supabase + Microsoft Graph  
> Primary device: iPad (kiosk + reception)  
> Context: UK School / Education SaaS (multi-tenant)

---

## Phase 1 — Foundation ✅
**Target:** Core scaffold, auth, database, basic routing

- [x] Project scaffold (Vite + React + TypeScript + Tailwind)
- [x] Supabase client setup (anon + authenticated)
- [x] MSAL.js config + Microsoft Graph client helpers
- [x] TypeScript types for all data models
- [x] Auth context (Supabase OAuth + email/password)
- [x] App context (sidebar state)
- [x] Sidebar navigation (role-aware, grouped)
- [x] TopBar component
- [x] AppShell layout + KioskLayout
- [x] React Router with all routes
- [x] Login page (Microsoft + email/password)
- [x] Full database schema (15+ tables + RLS + triggers)
- [x] Vercel deployment config

---

## Phase 2 — Multi-Tenancy & Security ✅
**Target:** Proper tenant isolation, production-safe data model

- [x] `tenants` table — company/trust level
- [x] `sites` table — school level (one tenant, many sites)
- [x] `site_id` on all data tables
- [x] Row Level Security — `current_user_site_id()` helper
- [x] Anon RLS scoped to active sites only (kiosk safety)
- [x] Authenticated RLS scoped to user's site
- [x] Super admin bypass (`is_super_admin()`)
- [x] Trust admin architecture (`is_trust_admin()`, `current_user_tenant_id()`)
- [x] `sites.slug` column + unique constraint
- [x] `user_profiles.site_id` nullable for trust admins
- [x] First-login race condition fix (await `auth_user_id` update before RLS queries)
- [x] Azure Sync `upsertPerson` scoped to `site_id` (no cross-tenant match)

---

## Phase 3 — Kiosk ✅
**Target:** Working kiosk for all person types, per-school routing

- [x] Kiosk home screen (big touch targets)
- [x] Staff check-in / check-out flows
- [x] Student check-in / check-out flows
- [x] Visitor check-in / check-out flows
- [x] DBS contractor check-in flow
- [x] Kiosk routing by `?site=<slug>` URL param
- [x] Slug persistence across navigation (sessionStorage)
- [x] KioskLayout shows correct school name per tenant
- [x] PersonBrowser scoped by `site_id`
- [x] All kiosk writes include correct `site_id`

---

## Phase 4 — Admin Panel ✅
**Target:** Full admin dashboard, all pages site-scoped

- [x] Admin Dashboard (occupancy, stats) — site scoped
- [x] Reception Dashboard (live visitor list, realtime) — site scoped
- [x] Attendance Dashboard (present / not in) — site scoped
- [x] Attendance Register (teacher view)
- [x] People Management (list, filter, search, Azure Sync)
- [x] Safeguarding page (DBS, watchlist)
- [x] Evacuation page
- [x] Reports page
- [x] Audit Log
- [x] Settings page (site config, Azure Sync, users)
- [x] Visitor Queue

---

## Phase 5 — Azure AD Integration ✅
**Target:** Full Microsoft 365 sync, paginated, reliable

- [x] MSAL popup auth (Graph API credentials)
- [x] `listGroups()` — paginated with `graphFetchAll()`, sorted client-side
- [x] `getGroupMembers()` — paginated, handles 100+ member groups
- [x] Group → PersonGroup mapping UI
- [x] Upsert by `azure_oid` scoped to `site_id`
- [x] Admin consent URL flow documented
- [x] `searchUsers()` for individual user import

---

## Phase 6 — Multi-School (Trust Admin) ✅
**Target:** One login managing multiple schools

- [x] Trust admin model (`site_id = NULL`, `tenant_id` set)
- [x] `resolveSite()` fetches all tenant sites for trust admins
- [x] School switcher in sidebar (shown when `availableSites.length > 1`)
- [x] Selected school persisted to `localStorage`
- [x] All admin pages re-scope when school is switched
- [x] RLS trust admin bypass policies on all tables

---

## Phase 7 — SOTARA Customer Tools ✅
**Target:** Internal tooling so SOTARA never needs raw SQL

- [x] Customers page (super_admin only)
- [x] Onboard New Customer modal (creates tenant + site + admin profile)
- [x] Add School to existing tenant (for trusts)
- [x] "Promote to trust admin" checkbox
- [x] Confirmation screen with copy-ready consent URL, login URL, kiosk URL
- [x] Customer reference list with site count
- [x] Documentation: ARCHITECTURE.md, CUSTOMER_ONBOARDING.md, TRUST_ADMIN_SETUP.md, SECURITY.md

---

## In Progress / Next Up

### User Invite Flow (non-Microsoft customers)
- [ ] "Send Invite" button on customer card — calls Supabase admin invite API
- [ ] Creates `auth.users` entry + sends magic link email
- [ ] Staff receive email, click link, set password, log in

### Microsoft Publisher Verification
- [ ] Enrol SOTARA in Microsoft Partner Center
- [ ] Add verified publisher domain to Azure App Registration
- [ ] Removes "unverified" warning on admin consent screen

### Custom Domain
- [ ] Configure custom domain in Vercel
- [ ] Update all URLs in docs + email templates

---

## Backlog

### Notifications
- [ ] Email notification on visitor check-in (via Microsoft Graph / SendGrid)
- [ ] Teams webhook on visitor check-in
- [ ] DBS expiry alerts (60 / 30 / 7 days before)
- [ ] Unauthorised absence notification to parents

### Attendance
- [ ] Staff QR sign-in (generate QR per person, scan at door)
- [ ] Late arrival auto-flag + late minutes tracking
- [ ] Absence form (set type, reason, dates)
- [ ] Parent notification on unauthorised absence

### Safeguarding
- [ ] DBS record create / edit / view
- [ ] DBS status auto-update (cron job)
- [ ] Single Central Record (SCR) view
- [ ] Watchlist check at visitor check-in (name match alert)

### Visitor Management
- [ ] QR pre-registration (email invite with token)
- [ ] Badge print integration (Dymo / Brother SDK)
- [ ] Returning visitor recognition (email → auto-populate form)
- [ ] Contractor vetting check (require DBS before badge prints)

### Emergency
- [ ] Lockdown mode (Teams/email blast, kiosk shows LOCKDOWN screen)
- [ ] Post-evacuation PDF report

### Reports
- [ ] Report filters (date range, group, type)
- [ ] Scheduled report delivery (weekly email via Graph)
- [ ] XLSX / PDF export

### Kiosk / UX
- [ ] PWA manifest + iPad fullscreen kiosk mode
- [ ] Offline mode (service worker + cache)
- [ ] Multi-language kiosk (EN + others)

### Platform
- [ ] MIS integrations (SIMS, Arbor, Bromcom)
- [ ] Mobile app (React Native) for staff QR sign-in
- [ ] RFID card tap
