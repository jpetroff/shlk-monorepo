import styles from './styles-tooltip.module.less'
import * as React from 'react'
import { CSSTransition } from 'react-transition-group'

type Props = {
  label: string
  onDone: () => void
}

const Flyover : React.FC<Props> = (
  { 
    label,
    onDone
  } : Props
) => {
  const ref = React.useRef(null)
  const globalClass = styles.flyoverClass+'_flyover'
  const animDuration = {
    appear: parseInt(styles.flyoverDuration) + parseInt(styles.opacityEndDuration)
  }

  return (
  <CSSTransition 
    appear={true}
    in={true}
    exit={false}
    mountOnEnter
    unmountOnExit
    timeout={animDuration}
    classNames='flyover-animation'
    nodeRef={ref}
    onEntered={onDone}
  >
    <div className={`${globalClass}`} ref={ref}>
      {label}
    </div>
  </CSSTransition>
  )
}

export default Flyover
