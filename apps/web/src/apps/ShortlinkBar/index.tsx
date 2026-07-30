import styles from './styles-shortlink-bar.module.less'
import { checkMobileMQ, modifyURLSlug, validateURL, setCookie, getCookie } from '../../js/utils'

import * as React from 'react'
import * as _ from 'underscore'

import HeroInput from '../../components/hero-input/index'
import ShortlinkDisplay from '../../components/shortlink-display'
import ShortlinkSlugInput, { TextPattern, SlugInputSpecialChars } from '../../components/shortlink-slug-input'
import Snackbar from '../../components/snackbar'
import SnoozeList from '../../components/snooze-list'

import linkTools from '../../js/link.tools'
import clipboardTools from '../../js/clipboard.tools'

import Query from '../../js/shortlink.gql'
import Cache, {TCachedLink} from '../../js/cache'
import GracefulError, { GracefulErrorType } from '../../js/extended-error'
import AppContext from '../../js/app.context'

import { HistoryWidget } from '../History'
import browserApi from '../../js/browser.api'
import Video from '../../components/video'
import Footer from '../../apps/Footer'
import Link from '../../components/link'

import config from '../../js/config'

enum globalCommands {
  submitAndCopy = 'submit_copy',
  snooze = 'snooze'
}

type Props = {
  router?: PageRouterProps
  extension?: PageExtensionProps,
  context?: React.ContextType<typeof AppContext>
  onToggleHeaderDisplay?: (visible: boolean) => void
}

type State = {
  location: string
  generatedShortlink: string | undefined
  generatedDescriptiveShortlink: string | undefined
  generatedHash: string | undefined
  userTag: string
  descriptionTag: string
  errorState: {
    lastError?: GracefulErrorType
    createLinkResult?: boolean
    createDescriptiveLinkResult?: boolean
  },
  successState: {
    successMessage?: string
  }
  loadingState: {
    createLinkIsLoading?: boolean
    createDescriptiveLinkIsLoading?: boolean
  }
  mobileConvenienceInput: boolean

  cachedShortlinks: Array<TCachedLink>
  cachedShortlinksLoading: boolean
  cachedShortlinksDisplayNumber: number

  showSnoozeOptions: boolean
}


export default class ShortlinkBar extends React.Component<Props, State> {
  private heroInputRef: React.RefObject<HTMLAnyInput | null>

  constructor(props: Props) {
    super(props)

    this.heroInputRef = React.createRef<HTMLAnyInput>()
    const [ predefinedLocation ] = linkTools.queryUrlSearchParams(['l'], props.router?.location?.search)

    this.state = {
      location: _.unescape(predefinedLocation || ''),
      generatedShortlink: undefined,
      generatedDescriptiveShortlink: undefined,
      generatedHash: undefined,
      userTag: this.defaultUserTag(),
      descriptionTag: '',
      errorState: {},
      loadingState: {
        createLinkIsLoading: false,
        createDescriptiveLinkIsLoading: false
      },
      successState: {},
      mobileConvenienceInput: false,

      cachedShortlinks: [],
      cachedShortlinksLoading: false,
      cachedShortlinksDisplayNumber: checkMobileMQ() ? 2 : 3,

      showSnoozeOptions: false
    }
    
    _.bindAll(this, ..._.functions(this))
    // this.submitDescriptor = _.debounce(this._submitDescriptor, 500)
  }

  componentDidMount() {
    if(
      this.heroInputRef.current &&
      (!checkMobileMQ() || config.target == 'extension')
    ) this.heroInputRef.current.focus()

    if(validateURL(this.state.location)) {
      this.submitLocation()
    }

    if(this.state.location) {
      this._setMobileConvenienceInput(true)
    }

    this.handleGlobalEvents(true)

    this.loadAllCachedShortlinks()

    if(this.props.context?.extension?.activeTabUrl) this.setState({
      location: this.props.context.extension.activeTabUrl
    })
  }

  componentWillUnmount(): void {
    this.handleGlobalEvents(false)
  }

  private handleGlobalEvents(bind : boolean = true) {
    console.log('global event binder ', bind)
    if(bind) {
      window.addEventListener('keypress', this.onGlobalKeypress)
    } else {
      window.removeEventListener('keypress', this.onGlobalKeypress)
    }
  }

