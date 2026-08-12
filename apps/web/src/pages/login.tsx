import styles from './styles-login.module.less'
import * as React from 'react'
import Link from '../components/link'
import Header from '../apps/Header'
import Footer from '../apps/Footer'
import Icon, { CaretLeft, IconSize, Google } from '../components/icons'
import { ButtonLink, ButtonSize, ButtonType } from '../components/button'
import Video from '../components/video'
import Scroller from '../components/scroller'
import logoPosterUrl from '../assets/media/shlk_logo.webp'
import logoVideoUrl from '../assets/media/shlk_logo.mp4'

export default function Login() {
  const globalClass = styles.loginClass + '_login'
  return <div className={globalClass}>
    <Header backButton="/" title="Log in" />
    <div className={`${globalClass}__layout`}><div className={`${globalClass}__body`}>
      <Link to="/" className="narrow-body__back-button" aria-label="Go to home"><Icon useIcon={CaretLeft} size={IconSize.LARGE} /></Link>
      <Scroller hideScroll className={`${globalClass}__scroller`}>
        <div className={`${globalClass}__login_content`}>
          <Video className={`${globalClass}__video`} thumbnail={logoPosterUrl}
            src={[{ link: logoVideoUrl, type: 'video/mp4' }]} aspectRatio={1200 / 360} timeout={1000} />
          <span className={`${globalClass}__intro_text`}>Create an account using Google<br />or log into an existing one</span>
          <ButtonLink href="/oauth/google" label="Log in with Google" size={ButtonSize.LARGE}
            type={ButtonType.PRIMARY} icon={Google} />
          <span className={`${globalClass}__legal`}>By clicking <strong>Log in</strong>,<br />you agree to our <Link inline to="/privacy-policy">Privacy policy</Link></span>
        </div>
      </Scroller>
    </div></div>
    <Footer />
  </div>
}
