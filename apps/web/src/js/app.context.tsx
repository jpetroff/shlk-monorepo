import * as React from 'react'
import config from './config'

import browserApi from './browser.api'
import UserQuery from './user.gql'
import AppError, { toAppError } from './app-error'
import Snackbar, { SnackbarType } from '../components/snackbar'
import styles from './styles-app-context.module.less'

declare type LoginContext = {
  name: string,
  email: string,
  avatar?: Maybe<string>,
  userTag?: Maybe<string>,
  predefinedTimers?: AnyObject[]
}

declare type ExtensionContext = {
  activeTabUrl: string
  activeTabId: number
}

export type AppContextT = {
  extension?: Maybe<ExtensionContext>,
  user?: Maybe<LoginContext>,
  requestUpdate: () => Promise<void>,
  error: AppError | null,
  reportError: (error: unknown, options?: ReportErrorOptions) => AppError,
  dismissError: () => void
}

export type AppContextState = Pick<AppContextT, 'extension' | 'user'>

export type ReportErrorOptions = {
  fallbackMessage?: string
  action?: { label: string, onClick: () => void }
  onDismiss?: () => void
}

type ErrorNotice = { error: AppError, action?: ReportErrorOptions['action'], onDismiss?: () => void }

const AppContext = React.createContext<AppContextT | undefined>(undefined)

type Props = {
  initValue: AppContextState
  initError?: unknown
}

const AppContextProvider : React.FC<React.PropsWithChildren<Props>> = (
 {
  initValue,
  initError,
  children
 } : React.PropsWithChildren<Props>
) => {
  const [ contextState, setContextState ] = React.useState(initValue)

  const [ errorNotice, setErrorNotice ] = React.useState<ErrorNotice | null>(() => initError === undefined
    ? null
    : { error: toAppError(initError) })

  const reportError = React.useCallback((error: unknown, options: ReportErrorOptions = {}) => {
    const appError = toAppError(error, options.fallbackMessage)
    setErrorNotice({ error: appError, action: options.action, onDismiss: options.onDismiss })
    return appError
  }, [])

  const dismissError = React.useCallback(() => {
    errorNotice?.onDismiss?.()
    setErrorNotice(null)
  }, [errorNotice])

  const requestUpdate = React.useCallback(async () => {
    const nextContextState = await getInitAppContext()
    setContextState(nextContextState)
  }, [])

  const value : AppContextT = React.useMemo( () => {
    return {
      ...contextState,
      requestUpdate,
      error: errorNotice?.error ?? null,
      reportError,
      dismissError
    }
  }, [contextState, dismissError, errorNotice, reportError, requestUpdate])

  return (
    <AppContext.Provider value={value}>
      {children}
      {errorNotice && <div className={styles.errorContainer}>
        <Snackbar key={errorNotice.error.message} type={SnackbarType.ERROR} message={errorNotice.error.message}
          action={errorNotice.action?.label} onAction={() => {
            dismissError()
            errorNotice.action?.onClick()
          }} canDismiss onDismiss={dismissError} />
      </div>}
    </AppContext.Provider>
  )
} 

export default AppContext
export { AppContextProvider }

export function useAppContext(): AppContextT {
  const context = React.useContext(AppContext)
  if (!context) throw new Error('useAppContext must be used inside AppContextProvider')
  return context
}
export async function getInitAppContext(): Promise<AppContextState> {

  const result : AppContextState = {}

  // getting active tab
  if(config.target == 'extension' && browserApi.isInit) {
    const activeTab = await browserApi.getTab(true)
    if(activeTab?.url) 
      result.extension = { activeTabUrl: activeTab.url, activeTabId: activeTab.id }
  }

  // getting login data
  const currentUser = await UserQuery.getLoggedInUser()
  console.log(currentUser)
  result.user = currentUser as LoginContext

  return result
}