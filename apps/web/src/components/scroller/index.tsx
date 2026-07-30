import styles from './styles-scroller.module.less'
import classNames from 'classnames'
import * as React from 'react'
import * as _ from 'underscore'
import { DOMContentLoaded } from '../../js/utils'

type Props = {
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number, direction?: number) => void
  padding?: number
  offsetTop?: number
  offsetBottom?: number
  hideScroll?: boolean
} & Omit<React.JSX.IntrinsicElements['div'], 'onScroll'>

const Scroller : React.FC<Props> = (
  providedArgs : Props 
) => {
  const args = {
    ...providedArgs,
    padding: providedArgs.padding ?? 8,
    offsetTop: providedArgs.offsetTop ?? 0,
    offsetBottom: providedArgs.offsetBottom ?? 0
  }
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const prevScrollheight = React.useRef<number>(-1)

  const [scrollPos, setScrollPos] = React.useState(-1)
  const [scrollbarStyles, setScrollbarStyles] = React.useState({})

  const globalClass = `${styles.wrapperClass}_scroller`
  const scrollerClasses = classNames({
    [`${globalClass}`]: true,
    [`${args.className}`]: !!args.className
  })

  const internalScroll = (event?: React.UIEvent) => {
    const content = contentRef.current
    if (!content) return
    const scrollTop = content.scrollTop
    const scrollHeight = content.scrollHeight
    const clientHeight = content.clientHeight

    if(args.hideScroll) return

    if(scrollHeight <= clientHeight) {
      if(scrollPos != -1) setScrollPos(-1)
      return
    }
    if(scrollTop == scrollPos && scrollHeight == prevScrollheight.current) return
    
    if(_.isFunction(args.onScroll) && event) args.onScroll(scrollTop, scrollHeight, clientHeight, scrollTop - scrollPos)

    prevScrollheight.current = scrollHeight
    setScrollPos(scrollTop)
    setScrollbarStyles({ top: calcScrollbarTop(scrollPos), height: calcScrollbarHeight() })
  }

  const calcScrollbarTop = (scrollTop: number) => {
    const content = contentRef.current
    if (!content) return 0
    const clientHeight = content.clientHeight
    const scrollHeight = content.scrollHeight

    const effectiveHeight = clientHeight - (args.offsetBottom + args.offsetTop + 2 * args.padding)

    return Math.ceil( (scrollTop / scrollHeight) * effectiveHeight ) + args.offsetTop + args.padding
  }
  const calcScrollbarHeight = () => {
    const content = contentRef.current
    if (!content) return 0
    const clientHeight = content.clientHeight
    const scrollHeight = content.scrollHeight

    const effectiveHeight = clientHeight - (args.offsetBottom + args.offsetTop + 2 * args.padding)
    return Math.ceil(effectiveHeight * (effectiveHeight / scrollHeight))
  }

  React.useEffect( () => {
    internalScroll()
  })

  const transientProps = _.omit(args, 'onScroll', 'ref', 'className', 'padding', 'offsetTop', 'offsetBottom', 'hideScroll')
  return (
    <div
      className={`${scrollerClasses}`}
      {...transientProps}
      >
        <div 
          className={`${globalClass}__scroller-wrapper`} 
          ref={wrapperRef}>

          <div 
            className={`${globalClass}__scroller-content`}
            ref={contentRef}
            onScroll={internalScroll}
            >
            {args.children}
          </div> 
        </div>

        {
          scrollPos >= 0 &&
          <div className={`${globalClass}__scrollbar`}>
            <div className={`${globalClass}__scrollbar__pill`} style={scrollbarStyles}></div>
          </div>
        }
    </div>
  )
}

export default Scroller