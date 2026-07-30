import styles from './styles-tooltip.module.less'
import * as React from 'react'
import { CSSTransition } from 'react-transition-group'

type Props = {
  label: string
}

/* 
  @TODO
*/

const Tooltip : React.FC<Props> = (
  { 
    label
  } : Props
) => {
  const globalClass = styles.tooltipClass+'_tooltip'

  return (
    <div className={`${globalClass}`}>
      {label}
    </div>
  )
}

export default Tooltip