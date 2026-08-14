import * as React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import Home from '../src/pages/home'

const mocks = vi.hoisted(() => ({
  context: { extension: undefined as { activeTabUrl: string, activeTabId: number } | undefined },
  isMobile: true
}))

vi.mock('../src/js/app.context', () => ({
  useAppContext: () => mocks.context
}))
vi.mock('../src/js/react-hooks', () => ({
  useMediaQuery: () => mocks.isMobile
}))
vi.mock('../src/apps/Header', () => ({
  default: () => <header data-testid="home-header">Header</header>
}))
vi.mock('../src/components/scroller', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}))
vi.mock('../src/apps/ShortlinkBar', () => ({
  default: ({ onMobileInputModeChange }: { onMobileInputModeChange: (active: boolean) => void }) => <>
    <button type="button" onClick={() => onMobileInputModeChange(true)}>Activate input</button>
    <button type="button" onClick={() => onMobileInputModeChange(false)}>Clear input</button>
  </>
}))

beforeEach(() => {
  mocks.context.extension = undefined
  mocks.isMobile = true
})

it('keeps the header mounted while mobile input mode hides and disables it', () => {
  const view = render(<Home />)
  const header = view.getByTestId('home-header')
  const headerWrapper = header.parentElement
  expect(headerWrapper).not.toBeNull()

  fireEvent.click(view.getByRole('button', { name: 'Activate input' }))
  expect(view.getByTestId('home-header')).toBe(header)
  expect(headerWrapper).toHaveAttribute('aria-hidden', 'true')
  expect(headerWrapper).toHaveAttribute('inert')

  fireEvent.click(view.getByRole('button', { name: 'Clear input' }))
  expect(view.getByTestId('home-header')).toBe(header)
  expect(headerWrapper).not.toHaveAttribute('aria-hidden')
  expect(headerWrapper).not.toHaveAttribute('inert')
})

it('keeps the initially hidden extension header mounted', () => {
  mocks.context.extension = { activeTabUrl: 'https://active.example', activeTabId: 42 }
  const view = render(<Home />)
  const headerWrapper = view.getByTestId('home-header').parentElement

  expect(headerWrapper).toHaveAttribute('aria-hidden', 'true')
  expect(headerWrapper).toHaveAttribute('inert')
})
