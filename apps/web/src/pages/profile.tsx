import styles from './styles-profile.module.less'
import * as React from 'react'
import { Navigate } from 'react-router'
import Link from '../components/link'
import Header, { HeaderPosition } from '../apps/Header'
import Footer from '../apps/Footer'
import UserSettings from '../apps/UserSettings'
import Icon, { CaretLeft, IconSize } from '../components/icons'
import { useAppContext } from '../js/app.context'
import Scroller from '../components/scroller'
import LoadingSkeleton from '../components/loading-skeleton'

export default function Profile() {
  const context = useAppContext()
  if (!context.user?.email) return <Navigate to="/login" replace />
  if (context.authStatus === 'checking') return <LoadingSkeleton />
  const globalClass = styles.profileClass + '_profile'
  return <div className={globalClass}>
    <Header backButton="/" title="My profile" position={HeaderPosition.sticky} />
    <div className={`${globalClass}__layout`}><div className={`${globalClass}__body`}>
      <Link to="/" className="narrow-body__back-button" aria-label="Go to home"><Icon useIcon={CaretLeft} size={IconSize.LARGE} /></Link>
      <Scroller><UserSettings className={`${globalClass}__profile-content`} /></Scroller>
    </div></div>
    <Footer />
  </div>
}
