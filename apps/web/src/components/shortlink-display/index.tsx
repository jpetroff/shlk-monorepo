import styles from './styles-shortlink-display.module.less'
import * as React from 'react'
import { ActionLink, LinkColors } from '../link'
import Button, { ButtonSize, ButtonType } from '../button'
import clipboardTools from '../../js/clipboard.tools'
import classNames from 'classnames'
import LinkTools from '../../js/link.tools'

type Props = { shortlink?: string, isLoading?: boolean, placeholder?: string, hashLength?: number, hasCta?: boolean, error?: boolean }

export default function ShortlinkDisplay({ placeholder, shortlink, isLoading = false, hasCta = true, error = false }: Props) {
  const globalClass = styles.wrapperClass + '_shortlink-display'
  const classes = classNames(globalClass, { [`${globalClass}_empty`]: !shortlink, [`${globalClass}_error`]: error })
  const displayShortlink = shortlink ? LinkTools.makeDisplayUrl(shortlink) : ''
  function copy() { if (shortlink && clipboardTools.enabled) clipboardTools.copy(shortlink) }

  return <div className={classes}>
    <div className={`${globalClass}__content-wrapper`}>
      <div className={`${globalClass}__label`}>Get your shortened link</div>
      <div className={`${globalClass}__action-wrapper ${shortlink ? `${globalClass}__action-wrapper_has-shortlink` : ''} link-block`}>
        <span className={`${globalClass}__text ${isLoading ? `${globalClass}__text_loading` : ''}`}>
          {shortlink ? displayShortlink : <>{placeholder}/<span className={`${globalClass}__text_placeholder-spacing`}>{'••••'}</span></>}
        </span>
        {shortlink && <ActionLink className={`${globalClass}__copy-pseudolink`} colorScheme={LinkColors.APP}
          flyover="Copied!" onClick={copy}>{isLoading ? 'Loading' : 'Copy shortlink'}</ActionLink>}
      </div>
    </div>
    {(isLoading || shortlink) && <Button className={`${globalClass}__copy-button`} label="Copy"
      size={ButtonSize.LARGE} type={hasCta ? ButtonType.PRIMARY : ButtonType.SECONDARY}
      isDisabled={!shortlink} isLoading={isLoading} onClick={copy} flyover="Copied!" />}
  </div>
}
