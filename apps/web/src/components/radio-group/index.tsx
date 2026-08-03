import styles from './styles-radio-group.module.less'
import * as React from 'react'
import Icon, { IconSize, ReactIcon } from '../icons'
import classNames from 'classnames'

type RadioItem = { label?: string, ariaLabel?: string, key: string, icon?: ReactIcon }
type Props = { items: RadioItem[], onChange: (key: string) => void, value: string, label: string, fullWidth?: boolean }

export default function RadioGroup({ items, onChange, value, label, fullWidth = false }: Props) {
  const name = React.useId()
  const globalClass = `${styles.wrapperClass}_radio-group`
  const classes = classNames({ [globalClass]: true, [`${globalClass}_full-width`]: fullWidth })

  return <fieldset className={classes} aria-label={label}>
    {items.map((item) => {
      const itemLabel = item.ariaLabel ?? item.label
      return <label className={classNames(`${globalClass}__radio-button`, {
        [`${globalClass}__radio-button_active`]: item.key === value
      })} key={item.key} aria-label={itemLabel}>
        <input className={`${globalClass}__native-radio`} type="radio" name={name}
          value={item.key} checked={item.key === value} aria-label={itemLabel}
          onChange={() => onChange(item.key)} />
        {item.icon && <Icon useIcon={item.icon} size={IconSize.SMALL} />}
        {item.label}
      </label>
    })}
  </fieldset>
}
