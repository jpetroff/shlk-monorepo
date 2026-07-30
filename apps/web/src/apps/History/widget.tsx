import styles from './styles-history.module.less'
import * as React from 'react'
import { TCachedLink } from '../../js/cache'
import clipboardTools from '../../js/clipboard.tools'
import Link, { ActionLink, LinkColors } from '../../components/link'
import LinkTools from '../../js/link.tools'
import classNames from 'classnames'
import Button, { ButtonSize, ButtonType } from '../../components/button'
import { useMediaQuery } from '../../js/react-hooks'
import constants from '../../js/constants'
import { useNavigate } from 'react-router'

type Props = { list: TCachedLink[], isLoading?: boolean, display?: number }

export default function HistoryWidget({ list, isLoading = false, display = 3 }: Props) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery(constants.MediaQueries.mobile)
  const globalClass = styles.widgetWrapper + '_history-widget'
  if (list.length === 0 && !isLoading) return null

  return <div className={classNames(globalClass)}>
    <div className={`${globalClass}__header`}>Last created shortlinks</div>
    <div className={`${globalClass}__link-list`}>
      {!isLoading && list.map((item) => {
        if (!item.hash) return null
        const hasDescriptor = !!item.descriptor?.descriptionTag
        const shortlink = hasDescriptor ? LinkTools.generateDescriptiveShortlink(item.descriptor!) : LinkTools.generateShortlinkFromHash(item.hash)
        const displayShortlink = hasDescriptor ? LinkTools.makeDisplayShortlink(item.descriptor!) : LinkTools.makeDisplayShortlink(item.hash)
        return <div className={`${globalClass}__link-block`} key={`${item.location}-${item.hash}`}>
          <ActionLink onClick={() => clipboardTools.copy(shortlink)} className={`${globalClass}__shortlink`} suffix="Copy+Copied">
            <span className={`${globalClass}__shortlink__label`}>{displayShortlink}</span>
          </ActionLink>
          <Link className={`${globalClass}__full-link`} href={item.location} newTab colorScheme={LinkColors.USER}>
            <span className={`${globalClass}__full-link__label`}>{LinkTools.makeDisplayUrl(item.location)}</span>
          </Link>
        </div>
      })}
      {isLoading && Array.from({ length: display }, (_, index) => <div
        className={`${globalClass}__link-block ${globalClass}__loading`} key={`loading-${index}`} aria-hidden="true">
        <div className={`${globalClass}__shortlink`}><span className={`${globalClass}__shortlink__label`}>&nbsp;</span></div>
        <div className={`${globalClass}__full-link`}><span className={`${globalClass}__full-link__label`}>&nbsp;</span></div>
      </div>)}
      {isMobile && <Button className={`${globalClass}__all-links`} label="Show all links"
        type={ButtonType.SECONDARY} size={ButtonSize.SMALL} fullWidth onClick={() => navigate('/app')} />}
    </div>
  </div>
}
