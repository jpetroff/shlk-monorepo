import styles from './styles-dropdown-menu.module.less'

import * as React from 'react'
import { CSSTransition } from 'react-transition-group'
import * as _ from 'underscore'
import classNames from 'classnames'

export enum DropdownPosition {
  top = 'top',
  left = 'left',
  bottom = 'bottom',
  right = 'right',
  wide = 'wide'
}

type Props = {
  show: boolean
  position?: [DropdownPosition, DropdownPosition]
  onClose: () => void
  onEnter?: (isAppearing: boolean) => void
  className?: string
  hasIcons?: boolean
  divRef?: React.RefObject<HTMLDivElement | null>
  style?: React.CSSProperties
}

const DropdownMenu : React.FC<React.PropsWithChildren<Props>> = (
  {
    show,
    children,
    onClose,
    onEnter,
    position = [DropdownPosition.bottom, DropdownPosition.wide],
    className,
    divRef = React.createRef<HTMLDivElement>(),
    style = {}
  } : React.PropsWithChildren<Props>
) => {

  const globalClass = `${styles.wrapperClass}_dropdown-menu`
  const dropdownMenuClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_${position[0]}`]: true,
    [`${globalClass}_${position[1]}`]: true,
    [`${className}`]: className
  })


  const transitionDuration = parseInt(styles.appearTransition)

  function handleClickOutside(_event: MouseEvent) {
    if(_.isFunction(onClose)) onClose()
  }

  function handleCSSEnter(isAppearing: boolean) {
    if(_.isFunction(onEnter)) onEnter(isAppearing)
  }

  React.useEffect( () => {
    if(show) {
      _.delay(() => document.addEventListener('click', handleClickOutside), transitionDuration)
    } else {
      document.removeEventListener('click', handleClickOutside)
    }

    return () => { document.removeEventListener('click', handleClickOutside) }
  }, [show])

  return (
    <>
    <CSSTransition nodeRef={divRef} 
      in={show} 
      timeout={transitionDuration}
      classNames={`${globalClass}`}
      onEnter={handleCSSEnter}
    >
    <div ref={divRef} className={`${dropdownMenuClasses}`} style={style}> 
      {children}
    </div>
    </CSSTransition>
    </>
  )
}

export default DropdownMenu