# Ventra — Build Session Log

> Each session records what was built, decisions made, and what's next.
> Tick boxes as items are completed within a session.

---

## Session 001 — 2026-03-28
**Phase:** 1 (Foundation) + 2 (Core Check-In scaffold)
**Duration:** ~1 session

### Completed
- [x] Full project brainstorm — feature set defined (VMS + Attendance + Safeguarding)
- [x] Tech stack confirmed: Vite + React 18 + TypeScript + Tailwind + Supabase + MSAL
- [x] Supabase project connected: `wspnxcdyspfaaqdzyrjv` (eu-west-2, London)
- [x] GitHub repo created: `https://github.com/GSGAPPDev255/Ventra`
- [x] `package.json` — all dependencies defined
- [x] `vite.config.ts` — with path alias `@/`
- [x] `tsconfig.json` + `tsconfig.node.json`
- [x] `tailwind.config.js` — custom brand colours (navy #1e3a5f, amber #f59e0b)
- [x] `postcss.config.js`
- [x] `index.html` — Inter font, mobile meta tags
- [x] `src/index.css` — Tailwind layers + component classes (btn-primary, card, badge, input, etc.)
- [x] `src/types/index.ts` — Full TypeScript interfaces (20+ types)
- [x] `src/lib/supabase.ts` — Supabase client
- [x] `src/lib/msalConfig.ts` — MSAL config with Graph scopes
- [x] `src/lib/graphClient.ts` — Graph API helpers (group members, send email, profile)
- [x] `src/store/AuthContext.tsx` — Auth context + profile fetch
- [x] `src/store/AppContext.tsx` — Site + sidebar state
- [x] `src/components/layout/Sidebar.tsx` — Role-aware nav with 10 items
- [x] `src/components/layout/TopBar.tsx` — Page header with actions slot
- [x] `src/components/layout/AppShell.tsx` — Shell with sidebar + outlet
- [x] `src/components/layout/KioskLayout.tsx` — Full-screen kiosk with live clock
- [x] `src/main.tsx` — Root with all providers
- [x] `src/App.tsx` — Full route tree (kiosk, reception, admin, attendance)
- [x] `src/pages/auth/LoginPage.tsx` — Email/password + kiosk shortcut
- [x] `src/pages/kiosk/KioskHome.tsx` — Touch-optimised landing (Sign In / Sign Out)
- [x] `src/pages/kiosk/KioskCheckin.tsx` — 4-step check-in flow with Supabase write
- [x] `src/pages/kiosk/KioskCheckout.tsx` — Name search + check-out
- [x] `src/pages/reception/ReceptionDashboard.tsx` — Live visitor list + Supabase Realtime
- [x] `src/pages/reception/VisitorQueue.tsx` — Full visitor log with status filter
- [x] `src/pages/admin/AdminDashboard.tsx` — Occupancy counts, stats, quick actions
- [x] `src/pages/admin/PeopleManagement.tsx` — People table with group filter
- [x] `src/pages/admin/SafeguardingPage.tsx` — Scaffold (Phase 5)
- [x] `src/pages/admin/ReportsPage.tsx` — Report cards with export buttons
- [x] `src/pages/admin/AuditLogPage.tsx` — Scaffold (Phase 4)
- [x] `src/pages/admin/SettingsPage.tsx` — Settings section cards
- [x] `src/pages/attendance/AttendanceDashboard.tsx` — Who's in/not in, live counts
- [x] `src/pages/attendance/RegisterView.tsx` — Scaffold (Phase 3)
- [x] `src/pages/attendance/AbsenceManager.tsx` — Scaffold (Phase 4)
- [x] Supabase migration `001_initial_schema` applied — 14 tables, RLS, indexes, triggers
- [x] Default site seeded: "My School"
- [x] `.env.local` configured with Supabase credentials
- [x] `.env.example` created
- [x] `.gitignore` created
- [x] `staticwebapp.config.json` — Azure SPA routing + security headers
- [x] `docs/ROADMAP.md` — Full 6-phase roadmap with checkboxes
- [x] `docs/SESSION_LOG.md` — This file

### Decisions Made
- **Kiosk is public (no auth)** — visitors use `/kiosk` route without login. RLS allows anon INSERT to `visitors` and `visit_logs` only.
- **Staff auth via Supabase** for now. Microsoft SSO wired up but placeholder until Azure AD app is registered.
- **Supabase Realtime** on `visit_logs` table for live reception dashboard updates.
- **Generated column** `full_name` on `persons` and `visitors` — always `first_name || ' ' || last_name`, never stale.
- **RLS broad for now** — all authenticated users can read/write. Will tighten per-role in Phase 4.

### Pending / Next Session
- [ ] Run `npm install` and verify dev server starts on `localhost:3000`
- [ ] Create first admin user in Supabase Auth dashboard
- [ ] Update "My School" site record with real school name + address
- [ ] Register Azure AD app in Entra ID portal → fill in `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID`
- [ ] Push to GitHub repo
- [ ] Set up Azure Static Web Apps deployment from GitHub

---

## Session 002 — TBD
**Phase:** 2 (Core Check-In — QR pre-registration, badge printing, Teams notification)

### Planned
- [ ] QR pre-registration flow (email invite → token → kiosk scan)
- [ ] Host search typeahead (live search against `persons` table)
- [ ] Returning visitor recognition (email lookup pre-fills form)
- [ ] Teams webhook notification on check-in
- [ ] Badge printing (Dymo / Brother browser SDK integration)
- [ ] Manual sign-in from reception dashboard
- [ ] Watchlist name check at kiosk check-in

---