  private onGlobalKeypress(event: KeyboardEvent) {
    console.log(event)
    if( (event.ctrlKey || event.metaKey) && event.code == 'KeyD' ) {
      event.preventDefault()
      event.stopPropagation()
      this.handleGlobalCommand(globalCommands.submitAndCopy)
    } else if ( (event.ctrlKey || event.metaKey) && event.code == 'KeyS' ) {
      event.preventDefault()
      event.stopPropagation()
      this.handleGlobalCommand(globalCommands.snooze)
    }
  }

  componentDidUpdate() {
    if(
      this.state.location &&
      config.target == 'extension'
    ) this._setMobileConvenienceInput(true)
  }

  updateLocation(newLocation: string, isClearPress: boolean = false) {
    const keepSnoozeOptionsOpen = newLocation != '' && this.state.showSnoozeOptions

    this._clearErrorState()
    this.setState({
      location: newLocation.trim(),
      generatedShortlink: undefined,
      generatedDescriptiveShortlink: undefined,
      generatedHash: undefined,
      userTag: this.defaultUserTag(),
      descriptionTag: '',
      showSnoozeOptions: keepSnoozeOptionsOpen
    })
    if(isClearPress) this._setMobileConvenienceInput(false)
  }

  public async handleGlobalCommand(command: globalCommands) {
    console.log('global command:', command)
    switch(command) {
      case globalCommands.submitAndCopy: {
        await this.submitLocation()
        this.setState({
          successState: {
            successMessage: 'Shortlink copied to clipboard'
          }
        })
        clipboardTools.copy(this.state.generatedShortlink || '')
        return
      }
      case globalCommands.snooze: {
        this.setState({
          showSnoozeOptions: true
        })
      }
    }
  }

  private setShortlinkState( args: { location: string, hash: string, userTag?: string, descriptionTag?: string} ) {
    console.log(`[Display new shortlink]`, args)
    let newState: any = {
      generatedShortlink: linkTools.generateShortlinkFromHash(args.hash),
      generatedHash: args.hash,
      location: args.location,
      errorState: {}
    }
    if(args.descriptionTag) {
      newState = {
        ...newState,
        userTag: args.userTag,
        descriptionTag: args.descriptionTag,
        generatedDescriptiveShortlink: linkTools.generateDescriptiveShortlink({ userTag: args.userTag, descriptionTag: args.descriptionTag || '' })
      }
    }
    this.setState(newState)
    _.defer(this.saveLSCache)
  }

  private async retrieveLSCache() : Promise<boolean> {
    const locationUrl = linkTools.fixUrl(this.state.location.trim())
    const cachedURL = Cache.checkShortlink( {location: locationUrl} )
    console.log('[Trying cache...]', locationUrl, window.localStorage[locationUrl])

    if(cachedURL == null || !cachedURL.hash) return false

    if(
      this.state.userTag != cachedURL.descriptor?.userTag ||
      (this.state.descriptionTag != '' && this.state.descriptionTag != cachedURL.descriptor?.descriptionTag)
    ) return false 

    console.log('[Cache → Retrieved object]:\n',cachedURL)
    this.setShortlinkState({
      location: cachedURL.location,
      hash: cachedURL.hash,
      userTag: cachedURL.descriptor?.userTag,
      descriptionTag: cachedURL.descriptor?.descriptionTag
    })
    return true
  }

  private saveLSCache() {
    if(!this.state.generatedHash) console.error('Empty hash to be saved!')
    const descriptor = this.state.descriptionTag ? 
      { userTag: this.state.userTag, descriptionTag: this.state.descriptionTag } :
      undefined

    Cache.storeShortlink({
      location: this.state.location.trim(),
      hash: this.state.generatedHash,
      descriptor
    })
    this.loadAllCachedShortlinks()
  }

  private async loadAllCachedShortlinks() {
    Cache.setStorage()
    this.setState({
      cachedShortlinks: [],
      cachedShortlinksLoading: true,
      cachedShortlinksDisplayNumber: checkMobileMQ() ? 2 : 3
    })
    const storage = await Cache.awaitStorage()
    this.setState({
      cachedShortlinks: _.first(storage, this.state.cachedShortlinksDisplayNumber),
      cachedShortlinksLoading: false,
      cachedShortlinksDisplayNumber: checkMobileMQ() ? 2 : 3
    })
  }

