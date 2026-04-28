# Ventra — Customer Onboarding Guide

> No SQL required. Everything is done through the Ventra admin panel.  
> Only SOTARA `super_admin` accounts can access the Customers page.

---

## Overview

| Step | Who | Time |
|---|---|---|
| 1. Create customer in Ventra | SOTARA | 2 min |
| 2. Customer IT admin accepts Microsoft consent | Customer IT admin | 2 min |
| 3. IT admin logs in and syncs their staff | Customer IT admin | 5 min |
| 4. Set up kiosk tablet | Customer IT admin | 2 min |

---

## Step 1 — Create the Customer

1. Log into Ventra as a `super_admin`
2. Go to **Customers** in the sidebar (bottom, under "Sotara")
3. Click **Onboard New Customer**
4. Fill in the form:

| Field | Example | Notes |
|---|---|---|
| Company / Trust Name | `Gardener Schools Group` | The organisation that signed — could be a trust or the school itself |
| School Name | `Kew House School` | The first school being onboarded |
| Site Slug | `kew-house` | Auto-generated. This becomes the kiosk URL identifier |
| Admin Full Name | `John Vasquez` | The IT admin who will manage the system |
| Admin Work Email | `john.vasquez@gardenerschools.com` | Must exactly match their Microsoft 365 email (case-insensitive) |
| Uses Microsoft 365 | ✅ | Tick for M365 tenants — shows consent URL in confirmation |
| Subscription Tier | `Starter` | Starter / Growth / Enterprise |

5. Click **Create Customer**

The confirmation screen shows three copy buttons — keep this open.

---

## Step 2 — Microsoft 365 Consent (M365 customers only)

The IT admin's **Global Administrator** must accept the consent URL once.
This grants Ventra permission to read Azure AD groups and authenticate staff.

Send them the **Consent URL** shown on the confirmation screen:
```
https://login.microsoftonline.com/common/adminconsent?client_id=<your-client-id>
```

They open it, log in as a Global Admin, and click **Accept**.  
This takes about 2 minutes and only needs to be done once per Microsoft tenant.

> **Non-M365 customers:** Skip this step. Instead, go to Supabase → Authentication →
> Users → **Invite user** with their email. They'll receive a magic link to set a password.
> Email/password login works at `/login`.

---

## Step 3 — IT Admin First Login

Send the IT admin:

**Subject: Your Ventra account is ready — [School Name]**

> Hi [Name],
>
> Your Ventra admin account is set up for [School Name]. Here's how to access it:
>
> **Admin login:**
> → [your-domain.com]/login
> → Click **Continue with Microsoft** and sign in with `[their email]`
>
> **Kiosk URL** (bookmark this on your reception tablet):
> → [your-domain.com]/kiosk?site=[their-slug]
>
> Once logged in, go to **Settings → Azure Sync** to import your staff and students
> from your Microsoft 365 directory.
>
> Let me know if you need anything.

---

## Step 4 — Azure Sync (M365 customers)

The IT admin does this themselves after logging in:

1. Go to **Settings → Azure AD Sync**
2. Click **Load Groups** — lists all their Azure AD groups
3. Map each group to a Ventra role:
   - `Teaching Staff` → Teaching Staff
   - `Students` → Students
   - etc.
4. Click **Sync Now**

Staff and students are imported automatically. Sync can be re-run any time.

---

## Step 5 — Kiosk Setup

1. Open an iPad / tablet browser
2. Navigate to `[your-domain.com]/kiosk?site=[their-slug]`
3. Bookmark it or set as homepage

The slug persists across navigation, so the school name always shows correctly.

---

## Adding More Schools to an Existing Customer

If a customer is a **trust** (e.g. Gardener Schools Group managing Kew House + RPPS):

1. Go to **Customers** → find their tenant card
2. Click **Add School** (button on the right of the card)
3. Fill in the new school's name and slug
4. Optionally add a school-specific admin
5. Tick **"Promote existing admins to trust admin"** if the same IT admin manages all schools
   — this gives them a school switcher dropdown in their sidebar

Each school gets its own kiosk URL, its own Azure Sync config, and its own
isolated data. The IT admin switches between schools in the sidebar.

See `TRUST_ADMIN_SETUP.md` for more detail.

---

## Recommending Tighter Microsoft Security (Optional)

After consent is accepted, advise the IT admin to restrict who can log into Ventra:

1. Go to **Entra Admin Centre** → **Enterprise Applications** → **Sotara - Ventra VMS**
2. **Properties** → set **Assignment required** to **Yes** → Save
3. **Users and groups** → Add only the staff who should have admin access

This prevents any Microsoft 365 user in their organisation from authenticating.

---

## Active Customer Reference

| Customer | Tenant | Schools | Tier | Notes |
|---|---|---|---|---|
| SOTARA (internal) | sotara | my-school | internal | Test/demo environment |
| Gardener Schools Group | gsg | kew-house | starter | First paying customer. IT: John Vasquez |

> Update this table after every onboarding.

---

## Onboarding Checklist

- [ ] Customer created via Customers page (tenant + site + admin profile)
- [ ] Consent URL sent and accepted (M365 customers only)
- [ ] Login URL + kiosk URL sent to IT admin
- [ ] IT admin confirmed successful login
- [ ] Azure Sync completed (staff + students imported)
- [ ] Kiosk URL bookmarked on reception tablet
- [ ] Customer reference table above updated
