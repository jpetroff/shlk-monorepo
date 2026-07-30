import styles from './styles-button.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import { Flyover } from '../tooltip'

import Icon, { ReactIcon, IconSize, CaretRight } from '../icons'
import { useState } from 'react'

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

type Props = {
  label?: string
  icon?: ReactIcon
  size?: ButtonSize
  type?: ButtonType
  onClick?: (event: React.SyntheticEvent<HTMLAnchorElement, Event>, element?: HTMLElement) => void
  isDisabled?: boolean
  isLoading?: boolean
  isCaret?: boolean
  flyover?: string
  tooltip?: TooltipProps
  fullWidth?: boolean
} & Omit<React.JSX.IntrinsicElements["a"], "onClick" | "type">

const BtnIcnMap = _.object(
  [ButtonSize.LARGE,	ButtonSize.SMALL,	],
  [IconSize.LARGE,		IconSize.SMALL,		]
)

const Button : React.FC<Props> = function(
  providedArgs : Props
) {
  const args = {
    ...providedArgs,
    size: providedArgs.size ?? ButtonSize.SMALL,
    type: providedArgs.type ?? ButtonType.PRIMARY,
    isDisabled: providedArgs.isDisabled ?? false,
    isLoading: providedArgs.isLoading ?? false,
    isCaret: providedArgs.isCaret ?? false,
    fullWidth: providedArgs.fullWidth ?? false
  }
  const [showFlyover, setShowFlyover] = useState(false)
  const globalClass = styles.wrapperClass+'_button'

  const buttonClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_${args.size}`]: true,
    [`${globalClass}_${args.type}`]: true,
    [`${globalClass}_disabled`]: args.isDisabled || args.isLoading,
    [`${globalClass}_loading`]: args.isLoading,
    [`${globalClass}_icon-only`]: !args.label && args.icon,
    [`${globalClass}_full-width`]: args.fullWidth,
    [`${args.className}`]: !!args.className,
  })


  const htmlAnchorProps = _.omit(args, 'size', 'type', 'isDisabled', 'isCaret', 'label', 'icon', 'isLoading', 'onClick', 'fullWidth', 'flyover', 'tooltip')
  const btnRef = React.useRef<HTMLAnchorElement | null>(null)

  const handleClick : (event: React.MouseEvent<HTMLAnchorElement>) => void = (event) => {
    if(args.isDisabled || args.isLoading) {
      event.preventDefault()
      event.stopPropagation()
      return;
    } 

    if(_.isFunction(args.onClick)) {
      args.onClick(event, btnRef.current ?? undefined)
    }

    if(config.target == 'extension' && args.href) {
      event.preventDefault()
      const fullUrl = new URL(args.href, linkTools.baseUrl)
      browserApi.openExternal(fullUrl.toString())
    }

    if(args.flyover) setShowFlyover(true)
  }

  return (
    <a {...htmlAnchorProps} 
      className={`${buttonClasses}`}
      onClick={handleClick}
      ref={btnRef}
    >
        {args.icon && 
          <Icon 
            className={`${globalClass}__icon`}
            useIcon={args.icon} 
            size={BtnIcnMap[args.size] || IconSize.SMALL} />
        }
        {args.label && 
          <span 
            className={`${globalClass}__label`} >
            {args.label}{args.icon ? <>&nbsp;</> : ''}
          </span>
        }
        {args.isCaret &&
          <Icon useIcon={CaretRight} size={IconSize.SMALL}/>
        }
        {args.flyover && showFlyover && <Flyover label={args.flyover} onDone={() => setShowFlyover(false)} />}
    </a>
  )
}

export default Button