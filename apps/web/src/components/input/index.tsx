import styles from './styles-input.module.less'
import * as React from 'react'
import classNames from 'classnames'
import Button, { ButtonSize, ButtonType } from '../button'
import Icon, { Cross, IconSize } from '../icons'

type Props = {
  onValueChange?: (value: string) => void
  label?: string
  placeholder?: string
  leftIcon?: React.FunctionComponent<React.SVGAttributes<SVGElement>>
  rightIcon?: React.FunctionComponent<React.SVGAttributes<SVGElement>>
  prefix?: React.ReactElement | string
  suffix?: React.ReactElement | string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix'>

export default function Input({
  onValueChange, label, placeholder, leftIcon, rightIcon, prefix, suffix,
  className, id: providedId, value, autoComplete = 'off', ...inputProps
}: Props) {
  const generatedId = React.useId()
  const inputId = providedId ?? generatedId
  const isEmpty = value == null || value === ''
  const globalClass = `${styles.wrapperClass}_input`
  const inputClasses = classNames({
    [globalClass]: true,
    [`${globalClass}_not-empty`]: !isEmpty,
    [`${globalClass}_has-left-icon`]: leftIcon,
    [`${globalClass}_has-right-icon`]: rightIcon
  })

  return <div className={inputClasses}>
    {label && <label className={`${globalClass}__label`} htmlFor={inputId}>{label}</label>}
    <div className={`${globalClass}__input-wrapper`}>
      {(prefix || leftIcon) && <div className={`${globalClass}__prefix`}>
        {leftIcon && <Icon size={IconSize.LARGE} className={`${globalClass}__left-icon`} useIcon={leftIcon} />}
        {prefix}
      </div>}
      <div className={`${globalClass}__input-inner`}>
        <span className={`${globalClass}__placeholder`} aria-hidden="true">{placeholder}</span>
        <input {...inputProps} id={inputId}
          className={`${globalClass}__input-element ${className ?? ''}`}
          value={value} autoComplete={autoComplete} placeholder={placeholder}
          onChange={(event) => onValueChange?.(event.currentTarget.value)} />
      </div>
      {(suffix || rightIcon || !isEmpty) && <div className={`${globalClass}__suffix`}>
        {suffix}
        {rightIcon && <Icon size={IconSize.LARGE} className={`${globalClass}__right-icon`} useIcon={rightIcon} />}
        {!isEmpty && <Button className={`${globalClass}__clear`} size={ButtonSize.SMALL}
          type={ButtonType.GHOST} icon={Cross} aria-label={`Clear ${label ?? 'input'}`}
          onClick={() => onValueChange?.('')} />}
      </div>}
    </div>
  </div>
}
