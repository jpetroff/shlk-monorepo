import styles from './styles-button.module.less'
import * as React from 'react'
import { Flyover } from '../tooltip'
import Icon, { ReactIcon, IconSize, CaretRight } from '../icons'
import config from '../../js/config'
import browserApi from '../../js/browser.api'
import linkTools from '../../js/link.tools'
import classNames from 'classnames'

export enum ButtonSize {
  LARGE = 'large',
  SMALL = 'small'
}

export enum ButtonType {
  PRIMARY = 'primary',
  GHOST = 'ghost',
  SECONDARY = 'secondary'
}

type SharedProps = {
  label?: string
  icon?: ReactIcon
  size?: ButtonSize
  type?: ButtonType
  isDisabled?: boolean
  isLoading?: boolean
  isCaret?: boolean
  flyover?: string
  tooltip?: TooltipProps
  fullWidth?: boolean
}

type ButtonProps = SharedProps & {
  htmlType?: 'button' | 'submit'
  onClick?: (event: React.MouseEvent<HTMLButtonElement>, element?: HTMLButtonElement) => void
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'disabled'>

type ButtonLinkProps = SharedProps & {
  href: string
  newTab?: boolean
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>, element?: HTMLAnchorElement) => void
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>

const BtnIcnMap: Record<ButtonSize, IconSize> = {
  [ButtonSize.LARGE]: IconSize.LARGE,
  [ButtonSize.SMALL]: IconSize.SMALL
}

function useButtonPresentation(props: SharedProps & { className?: string }) {
  const size = props.size ?? ButtonSize.SMALL
  const visualType = props.type ?? ButtonType.PRIMARY
  const isDisabled = props.isDisabled ?? false
  const isLoading = props.isLoading ?? false
  const globalClass = styles.wrapperClass + '_button'
  const classes = classNames({
    [globalClass]: true,
    [`${globalClass}_${size}`]: true,
    [`${globalClass}_${visualType}`]: true,
    [`${globalClass}_disabled`]: isDisabled || isLoading,
    [`${globalClass}_loading`]: isLoading,
    [`${globalClass}_icon-only`]: !props.label && props.icon,
    [`${globalClass}_full-width`]: props.fullWidth,
    [`${props.className}`]: !!props.className
  })
  return { size, isDisabled, isLoading, globalClass, classes }
}

function ButtonContent({
  label, icon, isCaret, size, globalClass, flyover, showFlyover, onFlyoverDone
}: SharedProps & {
  size: ButtonSize
  globalClass: string
  showFlyover: boolean
  onFlyoverDone: () => void
}) {
  return <>
    {icon && <Icon className={`${globalClass}__icon`} useIcon={icon} size={BtnIcnMap[size]} />}
    {label && <span className={`${globalClass}__label`}>{label}{icon ? <>&nbsp;</> : ''}</span>}
    {isCaret && <Icon useIcon={CaretRight} size={IconSize.SMALL} />}
    {flyover && showFlyover && <Flyover label={flyover} onDone={onFlyoverDone} />}
  </>
}

export default function Button(props: ButtonProps) {
  const [showFlyover, setShowFlyover] = React.useState(false)
  const ref = React.useRef<HTMLButtonElement>(null)
  const presentation = useButtonPresentation(props)
  const {
    label, icon, isCaret, flyover, tooltip: _tooltip, fullWidth: _fullWidth,
    htmlType = 'button', onClick, isDisabled: _isDisabled, isLoading: _isLoading,
    size: _size, type: _type, className: _className, ...htmlProps
  } = props

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event, ref.current ?? undefined)
    if (flyover) setShowFlyover(true)
  }

  return <button
    {...htmlProps}
    ref={ref}
    type={htmlType}
    className={presentation.classes}
    disabled={presentation.isDisabled || presentation.isLoading}
    aria-busy={presentation.isLoading || undefined}
    aria-label={props['aria-label']}
    onClick={handleClick}
  >
    <ButtonContent {...{ label, icon, isCaret, flyover }} size={presentation.size}
      globalClass={presentation.globalClass} showFlyover={showFlyover}
      onFlyoverDone={() => setShowFlyover(false)} />
  </button>
}

export function ButtonLink(props: ButtonLinkProps) {
  const [showFlyover, setShowFlyover] = React.useState(false)
  const ref = React.useRef<HTMLAnchorElement>(null)
  const presentation = useButtonPresentation(props)
  const {
    label, icon, isCaret, flyover, tooltip: _tooltip, fullWidth: _fullWidth,
    onClick, isDisabled: _isDisabled, isLoading: _isLoading, size: _size,
    type: _type, className: _className, href, newTab = false, ...htmlProps
  } = props

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (presentation.isDisabled || presentation.isLoading) {
      event.preventDefault()
      return
    }
    onClick?.(event, ref.current ?? undefined)
    if (config.target === 'extension') {
      event.preventDefault()
      browserApi.openExternal(new URL(href, linkTools.baseUrl).toString())
    }
    if (flyover) setShowFlyover(true)
  }

  return <a
    {...htmlProps}
    ref={ref}
    href={href}
    className={presentation.classes}
    target={newTab ? '_blank' : undefined}
    rel={newTab ? 'noopener noreferrer' : undefined}
    aria-disabled={presentation.isDisabled || presentation.isLoading || undefined}
    aria-busy={presentation.isLoading || undefined}
    onClick={handleClick}
  >
    <ButtonContent {...{ label, icon, isCaret, flyover }} size={presentation.size}
      globalClass={presentation.globalClass} showFlyover={showFlyover}
      onFlyoverDone={() => setShowFlyover(false)} />
  </a>
}
