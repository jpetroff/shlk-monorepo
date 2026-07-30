import styles from './styles-snackbar.module.less'
import * as React from 'react'
import * as _ from 'underscore'
import Button, { ButtonSize, ButtonType } from '../button'
import { Cross_16, Enter } from '../icons'
import { CSSTransition } from 'react-transition-group'
import Link from '../link'
import classNames from 'classnames'

export enum SnackbarType {
  MESSAGE = 'message',
  ERROR = 'error',
  WARNING = 'warning'
}

type Props = {
  type?: SnackbarType
  canDismiss?: boolean
  message: string | React.ReactElement
  action?: string
  onAction?: () => void
  onDismiss?: () => void
  timer?: number,
  className?: string
} 

const Snackbar : React.FC<Props> = (
  {
    type = SnackbarType.MESSAGE,
    canDismiss = false,
    message = '',
    action,
    onAction,
    onDismiss,
    timer,
    className
  } : Props
) => {
  const [state, setState] = React.useState(true)

  const globalClass = styles.wrapperClass+'_snackbar'
  const snackBarClasses = classNames({
    [`${globalClass}`]: true,
    [`${globalClass}_has-action`]: !!action,
    [`${className}`]: !!className
  })
  const snackbarNode = React.useRef<HTMLDivElement>(null)

  const timeout = parseInt(styles.transitionDuration)

  const timerDivStyle : React.CSSProperties = {
    animationDuration: timer ? `${timer}ms` : undefined,
  }

  const handleDismiss = () => {
    setState(false)
    if (_.isFunction(onDismiss)) _.delay(onDismiss, timeout)
  }

  if(timer) {
    React.useEffect( () => {
      const timerDelay = setTimeout(handleDismiss, timer)
      return () => {
        clearTimeout(timerDelay)
      }
    })
    
  }

  return (
  <CSSTransition 
    appear={true}
    in={state}
    nodeRef={snackbarNode}
    timeout={timeout}
    classNames={`${globalClass}__transition`}
  >
    <div ref={snackbarNode} className={`${snackBarClasses}`} >
      <div className={`${globalClass}__content-wrapper`}>
        <div className={`${globalClass}__message`}>{message}</div>
        {canDismiss && 
          <Cross_16 
            className={`${globalClass}__dismiss`} 
            onClick={handleDismiss}
            />
        }
      </div>
      {action &&
        <Link 
          className={`${globalClass}__snackbar-action`}
          label={action}
          onClick={onAction}
          />
      }
      {timer && 
        <div className={`${globalClass}__timer-progress`} style={ timerDivStyle } />
      }
    </div>
  </CSSTransition>
  )
}

export default Snackbar