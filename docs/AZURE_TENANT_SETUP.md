# Azure / Microsoft 365 Tenant Setup Guide

How to connect a Microsoft 365 (Entra ID) tenant to Ventra VMS — for your own tenant
and for onboarding future clients.

---

## Overview

Ventra uses Microsoft's identity platform in two ways:

| Purpose | How |
|---|---|
| **Admin login** | Supabase OAuth via Azure — staff click "Continue with Microsoft" |
| **Graph API** | MSAL — used for Azure AD people sync and host email notifications |

Both use the same Azure App Registration. You create one registration per Ventra
deployment (one for your SaaS product), not one per client.

---

## Part 1 — Create the Azure App Registration

> Do this once. This registration lives in **your** Azure tenant (Sotaraa's tenant),
> not the client's. Future clients grant consent to this same app.

### 1.1 Register the application

1. Go to [portal.azure.com](https://portal.azure.com)
2. Search for **App registrations** → **New registration**
3. Fill in:
   - **Name:** `Ventra VMS`
   - **Supported account types:** `Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)`
     > ⚠️ Choose **Multitenant** even if you are connecting only your own tenant now.
     > This is what allows future clients to grant consent without you creating a new app.
   - **Redirect URI:** leave blank for now (you'll add these next)
4. Click **Register**
5. On the overview page, copy and save:
   - **Application (client) ID** — this is your `VITE_AZURE_CLIENT_ID`
   - **Directory (tenant) ID** — this is your own tenant ID (not used in env vars directly — see below)

---

### 1.2 Add redirect URIs

You need two platforms with different redirect URIs.

#### Web platform (for Supabase OAuth login)

1. In your app registration → **Authentication** → **Add a platform** → **Web**
2. Add redirect URI:
   ```
   https://fjdbenpucfdnimqaxnxq.supabase.co/auth/v1/callback
   ```
3. Click **Configure**

#### Single-page application platform (for MSAL popup — Graph API features)

1. **Authentication** → **Add a platform** → **Single-page application**
2. Add redirect URI — your Vercel production URL:
   ```
   https://your-app.vercel.app
   ```
   Also add localhost for local development:
   ```
   http://localhost:3000
   ```
3. Click **Configure**

> Your Authentication page should now show two platforms: **Web** and
> **Single-page application**.

---

### 1.3 Create a client secret

1. **Certificates & secrets** → **New client secret**
2. Description: `Ventra Supabase OAuth`
3. Expiry: **24 months** (set a calendar reminder to rotate it)
4. Click **Add**
5. **Copy the secret Value immediately** — you cannot see it again after leaving the page

> Save this as `AZURE_CLIENT_SECRET` — it goes into Supabase, not into Vercel env vars.

---

### 1.4 Add API permissions

1. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
2. Add all of the following:

| Permission | Purpose |
|---|---|
| `User.Read` | Basic sign-in (added by default) |
| `User.ReadBasic.All` | Search staff during Azure AD sync |
| `Group.Read.All` | List tenant groups for AD sync |
| `GroupMember.Read.All` | Read group members for AD sync |
| `Mail.Send` | Send host arrival notification emails |
| `Calendars.Read` | Future: calendar integration |

3. After adding permissions → **Grant admin consent for [your tenant]** → **Yes**

> The **Grant admin consent** button only appears if you are a Global Administrator
> in your own tenant. For client tenants, they grant consent themselves (see Part 3).

---

## Part 2 — Configure Supabase Auth

> This connects Supabase to your Azure App Registration so the "Continue with
> Microsoft" button works.

1. Go to your Supabase project → **Authentication** → **Sign In / Up** → **Auth Providers**
2. Find **Azure** and enable it
3. Fill in:
   - **Azure Application (client) ID:** paste your `Application (client) ID` from Step 1.1
   - **Azure Application (client) secret:** paste the secret Value from Step 1.3
   - **Azure Tenant URL:**
     ```
     https://login.microsoftonline.com/common
     ```
     > Use `common` (not your specific tenant ID). This allows users from any
     > Microsoft tenant to log in — required for multi-tenant SaaS.
4. Click **Save**

---

## Part 3 — Set Vercel Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables** and add:

| Variable | Value |
|---|---|
| `VITE_AZURE_CLIENT_ID` | Your Application (client) ID from Step 1.1 |
| `VITE_AZURE_TENANT_ID` | `common` |

> Use `common` for `VITE_AZURE_TENANT_ID`. This tells MSAL to accept logins from
> any Microsoft tenant, which is correct for a multi-tenant SaaS product.

After adding both variables → **Redeploy** the project (Deployments → Redeploy on latest).

---

## Part 4 — Create the First Admin User Profile

The first time someone logs in with Microsoft, Supabase creates their auth record
automatically. But Ventra also requires a `user_profiles` row to know which site
they belong to and what role they have.

**Pre-create the profile before logging in:**

1. Go to your Supabase project → **Table Editor** → `user_profiles`
2. Insert a new row:

| Column | Value |
|---|---|
| `site_id` | The ID of your site (copy from the `sites` table) |
| `email` | Your Microsoft 365 email address (exact match, lowercase) |
| `full_name` | Your full name |
| `role` | `super_admin` |
| `is_active` | `true` |

Leave `id`, `auth_user_id`, and `created_at` blank — they fill in automatically.

> On your first login, Ventra finds this row by email, links it to your Microsoft
> account, and you're in. All future logins are instant via the `auth_user_id` link.

---

## Part 5 — Test the Login

1. Open your Vercel app URL
2. You'll land on the kiosk screen (public, no auth needed)
3. Navigate to `/login`
4. Click **Continue with Microsoft**
5. Sign in with your Microsoft 365 account
6. You should be redirected to `/admin` with full access

**If you land on `/login` again with no error:** your `user_profiles` row wasn't found.
Check that the email in `user_profiles` exactly matches your Microsoft account email
(check for typos, and make sure it's lowercase).

**If you see a Microsoft error about permissions:** admin consent wasn't granted.
Go back to Step 1.4 and click **Grant admin consent**.

---

## Part 6 — Rename Your School

The default site is called "My School". Update it:

1. Log into `/admin`
2. Go to **Settings** → **Site Details**
3. Update the name, address, and logo
4. Click **Save Changes**

---

## Future Clients — Onboarding Checklist

When a new client (school or trust) signs up, here is what happens on each side.

### Your side (Sotaraa)

- [ ] Create a new `sites` row in Supabase for each of their schools
- [ ] Pre-create a `user_profiles` row for their IT admin (email + `site_admin` role)
- [ ] Send them the **Client IT Admin Instructions** below

### Client's side (their IT admin)

They do not create an App Registration. They grant consent to **your** existing app.

1. Send the client this admin consent URL (replace `YOUR_CLIENT_ID`):
   ```
   https://login.microsoftonline.com/common/adminconsent?client_id=YOUR_CLIENT_ID
   ```
2. Their **Global Administrator** opens this URL and clicks **Accept**
3. That's it — their staff can now log in to Ventra using their Microsoft 365 accounts

> If the client doesn't have a Microsoft 365 tenant (or doesn't want to use it),
> they use email/password login instead. No consent step needed. You just create
> their admin account in Supabase Authentication → Users → Invite user.

---

## Rotating the Client Secret

The client secret expires (24 months recommended). **Before it expires:**

1. Azure Portal → App registrations → Ventra VMS → Certificates & secrets
2. Add a **new** client secret (don't delete the old one yet)
3. Update the secret in Supabase → Authentication → Azure provider
4. Verify login still works
5. Delete the old secret

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Need admin approval" on Microsoft login | App not consented in that tenant | Client admin runs the adminconsent URL |
| Redirected back to `/login` after Microsoft auth | No `user_profiles` row for that email | Pre-create the profile in Supabase |
| "Azure AD search failed" in Add User modal | MSAL not signed in | Log out and back in via Microsoft |
| Graph API errors in Azure AD sync | `Mail.Send` or sync permissions missing | Add permissions + re-grant admin consent |
| Login works but `/admin` shows wrong site | `useSite()` returning first site | Ensure `user_profiles.site_id` is correct |
