import styles from './styles-history.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import {ShortlinkLocal, TCachedLink} from '../../js/cache'
import clipboardTools from '../../js/clipboard.tools'
import Link, { LinkColors } from '../../components/link'
import LinkTools from '../../js/link.tools'
import classNames from 'classnames'
import Button, { ButtonSize, ButtonType } from '../../components/button'
import AppContext from '../../js/app.context'
import { checkMobileMQ } from '../../js/utils'

type Props = {
  list: TCachedLink[]
  totalCount?: number
  isLoading?: boolean
  display?: number
  context?: React.ContextType<typeof AppContext>
  router?: PageRouterProps
}

enum ActionLabels {
  copy = 'Copy',
  copied = 'Copied',
  open = 'Open'
}

const HistoryWidget : React.FC<Props> = (
  {
    list,
    totalCount = 0,
    isLoading = false,
    display = 3,
    context,
    router
  } : Props
) => {
  const globalClass = styles.widgetWrapper+'_history-widget'
  const widgetClasses = classNames({
    [`${globalClass}`]: true
  })
  const loadingSkeletons = _.range(display)

  const handleClick = (url: string, key: number, event?: React.MouseEvent) => {
    if(clipboardTools.enabled) clipboardTools.copy(url)
  }

  if(totalCount == 0 && !isLoading) return(<></>)

  return (
    <div 
      className={`${widgetClasses}`}
    >	
      <div className={`${globalClass}__header`}>Last created shortlinks</div>
      <div className={`${globalClass}__link-list`}>

        {!isLoading && list.map( (item: TCachedLink, key: number) => {
          if(!item.hash) return null
          const shortlink = item.descriptor?.descriptionTag && item.descriptor.descriptionTag != '' ? 
                            LinkTools.generateDescriptiveShortlink( item.descriptor ) :
                            LinkTools.generateShortlinkFromHash(item.hash)

          const displayShortlink =  item.descriptor?.descriptionTag && item.descriptor.descriptionTag != '' ? 
                                    LinkTools.makeDisplayShortlink( item.descriptor ) :
                                    LinkTools.makeDisplayShortlink( item.hash )

          const url = item.location
          const displayUrl = LinkTools.makeDisplayUrl(item.location)

          return (
          <div 
            className={`${globalClass}__link-block`} 
            key={key}
            >
            <Link
              onClick={(event) => handleClick(shortlink, key, event)}
              className={`${globalClass}__shortlink`}
              suffix={`${ActionLabels.copy}+${ActionLabels.copied}`}
            >
              <span className={`${globalClass}__shortlink__label`}>{displayShortlink}</span>
            </Link>
            <Link  
              className={`${globalClass}__full-link`} 
              href={url}
              colorScheme={LinkColors.USER}>
                <span className={`${globalClass}__full-link__label`}>{displayUrl}</span>
            </Link>
          </div>) 
        })}

        {isLoading && loadingSkeletons.map( (_, index) => {
          return (
            <div className={`${globalClass}__link-block ${globalClass}__loading`} key={index}>
              <div className={`${globalClass}__shortlink`}>
                <span className={`${globalClass}__shortlink__label`}>&nbsp;</span>
              </div>
              <div className={`${globalClass}__full-link`}>
                <span className={`${globalClass}__full-link__label`}>&nbsp;</span>
              </div>
            </div>
          )
        })}

        {router && checkMobileMQ() &&
          <Button 
            className={`${globalClass}__all-links`}
            label={`Show all links`}
            type={ButtonType.SECONDARY}
            size={ButtonSize.SMALL}
            fullWidth={true}
            onClick={() => router.navigate('/app')}
            />
        }
      </div>
    </div>
  )
}

export default HistoryWidget