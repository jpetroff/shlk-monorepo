import styles from './styles-shortlink-list.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import Input from '../../components/input'
import ShortlinkListItem from '../../components/shortlink-list-item'
import shortlinkQueries from '../../js/shortlink.gql'
import classNames from 'classnames'
import dateTimeTools, { DateGrouped } from '../../js/datetime.tools'
import RadioGroup from '../../components/radio-group'
import { NavigateFunction } from 'react-router'
import DropdownMenu, { DropdownPosition } from '../../components/dropdown-menu'
import MenuItem from '../../components/menu-item'
import Scroller from '../../components/scroller'
import clipboardTools from '../../js/clipboard.tools'
import linkTools from '../../js/link.tools'
import { CompactIcon, FullIcon, Search } from '../../components/icons'
import UrlEdit from '../UrlEdit'
import Snackbar from '../../components/snackbar'
import AppContext from '../../js/app.context'
import { getCookie, setCookie } from '../../js/utils'

type ShortlinkDisplayListItem = (DateGrouped<ShortlinkDocument> & {isSubheader?: false, timestamp?: number, originalIndex: number}) | {isSubheader: true, group: string, originalIndex: number}

enum LoadMode {
  append = 'append',
  replace = 'replace',
  none = 'none'
}

export enum ShortlinkListSubsection {
  all = 'created',
  snoozed = 'snoozed'
}

export enum ShortlinkListContentDisplay {
  compact = 'compact',
  full = 'full'
}

type Props = {
  limit?: number,
  navigate: NavigateFunction,
  router: PageRouterProps,
  context: React.ContextType<typeof AppContext>
}

type State = {
  shortlinks: ShortlinkDocument[],
  groupedShortlinks: ShortlinkDisplayListItem[]
  searchQuery: string
  pointer: number
  limit: number
  contentDisplay: ShortlinkListContentDisplay
  staleResults: boolean
  isLoading: LoadMode
  contextMenu: {
    key: number
    top: number
    left: number
    show: boolean
  }
  selected: {
    shortlink: ShortlinkDocument | null,
    loading: boolean,
    successState: string | null
    errorState: string | null
  }
}

export default class ShortlinkList extends React.Component<Props, State> {
  private contextMenuRef : React.RefObject<HTMLDivElement | null>

  constructor(props: Props) {
    super(props)
    const contentDisplay : ShortlinkListContentDisplay = getCookie('content-display') as ShortlinkListContentDisplay || ShortlinkListContentDisplay.compact

    this.state = {
      shortlinks: [],
      groupedShortlinks: [],
      searchQuery: '',
      pointer: 0,
      limit: props.limit || 30,
      contentDisplay,
      staleResults: false,
      isLoading: LoadMode.none,
      contextMenu: {
        key: -1,
        top: -99999,
        left: -999999,
        show: false
      },
      selected: {
        shortlink: null,
        loading: false,
        errorState: null,
        successState: null
      }
    }
    this.contextMenuRef = React.createRef<HTMLDivElement | null>()
    _.bindAll(this, ..._.functions(this))
  }

  onSearch(value: string, event: React.SyntheticEvent<any>, isClear : boolean) {
    this.loadShortlinks(LoadMode.replace)
  }

  onSearchQueryChange(value: string, event: React.SyntheticEvent<any>, isClear: boolean) {
    this.setState({ searchQuery: value, staleResults: true })
  }

  componentDidMount(): void {
    this.loadShortlinks(LoadMode.replace)
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any): void {
    if(this.getSubsection() != this.getSubsection(prevProps.router.location.pathname)) 
      this.loadShortlinks(LoadMode.replace)
  }

  private getSubsection(_pathname?: string) : ShortlinkListSubsection {
    const pathname = _pathname ? _pathname : this.props.router.location.pathname
    if(pathname == '/app')
      return ShortlinkListSubsection.all

    if(pathname == '/app/snoozed')
      return ShortlinkListSubsection.snoozed

    return ShortlinkListSubsection.all
  }

