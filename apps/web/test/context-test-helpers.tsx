import * as React from 'react'
import { vi } from 'vitest'
import AppContext, { type AppContextT } from '../src/js/app.context'
import { toAppError } from '../src/js/app-error'

export function createTestAppContext(overrides: Partial<AppContextT> = {}): AppContextT {
  return {
    error: null,
    authStatus: 'anonymous',
    requestUpdate: vi.fn().mockResolvedValue(undefined),
    reportError: vi.fn((error: unknown, options) => toAppError(error, options?.fallbackMessage)),
    dismissError: vi.fn(),
    ...overrides
  }
}

export function TestAppContext({
  children,
  value = createTestAppContext()
}: React.PropsWithChildren<{ value?: AppContextT }>) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
