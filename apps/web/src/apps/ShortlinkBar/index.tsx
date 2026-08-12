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
import browserApi from '../../js/browser.api'
import AppError from '../../js/app-error'
import Button, { ButtonLink, ButtonSize, ButtonType } from '../../components/button'
import logoPosterUrl from '../../assets/media/shlk_logo.webp'
import logoVideoUrl from '../../assets/media/shlk_logo.mp4'

type Props = { onMobileInputModeChange?: (active: boolean) => void }
type SnoozeAvailability = 'idle' | 'checking' | 'available' | 'unavailable'

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
  const [snoozeAvailability, setSnoozeAvailability] = React.useState<SnoozeAvailability>(
    config.target === 'extension' ? 'available' : 'idle'
  )
  const snoozeCheckSequence = React.useRef(0)
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

  const openSnooze = React.useCallback(async () => {
    if (!context.user || !validateURL(state.location)) {
      context.reportError(new AppError('Enter a valid link before snoozing it.', { code: 'INVALID_SNOOZE_URL' }))
      return
    }
    dispatch({ type: 'snooze-options', value: true })
    if (config.target === 'extension') { setSnoozeAvailability('available'); return }
    const sequence = ++snoozeCheckSequence.current
    setSnoozeAvailability('checking')
    const available = await browserApi.probeSnoozeExtension()
    if (sequence === snoozeCheckSequence.current) {
      setSnoozeAvailability(available ? 'available' : 'unavailable')
    }
  }, [context, dispatch, state.location])

  React.useEffect(() => {
    if (!state.showSnoozeOptions) {
      setSnoozeAvailability(config.target === 'extension' ? 'available' : 'idle')
    }
  }, [state.showSnoozeOptions])

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
      void openSnooze()
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

  const snoozeLocationValid = Boolean(context.user && validateURL(state.location))
  const generatedShortlink = state.result ? linkTools.generateShortlinkFromHash(state.result.hash) : undefined
  const generatedDescriptiveShortlink = state.result?.descriptor?.descriptionTag === state.descriptionTag && state.result.descriptor
    ? linkTools.generateDescriptiveShortlink(state.result.descriptor) : undefined
  const globalClass = styles.homepage + '_app-body'
  const mobileClass = mobileInputActive ? '__mobile-convenience-state' : ''

  return <div className={globalClass}>
    <div className={`${globalClass}__layout`}>
      <div className={`${globalClass}__shortlink-block ${mobileClass}`}>
        <div className={`${globalClass}__offset-wrapper`}>
          {!mobileInputActive && <Video className={`${globalClass}__video`} thumbnail={logoPosterUrl}
            src={[{ link: logoVideoUrl, type: 'video/mp4' }]} aspectRatio={1200 / 360} timeout={1000} />}
          <HeroInput inputRef={heroInputRef} onChange={updateLocation}
            onSubmit={(value) => void creator.submitLocation(value)}
            onSnooze={() => void openSnooze()}
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
        {state.showSnoozeOptions && snoozeAvailability === 'available' && snoozeLocationValid &&
          <SnoozeList onSnooze={(value) => void creator.snooze(value)} />}
        {state.showSnoozeOptions && snoozeAvailability === 'available' && !snoozeLocationValid &&
          <div className={`${globalClass}__snooze-status`} role="status">Enter a valid link before snoozing it.</div>}
        {state.showSnoozeOptions && snoozeAvailability === 'checking' &&
          <div className={`${globalClass}__snooze-status`} role="status">Checking for the Chrome extension…</div>}
        {state.showSnoozeOptions && snoozeAvailability === 'unavailable' &&
          <div className={`${globalClass}__snooze-status`} role="status">
            <div>Install or update the shlk.cc Chrome extension to reopen snoozed links.</div>
            <div className={`${globalClass}__snooze-status__actions`}>
              {config.extensionLink && <ButtonLink href={config.extensionLink} newTab label="Install extension"
                size={ButtonSize.LARGE} type={ButtonType.PRIMARY} />}
              <Button label="Retry" size={ButtonSize.LARGE} type={ButtonType.SECONDARY}
                onClick={() => void openSnooze()} />
            </div>
          </div>}

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
