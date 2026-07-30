import * as React from 'react'
import Query from '../../js/shortlink.gql'
import Cache, { TCachedLink } from '../../js/cache'
import linkTools from '../../js/link.tools'
import browserApi from '../../js/browser.api'
import { modifyURLSlug, setCookie } from '../../js/utils'
import { isAbortError, useAbortControllers, useDebouncedValue } from '../../js/react-hooks'

export type CreatorResult = Pick<ShortlinkDocument, 'location' | 'hash' | 'descriptor'>
type Phase = 'idle' | 'loading' | 'error'
export type CreatorNotice = { type: 'success' | 'error', message: string }
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
  | { type: 'create-error', message: string }
  | { type: 'descriptor', value: string }
  | { type: 'descriptor-loading' }
  | { type: 'descriptor-error', message: string }
  | { type: 'descriptor-clear' }
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
    case 'create-error': return { ...state, createPhase: 'error', notice: { type: 'error', message: action.message } }
    case 'descriptor': return { ...state, descriptionTag: modifyURLSlug(action.value), descriptorDirty: true,
      descriptorPhase: action.value ? 'loading' : 'idle', notice: null }
    case 'descriptor-loading': return { ...state, descriptorPhase: 'loading' }
    case 'descriptor-error': return { ...state, descriptorPhase: 'error', notice: { type: 'error', message: action.message } }
    case 'descriptor-clear': return { ...state, descriptorDirty: false, descriptorPhase: 'idle' }
    case 'snooze-options': return { ...state, showSnoozeOptions: action.value }
    case 'notice': return { ...state, notice: action.notice }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useRecentShortlinks(limit: number) {
  const [items, setItems] = React.useState<TCachedLink[]>([])
  const [loading, setLoading] = React.useState(false)
  const sequence = React.useRef(0)
  const refresh = React.useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    try {
      await Cache.setStorage()
      const storage = await Cache.awaitStorage()
      if (request === sequence.current) setItems(storage.slice(0, limit))
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [limit])
  React.useEffect(() => {
    void refresh()
    return () => { ++sequence.current }
  }, [refresh])
  return { items, loading, refresh }
}

export function useShortlinkCreator(initialLocation: string, defaultUserTag: string, historyLimit: number) {
  const [state, dispatch] = React.useReducer(creatorReducer, {
    location: initialLocation, result: null, userTag: defaultUserTag, descriptionTag: '',
    descriptorDirty: false, createPhase: 'idle', descriptorPhase: 'idle',
    showSnoozeOptions: false, notice: null
  })
  const stateRef = React.useRef(state)
  React.useEffect(() => { stateRef.current = state }, [state])
  const { items: recentItems, loading: recentLoading, refresh: refreshRecent } = useRecentShortlinks(historyLimit)
  const { nextController, abortController } = useAbortControllers()
  const createSequence = React.useRef(0)
  const descriptorSequence = React.useRef(0)
  const debouncedDescription = useDebouncedValue(state.descriptionTag, 500)

  const applyResult = React.useCallback(async (result: CreatorResult, persist: boolean) => {
    dispatch({ type: 'result', result })
    if (persist) {
      Cache.storeShortlink({ location: result.location.trim(), hash: result.hash, descriptor: result.descriptor })
      await refreshRecent()
    }
  }, [refreshRecent])

  const submitLocation = React.useCallback(async (providedLocation?: string): Promise<string | undefined> => {
    const rawLocation = providedLocation ?? stateRef.current.location
    const location = linkTools.fixUrl(rawLocation.trim())
    if (!location) return
    const sequence = ++createSequence.current
    const controller = nextController('create')
    abortController('descriptor')
    dispatch({ type: 'create-loading' })
    try {
      await Cache.awaitStorage()
      const cached = Cache.checkShortlink({ location })
      if (cached?.hash) {
        const result = { location: cached.location, hash: cached.hash, descriptor: cached.descriptor }
        if (sequence === createSequence.current) await applyResult(result, false)
        return linkTools.generateShortlinkFromHash(cached.hash)
      }
      const result = await Query.createShortlink(location, controller.signal)
      if (!result?.hash) throw new Error(`A shortlink for '${location}' could not be created. Please try again.`)
      if (sequence !== createSequence.current) return
      await applyResult(result, true)
      return linkTools.generateShortlinkFromHash(result.hash)
    } catch (error) {
      if (!isAbortError(error) && sequence === createSequence.current) dispatch({ type: 'create-error', message: errorMessage(error) })
      return undefined
    }
  }, [abortController, applyResult, nextController])

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
      if (!isAbortError(error) && sequence === descriptorSequence.current) dispatch({ type: 'descriptor-error', message: errorMessage(error) })
    })
    return () => controller.abort()
  }, [applyResult, debouncedDescription, nextController])

  const snooze = React.useCallback(async (standardTimer: string) => {
    const snapshot = stateRef.current
    const controller = nextController('snooze')
    try {
      const result = await Query.createOrUpdateShortlinkTimer({
        baseDateISOString: new Date().toISOString(), location: linkTools.fixUrl(snapshot.location),
        hash: snapshot.result?.hash, standardTimer
      }, controller.signal)
      if (!result) return
      dispatch({ type: 'location', value: '' })
      const trimmed = result.location.length > 30 ? `${result.location.slice(0, 29)}…` : result.location
      dispatch({ type: 'notice', notice: { type: 'success',
        message: `Snoozed until ${(result.snooze?.description ?? '').toLowerCase()}: ${trimmed}` } })
      if (browserApi.isInit) { await browserApi.closeActiveTab(); await browserApi.sendMessage({ command: 'sync' }) }
    } catch (error) {
      if (!isAbortError(error)) dispatch({ type: 'create-error', message: errorMessage(error) })
    }
  }, [nextController])

  return { state, dispatch, submitLocation, snooze, recentItems, recentLoading }
}
