import { IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { graphScopes } from './msalConfig'

async function getAccessToken(msalInstance: IPublicClientApplication): Promise<string> {
  const accounts = msalInstance.getAllAccounts()

  // No MSAL session — Ventra login uses Supabase OAuth, not MSAL directly.
  // Skip ssoSilent (it loads an iframe that triggers hash_empty_error in MSAL v3).
  // Show a popup to get Graph API credentials instead.
  if (accounts.length === 0) {
    const response = await msalInstance.loginPopup(graphScopes)
    return response.accessToken
  }

  const request = { ...graphScopes, account: accounts[0] }
  try {
    const response = await msalInstance.acquireTokenSilent(request)
    return response.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup(request)
      return response.accessToken
    }
    throw err
  }
}

async function graphFetch<T>(
  msalInstance: IPublicClientApplication,
  endpoint: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const token = await getAccessToken(msalInstance)
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
  if (!response.ok) {
    throw new Error(`Graph API error: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export interface GraphUser {
  id: string
  displayName: string
  givenName: string
  surname: string
  mail: string
  jobTitle?: string
  department?: string
  userPrincipalName: string
}

interface GraphListResponse<T> {
  value: T[]
}

// Fetch all members of an Azure AD group by group ID
export async function getGroupMembers(
  msalInstance: IPublicClientApplication,
  groupId: string
): Promise<GraphUser[]> {
  const data = await graphFetch<GraphListResponse<GraphUser>>(
    msalInstance,
    `/groups/${groupId}/members?$select=id,displayName,givenName,surname,mail,jobTitle,department,userPrincipalName`
  )
  return data.value
}

// Fetch the signed-in user's profile
export async function getMyProfile(
  msalInstance: IPublicClientApplication
): Promise<GraphUser> {
  return graphFetch<GraphUser>(
    msalInstance,
    '/me?$select=id,displayName,givenName,surname,mail,jobTitle,department,userPrincipalName'
  )
}

// Send a notification email via Microsoft Graph
export async function sendEmail(
  msalInstance: IPublicClientApplication,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const token = await getAccessToken(msalInstance)
  await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  })
}

// Find a user by email address (tries mail and userPrincipalName).
// Throws on auth/permission errors — only returns null when the user
// genuinely doesn't exist in the directory.
export async function findUserByEmail(
  msalInstance: IPublicClientApplication,
  email: string
): Promise<GraphUser | null> {
  const trimmed = email.trim()
  // Use $filter on both mail and userPrincipalName fields
  const filter = `mail eq '${trimmed}' or userPrincipalName eq '${trimmed}'`
  const data = await graphFetch<GraphListResponse<GraphUser>>(
    msalInstance,
    `/users?$filter=${encodeURIComponent(filter)}` +
    `&$select=id,displayName,givenName,surname,mail,jobTitle,department,userPrincipalName` +
    `&$top=1`,
  )
  return data.value[0] ?? null
}

// Search users in the directory by name or email (requires User.ReadBasic.All)
export async function searchUsers(
  msalInstance: IPublicClientApplication,
  query: string
): Promise<GraphUser[]> {
  const data = await graphFetch<GraphListResponse<GraphUser>>(
    msalInstance,
    `/users?$search="displayName:${query}" OR "mail:${query}"` +
    `&$select=id,displayName,givenName,surname,mail,jobTitle,department,userPrincipalName` +
    `&$top=15&$orderby=displayName`,
    { 'ConsistencyLevel': 'eventual' }
  )
  return data.value
}

// List all groups the current user belongs to
export async function listGroups(
  msalInstance: IPublicClientApplication
): Promise<{ id: string; displayName: string }[]> {
  const data = await graphFetch<GraphListResponse<{ id: string; displayName: string }>>(
    msalInstance,
    '/groups?$select=id,displayName&$top=100'
  )
  return data.value
}
