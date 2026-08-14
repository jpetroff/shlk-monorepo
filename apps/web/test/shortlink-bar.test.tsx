import * as React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import AppContext, { type AppContextT } from '../src/js/app.context'
import ShortlinkBar from '../src/apps/ShortlinkBar'
import config from '../src/js/config'

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
  default: ({ value, onChange, onSubmit, onSnooze, onFocus, inputRef }: {
    value: string, onChange: (value: string, isClear?: boolean) => void,
    onSubmit: (value: string) => void, onSnooze: () => void,
    onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void,
    inputRef?: React.RefObject<HTMLInputElement | null>
  }) => <>
    <input ref={inputRef} aria-label="Type or paste a link" value={value}
      onChange={(event) => onChange(event.currentTarget.value)} onFocus={onFocus} />
    <button type="button" onClick={() => onChange('', true)}>Clear URL</button>
    <button type="button">Paste</button>
    <button type="button" onClick={() => onSubmit(value)}>Create</button>
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

function renderBar(context: Partial<AppContextT> = {}, entry = '/',
  onMobileInputModeChange?: (active: boolean) => void) {
  const value = createTestAppContext(context)
  return render(
    <React.StrictMode>
      <AppContext.Provider value={value}>
        <MemoryRouter initialEntries={[entry]}>
          <ShortlinkBar onMobileInputModeChange={onMobileInputModeChange} />
        </MemoryRouter>
      </AppContext.Provider>
    </React.StrictMode>
  )
}

function setMobileViewport(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
}

function installVisualViewport(offsetTop = 32, height = 480) {
  const metrics = { offsetTop, height }
  const viewport = new EventTarget() as VisualViewport
  Object.defineProperties(viewport, {
    offsetTop: { configurable: true, get: () => metrics.offsetTop },
    height: { configurable: true, get: () => metrics.height }
  })
  const addEventListener = vi.spyOn(viewport, 'addEventListener')
  const removeEventListener = vi.spyOn(viewport, 'removeEventListener')
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  return { viewport, metrics, addEventListener, removeEventListener }
}

function getMobilePanel(input: HTMLElement) {
  const panel = input.parentElement?.parentElement
  if (!panel) throw new Error('Mobile shortlink panel not found')
  return panel
}

beforeEach(() => {
  vi.clearAllMocks()
  setMobileViewport(false)
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
  ;(config as unknown as { target: 'webapp' | 'extension' }).target = 'webapp'
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

describe('mobile input mode', () => {
  it('keeps the same input mounted and active through panel actions until Clear', () => {
    setMobileViewport(true)
    installVisualViewport()
    const onModeChange = vi.fn()
    const view = renderBar({}, '/', onModeChange)
    const input = view.getByRole('textbox', { name: 'Type or paste a link' })
    const panel = getMobilePanel(input)

    fireEvent.focus(input)
    expect(panel).toHaveClass('__mobile-convenience-state')
    expect(onModeChange).toHaveBeenCalledWith(true)
    expect(view.getByRole('textbox', { name: 'Type or paste a link' })).toBe(input)
    expect(view.getByTestId('video')).toBeInTheDocument()
    expect(window.scrollTo).not.toHaveBeenCalled()

    fireEvent.click(view.getByRole('button', { name: 'Paste' }))
    fireEvent.click(view.getByRole('button', { name: 'Create' }))
    expect(panel).toHaveClass('__mobile-convenience-state')

    fireEvent.click(view.getByRole('button', { name: 'Clear URL' }))
    expect(panel).not.toHaveClass('__mobile-convenience-state')
    expect(onModeChange).toHaveBeenLastCalledWith(false)
    expect(view.getByRole('textbox', { name: 'Type or paste a link' })).toBe(input)
  })

  it('tracks the visual viewport and removes listeners when compact mode exits', () => {
    setMobileViewport(true)
    const visual = installVisualViewport(40, 360)
    const view = renderBar()
    const input = view.getByRole('textbox', { name: 'Type or paste a link' })
    const panel = getMobilePanel(input)

    fireEvent.focus(input)
    expect(panel.style.getPropertyValue('--mobile-viewport-offset-top')).toBe('40px')
    expect(panel.style.getPropertyValue('--mobile-viewport-height')).toBe('360px')
    expect(visual.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(visual.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))

    visual.metrics.offsetTop = 72
    visual.metrics.height = 284
    visual.viewport.dispatchEvent(new Event('scroll'))
    expect(panel.style.getPropertyValue('--mobile-viewport-offset-top')).toBe('72px')
    expect(panel.style.getPropertyValue('--mobile-viewport-height')).toBe('284px')

    fireEvent.click(view.getByRole('button', { name: 'Clear URL' }))
    expect(visual.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(visual.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(panel.style.getPropertyValue('--mobile-viewport-offset-top')).toBe('')
    expect(panel.style.getPropertyValue('--mobile-viewport-height')).toBe('')
  })

  it('removes visual viewport listeners when unmounted while active', () => {
    setMobileViewport(true)
    const visual = installVisualViewport()
    const view = renderBar()
    fireEvent.focus(view.getByRole('textbox', { name: 'Type or paste a link' }))

    visual.removeEventListener.mockClear()
    view.unmount()
    expect(visual.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(visual.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('does not activate compact mode on desktop focus', () => {
    const onModeChange = vi.fn()
    const view = renderBar({}, '/', onModeChange)
    const input = view.getByRole('textbox', { name: 'Type or paste a link' })

    fireEvent.focus(input)
    expect(getMobilePanel(input)).not.toHaveClass('__mobile-convenience-state')
    expect(onModeChange).not.toHaveBeenCalled()
  })

  it('starts active for a prefilled mobile extension', () => {
    setMobileViewport(true)
    installVisualViewport(24, 400)
    ;(config as unknown as { target: 'webapp' | 'extension' }).target = 'extension'
    const view = renderBar({ extension: { activeTabUrl: 'https://active.example', activeTabId: 42 } })
    const input = view.getByRole('textbox', { name: 'Type or paste a link' })
    const panel = getMobilePanel(input)

    expect(panel).toHaveClass('__mobile-convenience-state')
    expect(panel.style.getPropertyValue('--mobile-viewport-offset-top')).toBe('24px')
    expect(view.getByTestId('video')).toBeInTheDocument()
  })
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
