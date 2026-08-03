import * as React from 'react'
import styles from './styles-hero-input.module.less'
import Button, { ButtonSize, ButtonType } from '../button'
import { Cross, Enter, Snooze } from '../icons'
import clipboardTools from '../../js/clipboard.tools'
import { useAppContext } from '../../js/app.context'

type Props = { onChange: (value: string, isClearPress?: boolean) => void,
  onSubmit: (value?: string) => void, onSnooze: () => void, placeholder: string, name: string,
  value?: string, inputRef?: React.RefObject<HTMLInputElement | null>,
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void,
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void, mobileTip?: string, hasCta?: boolean }

export default function HeroInput({ onChange, onSubmit, onSnooze, name, placeholder, value = '', inputRef,
  onFocus, onBlur, mobileTip, hasCta = true }: Props) {
  const [focused, setFocused] = React.useState(false)
  const context = useAppContext()
  const globalClass = styles.wrapperClass + '_hero-input'
  const modifiers = [focused ? `${globalClass}_focus` : '', value ? `${globalClass}_not-empty` : `${globalClass}_empty`].filter(Boolean)

  async function paste() {
    const clipText = await clipboardTools.paste()
    if (clipText) { onChange(clipText); onSubmit(clipText) }
  }

  return <div className={`${globalClass} ${modifiers.join(' ')}`}>
    <input className={`${globalClass}__input-elem`} ref={inputRef} aria-label={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') onSubmit() }}
      onFocus={(event) => { setFocused(true); onFocus?.(event) }}
      onBlur={(event) => { setFocused(false); onBlur?.(event) }}
      name={name} value={value} autoComplete="off" type="url" />
    <div className={`${globalClass}__actions ${globalClass}__clear`}>
      <Button icon={Cross} type={ButtonType.GHOST} size={ButtonSize.LARGE} aria-label="Clear URL"
        onClick={() => onChange('', true)} />
    </div>
    <div className={`${globalClass}__actions ${globalClass}__cta-actions`}>
      {mobileTip && <span className={`${globalClass}__cta-actions__mobile-tip`}>{mobileTip}</span>}
      <Button label="Paste" type={ButtonType.SECONDARY} size={ButtonSize.LARGE} onClick={() => void paste()} />
      {context.user && <Button icon={Snooze} className={`${globalClass}__snooze`} label="Snooze"
        type={ButtonType.SECONDARY} size={ButtonSize.LARGE} onClick={onSnooze} />}
      <Button icon={Enter} className={`${globalClass}__create`} label="Create"
        type={hasCta ? ButtonType.PRIMARY : ButtonType.SECONDARY} size={ButtonSize.LARGE} onClick={() => onSubmit()} />
    </div>
    <div aria-hidden="true" className={`${globalClass}__placeholder ${globalClass}__placeholder_${value ? 'hide' : 'show'}`}>{placeholder}</div>
  </div>
}
