import * as _ from 'underscore'
import * as React from 'react'
import styles from './styles-hero-input.module.less'

import Button, { ButtonSize, ButtonType } from '../button'
import { Cross, Enter, Snooze } from '../icons'
import { canShortcutPasteWithKeyboard, checkMobileMQ } from '../../js/utils'
import clipboardTools from '../../js/clipboard.tools'
import AppContext from '../../js/app.context'

type Props = {
  onChange: (str: string, isClearPress?: boolean) => void;
  onSubmit: () => void;
  onSnooze: () => void;
  placeholder: string;
  name: string;
  value?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  mobileTip?: string
  hasCta?: boolean
}

const HeroInput : React.FC<Props> = function(
  {
    onChange,
    onSubmit,
    onSnooze,
    name,
    placeholder,
    value = '',
    inputRef,
    onFocus,
    onBlur,
    mobileTip,
    hasCta = true
  } : Props
) {

  const [isFocus, setFocus] = React.useState(false)
  const inputId = React.useId()

  const appContext = React.useContext(AppContext)

  const handleKeyDown = (event: any) => {
    if (event.keyCode == 13 && _.isFunction(onSubmit)) {
      onSubmit()
    }
  }

  const handlePaste = async () => {
    const clipText = await clipboardTools.paste()
    if(clipText && clipText != '') {
      onChange(clipText)
      _.defer(onSubmit)
    }
  }

  const handleClear = (event: React.SyntheticEvent<HTMLAnchorElement, Event>) => {
    let doubleClick = false
    if(value == '') doubleClick = true
    onChange('', true)
    if(doubleClick) event.preventDefault()
  }

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => { setFocus(true); onFocus?.(event); return true }
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => { setFocus(false); onBlur?.(event); return true }

  const globalClass = styles.wrapperClass+'_hero-input'
  const wrapperMods : Array<string> = []

  if(isFocus) wrapperMods.push(globalClass+'_focus')
  if(canShortcutPasteWithKeyboard()) wrapperMods.push(globalClass+'_can-shortcut-paste')
  if(value && value != '') {
    wrapperMods.push(globalClass+'_not-empty')
  } else {
    wrapperMods.push(globalClass+'_empty')
  }

  return (
    <div className={`${globalClass} ${wrapperMods.join(' ')}`}>
      <input className={`${globalClass}__input-elem`} id={inputId}
        ref={inputRef}
        onChange={event => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        name={name}
        value={value}
        autoComplete='off'
        type='url'
        tabIndex={1}
        />
      <label htmlFor={inputId} className={`${globalClass}__actions ${globalClass}__clear`}>
        <Button 
          icon={Cross}
          type={ButtonType.GHOST}
          size={ButtonSize.LARGE}
          onClick={handleClear}
          />
      </label>
      <div className={`${globalClass}__actions ${globalClass}__cta-actions`}>
        {mobileTip && <span className={`${globalClass}__cta-actions__mobile-tip`}>
          {mobileTip}
        </span>}
        <label htmlFor={inputId} className={`${globalClass}__paste`}>
          <Button 
            label='Paste'
            type={ButtonType.SECONDARY}
            size={ButtonSize.LARGE}
            onClick={handlePaste}
            />
        </label>
        {appContext.user && 
        <Button
          icon={Snooze}
          className={`${globalClass}__snooze`}
          label='Snooze'
          type={ButtonType.SECONDARY}
          size={ButtonSize.LARGE}
          onClick={onSnooze}
          />
        }
        <Button
          icon={Enter}
          className={`${globalClass}__create`}
          label='Create'
          type={hasCta ? ButtonType.PRIMARY : ButtonType.SECONDARY}
          size={ButtonSize.LARGE}
          onClick={onSubmit}
          />
      </div>
      <div className={`${globalClass}__placeholder ${globalClass}__placeholder_${(value != '') ? 'hide' : 'show'}`}>
        {placeholder}
      </div>
    </div>
  );
}

export default HeroInput