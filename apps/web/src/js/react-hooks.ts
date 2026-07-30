import * as React from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mediaQuery = window.matchMedia(query)
    mediaQuery.addEventListener('change', onStoreChange)
    return () => mediaQuery.removeEventListener('change', onStoreChange)
  }, [query])

  const getSnapshot = React.useCallback(
    () => window.matchMedia(query).matches,
    [query]
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

export function useAbortControllers() {
  const controllersRef = React.useRef(new Map<string, AbortController>())

  const nextController = React.useCallback((key: string) => {
    controllersRef.current.get(key)?.abort()
    const controller = new AbortController()
    controllersRef.current.set(key, controller)
    return controller
  }, [])

  const abortController = React.useCallback((key: string) => {
    controllersRef.current.get(key)?.abort()
    controllersRef.current.delete(key)
  }, [])

  React.useEffect(() => {
    const controllers = controllersRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [])

  return { nextController, abortController }
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_CANCELED'
  )
}
