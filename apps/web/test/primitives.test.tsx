import * as React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import Button from '../src/components/button'
import Link, { ActionLink } from '../src/components/link'
import RadioGroup from '../src/components/radio-group'
import DropdownMenu from '../src/components/dropdown-menu'
import MenuItem from '../src/components/menu-item'
import Snackbar, { SnackbarType } from '../src/components/snackbar'
import ShortlinkListItem from '../src/components/shortlink-list-item'
import { createTestAppContext } from './context-test-helpers'
import HeroInput from '../src/components/hero-input'
import Video from '../src/components/video'
import AppContext from '../src/js/app.context'

afterEach(() => vi.useRealTimers())

describe('button and link semantics', () => {
  it('uses a native disabled button and does not invoke its action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button label="Save" isDisabled onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('distinguishes route, external, and in-place actions', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    render(<MemoryRouter><>
      <Link to="/profile">Profile</Link>
      <Link href="https://example.com" newTab>Example</Link>
      <ActionLink onClick={action}>Copy</ActionLink>
    </></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('link', { name: 'Example' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Example' })).toHaveAttribute('target', '_blank')
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(action).toHaveBeenCalledOnce()
  })
})

it('supports native radio keyboard selection with group and item labels', async () => {
  const user = userEvent.setup()
  function Harness() {
    const [value, setValue] = React.useState('compact')
    return <RadioGroup label="Display density" value={value} onChange={setValue} items={[
      { key: 'compact', label: 'Compact' },
      { key: 'full', label: 'Full' }
    ]} />
  }
  render(<Harness />)
  expect(screen.getByRole('group', { name: 'Display density' })).toBeInTheDocument()
  expect(document.querySelector('legend')).not.toBeInTheDocument()
  const compact = screen.getByRole('radio', { name: 'Compact' })
  const full = screen.getByRole('radio', { name: 'Full' })
  compact.focus()
  await user.keyboard('{ArrowRight}')
  expect(full).toBeChecked()
})

it('keeps shortlink menu state on the action button instead of rendering attribute text', () => {
  render(<ShortlinkListItem hash="abc" location="https://example.com" timestamp={0}
    siteTitle="Example" menuOpen />)
  const action = screen.getByRole('button', { name: 'Actions for Example' })
  expect(action).toHaveAttribute('aria-haspopup', 'menu')
  expect(action).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByText(/aria-haspopup/)).not.toBeInTheDocument()
})

it('names the hero URL input without rendering an extra label', () => {
  render(<AppContext.Provider value={createTestAppContext()}>
    <HeroInput name="URL" placeholder="Type or paste a link" onChange={vi.fn()}
      onSubmit={vi.fn()} onSnooze={vi.fn()} />
  </AppContext.Provider>)
  expect(screen.getByRole('textbox', { name: 'Type or paste a link' })).toBeInTheDocument()
  expect(document.querySelector('label')).not.toBeInTheDocument()
})
it('defers video playback without explicitly loading the media twice', () => {
  vi.useFakeTimers()
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  const { container, unmount } = render(<Video
    thumbnail="/poster.jpg"
    src={[{ link: '/logo.mp4', type: 'video/mp4' }]}
    timeout={100}
  />)

  expect(container.querySelector('video')).toHaveAttribute('preload', 'none')
  expect(load).not.toHaveBeenCalled()
  window.dispatchEvent(new Event('load'))
  act(() => vi.advanceTimersByTime(100))
  expect(play).toHaveBeenCalledOnce()
  unmount()
  expect(pause).toHaveBeenCalledOnce()
})


it('focuses and keyboard-navigates menu items, then handles Escape', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  function Harness() {
    const [open, setOpen] = React.useState(false)
    return <>
      <button type="button" onClick={() => setOpen(true)}>Actions</button>
      <DropdownMenu show={open} onClose={() => { onClose(); setOpen(false) }} label="Actions menu">
        <MenuItem label="Edit" />
        <MenuItem label="Delete" />
      </DropdownMenu>
    </>
  }
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Actions' }))
  const edit = screen.getByRole('menuitem', { name: 'Edit' })
  const remove = screen.getByRole('menuitem', { name: 'Delete' })
  await waitFor(() => expect(edit).toHaveFocus())
  await user.keyboard('{ArrowDown}')
  expect(remove).toHaveFocus()
  await user.keyboard('{ArrowUp}')
  expect(edit).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
})

describe('snackbar accessibility and cleanup', () => {
  it('announces normal messages politely and errors assertively', () => {
    const { rerender } = render(<Snackbar message="Saved" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    rerender(<Snackbar type={SnackbarType.ERROR} message="Failed" />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })

  it('dismisses after its timer and runs the transition callback once', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Snackbar message="Saved" timer={100} onDismiss={onDismiss} />)
    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(1000))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('offers a native accessible dismissal control', () => {
    render(<Snackbar message="Saved" canDismiss />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
