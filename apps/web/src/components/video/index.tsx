import classNames from 'classnames'
import styles from './styles-video.module.less'
import * as React from 'react'

type Props = { src: { link: string, type: string }[], thumbnail?: string, width?: number, height?: number,
  className?: string, aspectRatio?: number, timeout?: number, muted?: boolean }

export default function Video({ src, thumbnail, width, height, className, aspectRatio,
  timeout = 100, muted = true }: Props) {
  const videoNode = React.useRef<HTMLVideoElement>(null)
  const sourceKey = src.map(({ link, type }) => `${link}:${type}`).join('|')
  const globalClass = `${styles.wrapperClass}_video`
  const classes = classNames(globalClass, className)

  React.useEffect(() => {
    const video = videoNode.current
    if (!video) return
    video.load()
    const timerId = window.setTimeout(() => { video.play().catch(() => undefined) }, timeout)
    return () => { window.clearTimeout(timerId); video.pause() }
  }, [sourceKey, timeout])

  if (src.length === 0) return null
  const responsiveClass = !(width && height) && aspectRatio ? `${globalClass}__video-node_responsive` : ''
  return <div className={classes}>
    <video poster={thumbnail} ref={videoNode} className={`${globalClass}__video-node ${responsiveClass}`}
      muted={muted} controls={false} preload="metadata" playsInline height={height} width={width}
      style={aspectRatio ? { aspectRatio } : undefined}>
      {src.map((source) => <source src={source.link} type={source.type} key={`${source.link}:${source.type}`} />)}
    </video>
  </div>
}
