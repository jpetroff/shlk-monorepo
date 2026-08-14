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
  const [mobileInputActive, setMobileInputActive] = React.useState(
    () => isMobile && Boolean(context.extension?.activeTabUrl)
  )
  const globalClass = styles.homeClass + '_home'
  const mobileInputClass = mobileInputActive ? `${globalClass}_mobile-input-active` : ''
  return <div className={`${globalClass} ${mobileInputClass}`}>
    <div className={`${globalClass}__header`} aria-hidden={mobileInputActive || undefined}
      inert={mobileInputActive || undefined}>
      <Header hideLogo />
    </div>
    <Scroller className={`${globalClass}__body`} hideScroll>
      <ShortlinkBar onMobileInputModeChange={setMobileInputActive} />
    </Scroller>
  </div>
}
