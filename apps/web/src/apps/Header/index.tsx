import styles from './styles-header.module.less'
import * as React from 'react'
import classNames from 'classnames'
import { useNavigate } from 'react-router'
import Icon, { LogoC, Avatar, IconSize, CaretLeft, Logout, LinkIcon, Snooze } from '../../components/icons'
import { useAppContext } from '../../js/app.context'
import Link, { ActionLink } from '../../components/link'
import DropdownMenu, { DropdownPosition } from '../../components/dropdown-menu'
import MenuItem from '../../components/menu-item'
import browserApi from '../../js/browser.api'
import config from '../../js/config'

export enum HeaderPosition { sticky = 0, fixed = 1 }
type Props = { backButton?: string, title?: string, position?: HeaderPosition, hideLogo?: boolean }

export default function Header({ backButton = '', title, position, hideLogo = false }: Props) {
  const context = useAppContext()
  const user = context.user
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = React.useState(false)
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null)
  const closeDropdown = React.useCallback(() => {
    setShowDropdown(false)
    window.requestAnimationFrame(() => accountTriggerRef.current?.focus())
  }, [])
  const globalClass = `${styles.wrapperClass}_app-header`
  const classes = classNames({
    [globalClass]: true,
    [`${globalClass}_logged-user`]: !!user,
    [`${globalClass}_has-avatar`]: !!user?.avatar,
    [`${globalClass}_has-back-button`]: !!backButton,
    [`${globalClass}_sticky`]: position === HeaderPosition.sticky,
    [`${globalClass}_fixed`]: position === HeaderPosition.fixed
  })

  function logout() {
    if (config.target === 'extension') browserApi.openExternal(`${config.apiBaseUrl}/logout`)
    else window.location.href = '/logout'
    closeDropdown()
  }

  return <header className={classes}>
    {backButton && <div className={`${globalClass}__back_wrapper`}>
      <Link to={backButton} aria-label="Go back"><Icon useIcon={CaretLeft} size={IconSize.LARGE} /></Link>
    </div>}
    {!hideLogo && <Link to="/" className={`${globalClass}__logo_wrapper`} aria-label="Go to home">
      <LogoC className={`${globalClass}__logo ${globalClass}__logo_compact`} aria-hidden="true" />
    </Link>}
    <div className={`${globalClass}__middle`}>
      {title && <div className={`${globalClass}__title_wrapper`}>
        <span className={`${globalClass}__sub-header`}>shlk.cc</span><h1 className={`${globalClass}__header`}>{title}</h1>
      </div>}
    </div>
    <div className={`${globalClass}__user`}>
      {context.authStatus === 'checking' && <div
        className={`${globalClass}__account-link ${globalClass}__account-link_loading`} aria-busy="true">
        <div className={`${globalClass}__account-link__avatar`} aria-hidden="true" />
        <div className={`${globalClass}__account-link__text`} aria-hidden="true">Sign in</div>
      </div>}
      {context.authStatus !== 'checking' && <>
      <ActionLink ref={accountTriggerRef} className={`${globalClass}__account-link`} aria-haspopup={user ? 'menu' : undefined}
        aria-expanded={user ? showDropdown : undefined} onClick={() => user ? setShowDropdown(true) : navigate('/login')}>
        {!user && <><div className={`${globalClass}__account-link__avatar`}><Icon useIcon={Avatar} size={IconSize.LARGE} /></div>
          <div className={`${globalClass}__account-link__text`}>Sign in</div></>}
        {user && <><div className={`${globalClass}__account-link__text`}>{user.name}</div>
          {user.avatar ? <div className={`${globalClass}__account-link__avatar`} style={{ backgroundImage: `url(${user.avatar})` }} />
            : <div className={`${globalClass}__account-link__avatar`}>{user.name.charAt(0).toUpperCase()}</div>}</>}
      </ActionLink>
      {user && <DropdownMenu className={`${globalClass}__dropdown`} onClose={closeDropdown} show={showDropdown}
        position={[DropdownPosition.top, DropdownPosition.right]} label="Account">
        <div className={`${globalClass}__dropdown-header`}>
          <div className={`${globalClass}__dropdown-header__name-block`}>
            <div className={`${globalClass}__dropdown-header__name-block__name`}>{user.name}</div>
            <div className={`${globalClass}__dropdown-header__name-block__email`}>{user.email}</div>
          </div>
          {user.avatar ? <div className={`${globalClass}__dropdown-header__avatar`} style={{ backgroundImage: `url(${user.avatar})` }} />
            : <div className={`${globalClass}__dropdown-header__avatar`}>{user.name.charAt(0).toUpperCase()}</div>}
        </div>
        <MenuItem.Separator />
        <MenuItem label="My shortlinks" icon={LinkIcon} onClick={() => { navigate('/app'); closeDropdown() }} />
        <MenuItem label="Snoozed links" icon={Snooze} onClick={() => { navigate('/app/snoozed'); closeDropdown() }} />
        <MenuItem label="Profile" icon={Avatar} onClick={() => { navigate('/app/profile'); closeDropdown() }} />
        <MenuItem.Separator />
        <MenuItem label="Logout" icon={Logout} onClick={logout} />
      </DropdownMenu>}
      </>}
    </div>
  </header>
}
