import styles from './styles-link.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import Icon, { ReactIcon, IconSize } from '../icons'
import classNames from 'classnames'
import { Flyover } from '../tooltip'
import { Link as RouterLink, LinkProps } from 'react-router'
import config from '../../js/config'
import browserApi from '../../js/browser.api'
import linkTools from '../../js/link.tools'

export enum LinkColors {
  USER = 'user',
  APP = 'app'
}

type Props = {
  colorScheme?: LinkColors
  label?: string
  icon?: ReactIcon
  iconSize?: IconSize
  iconRight?: boolean
  isDisabled?: boolean
  isLoading?: boolean
  flyover?: string
  tooltip?: TooltipProps
  to?: string,
  href?: string,
  suffix?: string,
  inline?: boolean
} & Omit<LinkProps, 'to'>

const Link : React.FC<Props> = (
 providedArgs: Props
) => {
  const args = {
    ...providedArgs,
    isDisabled: providedArgs.isDisabled ?? false,
    isLoading: providedArgs.isLoading ?? false,
    colorScheme: providedArgs.colorScheme ?? LinkColors.APP,
    inline: providedArgs.inline ?? false
  }
  let [showFlyover, setShowFlyover] : [ boolean, React.Dispatch<boolean> ] = [false, () => {}]
  if(args.flyover) [showFlyover, setShowFlyover] = React.useState(false)
  
  const suffixes = args.suffix ? args.suffix.split('+') : []
  let [animateSuffix, setAnimateSuffix] : [ boolean, React.Dispatch<boolean> ] = [false, () => {}]
  if(suffixes.length > 1) [animateSuffix, setAnimateSuffix] = React.useState(false)

  const globalClass = styles.wrapperClass+'_link'
  const linkClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_inline`]: args.inline,
    [`${globalClass}_${args.colorScheme}`]: true,
    [`${globalClass}_loading`]: args.isLoading,
    [`${globalClass}_disabled`]: args.isDisabled || args.isLoading
  })

  const handleClick : (event: React.MouseEvent<HTMLAnchorElement>) => void = (event) => {
    if(args.isDisabled || args.isLoading) {
      event.preventDefault()
      event.stopPropagation()
      return
    } 

    if(_.isFunction(args.onClick)) {
      event.preventDefault()
      event.stopPropagation()
      args.onClick(event)
    }

    if(config.target == 'extension' && args.href) {
      event.preventDefault()
      const fullUrl = new URL(args.href, linkTools.baseUrl)
      browserApi.openExternal(fullUrl.toString())
    }

    if(args.flyover) setShowFlyover(true)
    if(suffixes.length > 1) setAnimateSuffix(true)
  }

  if(args.suffix) React.useEffect( () => {
    if(!animateSuffix) return 
    const timeout = setTimeout( () => { setAnimateSuffix(false) }, parseInt(styles.swapDuration))

    return () => { clearTimeout(timeout)}
  })
  
  const inner = (
    <>
      {args.icon && !args.iconRight && 
        <Icon useIcon={args.icon} size={args.iconSize || IconSize.SMALL} />
      }

      {args.label}{args.children}

      {args.icon && args.iconRight && 
        <Icon useIcon={args.icon} size={args.iconSize || IconSize.SMALL} />
      }

      {args.flyover && showFlyover && <Flyover label={args.flyover} onDone={() => setShowFlyover(false)} />}

      {suffixes.length > 0 && (<>
        <span className={`${globalClass}__separator`} >&nbsp;·&nbsp;</span>
        <span className={`${globalClass}__action-hint`}>
          <span className={`${globalClass}__action-hint__animated-inner ${animateSuffix ? `${globalClass}__action-hint__animated-inner-active` : ''}`}>
            {suffixes[0]}
            {suffixes[1] && <><br/>{suffixes[1]}</>}
          </span>
        </span>
      </>)}
    </>
  )

  const htmlAnchorAttributes = _.omit(args, 'colorScheme', 'label', 'icon', 'iconSize', 'isDisabled', 'iconRight', 'isLoading', 'flyover', 'tooltip', 'onClick', 'href', 'to', 'suffix', 'inline')
  
  if (
    args.to && args.to != ''
  ) {
    return <RouterLink to={args.to} {...htmlAnchorAttributes} 
      className={`${linkClasses} ${args.className || ''}`}
      onClick={handleClick}>
        {inner}
      </RouterLink>
  } else {
    return <a href={args.href} {...htmlAnchorAttributes} 
    className={`${linkClasses} ${args.className || ''}`}
    onClick={handleClick}
    target='_blank'>
      {inner}
    </a>
  }
}

export default Link