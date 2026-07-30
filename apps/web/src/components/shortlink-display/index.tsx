import styles from './styles-shortlink-display.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import Link, { LinkColors } from '../link'
import Button, { ButtonSize, ButtonType } from '../button'
import clipboardTools from '../../js/clipboard.tools'
import { Flyover } from '../tooltip'
import classNames from 'classnames'
import LinkTools from '../../js/link.tools'

type Props = {
  shortlink: string | undefined
  isLoading?: boolean
  placeholder?: string
  hashLength?: number,
  hasCta?: boolean,
  error?: boolean
}

export const ShortlinkDisplay : React.FC<Props> = function(
  {
    placeholder,
    hashLength,
    shortlink,
    isLoading = false,
    hasCta = true,
    error = false
  } : Props
) {
  const [showFlyover, setShowFlyover] = React.useState(false)

  function copyOnClick() {
    if(shortlink && clipboardTools.enabled) {
      clipboardTools.copy(shortlink)
      setShowFlyover(true)
    }
  }

  const globalClass = styles.wrapperClass+'_shortlink-display'
  const shortlinkClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_empty`]: !shortlink,
    [`${globalClass}_error`]: error
  })

  const placeholderText = (<>{placeholder}/<span className={globalClass+'__text_placeholder-spacing'}>{'••••'}</span></>)

  let linkLabel : string = 'Copy shortlink'

  const btnLabel : string = 'Copy'
  if(isLoading) linkLabel = 'Loading'

  const displayShortlink = shortlink ? LinkTools.makeDisplayUrl(shortlink) : ''

  const activeActionWrapperClass = shortlink ? globalClass+'__action-wrapper_has-shortlink' : ''
  const placeholderLoadingClass = isLoading ? globalClass+'__text_loading' : ''

  return (
    <div className={`${shortlinkClasses}`}>
      <div className={`${globalClass}__content-wrapper`}>
        <div className={`${globalClass}__label`}>Get your shortened link</div>
        <div className={`${globalClass}__action-wrapper ${activeActionWrapperClass} link-block`} 
          onClick={copyOnClick}
        >
          <span className={`${globalClass}__text ${placeholderLoadingClass}`}>
            {shortlink ? displayShortlink : placeholderText}
          </span>

          {shortlink && 
            <Link
              className={`${globalClass}__copy-pseudolink`}
              colorScheme={LinkColors.APP}
              flyover={'Copied!'}
            >
              {linkLabel}
              {showFlyover && <Flyover label={'Copied!'} onDone={() => setShowFlyover(false)} />}
            </Link>
            }
        </div>
      </div>
      {
        (isLoading || shortlink) &&
        <Button
          className={`${globalClass}__copy-button`}
          label={btnLabel}
          size={ButtonSize.LARGE}
          type={hasCta ? ButtonType.PRIMARY : ButtonType.SECONDARY}
          isDisabled={!shortlink}
          isLoading={isLoading}
          flyover={'Copied!'}
          />
      }
    </div>
  )
}

export default ShortlinkDisplay