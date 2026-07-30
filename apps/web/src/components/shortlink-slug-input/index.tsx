import styles from './styles-shortlink-slug-input.module.less'
import * as React from 'react'
import { ActionLink, LinkColors } from '../link'
import Button, { ButtonSize, ButtonType } from '../button'
import classNames from 'classnames'

type Props = {
  displayLink: string
  userTag: string
  value: string
  placeholder?: string
  flyover?: React.ReactElement
  onValueChange?: (value: string) => void
  show?: boolean
  generatedLink?: string
  isLoading?: boolean
  hasCta?: boolean
  error?: boolean
}

export default function ShortlinkSlugInput({
  show = true, isLoading = false, generatedLink, hasCta = true, error = false,
  displayLink, userTag, value, placeholder = 'type-your-custom-value', flyover, onValueChange
}: Props) {
  const globalClass = styles.wrapperClass + '_slug-input'
  const classes = classNames(globalClass, { [`${globalClass}_error`]: error, [`${globalClass}_hide`]: !show })
  const activeClass = generatedLink ? `${globalClass}__action-wrapper_has-shortlink` : ''

  function copy() {
    if (generatedLink) void navigator.clipboard.writeText(generatedLink)
  }

  return <div className={classes}>
    <div className={`${globalClass}__label`}>Make a custom link</div>
    <div className={`${globalClass}__content-wrapper`}>
      <div className={`${globalClass}__action-wrapper ${activeClass}`}>
        <div className={`${globalClass}__constructed-input`}>
          <span className={`${globalClass}_text-filler ${globalClass}__input-common-style`}>{displayLink}/</span>
          <div className={`${globalClass}_text-filler ${globalClass}__input-common-style ${globalClass}__user-tag`}>
            {userTag}
            {flyover && <div className={`${globalClass}__flyover`}><div className={`${globalClass}__flyover__content`}>{flyover}</div></div>}
          </div>
          <div className={`${globalClass}_text-filler ${globalClass}__input-common-style`}>@</div>
          <br className={`${globalClass}__mlbr`} />
          <span className={`${globalClass}__input-resizable`}>
            <input className={`${globalClass}__input-resizable__real-input ${globalClass}__input-common-style`}
              value={value} aria-label="Custom shortlink slug" onChange={(event) => onValueChange?.(event.currentTarget.value)} />
            <span aria-hidden="true" className={`${globalClass}__input-resizable__width-sizer ${globalClass}__input-common-style ${globalClass}__input-resizable__width-sizer_${value ? 'hide' : 'show'}`}>{value || placeholder}</span>
          </span>
        </div>
        <ActionLink className={`${globalClass}__copy_pseudolink`} colorScheme={LinkColors.APP}
          isDisabled={!generatedLink || error} isLoading={isLoading} label={generatedLink ? (isLoading ? 'Loading' : 'Copy custom shortlink') : ''}
          flyover="Copied!" onClick={copy} />
      </div>
      {(isLoading || generatedLink) && <Button className={`${globalClass}__copy_button`} label="Copy"
        size={ButtonSize.LARGE} type={hasCta ? ButtonType.PRIMARY : ButtonType.SECONDARY}
        isDisabled={!generatedLink || error} isLoading={isLoading} onClick={copy} flyover="Copied!" />}
    </div>
  </div>
}
