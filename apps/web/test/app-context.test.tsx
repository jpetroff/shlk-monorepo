import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { AppContextProvider, useAppContext } from '../src/js/app.context'

function ErrorReporter({ retry }: { retry: () => void }) {
  const context = useAppContext()
  return <>
    <button type="button" onClick={() => context.reportError({
      message: 'GraphQL validation failed',
      code: 'BAD_INPUT'
    })}>GraphQL error</button>
    <button type="button" onClick={() => context.reportError(new Error('Internal validation failed'))}>
      Internal error
    </button>
    <button type="button" onClick={() => context.reportError(null, {
      fallbackMessage: 'Could not load links',
      action: { label: 'Retry', onClick: retry }
    })}>Retry error</button>
    <span data-testid="error-code">{context.error?.code}</span>
  </>
}

it('presents GraphQL-shaped and internal errors through one context snackbar', async () => {
  const user = userEvent.setup()
  render(<AppContextProvider initValue={{}}>
    <ErrorReporter retry={vi.fn()} />
  </AppContextProvider>)

  await user.click(screen.getByRole('button', { name: 'GraphQL error' }))
  expect(screen.getByRole('alert')).toHaveTextContent('GraphQL validation failed')
  expect(screen.getByTestId('error-code')).toHaveTextContent('BAD_INPUT')

  await user.click(screen.getByRole('button', { name: 'Internal error' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Internal validation failed')
})

it('dismisses an error before invoking its retry action', async () => {
  const user = userEvent.setup()
  const retry = vi.fn()
  render(<AppContextProvider initValue={{}}>
    <ErrorReporter retry={retry} />
  </AppContextProvider>)

  await user.click(screen.getByRole('button', { name: 'Retry error' }))
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
