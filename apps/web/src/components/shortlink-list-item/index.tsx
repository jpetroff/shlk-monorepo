import styles from './styles-shortlink-list-item.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import classNames from 'classnames'
import LinkTools from '../../js/link.tools'
import Link, { LinkColors } from '../link'
import Button, { ButtonSize, ButtonType } from '../button'
import { MoreVertical } from '../icons'

enum ActionLabels {
  copy = 'Copy',
  copied = 'Copied'
}

type Props = {
  hash: string
  location: string
  descriptor?: {
    userTag?: string
    descriptionTag: string
  }
  timestamp: number
  siteTitle?: string
  siteDescription?: string
  urlMetadata?: AnyObject
  snooze?: {
    awake: number
    description?: string
  }
  tags?: string[]
  showDescription?: boolean
  onContextClick?: (htmlNode: HTMLElement) => void
  onCopyClick?: () => void
}

const ShortlinkListItem : React.FC<Props> & { Loading: React.FC } = (
  {
    location,
    hash,
    descriptor,
    timestamp,
    siteTitle,
    siteDescription,
    urlMetadata,
    snooze,
    tags,
    showDescription,
    onContextClick,
    onCopyClick
  } : Props
) => {
  const globalClass = `${styles.wrapperClass}_shortlink-item`
  const shortlinkItemClasses = classNames({
    [`${globalClass}`]: true
  })
  const shortlink = descriptor?.descriptionTag && descriptor.descriptionTag != '' ? 
                    LinkTools.generateDescriptiveShortlink( descriptor ) :
                    LinkTools.generateShortlinkFromHash(hash)

  const displayShortlink =  descriptor?.descriptionTag && descriptor.descriptionTag != '' ? 
                            LinkTools.makeDisplayShortlink( descriptor ) :
                            LinkTools.makeDisplayShortlink(hash)
  
  const favicon = (urlMetadata?.favicons && urlMetadata?.favicons[0] && urlMetadata?.favicons[0].src) ? urlMetadata?.favicons[0].src : '/assets/default-favicon.png'

  function handleCopyClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if(_.isFunction(onCopyClick)) onCopyClick()
    return void 0
  }

  function handleContextClick(event: React.SyntheticEvent<HTMLAnchorElement, Event>, elem?: HTMLElement) {
    if(_.isFunction(onContextClick) && elem) onContextClick(elem)
    return void 0
  }

  const noDescription = (siteDescription == undefined) ? `` : `${globalClass}__display-full-link_no-description`
  return (
    <div className={`${shortlinkItemClasses}`}>
      <Link  
        className={`${globalClass}__display-full-link ${noDescription}`} 
        href={location}
        colorScheme={LinkColors.USER}
        >
        <div className={`${globalClass}__display-full-link__main`}>
          <div className={`${globalClass}__display-full-link__title`}>{siteTitle}</div>
        </div>
        <div className={`${globalClass}__display-full-link__subheader`}>
          <img className={`${globalClass}__display-full-link__favicon`} src={favicon} />
          <span className={`${globalClass}__display-full-link__subheader__span`}>{LinkTools.makeDisplayUrl(location)}</span>
        </div>
        {showDescription && siteDescription &&
          <div className={`${globalClass}__display-full-link__description`}>
            {siteDescription}
          </div>
        }
      </Link>
      <div className={`${globalClass}__shortlink-meta`}>
        <Link
          onClick={handleCopyClick}
          className={`${globalClass}__display-shortlink`}
          suffix={`${ActionLabels.copy}+${ActionLabels.copied}`}
          >
          <span className={`${globalClass}__shortlink`}>{displayShortlink}</span>
        </Link>
        <Button
          icon={MoreVertical}
          size={ButtonSize.SMALL}
          type={ButtonType.GHOST}
          onClick={handleContextClick}
          />
      </div>
    </div>
  )
}

ShortlinkListItem.Loading = function (props: {}) : React.ReactElement<{}, any> | null {
  const globalClass = styles.wrapperClass + '_shortlink-item'
  return (
    <div className={`${globalClass} ${globalClass}_loading`}>
      <div className={`${globalClass}__display-full-link`}>
        <div className={`${globalClass}__display-full-link__main`}>
          <div className={`${globalClass}__display-full-link__title`}>&nbsp;</div>
        </div>
        <div className={`${globalClass}__display-full-link__subheader`}>
          <img className={`${globalClass}__display-full-link__favicon`} src={`/assets/default-favicon.png`} />
          <span className={`${globalClass}__display-full-link__subheader__span`}>&nbsp;</span>
        </div>
      </div>
    </div>
  )
}

export default ShortlinkListItem