  async loadShortlinks(load: LoadMode) {
    let params : AnyObject

    this.setState({
      isLoading: load,
      staleResults: load == LoadMode.replace ? true : false
    })

    if(this.getSubsection() == ShortlinkListSubsection.snoozed) {
      params = { 
        search: this.state.searchQuery || undefined,
        skip: load == LoadMode.replace ? 0 : this.state.pointer,
        limit: this.state.limit,
        isSnooze: true,
        sort: 'snooze.awake',
        order: '1'
      }
    } else {
      params = { 
        search: this.state.searchQuery || undefined,
        skip: load == LoadMode.replace ? 0 : this.state.pointer,
        limit: this.state.limit
      }
    }

    const result = await shortlinkQueries.getUserShortlinks(params)
    const newShortlinks = load == LoadMode.replace ? result : [...this.state.shortlinks, ...result]
    const groupedResult = this.groupShortlinks(newShortlinks as ShortlinkDocument[])
    
    console.log(load, result)
    this.setState({
      pointer: load == LoadMode.replace ? result.length : this.state.shortlinks.length + result.length,
      shortlinks: newShortlinks,
      groupedShortlinks: groupedResult,
      staleResults: false
    })

    _.delay(() => {
      this.setState({
        isLoading: LoadMode.none
      })
    }, 250)
  }

  private groupShortlinks(shortlinks: ShortlinkDocument[]) : ShortlinkDisplayListItem[] {
    const dateGroupKey = ( this.getSubsection() == ShortlinkListSubsection.snoozed ) ? ['snooze', 'awake'] : ['createdAt']
    const _enrichedLabelGroups = dateTimeTools.groupDatedItems(shortlinks, dateGroupKey)

    const groupedShortlinks : Array<ShortlinkDisplayListItem> = []
    _.each(_enrichedLabelGroups, (item, index, array) => {
      if (index == 0 || array[index - 1].group != item.group) {
        groupedShortlinks.push({isSubheader: true, group: item.group, originalIndex: -1})
      }
      groupedShortlinks.push( _.extend({timestamp: item.createdAt || item.updatedAt || null, originalIndex: index}, item) )
    })
    return groupedShortlinks
  }

  private removeCachedShortlink(id: string) {
    const index = _.findIndex(this.state.shortlinks, {_id: id})
    console.log(id, index)
    const updatedShortlinks = this.state.shortlinks
    updatedShortlinks.splice(index, 1)
    const groupedShortlinks = this.groupShortlinks(updatedShortlinks)

    this.setState({
      pointer: this.state.pointer - 1,
      shortlinks: updatedShortlinks,
      groupedShortlinks: groupedShortlinks,
      staleResults: false
    })
  }

  private updateCachedShortlink(shortlink: ShortlinkDocument) {
    const index = _.findIndex(this.state.shortlinks, {_id: shortlink._id})
    console.log('Updating shortlink', index, this.state.shortlinks[index])
    const updatedShortlinks = this.state.shortlinks
    updatedShortlinks[index] = shortlink
    const groupedShortlinks = this.groupShortlinks(updatedShortlinks)

    this.setState({
      shortlinks: updatedShortlinks,
      groupedShortlinks: groupedShortlinks,
      staleResults: false
    })
  }

  handleInternalNavigate(key: string) {
    if(key == ShortlinkListSubsection.all)
      this.props.navigate('/app')

    if(key == ShortlinkListSubsection.snoozed)
      this.props.navigate('/app/snoozed')
  }

  handleContentDisplayChange(key: string) {
    this.setState({
      contentDisplay: key as ShortlinkListContentDisplay
    })
    setCookie('content-display', key, 180)
  }

  handleContextClick(key: number, element: HTMLElement) {
    _.defer(() => {
      const top = element.offsetTop + element.offsetHeight
      const left = element.offsetLeft + element.offsetWidth
      this.setState({
        contextMenu: {
          show: true,
          top: -top,
          left: -left,
          key: key,
        }
      })
    })
  }

