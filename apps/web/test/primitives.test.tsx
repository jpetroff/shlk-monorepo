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
  const compact = screen.getByRole('radio', { name: 'Compact' })
  const full = screen.getByRole('radio', { name: 'Full' })
  compact.focus()
  await user.keyboard('{ArrowRight}')
  expect(full).toBeChecked()
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
