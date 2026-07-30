import styles from './styles-header.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import classNames from 'classnames'
import { useNavigate, Link as RouterLink } from 'react-router'

import Icon, { Logo, LogoC, Avatar, IconSize, CaretLeft, Logout, LinkIcon, Snooze } from '../../components/icons'
import { checkMobileMQ } from '../../js/utils'
import AppContext from '../../js/app.context'

import Link from '../../components/link'
import DropdownMenu, { DropdownPosition } from '../../components/dropdown-menu'
import MenuItem from '../../components/menu-item'
import browserApi from '../../js/browser.api'

import config from '../../js/config'

export enum HeaderPosition {
  sticky = 0,
  fixed = 1
}

type Props = {
  backButton?: string
  title?: string
  position?: HeaderPosition
  hideLogo?: boolean
}

type State = {}

const Header : React.FC<Props> = (
  { backButton = "", title, position, hideLogo = false } : Props
) => {
	const isMobile: boolean = checkMobileMQ()
  const appContext = React.useContext(AppContext)
  const user = appContext.user
  const hasLoggedUser = !!user
  console.log(appContext)
  const navigate = useNavigate()
  const [showDropdown, setDropdown] = React.useState(false)

  const loginLink = hasLoggedUser ? '/app' : '/login'

  const globalClass = `${styles.wrapperClass}_app-header`
  const headerClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_logged-user`]: hasLoggedUser,
    [`${globalClass}_has-avatar`]: !!user?.avatar,
    [`${globalClass}_has-back-button`]: !!backButton,
    [`${globalClass}_sticky`]: position == HeaderPosition.sticky,
    [`${globalClass}_fixed`]: position == HeaderPosition.fixed,
  })

  function handleLoginClick(event: React.SyntheticEvent) {
    if(hasLoggedUser) {
      setDropdown(true)
    } else {
      navigate(loginLink)
    }
  }

  function handleLogoutClick() {
    if(config.target == 'extension') {
      browserApi.openExternal(`${config.apiBaseUrl}/logout`)
      
    } else {
      window.location.href = '/logout'
      setDropdown(false)
    }
  }

  return (
    <div className={`${headerClasses}`}>
      {backButton && (
        <div className={`${globalClass}__back_wrapper`}>
          <div onClick={() => navigate(backButton)}><Icon useIcon={CaretLeft} size={IconSize.LARGE} /></div>
        </div>
      )}
        {!hideLogo && <div className={`${globalClass}__logo_wrapper`} onClick={() => navigate('/')} >
          <LogoC className={`${globalClass}__logo ${globalClass}__logo_compact`} />
        </div>}
        <div className={`${globalClass}__middle`}>
          {title && (
            <div className={`${globalClass}__title_wrapper`}>
              <span className={`${globalClass}__sub-header`}>shlk.cc</span>
              <h1 className={`${globalClass}__header`}>{title}</h1>
            </div>
          )}
        </div>
        <div className={`${globalClass}__user`}>
          <Link className={`${globalClass}__account-link`} isDisabled={false} onClick={handleLoginClick}
          >
            {!hasLoggedUser && 
              (<>
                <div className={`${globalClass}__account-link__avatar`}><Icon useIcon={Avatar} size={IconSize.LARGE} /></div>
                <div className={`${globalClass}__account-link__text`}>Sign in</div>
              </>)
            }
            {user && 
              (<>
                <div className={`${globalClass}__account-link__text`}>
                  {user.name}
                </div>
                { user.avatar && <div className={`${globalClass}__account-link__avatar`} style={ { backgroundImage: `url(${user.avatar})` } }></div> }
                {!user.avatar && <div className={`${globalClass}__account-link__avatar`}>{_.first(user.name.toUpperCase())}</div> }
                <DropdownMenu className={`${globalClass}__dropdown`} onClose={() => setDropdown(false)} show={showDropdown} position={[DropdownPosition.top, DropdownPosition.right]}>
                    <div className={`${globalClass}__dropdown-header`}>
                      
                      <div className={`${globalClass}__dropdown-header__name-block`}>
                        <div className={`${globalClass}__dropdown-header__name-block__name`}>{user.name}</div>
                        <div className={`${globalClass}__dropdown-header__name-block__email`}>{user.email}</div>
                      </div>

                      { user?.avatar && 
                        <div className={`${globalClass}__dropdown-header__avatar`} style={ { backgroundImage: `url(${user.avatar})` } }></div>
                      }
                      {!user?.avatar &&
                        <div className={`${globalClass}__dropdown-header__avatar`}>{_.first(user.name.toUpperCase())}</div>
                      }
                    </div>
                    <MenuItem.Separator />
                    <MenuItem label='My shortlinks' icon={LinkIcon} onClick={() => { navigate('/app'); setDropdown(false) } }/>
                    <MenuItem label='Snoozed links' icon={Snooze} onClick={() => { navigate('/app/snoozed'); setDropdown(false) } }/>
                    <MenuItem label='Profile' icon={Avatar} onClick={() => { navigate('/app/profile'); setDropdown(false) } }/>
                    <MenuItem.Separator />
                    <MenuItem label='Logout' icon={Logout} onClick={handleLogoutClick}/>
                  </DropdownMenu>
              </>)
            }
          </Link>
        </div>
    </div>
  )
}

export default Header