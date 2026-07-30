import './modernizr_build.js'
import '../css/main.less'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import config from './config'
import { getInitAppContext, AppContextProvider } from './app.context'
import createRouter from './routes'
import cache, { CacheMode } from './cache'

async function main() {
  document.documentElement.classList.add(config.target)
  const appContext = await getInitAppContext()
  cache.mode = appContext.user ? CacheMode.remote : CacheMode.local
  cache.setStorage()

  const container = document.getElementById('app')
  if (!container) throw new Error('Application root element was not found')
  createRoot(container).render(
    <AppContextProvider initValue={appContext}>
      <RouterProvider router={createRouter()} />
    </AppContextProvider>
  )
}

main().catch((error: unknown) => console.error(error))

