import * as React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import AppContext, { type AppContextT } from '../src/js/app.context'
import ShortlinkBar from '../src/apps/ShortlinkBar'

import { createTestAppContext } from './context-test-helpers'
const mocks = vi.hoisted(() => ({
  useCreator: vi.fn(),
  submitLocation: vi.fn(),
  snooze: vi.fn(),
  dispatch: vi.fn(),
  copy: vi.fn(),
  probeExtension: vi.fn()
}))

vi.mock('../src/apps/ShortlinkBar/use-shortlink-creator', () => ({
  useShortlinkCreator: mocks.useCreator
}))
vi.mock('../src/js/clipboard.tools', () => ({ default: { copy: mocks.copy } }))
vi.mock('../src/js/browser.api', () => ({ default: { probeSnoozeExtension: mocks.probeExtension } }))
vi.mock('../src/components/hero-input', () => ({
  default: ({ value, onSubmit, onSnooze }: {
    value: string, onSubmit: (value: string) => void, onSnooze: () => void
  }) => <>
    <button type="button" onClick={() => onSubmit(value)}>Submit {value}</button>
    <button type="button" onClick={onSnooze}>Snooze</button>
  </>
}))
vi.mock('../src/components/shortlink-display', () => ({ default: () => <div data-testid="shortlink-display" /> }))
vi.mock('../src/components/shortlink-slug-input', () => ({ default: () => <div data-testid="slug-input" /> }))
vi.mock('../src/components/snooze-list', () => ({ default: () => <div data-testid="snooze-list" /> }))
vi.mock('../src/components/video', () => ({ default: () => <div data-testid="video" /> }))
vi.mock('../src/apps/Footer', () => ({ default: () => <footer /> }))
vi.mock('../src/apps/History', () => ({ HistoryWidget: () => <div data-testid="history" /> }))

const creatorState = {
  location: '',
  result: null,
  userTag: 'someone',
  descriptionTag: '',
  descriptorDirty: false,
  createPhase: 'idle',
  descriptorPhase: 'idle',
  showSnoozeOptions: false,
  notice: null
}

function renderBar(context: Partial<AppContextT> = {}, entry = '/') {
  const value = createTestAppContext(context)
  return render(
    <React.StrictMode>
      <AppContext.Provider value={value}>
        <MemoryRouter initialEntries={[entry]}><ShortlinkBar /></MemoryRouter>
      </AppContext.Provider>
    </React.StrictMode>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.submitLocation.mockResolvedValue('https://shlk.test/returned')
  mocks.probeExtension.mockResolvedValue(false)
  mocks.useCreator.mockImplementation((initialLocation: string) => ({
    state: { ...creatorState, location: initialLocation },
    dispatch: mocks.dispatch,
    submitLocation: mocks.submitLocation,
    snooze: mocks.snooze,
    recentItems: [],
    recentLoading: false
  }))
})

describe('ShortlinkBar initialization', () => {
  it('prefills the extension active tab ahead of the query and does not auto-submit it', async () => {
    renderBar({ extension: { activeTabUrl: 'https://active.example', activeTabId: 42 } },
      '/?l=https%3A%2F%2Fquery.example')
    expect(mocks.useCreator).toHaveBeenCalledWith('https://active.example', 'someone', 3)
    await Promise.resolve()
    expect(mocks.submitLocation).not.toHaveBeenCalled()
  })

  it('auto-submits a valid query URL once under Strict Mode effect replay', async () => {
    renderBar({}, '/?l=https%3A%2F%2Fquery.example')
    expect(mocks.useCreator).toHaveBeenCalledWith('https://query.example', 'someone', 3)
    await waitFor(() => expect(mocks.submitLocation).toHaveBeenCalledOnce())
    expect(mocks.submitLocation).toHaveBeenCalledWith('https://query.example')
  })
})

it('copies the value returned by shortcut submission and cleans up its global listener', async () => {
  const view = renderBar()
  fireEvent.keyDown(window, { code: 'KeyD', ctrlKey: true })
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith('https://shlk.test/returned'))
  expect(mocks.dispatch).toHaveBeenCalledWith({ type: 'notice', notice: {
    type: 'success', message: 'Shortlink copied to clipboard'
  } })
  mocks.submitLocation.mockClear()
  view.unmount()
  fireEvent.keyDown(window, { code: 'KeyD', ctrlKey: true })
  expect(mocks.submitLocation).not.toHaveBeenCalled()
})


describe('website snooze availability', () => {
  const user = { name: 'Alex', email: 'alex@example.com', predefinedTimers: [] }

  function useVisibleSnoozeState() {
    mocks.useCreator.mockReturnValue({
      state: { ...creatorState, location: 'https://example.com', showSnoozeOptions: true },
      dispatch: mocks.dispatch,
      submitLocation: mocks.submitLocation,
      snooze: mocks.snooze,
      recentItems: [],
      recentLoading: false
    })
  }

  it('shows installation guidance instead of timers when the extension is unavailable', async () => {
    useVisibleSnoozeState()
    const view = renderBar({ user })
    fireEvent.click(view.getByRole('button', { name: 'Snooze' }))
    expect(await view.findByText(/Install or update the shlk.cc Chrome extension/)).toBeInTheDocument()
    expect(view.queryByTestId('snooze-list')).not.toBeInTheDocument()
  })

  it('shows snooze times only after a compatible extension replies', async () => {
    useVisibleSnoozeState()
    mocks.probeExtension.mockResolvedValue(true)
    const view = renderBar({ user })
    fireEvent.keyDown(window, { code: 'KeyS', ctrlKey: true })
    expect(await view.findByTestId('snooze-list')).toBeInTheDocument()
  })
})
