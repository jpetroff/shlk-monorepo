import styles from './styles-page.module.less'
import * as React from 'react'
import { Navigate } from 'react-router'
import Link from '../components/link'
import Header, { HeaderPosition } from '../apps/Header'
import Icon, { CaretLeft, IconSize } from '../components/icons'
import { useAppContext } from '../js/app.context'
import ShortlinkList from '../apps/ShortlinkList'
import { useMediaQuery } from '../js/react-hooks'
import constants from '../js/constants'

export default function AppMain() {
  const context = useAppContext()
  const isMobile = useMediaQuery(constants.MediaQueries.mobile)
  if (!context.user?.email) return <Navigate to="/login" replace />
  const globalClass = styles.appMainClass + '_app-main'
  return <div className={globalClass}>
    <Header backButton="/" title="My Links" position={isMobile ? HeaderPosition.fixed : undefined} />
    <div className={`${globalClass}__layout`}><div className={`${globalClass}__body`}>
      <Link to="/" className="narrow-body__back-button" aria-label="Go to home"><Icon useIcon={CaretLeft} size={IconSize.LARGE} /></Link>
      <ShortlinkList />
    </div></div>
  </div>
}
