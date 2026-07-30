import styles from './styles-dropdown-menu.module.less'
import * as React from 'react'
import { CSSTransition } from 'react-transition-group'
import classNames from 'classnames'

export enum DropdownPosition { top = 'top', left = 'left', bottom = 'bottom', right = 'right', wide = 'wide' }
type Props = React.PropsWithChildren<{
  show: boolean
  position?: [DropdownPosition, DropdownPosition]
  onClose: () => void
  onEnter?: (isAppearing: boolean) => void
  className?: string
  hasIcons?: boolean
  divRef?: React.RefObject<HTMLDivElement | null>
  style?: React.CSSProperties
  label?: string
}>

export default function DropdownMenu({
  show, children, onClose, onEnter,
  position = [DropdownPosition.bottom, DropdownPosition.wide],
  className, divRef, style = {}, label = 'Menu'
}: Props) {
  const internalRef = React.useRef<HTMLDivElement>(null)
  const menuRef = divRef ?? internalRef
  const transitionDuration = Number.parseInt(styles.appearTransition)
  const globalClass = `${styles.wrapperClass}_dropdown-menu`
  const classes = classNames({
    [globalClass]: true,
    [`${globalClass}_${position[0]}`]: true,
    [`${globalClass}_${position[1]}`]: true,
    [`${className}`]: !!className
  })

  React.useEffect(() => {
    if (!show) return
    let cleanup = () => {}
    const timeoutId = window.setTimeout(() => {
      const handlePointerDown = (event: PointerEvent) => {
        if (!menuRef.current?.contains(event.target as Node)) onClose()
      }
      document.addEventListener('pointerdown', handlePointerDown)
      cleanup = () => document.removeEventListener('pointerdown', handlePointerDown)
    }, transitionDuration)
    return () => { window.clearTimeout(timeoutId); cleanup() }
  }, [menuRef, onClose, show, transitionDuration])

  React.useEffect(() => {
    if (!show) return
    const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = menuItems()
      if (items.length === 0) return
      event.preventDefault()
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      if (event.key === 'Home') items[0].focus()
      else if (event.key === 'End') items.at(-1)?.focus()
      else {
        const offset = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex = currentIndex < 0
          ? (offset > 0 ? 0 : items.length - 1)
          : (currentIndex + offset + items.length) % items.length
        items[nextIndex].focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, show])

  return <CSSTransition nodeRef={menuRef} in={show} timeout={transitionDuration}
    classNames={globalClass} onEnter={onEnter}
    onEntered={() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()}>
    <div ref={menuRef} className={classes} style={style} role="menu" aria-label={label}>{children}</div>
  </CSSTransition>
}
