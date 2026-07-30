import styles from './styles-shortlink-slug-input.module.less'
import * as _ from 'underscore'
import * as React from 'react'
import Link, { LinkColors } from '../link'
import Button, { ButtonSize, ButtonType } from '../button'
import classNames from 'classnames'

export type TextPattern = {
  key: string
  value: string
  readOnly?: boolean
  placeholder?: string
  lineBreak?: boolean
  mobileLineBreak?: boolean
}

export enum SlugInputSpecialChars {
  mobileLineBreak = '__mobileLineBreak__',
  lineBreak = '__lineBreak__'
}

type Props = {
  displayLink: string
  userTag: string
  value: string
  placeholder?: string
  flyover?: React.ReactElement
  onChange?: (value: string) => void
  onDebouncedChange?: (value: string) => void
  debounce?: number | null
  onDeferredChange?: (value: string) => void
  show?: boolean
  generatedLink?: string
  isLoading?: boolean
  hasCta?: boolean
  error?: boolean
}

export const ShortlinkSlugInput : React.FC<Props> = (
  {
    onChange,
    onDebouncedChange,
    debounce = 100,
    onDeferredChange,
    show = true,
    isLoading = false,
    generatedLink,
    hasCta = true,
    error = false,
    displayLink,
    userTag,
    value = "",
    placeholder = "type-your-custom-value",
    flyover
  } : Props
) => {

  const debounceMs = debounce ?? 100
  const debouncedFn = React.useCallback( 
    _.debounce( (fn: () => void) => {
      fn()
    }, debounceMs)
  ,[debounceMs])

  const globalClass = styles.wrapperClass+'_slug-input'
  const slugInputClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_error`]: error,
    [`${globalClass}_hide`]: !show
  })
  const activeActionWrapperClass = generatedLink ? globalClass+'__action-wrapper_has-shortlink' : ''

  let linkLabel : string = 'Copy custom shortlink'
  if(!generatedLink) linkLabel = ''
  if(isLoading) linkLabel = 'Loading'

  const btnLabel : string = 'Copy'
  if(isLoading) linkLabel = 'Loading'


  function handleCopy () {
    if(_.isFunction(navigator.clipboard.writeText) && generatedLink) {
      navigator.clipboard.writeText(generatedLink)
    } 
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if(_.isFunction(onChange)) 
      onChange(event.target.value)

    if(_.isFunction(onDeferredChange))
      _.defer(onDeferredChange, event.target.value)

    if(_.isFunction(onDebouncedChange) && debounce) 
      debouncedFn( () => {
        onDebouncedChange(event.target.value)
      })
  }

  return (
    <div className={`${slugInputClasses}`}>
      <div className={`${globalClass}__label`}>Make a custom link</div>
      <div className={`${globalClass}__content-wrapper`}>
        <div className={`${globalClass}__action-wrapper ${activeActionWrapperClass}`} 
        onClick={handleCopy}
      >
        <div className={`${globalClass}__constructed-input`}>
          <span className={`${globalClass}_text-filler ${globalClass}__input-common-style`}>{displayLink}/</span>
          <div className={`${globalClass}_text-filler ${globalClass}__input-common-style ${globalClass}__user-tag`}>
            {userTag}
            {flyover &&
              <div className={`${globalClass}__flyover`}>
                <div className={`${globalClass}__flyover__content`}>{flyover}</div>
              </div>
            }
          </div>
          <div className={`${globalClass}_text-filler ${globalClass}__input-common-style`}>@</div>
          <br className={`${globalClass}__mlbr`} />
          <span className={`${globalClass}__input-resizable`}>
            <input 
              className={`${globalClass}__input-resizable__real-input ${globalClass}__input-common-style`}
              value={value}
              onChange={handleChange}
            />
            <span className={`${globalClass}__input-resizable__width-sizer ${globalClass}__input-common-style ${globalClass}__input-resizable__width-sizer_${value ? 'hide' : 'show'}`}>{value || placeholder}</span>
          </span>
        </div>
        <Link
            className={`${globalClass}__copy_pseudolink`}
            colorScheme={LinkColors.APP}
            isDisabled={!generatedLink || error}
            isLoading={isLoading}
            label={linkLabel}
            flyover='Copied!'
            />
        </div>
        {
          (isLoading || generatedLink) &&
          <Button
            className={`${globalClass}__copy_button`}
            label={btnLabel}
            size={ButtonSize.LARGE}
            type={hasCta ? ButtonType.PRIMARY : ButtonType.SECONDARY}
            isDisabled={!generatedLink || error}
            isLoading={isLoading}
            onClick={handleCopy}
            flyover='Copied!'
            />
        }
      </div>
    </div>
  )

}

export default ShortlinkSlugInput