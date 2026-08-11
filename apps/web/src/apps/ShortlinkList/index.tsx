import styles from './styles-shortlink-list.module.less'
import * as React from 'react'
import Input from '../../components/input'
import ShortlinkListItem from '../../components/shortlink-list-item'
import shortlinkQueries from '../../js/shortlink.gql'
import classNames from 'classnames'
import dateTimeTools, { DateGrouped, timestampValue } from '../../js/datetime.tools'
import RadioGroup from '../../components/radio-group'
import DropdownMenu from '../../components/dropdown-menu'
import MenuItem from '../../components/menu-item'
import Scroller from '../../components/scroller'
import clipboardTools from '../../js/clipboard.tools'
import linkTools from '../../js/link.tools'
import { CompactIcon, FullIcon, Search } from '../../components/icons'
import UrlEdit from '../UrlEdit'
import Snackbar, { SnackbarType } from '../../components/snackbar'
import { useAppContext } from '../../js/app.context'
import { getCookie, setCookie } from '../../js/utils'
import { isAbortError, useAbortControllers, useDebouncedValue } from '../../js/react-hooks'
import { useLocation, useNavigate } from 'react-router'

export enum ShortlinkListSubsection { all = 'created', snoozed = 'snoozed' }
export enum ShortlinkListContentDisplay { compact = 'compact', full = 'full' }
type LoadMode = 'append' | 'replace' | 'none'
type GroupedItem = DateGrouped<ShortlinkDocument> & { isSubheader?: false, timestamp: number }
type GroupedHeader = { isSubheader: true, group: string, key: string }
export type ShortlinkDisplayListItem = GroupedItem | GroupedHeader

export function subsectionFromPath(pathname: string): ShortlinkListSubsection {
  return pathname === '/app/snoozed' ? ShortlinkListSubsection.snoozed : ShortlinkListSubsection.all
}

export function groupShortlinks(shortlinks: ShortlinkDocument[], subsection: ShortlinkListSubsection): ShortlinkDisplayListItem[] {
  const dateGroupKey = subsection === ShortlinkListSubsection.snoozed ? ['snooze', 'awake'] : ['createdAt']
  const grouped = dateTimeTools.groupDatedItems(shortlinks, dateGroupKey)
  const rows: ShortlinkDisplayListItem[] = []
  grouped.forEach((item, index) => {
    if (index === 0 || grouped[index - 1].group !== item.group) {
      rows.push({ isSubheader: true, group: item.group, key: `group-${item.group}` })
    }
    rows.push({ ...item, timestamp: timestampValue(item.createdAt ?? item.updatedAt ?? 0) })
  })
  return rows
}

type ListState = {
  shortlinks: ShortlinkDocument[]
  searchQuery: string
  contentDisplay: ShortlinkListContentDisplay
  loadMode: LoadMode
  hasMore: boolean
  error: string | null
}
type ListAction =
  | { type: 'search', value: string }
  | { type: 'loading', mode: Exclude<LoadMode, 'none'> }
  | { type: 'loaded', mode: Exclude<LoadMode, 'none'>, items: ShortlinkDocument[], limit: number }
  | { type: 'failed', message: string }
  | { type: 'clear-error' }
  | { type: 'display', value: ShortlinkListContentDisplay }
  | { type: 'remove', id: string }
  | { type: 'update', item: ShortlinkDocument }

export function shortlinkListReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'search': return { ...state, searchQuery: action.value }
    case 'loading': return { ...state, loadMode: action.mode, error: null }
    case 'loaded': return {
      ...state,
      shortlinks: action.mode === 'replace' ? action.items : [...state.shortlinks, ...action.items],
      loadMode: 'none',
      hasMore: action.items.length === action.limit,
      error: null
    }
    case 'failed': return { ...state, loadMode: 'none', error: action.message }
    case 'clear-error': return { ...state, error: null }
    case 'display': return { ...state, contentDisplay: action.value }
    case 'remove': return { ...state, shortlinks: state.shortlinks.filter((item) => item._id !== action.id) }
    case 'update': return { ...state, shortlinks: state.shortlinks.map((item) => item._id === action.item._id ? action.item : item) }
  }
}

function initialState(): ListState {
  const storedDisplay = getCookie('content-display') as ShortlinkListContentDisplay
  return { shortlinks: [], searchQuery: '',
    contentDisplay: Object.values(ShortlinkListContentDisplay).includes(storedDisplay) ? storedDisplay : ShortlinkListContentDisplay.compact,
    loadMode: 'none', hasMore: true, error: null }
}