  handleContextPortal(isAppearing: boolean) {
    const contextMenuParams = this.contextMenuRef.current?.getClientRects()
    this.setState({
      contextMenu: {
        show: true,
        top: Math.abs(this.state.contextMenu.top) - (contextMenuParams?.[0]?.height ?? 0),
        left: Math.abs(this.state.contextMenu.left) - (contextMenuParams?.[0]?.width ?? 0),
        key: this.state.contextMenu.key,
      }
    })
  }

  async handleRemoveSnoozeTimer() {
    const id = this.state.shortlinks[this.state.contextMenu.key]?._id
    if (!id) return
    const result = await shortlinkQueries.deleteShortlinkSnoozeTimer([id])
    if(result && result.length > 0) {
      _.each(result, (item) => {
        this.removeCachedShortlink(item._id)
      })
    }
    _.defer(this.resetContextMenu)
  }

  async handleDeleteShortlink() {
    const id = this.state.shortlinks[this.state.contextMenu.key]?._id
    if (!id) return
    const result = await shortlinkQueries.deleteShortlink(id)
    console.log(result)
    if(result && result._id) {
      this.removeCachedShortlink(result._id)
    }
    _.defer(this.resetContextMenu)
  }

  private resetContextMenu() {
    this.setState({
      contextMenu: {
        key: -1,
        top: -99999,
        left: -999999,
        show: false
      }
    })
  }

  handleCopyClick(key: number) {
    if(!this.state.shortlinks[key]) return

    const hash = this.state.shortlinks[key].hash
    const descriptor = this.state.shortlinks[key].descriptor

    const shortlink = this.state.shortlinks[key].descriptor ? 
                      linkTools.generateDescriptiveShortlink(this.state.shortlinks[key].descriptor) :
                      linkTools.generateShortlinkFromHash(this.state.shortlinks[key].hash)

    clipboardTools.copy(shortlink)
  }

  handleScroll(scrollTop: number, scrollHeight: number, clientHeight: number, direction = 0) {
    const isThreshold : boolean = (scrollTop + clientHeight) > (scrollHeight * 0.96)
    
    if(
      isThreshold && 
      this.state.isLoading == LoadMode.none && 
      direction > 0
    ) { 
      console.log('scroll load', scrollTop)
      this.loadShortlinks(LoadMode.append)
    }
  }

  async handleUrlChange(shortlink: ShortlinkDocument) { 
    if(!shortlink) {
      this.setState({
        selected: _.defaults({
          errorState: 'Couldn’t save this shortlink'
        }, this.state.selected) 
      })
      console.error('No shortlink passed to onChange method from module UrlEdit', shortlink)
    }

    this.setState({ selected: _.defaults({loading: true}, this.state.selected)})
    try {
      console.log('sending ',shortlink)
      const result = await shortlinkQueries.updateShortlink(shortlink._id, shortlink)
      console.log(result)
      this.updateCachedShortlink(result)
      this.setState({
        selected: {
          shortlink: null,
          loading: false,
          errorState: null,
          successState: 'Shortlink updated'
        }
      })
    } catch(error: unknown) {
      console.error(error)
      this.setState({
        selected: _.defaults({
          loading: false,
          errorState: error instanceof Error ? error.message : 'Something went wrong'
        }, this.state.selected)
      })
    }
      
  }

  handleSelectShortlink() {
    this.resetContextMenu()
    if(!this.state.shortlinks[this.state.contextMenu.key]) return

    this.setState({
      selected: _.defaults({
        shortlink: _.omit(this.state.shortlinks[this.state.contextMenu.key], 'group')
      }, this.state.selected)
    })
  }

  _clearSelected() {
    this.setState({
      selected: _.defaults({
        shortlink: null
      }, this.state.selected)
    })
  }

  _clearSelectedErrorState() {
    this.setState({
      selected: _.defaults({errorState: null}, this.state.selected)
    })
  }

  _clearSelectedSuccessState() {
    this.setState({
      selected: _.defaults({successState: null}, this.state.selected)
    })
  }

