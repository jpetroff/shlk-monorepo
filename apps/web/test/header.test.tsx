import * as React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import Header from '../src/apps/Header'
import { createTestAppContext, TestAppContext } from './context-test-helpers'

it('uses a backdrop to close the account menu without dismissing it on pointer down', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter>
    <TestAppContext value={createTestAppContext({
      authStatus: 'authenticated',
      user: { name: 'Ada', email: 'ada@example.com' }
    })}>
      <Header />
    </TestAppContext>
  </MemoryRouter>)

  const accountButton = screen.getByRole('button', { name: /Ada/ })
  await user.click(accountButton)
  await waitFor(() => expect(screen.getByRole('menuitem', { name: 'My shortlinks' })).toHaveFocus())

  const backdrop = screen.getByRole('button', { name: 'Close account menu' })
  fireEvent.pointerDown(backdrop)
  expect(accountButton).toHaveAttribute('aria-expanded', 'true')

  fireEvent.click(backdrop)
  expect(accountButton).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: 'Close account menu' })).not.toBeInTheDocument()
})
