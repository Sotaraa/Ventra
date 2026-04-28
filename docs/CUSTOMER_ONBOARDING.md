# Ventra — New Customer Onboarding Guide

How to onboard a new school or trust onto the Ventra platform.
Each customer is an isolated **tenant** with one or more **sites** (schools).

---

## Overview

| Step | Who does it | Time |
|---|---|---|
| 1. Create tenant + site in Supabase | SOTARA | 2 min |
| 2. Create IT admin profile | SOTARA | 1 min |
| 3. Send consent link (Microsoft 365 customers) | Customer IT Admin | 2 min |
| 4. Send login details to IT admin | SOTARA | 1 min |

---

## Step 1 — Create the Tenant and Site in Supabase

Go to **Supabase → SQL Editor** and run:

```sql
-- 1. Create the tenant
insert into public.tenants (id, name, slug, subscription_tier, is_active)
values (
  gen_random_uuid(),
  'School Name Here',       -- e.g. 'Kew House School'
  'school-slug-here',       -- e.g. 'kew-house'  (lowercase, hyphens only)
  'starter',
  true
);

-- 2. Create the site (copy the tenant id from the row above)
insert into public.sites (id, tenant_id, name, address, slug, timezone, is_active)
values (
  gen_random_uuid(),
  '<paste-tenant-id-here>',
  'School Name Here',
  'United Kingdom',
  'school-slug-here',       -- same slug as tenant
  'Europe/London',
  true
);
```

> **Slug rules:** lowercase letters and hyphens only. Must be unique across all sites.
> This becomes the kiosk URL: `https://my-project3-seven.vercel.app/kiosk?site=<slug>`

---

## Step 2 — Create the IT Admin Profile

```sql
insert into public.user_profiles (site_id, tenant_id, email, full_name, role, is_active)
values (
  '<paste-site-id-here>',
  '<paste-tenant-id-here>',
  'itadmin@theirdomain.com',   -- must exactly match their Microsoft 365 email (lowercase)
  'Their Full Name',
  'site_admin',
  true
);
```

> Leave `id`, `auth_user_id`, and `created_at` blank — they fill in automatically.
> `auth_user_id` links on the customer's first login.

---

## Step 3 — Microsoft 365 Consent (if they use M365)

Send their **Global Administrator** this URL. They click it once and accept.

```
https://login.microsoftonline.com/common/adminconsent?client_id=94f84d52-8f71-4339-a6da-625c827e0e40
```

This grants Ventra permission to authenticate their staff via Microsoft.

**If they don't use Microsoft 365:** skip this step. Invite them via
Supabase → Authentication → Users → Invite user (email/password login).

---

## Step 4 — Send Login Instructions to IT Admin

**Subject: Your Ventra account is ready**

> Hi [Name],
>
> Your Ventra admin account is set up for [School Name]. Here's how to get started:
>
> **Admin panel login:**
> 1. Go to: https://my-project3-seven.vercel.app/login
> 2. Click **Continue with Microsoft**
> 3. Sign in with `[their email]`
>
> **Kiosk URL** (bookmark this on your reception tablet):
> ```
> https://my-project3-seven.vercel.app/kiosk?site=[their-slug]
> ```
>
> From the admin panel you can:
> - Sync staff from your Microsoft 365 directory (People → Sync Azure AD)
> - Add students and contractors manually (People → Add Person)
> - Configure visitor check-in settings (Settings)
>
> Let me know if you need anything.

---

## Optional — Tighten Microsoft Login (Recommended)

After the customer accepts the consent URL, advise their IT admin to:

1. Go to **Entra admin centre** → **Enterprise applications** → **Sotara - Ventra VMS**
2. **Properties** → set **Assignment required** to **Yes** → Save
3. **Users and groups** → **Add user/group** → assign only the staff who need admin access

This prevents anyone else in their Microsoft tenant from authenticating with Ventra.

---

## Slug Reference

| School | Slug | Kiosk URL |
|---|---|---|
| SOTARA (internal test) | `my-school` | `/kiosk?site=my-school` |
| Kew House School | `kew-house` | `/kiosk?site=kew-house` |

Add new rows here whenever a new school is onboarded.

---

## Checklist

- [ ] Tenant row created in Supabase
- [ ] Site row created with correct `slug`
- [ ] IT admin `user_profiles` row created (email exact match, lowercase)
- [ ] Consent URL sent and accepted (M365 customers)
- [ ] Login instructions sent to IT admin
- [ ] IT admin confirmed they can log in
- [ ] Slug reference table above updated
