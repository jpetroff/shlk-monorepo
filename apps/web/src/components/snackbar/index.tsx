import styles from './styles-snackbar.module.less'
import * as React from 'react'
import { Cross_16 } from '../icons'
import { CSSTransition } from 'react-transition-group'
import classNames from 'classnames'

export enum SnackbarType { MESSAGE = 'message', ERROR = 'error', WARNING = 'warning' }
type Props = { type?: SnackbarType, canDismiss?: boolean, message: string | React.ReactElement,
  action?: string, onAction?: () => void, onDismiss?: () => void, timer?: number, className?: string }

export default function Snackbar({
  type = SnackbarType.MESSAGE, canDismiss = false, message, action, onAction, onDismiss, timer, className
}: Props) {
  const [visible, setVisible] = React.useState(true)
  const snackbarNode = React.useRef<HTMLDivElement>(null)
  const timeout = Number.parseInt(styles.transitionDuration)
  const globalClass = styles.wrapperClass + '_snackbar'
  const classes = classNames({ [globalClass]: true, [`${globalClass}_has-action`]: !!action, [`${className}`]: !!className })

  React.useEffect(() => {
    if (!timer || !visible) return
    const timerId = window.setTimeout(() => setVisible(false), timer)
    return () => window.clearTimeout(timerId)
  }, [timer, visible])

  return <CSSTransition appear in={visible} nodeRef={snackbarNode} timeout={timeout}
    classNames={`${globalClass}__transition`} onExited={() => onDismiss?.()}>
    <div ref={snackbarNode} className={classes} role={type === SnackbarType.ERROR ? 'alert' : 'status'}
      aria-live={type === SnackbarType.ERROR ? 'assertive' : 'polite'}>
      <div className={`${globalClass}__content-wrapper`}>
        <div className={`${globalClass}__message`}>{message}</div>
        {canDismiss && <button type="button" className={`${globalClass}__dismiss`}
          aria-label="Dismiss notification" onClick={() => setVisible(false)}>
          <Cross_16 aria-hidden="true" />
        </button>}
      </div>
      {action && <button type="button" className={`${globalClass}__snackbar-action`} onClick={onAction}>{action}</button>}
      {timer && <div className={`${globalClass}__timer-progress`} style={{ animationDuration: `${timer}ms` }} />}
    </div>
  </CSSTransition>
}
