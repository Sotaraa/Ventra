import { Configuration, PopupRequest } from '@azure/msal-browser'

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Scopes for Microsoft Graph API
export const graphScopes: PopupRequest = {
  scopes: [
    'User.Read',
    'User.ReadBasic.All',
    'Group.Read.All',          // list all tenant groups for AD sync
    'GroupMember.Read.All',    // read group membership for AD sync
    'Mail.Send',
    'Calendars.Read',
  ],
}

// Minimal scope just for sign-in
export const loginRequest: PopupRequest = {
  scopes: ['User.Read'],
}
