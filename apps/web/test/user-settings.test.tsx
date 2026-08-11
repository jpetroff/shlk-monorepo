import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppContext, { type AppContextT } from '../src/js/app.context'
import UserSettings from '../src/apps/UserSettings'

import { createTestAppContext } from './context-test-helpers'
const updateLoggedInUser = vi.hoisted(() => vi.fn())

vi.mock('../src/js/user.gql', () => ({
  default: { updateLoggedInUser }
}))

function renderSettings(requestUpdate = vi.fn().mockResolvedValue(undefined)) {
  const value = createTestAppContext({
    user: { name: 'Alex', email: 'alex@example.com', userTag: 'alex' }, requestUpdate })
  return { requestUpdate, reportError: value.reportError, ...render(
    <AppContext.Provider value={value}><UserSettings /></AppContext.Provider>
  ) }
}

beforeEach(() => { updateLoggedInUser.mockReset() })

describe('UserSettings', () => {
  it('submits the controlled value, refreshes context, and announces success', async () => {
    const user = userEvent.setup()
    updateLoggedInUser.mockResolvedValue({ userTag: 'new-tag' })
    const { requestUpdate } = renderSettings()
    const input = screen.getByRole('textbox', { name: 'Personal shortlink prefix' })
    await user.clear(input)
    await user.type(input, 'new-tag')
    await user.click(screen.getByRole('button', { name: 'Save profile settings' }))
    expect(updateLoggedInUser).toHaveBeenCalledWith({ userTag: 'new-tag' }, expect.any(AbortSignal))
    expect(await screen.findByRole('status')).toHaveTextContent('Profile updated')
    expect(requestUpdate).toHaveBeenCalledOnce()
    expect(input).toHaveValue('new-tag')
  })

  it('prevents duplicate saves while the request is pending', async () => {
    const user = userEvent.setup()
    let resolveRequest!: (value: { userTag: string }) => void
    updateLoggedInUser.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    renderSettings()
    const input = screen.getByRole('textbox', { name: 'Personal shortlink prefix' })
    await user.clear(input)
    await user.type(input, 'pending-tag')
    const save = screen.getByRole('button', { name: 'Save profile settings' })
    await user.click(save)
    expect(save).toBeDisabled()
    await user.click(save)
    expect(updateLoggedInUser).toHaveBeenCalledOnce()
    resolveRequest({ userTag: 'alex' })
    await screen.findByRole('status')
  })

  it('retains the entered value and exposes an alert after failure', async () => {
    const user = userEvent.setup()
    updateLoggedInUser.mockRejectedValue(new Error('offline'))
    const { reportError } = renderSettings()
    const input = screen.getByRole('textbox', { name: 'Personal shortlink prefix' })
    await user.clear(input)
    await user.type(input, 'keep-this')
    await user.click(screen.getByRole('button', { name: 'Save profile settings' }))
    await waitFor(() => expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      fallbackMessage: 'Sorry, something did not go well. Please try again.' }))
    expect(input).toHaveValue('keep-this')
    expect(screen.getByRole('button', { name: 'Save profile settings' })).not.toBeDisabled()
  })

  it('aborts an in-flight save when unmounted', async () => {
    const user = userEvent.setup()
    let signal: AbortSignal | undefined
    updateLoggedInUser.mockImplementation((_args, requestSignal: AbortSignal) => {
      signal = requestSignal
      return new Promise(() => undefined)
    })
    const { unmount } = renderSettings()
    const input = screen.getByRole('textbox', { name: 'Personal shortlink prefix' })
    await user.clear(input)
    await user.type(input, 'abort-me')
    await user.click(screen.getByRole('button', { name: 'Save profile settings' }))
    await waitFor(() => expect(signal).toBeDefined())
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
