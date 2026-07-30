import styles from './styles-user-settings.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import classNames from 'classnames'
import AppContext from '../../js/app.context'
import Input from '../../components/input'
import Button, { ButtonSize, ButtonType } from '../../components/button'
import users from '../../js/user.gql'
import Snackbar from '../../components/snackbar'
import Link from '../../components/link'
import config from '../../js/config'
import { LinkIcon, Search } from '../../components/icons'

type Props = {
  router?: PageRouterProps
  context: React.ContextType<typeof AppContext>
  className?: string
}

type State = {
  userTag: string
  savingInProgress: boolean
  successState: {
    successMessage?: string
  }
  errorState: {
    errorMessage?: string
  }
}


export default class UserSettings extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      userTag: this.props.context.user?.userTag || this.props.context.user?.name || 'someone',
      savingInProgress: false,
      successState: {},
      errorState: {}
    }
    _.bindAll(this, ..._.functions(this))
  }

  async handleSave() {
    try {
      this.setState({savingInProgress: true})

      const result = await users.updateLoggedInUser({ userTag: this.state.userTag })
      await this.props.context.requestUpdate()

      this.setState({
        userTag: result?.userTag ?? this.state.userTag,
        savingInProgress: false,
        successState: {
          successMessage: 'Profile updated'
        }
      })
    } catch(error) {
      this.setState({
        errorState: {
          errorMessage: `Sorry, something didn’t go well. Please, try again`
        }
      })
    }
  }

  private _clearErrorState() {
    this.setState({
      errorState: {},
      savingInProgress: false
    })
  }

  private _clearSuccessState() {
    this.setState({
      successState: {},
      savingInProgress: false
    })
  }

  private saveDisabled() {
    return !(
      this.state.userTag != ''
    )
  }

  render() {
    const globalClass = `${styles.wrapperClass}_user-settings`
    const userSettingsClasses = classNames({
      [`${globalClass}`]: true,
      [`${this.props.className}`]: !!this.props.className
    })
    return (
      <div className={`${userSettingsClasses}`}>
        <div className={`${globalClass}__header`}>
          <div className={`${globalClass}__header__avatar`}>
            {this.props.context.user?.avatar && 
              <img className={`${globalClass}__header__img-source`} src={this.props.context.user?.avatar} />
            }
          </div>
          <div className={`${globalClass}__name-block`}>
            <div className={`${globalClass}__header__name`}>
              Hello {this.props.context.user?.name},
            </div>
            <div className={`${globalClass}__header__email`}>
              {this.props.context.user?.email}
            </div>
          </div>
        </div>
        <div className={`${globalClass}__field`}>
          <div className={`${globalClass}__field__composite-input`}>
            <Input
              className={`${globalClass}__field__input`}
              id={'slug-input-field'}
              value={this.state.userTag} 
              onChange={(value, event) => this.setState( {userTag: value} ) }
              prefix={`${config.displayServiceUrl}/`}
              label={`Personal shortlink prefix`}
              placeholder={`me`}
              />
            </div>
        </div>
        {config.target != 'extension' && <div className={`${globalClass}__download`}>
          <span className={`${globalClass}__download__label`}>Install browser extension</span>
          <Link href={config.extensionLink} className={`${globalClass}__download__link`}>
            <img src={`/assets/chrome_store.jpg`} srcSet={`/assets/chrome_store@2x.jpg 2x`} className={`${globalClass}__download__link-content`} />
          </Link>
        </div>}
        <div className={`${globalClass}__submit`}>
          <Button 
            isDisabled={this.saveDisabled()}
            isLoading={this.state.savingInProgress}
            size={ButtonSize.LARGE}
            type={ButtonType.PRIMARY}
            label='Save profile settings'
            onClick={this.handleSave}
            fullWidth={true}
            />
        </div>
        <div className={`${globalClass}__snackbar-container`}>
          { this.state.errorState.errorMessage && 
            <Snackbar 
              className={`${globalClass}__profile-error`}
              message={this.state.errorState.errorMessage}
              canDismiss={true}
              onDismiss={this._clearErrorState}
              />
          }
          { this.state.successState.successMessage && 
            <Snackbar 
              className={`${globalClass}__profile-success`}
              message={this.state.successState.successMessage}
              canDismiss={true}
              timer={2000}
              onDismiss={this._clearSuccessState}
              />
          }
        </div>
      </div>
    )
  }
}