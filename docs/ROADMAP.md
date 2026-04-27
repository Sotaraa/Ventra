# Ventra — Build Roadmap

> Platform: Azure Static Web Apps + Supabase + Microsoft Graph
> Primary device: iPad (kiosk + reception)
> Context: UK School / Education

---

## Phase 1 — Foundation
**Target:** Core scaffold, auth, database, basic routing

- [x] Project scaffold (Vite + React + TypeScript + Tailwind)
- [x] Supabase client setup
- [x] MSAL.js config (placeholder — Azure AD app registration pending)
- [x] Microsoft Graph client helpers
- [x] TypeScript types for all data models
- [x] Auth context (Supabase auth)
- [x] App context (site, sidebar state)
- [x] Sidebar navigation (role-aware)
- [x] TopBar component
- [x] AppShell layout
- [x] KioskLayout (full-screen iPad mode)
- [x] React Router with all routes
- [x] Login page
- [x] Full database schema applied to Supabase (14 tables + RLS + triggers)
- [x] Azure Static Web Apps routing config
- [x] `.env.local` configured
- [ ] Azure AD app registration (waiting on Azure portal setup)
- [ ] Create first admin user in Supabase Auth
- [ ] Seed `sites` table with real school details

---

## Phase 2 — Core Check-In
**Target:** Working visitor kiosk, badge printing, Teams notification

- [x] Kiosk home screen (big touch targets)
- [x] Kiosk check-in flow (4-step: details → type → host → NDA)
- [x] Kiosk checkout (name search → sign out)
- [x] Reception dashboard (live visitor list + Supabase Realtime)
- [x] Visitor queue / log page
- [ ] QR pre-registration (email invite with token)
- [ ] Badge print integration (Dymo / Brother SDK)
- [ ] Teams webhook notification on visitor check-in
- [ ] Email notification via Microsoft Graph
- [ ] Returning visitor recognition (email lookup)
- [ ] Host search from Persons table (live typeahead)
- [ ] Manual sign-in from reception dashboard
- [ ] Watchlist check on visitor name at check-in

---

## Phase 3 — Attendance
**Target:** Full staff + student attendance, absence management

- [x] Attendance dashboard (who's in / not in, live counts)
- [x] Attendance page scaffolds (register view, absence manager)
- [ ] Staff QR sign-in (generate QR per person, scan at door)
- [ ] Student register (class/form group view, teacher marks)
- [ ] Absence codes (sick, authorised, unauthorised, holiday, medical)
- [ ] Late arrival tracking (auto-flag, timestamp)
- [ ] Early departure tracking
- [ ] Absence form (admin raises absence, sets type + reason)
- [ ] Parent notification on unauthorised absence (Graph email)
- [ ] Persistent absence alert (3+ consecutive days)
- [ ] Teacher register view (only their form group)
- [ ] Microsoft Graph sync — pull staff from Azure AD group

---

## Phase 4 — Admin & Reporting
**Target:** Full admin dashboard, export engine, audit log

- [x] Admin dashboard (occupancy, stats, quick actions)
- [x] People management (list, filter by group, search)
- [x] Reports page (report cards + export buttons)
- [x] Settings page (section cards)
- [ ] Audit log (every action recorded to `notifications_log`, viewable)
- [ ] Weekly report generator (CSV + XLSX + PDF)
- [ ] Report filters (date range, group, type)
- [ ] Scheduled report delivery (email via Graph on Friday)
- [ ] Badge template editor (drag-and-drop fields, preview)
- [ ] Site settings form (name, address, logo upload)
- [ ] User management (invite, assign role, deactivate)
- [ ] Multi-site switcher

---

## Phase 5 — Safeguarding & Safety
**Target:** DBS/SCR, watchlist, evacuation, lockdown

- [x] Safeguarding page scaffold
- [ ] DBS record create/edit/view
- [ ] DBS status auto-update (expiring_soon at 60 days, expired at 0)
- [ ] Single Central Record (SCR) view — all staff DBS statuses in one table
- [ ] DBS expiry alerts (email admin at 60/30/7 days)
- [ ] Watchlist management (add, flag, deactivate)
- [ ] Watchlist check at visitor check-in (name match → alert)
- [ ] Evacuation trigger (big red button → generate roll call from current sign-ins)
- [ ] Live evacuation roll call (mobile-friendly, tick off names)
- [ ] Real-time headcount (Supabase Realtime)
- [ ] Post-evacuation report (PDF)
- [ ] Lockdown mode (Teams/email blast, kiosk shows LOCKDOWN screen)
- [ ] Contractor vetting check (require DBS/induction before badge prints)

---

## Phase 6 — Polish & Go Live
**Target:** Production-ready, tested, deployed

- [ ] Dark mode (Tailwind `dark:` classes)
- [ ] Offline mode (service worker + cache for kiosk)
- [ ] iPad kiosk mode (fullscreen lock via PWA manifest)
- [ ] PWA manifest + icons
- [ ] Parking code on badge
- [ ] Wi-Fi QR code on badge
- [ ] Multi-language kiosk (EN / others as needed)
- [ ] Returning visitor pre-fill (email → auto-populate form)
- [ ] Estimated arrival time (host sets, dashboard shows countdown)
- [ ] Performance audit (Lighthouse ≥ 90)
- [ ] Security audit (RLS review, auth checks)
- [ ] UAT with reception and admin staff
- [ ] Final Azure Static Web Apps deployment
- [ ] DNS + custom domain
- [ ] Documentation for staff

---

## Deferred / Future
- Mobile app (React Native) for staff sign-in
- Visitor photo capture (iPad camera API)
- RFID card tap for staff sign-in
- API integrations with MIS (SIMS, Arbor, Bromcom)
- Biometric sign-in options
