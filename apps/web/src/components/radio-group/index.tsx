import styles from './styles-radio-group.module.less'
import * as React from 'react'
import Icon, { IconSize, ReactIcon } from '../icons'
import classNames from 'classnames'

type Props = {
  items: Array<{label?: string, key: string, icon?: ReactIcon}>
  onChange: (key: string) => void
  value: string
  fullWidth?: boolean
}

const RadioGroup : React.FC<Props> = (
  {
    items, 
    onChange,
    value,
    fullWidth = false
  } : Props
) => {
  const globalClass = `${styles.wrapperClass}_radio-group`
  const radioGroupClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_full-width`]: fullWidth
  })

  function handleClick(_event: React.MouseEvent, key: string) {
    onChange(key)
  }

  // const styleObj = fullWidth ? { width: `${100%}`}

  return (
    <div className={`${radioGroupClasses}`}>
      {items.map( (item, index) => {
        const activeClass = item.key == value ? `${globalClass}__radio-button_active` : ''
        return (
          <div 
            className={`${globalClass}__radio-button ${activeClass}`}
            onClick={(event) => handleClick(event, item.key)}
            key={item.key}
          >
            {item.icon && <Icon useIcon={item.icon} size={IconSize.SMALL} />}
            {item.label}
          </div>
        )
      } )}
    </div>
  )
}

export default RadioGroup