export function useShortlinkList(limit: number, subsection: ShortlinkListSubsection) {
  const [state, dispatch] = React.useReducer(shortlinkListReducer, undefined, initialState)
  const { reportError } = useAppContext()
  const debouncedSearch = useDebouncedValue(state.searchQuery, 150)
  const requestSequence = React.useRef(0)
  const { nextController, abortController } = useAbortControllers()
  const requestInFlight = React.useRef(false)

  const load = React.useCallback(async (mode: Exclude<LoadMode, 'none'>, skip: number) => {
    const sequence = ++requestSequence.current
    const controller = nextController('list')
    requestInFlight.current = true
    dispatch({ type: 'loading', mode })
    const params: QICommon = { search: debouncedSearch || undefined, skip, limit }
    if (subsection === ShortlinkListSubsection.snoozed) Object.assign(params, {
      isSnooze: true, sort: 'snooze.awake', order: '1'
    })
    try {
      const items = await shortlinkQueries.getUserShortlinks<ShortlinkDocument>(params, controller.signal)
      if (sequence === requestSequence.current) dispatch({ type: 'loaded', mode, items, limit })
    } catch (error) {
      if (!isAbortError(error) && sequence === requestSequence.current) {
        const appError = reportError(error, {
          fallbackMessage: 'Could not load your shortlinks',
          action: { label: 'Retry', onClick: () => void load('replace', 0) },
          onDismiss: () => dispatch({ type: 'clear-error' })
        })
        dispatch({ type: 'failed', message: appError.message })
      }
    } finally {
      if (sequence === requestSequence.current) requestInFlight.current = false
    }
  }, [debouncedSearch, limit, nextController, reportError, subsection])
  React.useEffect(() => {
    void load('replace', 0)
    return () => {
      ++requestSequence.current
      requestInFlight.current = false
      abortController('list')
    }
  }, [abortController, load])

  const append = React.useCallback(() => {
    if (requestInFlight.current || state.loadMode !== 'none' || !state.hasMore) return
    void load('append', state.shortlinks.length)
  }, [load, state.hasMore, state.loadMode, state.shortlinks.length])

  return { state, dispatch, append, retry: () => void load('replace', 0), nextController }
}

type Props = { limit?: number }
type MenuState = { id: string | null, top: number, left: number, trigger: HTMLElement | null }
const closedMenu: MenuState = { id: null, top: -99999, left: -99999, trigger: null }

