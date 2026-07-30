import styles from './styles-snooze-list.module.less'
import * as React from 'react'
import { ActionLink } from '../link'
import classNames from 'classnames'
import { useAppContext } from '../../js/app.context'

type Props = { onSnooze: (value: string) => void }

function displayTime(value: number, standardSnooze?: string): string {
  const date = new Date(value)
  let prefix = ''
  if (standardSnooze && /random/.test(standardSnooze)) prefix = '~3 months'
  else if (standardSnooze && !(/today/.test(standardSnooze) || /tomorrow/.test(standardSnooze))) {
    prefix = `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, `
  }
  const time = standardSnooze && !/random/.test(standardSnooze)
    ? date.toLocaleTimeString(['en-GB'], { hour: '2-digit', minute: '2-digit' }) : ''
  return prefix + time
}

function displayDate(value: number): string {
  return new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function SnoozeList({ onSnooze }: Props) {
  const context = useAppContext()
  const globalClass = `${styles.wrapperClass}_snooze-list`
  const timers = context.user?.predefinedTimers ?? []
  const groupedTimers = Object.groupBy(timers, (timer) => String(timer.groupLabel))
  return <div className={classNames(globalClass)}>
    <div className={`${globalClass}__subheader`}>Snooze link until:</div>
    <div className={`${globalClass}__wrapper`}>
      {Object.entries(groupedTimers).map(([groupLabel, group], groupIndex) => group && <div
        className={`${globalClass}__group ${globalClass}__group_${groupIndex}`} key={groupLabel}>
        <div className={`${globalClass}__group__subheader`}>
          <span className={`${globalClass}__group__subheader__label`}>{groupLabel}</span>
          <span className={`${globalClass}__group__subheader__meta`}>
            {group[0].groupDate[0] && ` · ${displayDate(group[0].groupDate[0])}`}
            {group[0].groupDate[1] && `–${displayDate(group[0].groupDate[1])}`}
          </span>
        </div>
        <div className={`${globalClass}__group-bullet`} />
        <div className={`${globalClass}__group-line`} />
        <div className={`${globalClass}__group__wrapper`}>
          {group.map((timer) => <div className={`${globalClass}__item`} key={timer.value}>
            <ActionLink className={`${globalClass}__link`} onClick={() => onSnooze(timer.value)}>
              <span className={`${globalClass}__link__label`}>{timer.label}</span>
              <span className={`${globalClass}__link__time`}>{displayTime(timer.dateValue, timer.value)}</span>
            </ActionLink>
          </div>)}
        </div>
      </div>)}
    </div>
  </div>
}
