import styles from './styles-home.module.less'
import * as React from 'react'
import Header from '../apps/Header'
import ShortlinkBar from '../apps/ShortlinkBar'
import Scroller from '../components/scroller'
import { useAppContext } from '../js/app.context'
import { useMediaQuery } from '../js/react-hooks'
import constants from '../js/constants'

export default function Home() {
  const context = useAppContext()
  const isMobile = useMediaQuery(constants.MediaQueries.mobile)
  const [visibleHeader, setVisibleHeader] = React.useState(
    () => !(isMobile && Boolean(context.extension?.activeTabUrl))
  )
  const globalClass = styles.homeClass + '_home'
  return <div className={`${globalClass} ${visibleHeader ? '' : `${globalClass}_no-header`}`}>
    {visibleHeader && <Header hideLogo />}
    <Scroller className={`${globalClass}__body`} hideScroll>
      <ShortlinkBar onMobileInputModeChange={(active) => setVisibleHeader(!active)} />
    </Scroller>
  </div>
}
