import styles from './styles-menu-item.module.less'

import * as React from 'react'
import * as _ from 'underscore'
import Icon, { IconSize, ReactIcon } from '../icons'
import classNames from 'classnames'

type Props = {
  icon?: ReactIcon
  label: string
  onClick?: () => void
  isDisabled?: boolean
  keepIconSpace?: boolean
}

const MenuItem : React.FC<Props> & { Separator: React.FC } = (
  {
    icon,
    keepIconSpace = false,
    label,
    onClick,
    isDisabled = false
  } : Props
) => {
  const globalClass = `${styles.wrapperClass}_menu-item`
  const menuItemClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_disabled`]: !!isDisabled,
    [`${globalClass}_keep-space`]: keepIconSpace && !icon
  })

  function handleClick(event: React.SyntheticEvent) {
    event.stopPropagation()
    if(isDisabled) event.preventDefault()
    if(_.isFunction(onClick)) onClick()
  }

  return (
    <div className={`${menuItemClasses}`} onClick={handleClick}>
      {icon && 
        <Icon className={`${globalClass}__icon`} useIcon={icon} size={IconSize.SMALL} />
      }
      <span className={`${globalClass}__label`}>{label}</span>
    </div>
  )
}

MenuItem.Separator = function (_props: unknown) : React.ReactElement<any, any> | null {
  const globalClass = `${styles.wrapperClass}__separator`
  return (
    <div className={globalClass}></div>
  )
}

export default MenuItem