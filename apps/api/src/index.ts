import { createApp } from './libs/app'
import { connectDatabase, createSessionStore } from './libs/connect.db'
import config, { validateConfig } from './config'
import { cliColors } from './libs/utils'
import { closeDatabase } from './db/client'

export async function startServer(): Promise<void> {
  validateConfig()
  console.log(
    `\n\n[…] shlk.cc app starting in ${cliColors.yellow}${config.NODE_ENV}${cliColors.end} mode`
  )

  await connectDatabase()
  const store = createSessionStore()
  const app = createApp(store)
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(
      `${cliColors.green}[✓]${cliColors.end} Server listening on port ${config.PORT}`
    )
  })

  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    server.close(() => {
      store.close()
      closeDatabase()
    })
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

if (import.meta.main) {
  startServer().catch((error: unknown) => {
    console.error(`${cliColors.red}[x]${cliColors.end} Startup failed`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

