import './modernizr_build.js'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import config from './config'
import { getInitAppContext, AppContextProvider, type AppContextState } from './app.context'
import createRouter from './routes'
import cache, { CacheMode } from './cache'

import { StrictMode } from 'react'
async function main() {
  document.documentElement.classList.add(config.target)
  let appContext: AppContextState = {}
  let initError: unknown
  try {
    appContext = await getInitAppContext()
  } catch (error) {
    initError = error
  }
  cache.mode = appContext.user ? CacheMode.remote : CacheMode.local
  try {
    await cache.setStorage()
  } catch (error) {
    initError ??= error
  }

  const container = document.getElementById('app')
  if (!container) throw new Error('Application root element was not found')
  createRoot(container).render(
    <StrictMode>
      <AppContextProvider initValue={appContext} initError={initError}>
        <RouterProvider router={createRouter()} />
      </AppContextProvider>
    </StrictMode>
  )
}

main().catch((error: unknown) => console.error(error))

