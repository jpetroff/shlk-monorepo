import styles from './styles-link.module.less'
import * as React from 'react'
import Icon, { ReactIcon, IconSize } from '../icons'
import classNames from 'classnames'
import { Flyover } from '../tooltip'
import { Link as RouterLink, LinkProps } from 'react-router'
import config from '../../js/config'
import browserApi from '../../js/browser.api'
import linkTools from '../../js/link.tools'

export enum LinkColors { USER = 'user', APP = 'app' }

type SharedProps = {
  colorScheme?: LinkColors
  label?: string
  icon?: ReactIcon
  iconSize?: IconSize
  iconRight?: boolean
  isDisabled?: boolean
  isLoading?: boolean
  flyover?: string
  tooltip?: TooltipProps
  suffix?: string
  inline?: boolean
}
type InternalLinkProps = SharedProps & { to: string, href?: never, newTab?: never } & Omit<LinkProps, 'to'>
type ExternalLinkProps = SharedProps & { href: string, to?: never, newTab?: boolean } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
type ActionLinkProps = SharedProps & { ref?: React.Ref<HTMLButtonElement> } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'>
type LinkPropsUnion = InternalLinkProps | ExternalLinkProps

function useFeedback(suffix?: string) {
  const [showFlyover, setShowFlyover] = React.useState(false)
  const [animateSuffix, setAnimateSuffix] = React.useState(false)
  React.useEffect(() => {
    if (!animateSuffix) return
    const timeoutId = window.setTimeout(() => setAnimateSuffix(false), Number.parseInt(styles.swapDuration))
    return () => window.clearTimeout(timeoutId)
  }, [animateSuffix])
  return { showFlyover, setShowFlyover, animateSuffix, setAnimateSuffix, suffixes: suffix?.split('+') ?? [] }
}

function presentation(props: SharedProps & { className?: string }) {
  const globalClass = styles.wrapperClass + '_link'
  const classes = classNames({
    [globalClass]: true,
    [`${globalClass}_inline`]: props.inline,
    [`${globalClass}_${props.colorScheme ?? LinkColors.APP}`]: true,
    [`${globalClass}_loading`]: props.isLoading,
    [`${globalClass}_disabled`]: props.isDisabled || props.isLoading,
    [`${props.className}`]: !!props.className
  })
  return { globalClass, classes }
}

function LinkContent({ props, feedback, globalClass }: {
  props: SharedProps & { children?: React.ReactNode },
  feedback: ReturnType<typeof useFeedback>,
  globalClass: string
}) {
  return <>
    {props.icon && !props.iconRight && <Icon useIcon={props.icon} size={props.iconSize ?? IconSize.SMALL} />}
    {props.label}{props.children}
    {props.icon && props.iconRight && <Icon useIcon={props.icon} size={props.iconSize ?? IconSize.SMALL} />}
    {props.flyover && feedback.showFlyover && <Flyover label={props.flyover} onDone={() => feedback.setShowFlyover(false)} />}
    {feedback.suffixes.length > 0 && <>
      <span className={`${globalClass}__separator`}>&nbsp;·&nbsp;</span>
      <span className={`${globalClass}__action-hint`}>
        <span className={classNames(`${globalClass}__action-hint__animated-inner`, {
          [`${globalClass}__action-hint__animated-inner-active`]: feedback.animateSuffix
        })}>
          {feedback.suffixes[0]}
          {feedback.suffixes[1] && <><br />{feedback.suffixes[1]}</>}
        </span>
      </span>
    </>}
  </>
}

export default function Link(props: LinkPropsUnion) {
  const feedback = useFeedback(props.suffix)
  const { globalClass, classes } = presentation(props)
  const disabled = props.isDisabled || props.isLoading
  const activate = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled) { event.preventDefault(); return }
    if (props.flyover) feedback.setShowFlyover(true)
    if (feedback.suffixes.length > 1) feedback.setAnimateSuffix(true)
    if ('href' in props && props.href && config.target === 'extension') {
      event.preventDefault()
      browserApi.openExternal(new URL(props.href, linkTools.baseUrl).toString())
    }
  }
  const content = <LinkContent props={props} feedback={feedback} globalClass={globalClass} />

  if ('to' in props && props.to) {
    const { to, colorScheme: _color, label: _label, icon: _icon, iconSize: _iconSize,
      iconRight: _iconRight, isDisabled: _disabled, isLoading: _loading, flyover: _flyover,
      tooltip: _tooltip, suffix: _suffix, inline: _inline, className: _className, ...routerProps } = props
    return <RouterLink {...routerProps} to={to} className={classes} aria-disabled={disabled || undefined} onClick={activate}>{content}</RouterLink>
  }

  const { href, newTab = false, colorScheme: _color, label: _label, icon: _icon,
    iconSize: _iconSize, iconRight: _iconRight, isDisabled: _disabled, isLoading: _loading,
    flyover: _flyover, tooltip: _tooltip, suffix: _suffix, inline: _inline,
    className: _className, ...anchorProps } = props as ExternalLinkProps
  return <a {...anchorProps} href={href} className={classes} aria-disabled={disabled || undefined}
    target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}
    onClick={activate}>{content}</a>
}

export function ActionLink(props: ActionLinkProps) {
  const feedback = useFeedback(props.suffix)
  const { globalClass, classes } = presentation(props)
  const { colorScheme: _color, label: _label, icon: _icon, iconSize: _iconSize,
    iconRight: _iconRight, isDisabled, isLoading, flyover: _flyover, tooltip: _tooltip,
    suffix: _suffix, inline: _inline, className: _className, onClick, ...buttonProps } = props
  const disabled = isDisabled || isLoading
  return <button {...buttonProps} type="button" className={classes} disabled={disabled}
    aria-busy={isLoading || undefined} onClick={(event) => {
      onClick?.(event)
      if (props.flyover) feedback.setShowFlyover(true)
      if (feedback.suffixes.length > 1) feedback.setAnimateSuffix(true)
    }}>
    <LinkContent props={props} feedback={feedback} globalClass={globalClass} />
  </button>
}
