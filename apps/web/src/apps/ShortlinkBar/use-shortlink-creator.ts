import * as React from 'react'
import Query from '../../js/shortlink.gql'
import Cache, { TCachedLink } from '../../js/cache'
import linkTools from '../../js/link.tools'
import browserApi from '../../js/browser.api'
import { modifyURLSlug, setCookie } from '../../js/utils'
import { isAbortError, useAbortControllers, useDebouncedValue } from '../../js/react-hooks'
import { useAppContext } from '../../js/app.context'
import AppError from '../../js/app-error'

export type CreatorResult = Pick<ShortlinkDocument, 'location' | 'hash' | 'descriptor'>
type Phase = 'idle' | 'loading' | 'error'
export type CreatorNotice = { type: 'success', message: string }
export type CreatorState = {
  location: string
  result: CreatorResult | null
  userTag: string
  descriptionTag: string
  descriptorDirty: boolean
  createPhase: Phase
  descriptorPhase: Phase
  showSnoozeOptions: boolean
  notice: CreatorNotice | null
}
export type CreatorAction =
  | { type: 'location', value: string }
  | { type: 'create-loading' }
  | { type: 'result', result: CreatorResult, descriptorDirty?: boolean }
  | { type: 'create-error' }
  | { type: 'descriptor', value: string }
  | { type: 'descriptor-loading' }
  | { type: 'descriptor-error' }
  | { type: 'descriptor-clear' }
  | { type: 'default-user-tag', value: string }
  | { type: 'snooze-options', value: boolean }
  | { type: 'notice', notice: CreatorNotice | null }

export function creatorReducer(state: CreatorState, action: CreatorAction): CreatorState {
  switch (action.type) {
    case 'location': return { ...state, location: action.value.trim(), result: null, descriptionTag: '',
      descriptorDirty: false, createPhase: 'idle', descriptorPhase: 'idle', notice: null,
      showSnoozeOptions: action.value !== '' && state.showSnoozeOptions }
    case 'create-loading': return { ...state, createPhase: 'loading', showSnoozeOptions: false, notice: null }
    case 'result': return { ...state, location: action.result.location, result: action.result,
      descriptionTag: action.result.descriptor?.descriptionTag ?? state.descriptionTag,
      userTag: action.result.descriptor?.userTag ?? state.userTag,
      descriptorDirty: action.descriptorDirty ?? false, createPhase: 'idle', descriptorPhase: 'idle', notice: null }
    case 'create-error': return { ...state, createPhase: 'error', notice: null }
    case 'descriptor': return { ...state, descriptionTag: modifyURLSlug(action.value), descriptorDirty: true,
      descriptorPhase: action.value ? 'loading' : 'idle', notice: null }
    case 'descriptor-loading': return { ...state, descriptorPhase: 'loading' }
    case 'descriptor-error': return { ...state, descriptorPhase: 'error', notice: null }
    case 'descriptor-clear': return { ...state, descriptorDirty: false, descriptorPhase: 'idle' }
    case 'default-user-tag': return state.result || state.descriptorDirty ? state : { ...state, userTag: action.value }
    case 'snooze-options': return { ...state, showSnoozeOptions: action.value }
    case 'notice': return { ...state, notice: action.notice }
  }
}

export function useRecentShortlinks(limit: number) {
  const [items, setItems] = React.useState<TCachedLink[]>([])
  const { reportError, user } = useAppContext()
  const [loading, setLoading] = React.useState(false)
  const sequence = React.useRef(0)
  const refresh = React.useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    try {
      await Cache.setStorage()
      const storage = await Cache.awaitStorage()
      if (request === sequence.current) setItems(storage.slice(0, limit))
    } catch (error) {
      if (request === sequence.current) {
        reportError(error, { fallbackMessage: 'Could not load your recent shortlinks' })
      }
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [limit, reportError, user?.email])
  React.useEffect(() => {
    void refresh()
    return () => { ++sequence.current }
  }, [refresh])
  return { items, loading, refresh }
}

