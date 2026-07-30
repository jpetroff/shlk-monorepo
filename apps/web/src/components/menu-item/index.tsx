import styles from './styles-menu-item.module.less'
import * as React from 'react'
import Icon, { IconSize, ReactIcon } from '../icons'
import classNames from 'classnames'

type Props = { icon?: ReactIcon, label: string, onClick?: () => void, isDisabled?: boolean, keepIconSpace?: boolean }

function MenuItem({ icon, keepIconSpace = false, label, onClick, isDisabled = false }: Props) {
  const globalClass = `${styles.wrapperClass}_menu-item`
  const classes = classNames({
    [globalClass]: true,
    [`${globalClass}_disabled`]: isDisabled,
    [`${globalClass}_keep-space`]: keepIconSpace && !icon
  })
  return <button type="button" role="menuitem" className={classes} disabled={isDisabled}
    onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    {icon && <Icon className={`${globalClass}__icon`} useIcon={icon} size={IconSize.SMALL} />}
    <span className={`${globalClass}__label`}>{label}</span>
  </button>
}

MenuItem.Separator = function MenuItemSeparator() {
  return <div className={`${styles.wrapperClass}__separator`} role="separator" />
}

export default MenuItem as typeof MenuItem & { Separator: typeof MenuItem.Separator }