  async submitLocation() {
    this._clearErrorState()
    this.snoozeOptions(false)

    try {
      const locationUrl = linkTools.fixUrl(this.state.location.trim())
      if (!locationUrl) return
      
      const cachedResult = await this.retrieveLSCache()
      if(cachedResult) return

      this.setState({loadingState: {createLinkIsLoading: true}})
      const result = await Query.createShortlink(locationUrl)
      console.log('[Home → submitLocation]\n', result)
      if(!result || !result.hash) throw new Error(`Unexpected error: shortlink for '${locationUrl}' was not created. Please, try again`)

      this.setShortlinkState({
        location: result.location,
        hash: result.hash,
        userTag: result.descriptor?.userTag || '',
        descriptionTag: result.descriptor?.descriptionTag || ''
      })
    } catch(error) {
      this.setState({errorState: {
          lastError: error instanceof Error ? { message: error.message } : { message: String(error) },
          createLinkResult: true
        }
      })
    }
    this.setState({loadingState: {createLinkIsLoading: false}})
  }

  snoozeOptions(val: boolean = true) {
    this.setState({
      showSnoozeOptions: val
    })
  }

  handleSuccessPaste(clipText: string) {
    this._clearErrorState()
    this.setState({
      location: clipText
    })
    this.submitLocation()
  }

  handleDescriptorChange(value: string) {
    this._clearErrorState()
    this.setState({
      descriptionTag: modifyURLSlug(value),
      loadingState: {createDescriptiveLinkIsLoading: true}
    })
  }

  // public submitDescriptor: (() => void) & _.Cancelable;
  private async submitDescriptor() {
    this._clearErrorState()
    console.log('[Home → submitDescriptor]\n', this.state.userTag, this.state.descriptionTag)

    if(this.state.userTag) setCookie('userTag', this.state.userTag, 365)

    if(!this.state.descriptionTag) { 
      this.setState({
        generatedDescriptiveShortlink: undefined,
        loadingState: {createDescriptiveLinkIsLoading: false}
      })
      return
    }

    if(await this.retrieveLSCache()) return
    
    try {
      const result = await Query.createShortlinkDescriptor( 
        { userTag: this.state.userTag, 
          descriptionTag: this.state.descriptionTag,
          location: this.state.location,
          hash: this.state.generatedHash
        }
      )

      if(!result || !result.descriptor) return
      if(result.descriptor.descriptionTag != this.state.descriptionTag) return

      this.setShortlinkState({
        location: result.location,
        hash: result.hash,
        userTag: result.descriptor.userTag,
        descriptionTag: result.descriptor.descriptionTag
      })
    } catch(error) {
      this.setState({errorState: {
          lastError: error instanceof Error ? { message: error.message } : { message: String(error) },
          createDescriptiveLinkResult: true
        }
      })
    }
    this.setState({loadingState: {createDescriptiveLinkIsLoading: false}})
  }

  private _clearErrorState(): void {
    this.setState({ errorState: {
      lastError: undefined,
      createDescriptiveLinkResult: this.state.errorState.createDescriptiveLinkResult
    } })
  }

  private _clearSuccessState(): void {
    this.setState({ successState: {} })
  }

  public defaultUserTag() : string {
    return getCookie('userTag')
  }

  private _setMobileConvenienceInput(mode: boolean) {
    if(checkMobileMQ() && this.state.mobileConvenienceInput != mode) {
      this.setState({ mobileConvenienceInput: mode })
      if(_.isFunction(this.props.onToggleHeaderDisplay)) this.props.onToggleHeaderDisplay(mode)
      _.delay(() => document.body.scrollTo(0,0), 1000)
    }
  }

  private _onHeroInputElementFocus(event: React.FocusEvent<HTMLInputElement>) : void {
    this._setMobileConvenienceInput(true)
  }

  public async handleStandardSnooze(predefinedValue: string) {
    const baseDateISOString = (new Date()).toISOString()
    try {
      const location = linkTools.fixUrl(this.state.location)
      const result = await Query.createOrUpdateShortlinkTimer({
        baseDateISOString,
        location,
        hash: this.state.generatedHash,
        standardTimer: predefinedValue
      })
      if(!result) return null

      this.updateLocation('')
      const trimLocation = result.location.length > 30 ? result.location.slice(0,29) + '…' : result.location
      const description = (result.snooze?.description || '').toLowerCase()
      this.setState({
        successState: {
          successMessage: `Snoozed until ${description}: ${trimLocation}`
        }
      })
      if(browserApi.isInit) {
        browserApi.closeActiveTab()
        browserApi.sendMessage({command: 'sync'})
      }
    } catch(error) {
      this.setState({errorState: {
          lastError: error instanceof Error ? { message: error.message } : { message: String(error) },
          createLinkResult: true
        }
      })
    }
  }

