import styles from './styles-scroller.module.less'
import classNames from 'classnames'
import * as React from 'react'

type Props = { onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number, direction?: number) => void,
  padding?: number, offsetTop?: number, offsetBottom?: number, hideScroll?: boolean
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onScroll'>
type ScrollState = { position: number, previousHeight: number, top: number, height: number }
const hiddenState: ScrollState = { position: -1, previousHeight: -1, top: 0, height: 0 }

export default function Scroller({ onScroll, padding = 8, offsetTop = 0, offsetBottom = 0,
  hideScroll = false, className, children, ...htmlProps }: Props) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = React.useState(hiddenState)
  const scrollStateRef = React.useRef(hiddenState)
  const globalClass = `${styles.wrapperClass}_scroller`
  const classes = classNames(globalClass, className)

  const measure = React.useCallback((notify: boolean) => {
    const content = contentRef.current
    if (!content) return
    const previous = scrollStateRef.current
    if (hideScroll) {
      if (previous.position !== -1) {
        scrollStateRef.current = hiddenState
        setScrollState(hiddenState)
      }
      return
    }
    const { scrollTop, scrollHeight, clientHeight } = content
    if (scrollHeight <= clientHeight) {
      if (previous.position !== -1) {
        scrollStateRef.current = hiddenState
        setScrollState(hiddenState)
      }
      return
    }
    if (scrollTop === previous.position && scrollHeight === previous.previousHeight) return
    const effectiveHeight = clientHeight - (offsetBottom + offsetTop + 2 * padding)
    const next = { position: scrollTop, previousHeight: scrollHeight,
      top: Math.ceil((scrollTop / scrollHeight) * effectiveHeight) + offsetTop + padding,
      height: Math.ceil(effectiveHeight * (effectiveHeight / scrollHeight)) }
    scrollStateRef.current = next
    setScrollState(next)
    if (notify) onScroll?.(scrollTop, scrollHeight, clientHeight, scrollTop - previous.position)
  }, [hideScroll, offsetBottom, offsetTop, onScroll, padding])

  React.useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure(false))
    observer.observe(content)
    if (content.firstElementChild) observer.observe(content.firstElementChild)
    return () => observer.disconnect()
  }, [measure])

  return <div className={classes} {...htmlProps}>
    <div className={`${globalClass}__scroller-wrapper`}>
      <div className={`${globalClass}__scroller-content`} ref={contentRef}
        onScroll={() => measure(true)}>{children}</div>
    </div>
    {scrollState.position >= 0 && <div className={`${globalClass}__scrollbar`} aria-hidden="true">
      <div className={`${globalClass}__scrollbar__pill`} style={{ top: scrollState.top, height: scrollState.height }} />
    </div>}
  </div>
}
