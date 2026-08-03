import styles from './styles-shortlink-list-item.module.less'
import * as React from 'react'
import classNames from 'classnames'
import LinkTools from '../../js/link.tools'
import Link, { ActionLink, LinkColors } from '../link'
import Button, { ButtonSize, ButtonType } from '../button'
import { MoreVertical } from '../icons'

type Props = { hash: string, location: string, descriptor?: { userTag?: string, descriptionTag: string },
  timestamp: number, siteTitle?: string, siteDescription?: string, urlMetadata?: AnyObject,
  snooze?: { awake: number, description?: string }, tags?: string[], showDescription?: boolean,
  menuOpen?: boolean, onContextClick?: (htmlNode: HTMLElement) => void, onCopyClick?: () => void }

function ShortlinkListItem({ location, hash, descriptor, siteTitle, siteDescription, urlMetadata,
  showDescription, menuOpen = false, onContextClick, onCopyClick }: Props) {
  const globalClass = `${styles.wrapperClass}_shortlink-item`
  const displayShortlink = descriptor?.descriptionTag ? LinkTools.makeDisplayShortlink(descriptor) : LinkTools.makeDisplayShortlink(hash)
  const favicon = urlMetadata?.favicons?.[0]?.src ?? '/assets/default-favicon.png'
  const noDescription = siteDescription === undefined ? '' : `${globalClass}__display-full-link_no-description`
  return <div className={classNames(globalClass)}>
    <Link className={`${globalClass}__display-full-link ${noDescription}`} href={location} newTab colorScheme={LinkColors.USER}>
      <div className={`${globalClass}__display-full-link__main`}><div className={`${globalClass}__display-full-link__title`}>{siteTitle}</div></div>
      <div className={`${globalClass}__display-full-link__subheader`}>
        <img className={`${globalClass}__display-full-link__favicon`} src={favicon} alt="" />
        <span className={`${globalClass}__display-full-link__subheader__span`}>{LinkTools.makeDisplayUrl(location)}</span>
      </div>
      {showDescription && siteDescription && <div className={`${globalClass}__display-full-link__description`}>{siteDescription}</div>}
    </Link>
    <div className={`${globalClass}__shortlink-meta`}>
      <ActionLink onClick={onCopyClick} className={`${globalClass}__display-shortlink`} suffix="Copy+Copied">
        <span className={`${globalClass}__shortlink`}>{displayShortlink}</span>
      </ActionLink>
      <Button icon={MoreVertical} size={ButtonSize.SMALL} type={ButtonType.GHOST}
        aria-label={`Actions for ${siteTitle || location}`} aria-haspopup="menu" aria-expanded={menuOpen}
        onClick={(_event, element) => { if (element) onContextClick?.(element) }} />
    </div>
  </div>
}

ShortlinkListItem.Loading = function Loading() {
  const globalClass = styles.wrapperClass + '_shortlink-item'
  return <div className={`${globalClass} ${globalClass}_loading`} aria-label="Loading shortlinks">
    <div className={`${globalClass}__display-full-link`}>
      <div className={`${globalClass}__display-full-link__main`}><div className={`${globalClass}__display-full-link__title`}>&nbsp;</div></div>
      <div className={`${globalClass}__display-full-link__subheader`}>
        <img className={`${globalClass}__display-full-link__favicon`} src="/assets/default-favicon.png" alt="" />
        <span className={`${globalClass}__display-full-link__subheader__span`}>&nbsp;</span>
      </div>
    </div>
  </div>
}

export default ShortlinkListItem as typeof ShortlinkListItem & { Loading: typeof ShortlinkListItem.Loading }
