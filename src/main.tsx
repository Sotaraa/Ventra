import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from '@/lib/msalConfig'
import { AuthProvider } from '@/store/AuthContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const msalInstance = new PublicClientApplication(msalConfig)

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

function renderApp() {
  createRoot(rootEl!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' },
                  success: { iconTheme: { primary: '#1e3a5f', secondary: '#fff' } },
                }}
              />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </MsalProvider>
    </StrictMode>
  )
}

// MSAL v3 requires initialize() before any auth calls are made.
// If init fails (network, config), render anyway — only Graph API features are affected.
msalInstance.initialize().then(renderApp).catch((err) => {
  console.warn('[MSAL] Initialization failed — Graph API unavailable:', err)
  renderApp()
})