export function useShortlinkCreator(initialLocation: string, defaultUserTag: string, historyLimit: number) {
  const context = useAppContext()
  const { reportError } = context
  const [state, dispatch] = React.useReducer(creatorReducer, {
    location: initialLocation, result: null, userTag: defaultUserTag, descriptionTag: '',
    descriptorDirty: false, createPhase: 'idle', descriptorPhase: 'idle',
    showSnoozeOptions: false, notice: null
  })
  React.useEffect(() => {
    dispatch({ type: 'default-user-tag', value: defaultUserTag })
  }, [defaultUserTag])
  const stateRef = React.useRef(state)
  React.useEffect(() => { stateRef.current = state }, [state])
  const { items: recentItems, loading: recentLoading, refresh: refreshRecent } = useRecentShortlinks(historyLimit)
  const { nextController, abortController } = useAbortControllers()
  const createSequence = React.useRef(0)
  const descriptorSequence = React.useRef(0)
  const debouncedDescription = useDebouncedValue(state.descriptionTag, 500)
  const snoozeInFlight = React.useRef(false)

  const applyResult = React.useCallback(async (result: CreatorResult, persist: boolean) => {
    dispatch({ type: 'result', result })
    if (persist) {
      Cache.storeShortlink({ location: result.location.trim(), hash: result.hash, descriptor: result.descriptor })
      await refreshRecent()
    }
  }, [refreshRecent])

  const submitLocation = React.useCallback(async (providedLocation?: string): Promise<string | undefined> => {
    const rawLocation = providedLocation ?? stateRef.current.location
    const sequence = ++createSequence.current
    dispatch({ type: 'create-loading' })
    try {
      const location = linkTools.fixUrl(rawLocation.trim())
      const controller = nextController('create')
      abortController('descriptor')
      await Cache.awaitStorage()
      const cached = Cache.checkShortlink({ location })
      if (cached?.hash) {
        const result = { location: cached.location, hash: cached.hash, descriptor: cached.descriptor }
        if (sequence === createSequence.current) await applyResult(result, false)
        return linkTools.generateShortlinkFromHash(cached.hash)
      }
      const result = await Query.createShortlink(location, controller.signal)
      if (!result?.hash) throw new AppError(`A shortlink for '${location}' could not be created. Please try again.`,
        { code: 'EMPTY_SHORTLINK_RESULT', source: result })
      if (sequence !== createSequence.current) return
      await applyResult(result, true)
      return linkTools.generateShortlinkFromHash(result.hash)
    } catch (error) {
      if (!isAbortError(error) && sequence === createSequence.current) {
        reportError(error)
        dispatch({ type: 'create-error' })
      }
      return undefined
    }
  }, [abortController, applyResult, nextController, reportError])

  React.useEffect(() => {
    const snapshot = stateRef.current
    if (!snapshot.descriptorDirty || !snapshot.result) return
    if (!debouncedDescription) { dispatch({ type: 'descriptor-clear' }); return }
    const sequence = ++descriptorSequence.current
    const controller = nextController('descriptor')
    const args = { userTag: snapshot.userTag, descriptionTag: debouncedDescription,
      location: snapshot.location, hash: snapshot.result.hash }
    if (args.userTag) setCookie('userTag', args.userTag, 365)
    dispatch({ type: 'descriptor-loading' })
    void Query.createShortlinkDescriptor(args, controller.signal).then(async (result) => {
      if (!result?.descriptor || sequence !== descriptorSequence.current) return
      const current = stateRef.current
      if (
        current.location !== args.location ||
        current.result?.hash !== args.hash ||
        current.userTag !== args.userTag ||
        current.descriptionTag !== args.descriptionTag ||
        result.descriptor.descriptionTag !== args.descriptionTag
      ) return
      await applyResult(result, true)
    }).catch((error: unknown) => {
      if (!isAbortError(error) && sequence === descriptorSequence.current) {
        reportError(error)
        dispatch({ type: 'descriptor-error' })
      }
    })
    return () => controller.abort()
  }, [applyResult, debouncedDescription, nextController, reportError])

  const snooze = React.useCallback(async (standardTimer: string) => {
    if (snoozeInFlight.current) return
    snoozeInFlight.current = true
    const snapshot = stateRef.current
    const controller = nextController('snooze')
    let created: ShortlinkDocument | null = null
    try {
      created = await Query.createOrUpdateShortlinkTimer({
        baseDateISOString: new Date().toISOString(), location: linkTools.fixUrl(snapshot.location),
        hash: snapshot.result?.hash, standardTimer
      }, controller.signal)
      if (!created?._id || !created.snooze?.awake) {
        throw new AppError('The snooze timer could not be created. Please try again.', {
          code: 'EMPTY_SNOOZE_RESULT', source: created
        })
      }
      await browserApi.scheduleSnooze({
        id: created._id,
        location: created.location,
        awake: created.snooze.awake,
        ...(created.siteTitle ? { siteTitle: created.siteTitle } : {})
      })
      dispatch({ type: 'location', value: '' })
      const trimmed = created.location.length > 30 ? `${created.location.slice(0, 29)}…` : created.location
      dispatch({ type: 'notice', notice: { type: 'success',
        message: `Snoozed until ${(created.snooze.description ?? '').toLowerCase()}: ${trimmed}` } })
      if (context.extension?.activeTabId != null) {
        try {
          await browserApi.closeTab(context.extension.activeTabId)
        } catch (error) {
          console.error('The snooze was scheduled, but the original tab could not be closed', error)
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        let rollbackError: unknown
        if (created?._id) {
          try {
            await Query.deleteShortlinkSnoozeTimer([created._id])
          } catch (rollbackFailure) {
            rollbackError = rollbackFailure
          }
        }
        reportError(!created
          ? error
          : rollbackError
            ? new AppError('The extension could not confirm this snooze, and its timer could not be rolled back. Remove it from Snoozed before retrying.', {
              code: 'SNOOZE_ROLLBACK_ERROR', source: { scheduleError: error, rollbackError }
            })
            : new AppError('The extension could not confirm this snooze. Please check that it is installed and try again.', {
              code: 'SNOOZE_SCHEDULE_ERROR', source: error
            }))
        dispatch({ type: 'create-error' })
      }
    } finally {
      snoozeInFlight.current = false
    }
  }, [context.extension?.activeTabId, nextController, reportError])

  return { state, dispatch, submitLocation, snooze, recentItems, recentLoading }
}
