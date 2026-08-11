import styles from './styles-shortlink-bar.module.less'
import { getCookie, validateURL } from '../../js/utils'
import * as React from 'react'
import HeroInput from '../../components/hero-input'
import ShortlinkDisplay from '../../components/shortlink-display'
import ShortlinkSlugInput from '../../components/shortlink-slug-input'
import Snackbar, { SnackbarType } from '../../components/snackbar'
import SnoozeList from '../../components/snooze-list'
import linkTools from '../../js/link.tools'
import clipboardTools from '../../js/clipboard.tools'
import { useAppContext } from '../../js/app.context'
import { HistoryWidget } from '../History'
import Video from '../../components/video'
import Footer from '../Footer'
import Link from '../../components/link'
import config from '../../js/config'
import constants from '../../js/constants'
import { useMediaQuery } from '../../js/react-hooks'
import { useLocation } from 'react-router'
import { useShortlinkCreator } from './use-shortlink-creator'

type Props = { onMobileInputModeChange?: (active: boolean) => void }

export default function ShortlinkBar({ onMobileInputModeChange }: Props) {
  const location = useLocation()
  const context = useAppContext()
  const isMobile = useMediaQuery(constants.MediaQueries.mobile)
  const [queryLocation] = linkTools.queryUrlSearchParams(['l'], location.search)
  const activeTabUrl = context.extension?.activeTabUrl
  const initialLocationRef = React.useRef(activeTabUrl || queryLocation || '')
  const initialLocation = initialLocationRef.current
  const historyLimit = isMobile ? 2 : 3
  const userTag = context.user?.userTag || getCookie('userTag') || 'someone'
  const creator = useShortlinkCreator(initialLocation, userTag, historyLimit)
  const { state, dispatch } = creator
  const heroInputRef = React.useRef<HTMLInputElement>(null)
  const [mobileInputActive, setMobileInputActive] = React.useState(
    isMobile && config.target === 'extension' && Boolean(initialLocation)
  )
  const scrollTimerRef = React.useRef<number | null>(null)
  const autoSubmitted = React.useRef(false)

  React.useEffect(() => {
    if (!isMobile || config.target === 'extension') heroInputRef.current?.focus()
  }, [isMobile])

  React.useEffect(() => {
    if (autoSubmitted.current || activeTabUrl || !validateURL(queryLocation || '')) return
    autoSubmitted.current = true
    void creator.submitLocation(queryLocation ?? undefined)
  }, [activeTabUrl, creator.submitLocation, queryLocation])

  const handleGlobalKeyDown = React.useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return
    if (event.code === 'KeyD') {
      event.preventDefault(); event.stopPropagation()
      void creator.submitLocation().then((shortlink) => {
        if (!shortlink) return
        clipboardTools.copy(shortlink)
        dispatch({ type: 'notice', notice: { type: 'success', message: 'Shortlink copied to clipboard' } })
      })
    } else if (event.code === 'KeyS') {
      event.preventDefault(); event.stopPropagation()
      dispatch({ type: 'snooze-options', value: true })
    }
  })

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => handleGlobalKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  React.useEffect(() => () => {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current)
  }, [])

  function setMobileMode(active: boolean) {
    if (!isMobile || mobileInputActive === active) return
    setMobileInputActive(active)
    onMobileInputModeChange?.(active)
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current)
    if (active) scrollTimerRef.current = window.setTimeout(() => document.body.scrollTo(0, 0), 250)
  }

  function updateLocation(value: string, isClear = false) {
    dispatch({ type: 'location', value })
    if (isClear) setMobileMode(false)
  }

  const generatedShortlink = state.result ? linkTools.generateShortlinkFromHash(state.result.hash) : undefined
  const generatedDescriptiveShortlink = state.result?.descriptor?.descriptionTag === state.descriptionTag && state.result.descriptor
    ? linkTools.generateDescriptiveShortlink(state.result.descriptor) : undefined
  const globalClass = styles.homepage + '_app-body'
  const mobileClass = mobileInputActive ? '__mobile-convenience-state' : ''

  return <div className={globalClass}>
    <div className={`${globalClass}__layout`}>
      <div className={`${globalClass}__shortlink-block ${mobileClass}`}>
        <div className={`${globalClass}__offset-wrapper`}>
          {!mobileInputActive && <Video className={`${globalClass}__video`} thumbnail="/assets/shlk_logo.jpg"
            src={[{ link: '/assets/shlk_logo.mp4', type: 'video/mp4' }]} aspectRatio={1200 / 360} timeout={1000} />}
          <HeroInput inputRef={heroInputRef} onChange={updateLocation}
            onSubmit={(value) => void creator.submitLocation(value)}
            onSnooze={() => dispatch({ type: 'snooze-options', value: true })}
            name="URL" placeholder="Type or paste a link" value={state.location}
            onFocus={() => setMobileMode(true)} hasCta={!generatedShortlink} />
        </div>
        {!state.showSnoozeOptions && <>
          <ShortlinkDisplay placeholder={config.displayServiceUrl} shortlink={generatedShortlink}
            isLoading={state.createPhase === 'loading'} hasCta={!!generatedShortlink && !generatedDescriptiveShortlink}
            error={state.createPhase === 'error'} />
          {generatedShortlink && <ShortlinkSlugInput displayLink={linkTools.displayServiceUrl}
            userTag={context.user?.userTag || state.userTag || 'someone'} value={state.descriptionTag}
            placeholder="your-custom-url" onValueChange={(value) => dispatch({ type: 'descriptor', value })}
            show generatedLink={generatedDescriptiveShortlink} isLoading={state.descriptorPhase === 'loading'}
            hasCta={!generatedDescriptiveShortlink} error={state.descriptorPhase === 'error'}
            flyover={context.user
              ? <div className={`${globalClass}__logged-content`}>Choose a different name in <Link inline to="/app/profile">Profile</Link></div>
              : <div className={`${globalClass}__anonymous-content`}>Make it unique by <Link inline to="/login">creating an account</Link></div>} />}
        </>}
        {state.showSnoozeOptions && <SnoozeList onSnooze={(value) => void creator.snooze(value)} />}
        <div className={`${globalClass}__snackbar-container`}>
          {state.notice && <Snackbar type={SnackbarType.MESSAGE} message={state.notice.message} canDismiss timer={2000}
            onDismiss={() => dispatch({ type: 'notice', notice: null })} />}
        </div>
      </div>
      <div className={`${globalClass}__footer-wrapper`}>
        <HistoryWidget list={creator.recentItems} isLoading={creator.recentLoading}
          display={historyLimit} />
      </div>
    </div>
    <Footer />
  </div>
}