  render() {
    const globalClass = `${styles.wrapperClass}_shortlink-list-app`
    const listClasses = classNames({
      [`${globalClass}`]: true,
      [`${globalClass}_loading`]: this.state.staleResults
    })
    return (
      <div className={`${listClasses}`} >
        <div className={`${globalClass}__search`}>
          <Input 
            onChange={this.onSearchQueryChange}
            onDebouncedChange={this.onSearch} 
            value={this.state.searchQuery}
            placeholder='Search your links'
            rightIcon={Search}
           />
          <div className={`${globalClass}__search__controls`}>  
            <RadioGroup
              items={[
                {label: 'All links', key: ShortlinkListSubsection.all},
                {label: 'Snoozed', key: ShortlinkListSubsection.snoozed}
              ]}
              value={this.getSubsection()}
              onChange={(key) => { this.handleInternalNavigate(key) } }
              fullWidth={true}
              />
            <RadioGroup
              items={[
                {icon: CompactIcon, key: ShortlinkListContentDisplay.compact},
                {icon: FullIcon, key: ShortlinkListContentDisplay.full}
              ]}
              value={this.state.contentDisplay}
              onChange={this.handleContentDisplayChange}
              />
          </div>
        </div>
        <Scroller className={`${globalClass}__scroller`} onScroll={this.handleScroll}>
          <div className={`${globalClass}__list`}>
            { 
              this.state.groupedShortlinks.map( (item, index, array) => {
                if(item.isSubheader) {
                  return <span key={index} className={`${globalClass}__subheader`}>{item.group}</span>
                } else {
                  return (
                    <ShortlinkListItem key={index}
                      timestamp={item.timestamp ?? 0}
                      {..._.omit(item, 'hash', 'location')}
                      hash={item.hash}
                      location={item.location}
                      showDescription={this.state.contentDisplay == ShortlinkListContentDisplay.full}
                      onCopyClick={() => this.handleCopyClick(item.originalIndex)}
                      onContextClick={(elem) => { this.handleContextClick(item.originalIndex, elem) } }
                    />
                  )
                }
              })
            }
            {this.state.isLoading == LoadMode.append &&  
              <ShortlinkListItem.Loading />
            }
            {this.state.shortlinks.length == 0 && this.state.isLoading == LoadMode.none &&
              <div className={`${globalClass}__list-footer_nothing`}>Nothing found</div>
            }
            {this.state.isLoading == LoadMode.none && this.state.shortlinks.length > 0 &&
              <div className={`${globalClass}__list-footer_empty`}>&nbsp;</div>
            }
            <DropdownMenu
              divRef={this.contextMenuRef}
              show={this.state.contextMenu.show}
              onClose={this.resetContextMenu}
              onEnter={this.handleContextPortal}
              style={ { top: this.state.contextMenu.top, left: this.state.contextMenu.left} }
              >
              <MenuItem label='Delete' onClick={this.handleDeleteShortlink}/>
              <MenuItem.Separator />
              {this.getSubsection() == ShortlinkListSubsection.snoozed && <MenuItem label='Remove snooze' onClick={this.handleRemoveSnoozeTimer}/>}
              <MenuItem label='Edit shortlink' onClick={this.handleSelectShortlink}/>
            </DropdownMenu>
          </div>
          
        </Scroller>

        {this.state.selected.shortlink && 
          <UrlEdit 
            onChange={this.handleUrlChange}
            onCancel={this._clearSelected}
            shortlink={this.state.selected.shortlink}
            isLoading={this.state.selected.loading}
            userContextName={this.props.context.user?.userTag ?? 'you'}
            />
        }

        <div className={`${globalClass}__snackbar-container`}>
          { this.state.selected.errorState && 
            <Snackbar 
              className={`${globalClass}__shortlink-list-error`}
              message={this.state.selected.errorState}
              canDismiss={true}
              onDismiss={this._clearSelectedErrorState}
              />
          }
          { this.state.selected.successState && 
            <Snackbar 
              className={`${globalClass}__shortlink-list-success`}
              message={this.state.selected.successState}
              canDismiss={true}
              timer={2000}
              onDismiss={this._clearSelectedSuccessState}
              />
          }
        </div>
      </div>
    )
  }
}