export default function ShortlinkList({ limit = 30 }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const appContext = useAppContext()
  const subsection = subsectionFromPath(location.pathname)
  const { state, dispatch, append, nextController } = useShortlinkList(limit, subsection)
  const grouped = React.useMemo(() => groupShortlinks(state.shortlinks, subsection), [state.shortlinks, subsection])
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [menu, setMenu] = React.useState<MenuState>(closedMenu)
  const [selected, setSelected] = React.useState<ShortlinkDocument | null>(null)
  const [mutationLoading, setMutationLoading] = React.useState(false)
  const [notice, setNotice] = React.useState<{ type: 'success', message: string } | null>(null)
  const globalClass = `${styles.wrapperClass}_shortlink-list-app`
  const listClasses = classNames(globalClass, { [`${globalClass}_loading`]: state.loadMode === 'replace' })

  const closeMenu = React.useCallback(() => {
    const trigger = menu.trigger
    setMenu(closedMenu)
    window.requestAnimationFrame(() => trigger?.focus())
  }, [menu.trigger])

  function openMenu(id: string, element: HTMLElement) {
    const top = element.offsetTop + element.offsetHeight
    const left = element.offsetLeft + element.offsetWidth
    setMenu({ id, top: -top, left: -left, trigger: element })
  }

  function positionMenu() {
    const rect = menuRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenu((current) => ({ ...current, top: Math.abs(current.top) - rect.height, left: Math.abs(current.left) - rect.width }))
  }

  async function deleteSelected(removeSnooze: boolean) {
    const id = menu.id
    if (!id) return
    const controller = nextController('mutation')
    setMutationLoading(true)
    try {
      if (removeSnooze) {
        const result = await shortlinkQueries.deleteShortlinkSnoozeTimer([id], controller.signal)
        result.forEach((item) => dispatch({ type: 'remove', id: item._id }))
      } else {
        const result = await shortlinkQueries.deleteShortlink(id, controller.signal)
        if (result) dispatch({ type: 'remove', id: result._id })
      }
      closeMenu()
    } catch (error) {
      if (!isAbortError(error)) {
        appContext.reportError(error, { fallbackMessage: 'Could not update this shortlink' })
      }
    } finally {
      setMutationLoading(false)
    }
  }

  async function saveShortlink(shortlink: ShortlinkDocument) {
    const controller = nextController('mutation')
    setMutationLoading(true)
    setNotice(null)
    try {
      const result = await shortlinkQueries.updateShortlink(shortlink._id, shortlink, controller.signal)
      dispatch({ type: 'update', item: result })
      setSelected(null)
      setNotice({ type: 'success', message: 'Shortlink updated' })
    } catch (error) {
      if (!isAbortError(error)) {
        appContext.reportError(error, { fallbackMessage: 'Could not save this shortlink' })
      }
    } finally {
      setMutationLoading(false)
    }
  }

  const menuItem = menu.id ? state.shortlinks.find((item) => item._id === menu.id) : undefined

  return <div className={listClasses}>
    <div className={`${globalClass}__search`}>
      <Input onValueChange={(value) => dispatch({ type: 'search', value })} value={state.searchQuery}
        placeholder="Search your links" aria-label="Search your links" rightIcon={Search} />
      <div className={`${globalClass}__search__controls`}>
        <RadioGroup label="Shortlink section" items={[
          { label: 'All links', key: ShortlinkListSubsection.all },
          { label: 'Snoozed', key: ShortlinkListSubsection.snoozed }
        ]} value={subsection} onChange={(key) => navigate(key === ShortlinkListSubsection.snoozed ? '/app/snoozed' : '/app')} fullWidth />
        <RadioGroup label="Shortlink display density" items={[
          { icon: CompactIcon, ariaLabel: 'Compact display', key: ShortlinkListContentDisplay.compact },
          { icon: FullIcon, ariaLabel: 'Full display', key: ShortlinkListContentDisplay.full }
        ]} value={state.contentDisplay} onChange={(key) => {
          const value = key as ShortlinkListContentDisplay
          dispatch({ type: 'display', value }); setCookie('content-display', value, 180)
        }} />
      </div>
    </div>
    <Scroller className={`${globalClass}__scroller`} onScroll={(_top, _height, _client, direction) => { if ((direction ?? 0) > 0) append() }}>
      <div className={`${globalClass}__list`}>
        {grouped.map((item) => item.isSubheader
          ? <span key={item.key} className={`${globalClass}__subheader`}>{item.group}</span>
          : <ShortlinkListItem key={item._id} {...item} showDescription={state.contentDisplay === ShortlinkListContentDisplay.full}
              menuOpen={menu.id === item._id} onCopyClick={() => clipboardTools.copy(item.descriptor ? linkTools.generateDescriptiveShortlink(item.descriptor) : linkTools.generateShortlinkFromHash(item.hash))}
              onContextClick={(element) => openMenu(item._id, element)} />)}
        {state.loadMode === 'append' && <ShortlinkListItem.Loading />}
        {state.shortlinks.length === 0 && state.loadMode === 'none' && !state.error && <div className={`${globalClass}__list-footer_nothing`}>Nothing found</div>}
        {state.loadMode === 'none' && state.shortlinks.length > 0 && <div className={`${globalClass}__list-footer_empty`}>&nbsp;</div>}
        <DropdownMenu divRef={menuRef} show={!!menu.id} onClose={closeMenu} onEnter={positionMenu}
          style={{ top: menu.top, left: menu.left }} label="Shortlink actions">
          <MenuItem label="Delete" onClick={() => void deleteSelected(false)} isDisabled={mutationLoading} />
          <MenuItem.Separator />
          {subsection === ShortlinkListSubsection.snoozed && <MenuItem label="Remove snooze" onClick={() => void deleteSelected(true)} isDisabled={mutationLoading} />}
          <MenuItem label="Edit shortlink" onClick={() => { if (menuItem) setSelected({ ...menuItem }); closeMenu() }} />
        </DropdownMenu>
      </div>
    </Scroller>
    {selected && <UrlEdit onChange={(value) => void saveShortlink(value)} onCancel={() => setSelected(null)}
      shortlink={selected} isLoading={mutationLoading} userContextName={appContext.user?.userTag ?? 'you'} />}
    <div className={`${globalClass}__snackbar-container`}>
      {notice && <Snackbar type={SnackbarType.MESSAGE} className={`${globalClass}__shortlink-list-success`}
        message={notice.message} canDismiss timer={2000} onDismiss={() => setNotice(null)} />}
    </div>
  </div>
}