  render() {
    const globalClass = styles.homepage+'_app-body'
    const mobileConvenienceClass = this.state.mobileConvenienceInput ? '__mobile-convenience-state' : ''
    return (
        <div className={`${globalClass}`}>
          <div className={`${globalClass}__layout`}>
            <div className={`${globalClass}__shortlink-block ${mobileConvenienceClass}`}>
              <div className={`${globalClass}__offset-wrapper`}>
                {!this.state.mobileConvenienceInput && 
                  <Video
                    className={`${globalClass}__video`}
                    thumbnail={`/assets/shlk_logo.jpg`}
                    src={
                      [{link:'/assets/shlk_logo.mp4', type:'video/mp4'}]
                    }
                    aspectRatio={1200/360}
                    timeout={1000}
                    />
                }
                <HeroInput 
                  inputRef={this.heroInputRef}
                  onChange={this.updateLocation}
                  onSubmit={this.submitLocation}
                  onSnooze={() => this.snoozeOptions(true)}
                  name="URL"
                  placeholder="Type or paste a link"
                  value={this.state.location}
                  onFocus={this._onHeroInputElementFocus}
                  hasCta={!this.state.generatedShortlink || this.state.generatedShortlink == ''}
                />
              </div>
              {!this.state.showSnoozeOptions && (
                <>
                <ShortlinkDisplay
                  placeholder={config.displayServiceUrl}
                  shortlink={this.state.generatedShortlink}
                  isLoading={this.state.loadingState.createLinkIsLoading}
                  hasCta={(!!this.state.generatedShortlink || this.state.generatedShortlink != '') && (!this.state.generatedDescriptiveShortlink)}
                  error={this.state.errorState.createLinkResult}
                />
                {this.state.generatedShortlink && 
                  <ShortlinkSlugInput
                    displayLink={linkTools.displayServiceUrl}
                    userTag={this.props.context?.user?.userTag ? this.props.context?.user?.userTag : 'someone'}
                    value={this.state.descriptionTag}
                    placeholder={`your-custom-url`}
                    onDeferredChange={this.handleDescriptorChange}
                    onDebouncedChange={this.submitDescriptor}
                    debounce={500}
                    show={this.state.generatedShortlink ? true : false}
                    generatedLink={this.state.generatedDescriptiveShortlink}
                    isLoading={this.state.loadingState.createDescriptiveLinkIsLoading}
                    hasCta={!this.state.generatedDescriptiveShortlink || this.state.generatedDescriptiveShortlink != ''}
                    error={this.state.errorState.createDescriptiveLinkResult}
                    flyover={
                      <div className={`${globalClass}__flyover`}>
                        {this.props.context?.user && 
                          <div className={`${globalClass}__logged-content`}>
                            You can choose different name in <Link inline={true} to='/app/profile'>Profile</Link>
                          </div>
                        }
                        { !this.props.context?.user &&
                          <div className={`${globalClass}__anonymous-content`}>
                            You can make it unique by <Link inline={true} to='/login'>creating&nbsp;an&nbsp;account</Link>
                          </div>
                        }
                      </div>
                    }
                  />
                }
                </>)
              }
              {this.state.showSnoozeOptions && (
                <SnoozeList
                  onSnooze={this.handleStandardSnooze}
                />
              )}
              <div className={`${globalClass}__snackbar-container`}>
                { this.state.errorState.lastError && 
                  <Snackbar 
                    message={this.state.errorState.lastError.message}
                    canDismiss={true}
                    onDismiss={this._clearErrorState}
                    />
                }
                { this.state.successState.successMessage && 
                  <Snackbar 
                    message={this.state.successState.successMessage}
                    canDismiss={true}
                    timer={2000}
                    onDismiss={this._clearSuccessState}
                    />
                }
              </div>
            </div>

            <div className={`${globalClass}__footer-wrapper`}>
              <HistoryWidget 
                list={this.state.cachedShortlinks}
                totalCount={this.state.cachedShortlinks.length}
                isLoading={this.state.cachedShortlinksLoading}
                display={this.state.cachedShortlinksDisplayNumber}
                context={this.props.context}
                router={this.props.router}
              />
            </div>
          </div>
          
          <Footer />
        </div>
    )
  }
}
ShortlinkBar.contextType = AppContext