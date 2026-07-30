import styles from './styles-snooze-list.module.less'
import * as _ from 'underscore'
import * as React from 'react'
import Link, { LinkColors } from '../link'
import classNames from 'classnames'
import AppContext from '../../js/app.context'

type Props = {
  onSnooze: (value: string) => void
}

const SnoozeList : React.FC<Props> = (
  {
    onSnooze
  } : Props
) => {
  const globalClass = `${styles.wrapperClass}_snooze-list`
  const snoozeClasses = classNames({
    [`${globalClass}`]: true
  })
  const appContext = React.useContext(AppContext)

  function displayTime(value: number, standardSnooze?: string) : string {
    const now = new Date()
    const setDate = new Date(value)
    let preDate : string = ''

    let actualTime : string = ''

    if (
      standardSnooze && /random/.test(standardSnooze)
    ) {
      preDate = '~3 months'
    } else if (
      standardSnooze && 
      !(
        /today/.test(standardSnooze) ||
        /tomorrow/.test(standardSnooze)
      )
    ) {
      preDate = setDate.toLocaleDateString([], {month: 'short', day: 'numeric'}) + ', '
    }

    if(standardSnooze && !/random/.test(standardSnooze)) {
      actualTime = setDate.toLocaleTimeString(['en-GB'], {hour: '2-digit', minute: '2-digit'})
    }

    return preDate + actualTime
  }

  function displayDate(value: number) : string {
    return (new Date(value)).toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})
  }

  const groupedTimers = _.groupBy(appContext.user?.predefinedTimers ?? [], 'groupLabel')
  console.log(groupedTimers)
  const groups = Object.getOwnPropertyNames(groupedTimers)

  return (
    <div className={`${snoozeClasses}`}>
      <div className={`${globalClass}__subheader`}>Snooze link until:</div>
      <div className={`${globalClass}__wrapper`}>
        {groups.map( (groupProp, key) => {
          const group = groupedTimers[groupProp]
          return (
            <div className={`${globalClass}__group ${globalClass}__group_${key}`} key={key}>
              <div className={`${globalClass}__group__subheader`}>
                <span className={`${globalClass}__group__subheader__label`}>{group[0].groupLabel}</span>
                <span className={`${globalClass}__group__subheader__meta`}>
                  {group[0].groupDate[0] && ' · ' + displayDate(group[0].groupDate[0])}
                  {group[0].groupDate[1] && '–' + displayDate(group[0].groupDate[1]) }
                </span>
              </div>
              <div className={`${globalClass}__group-bullet`}></div>
              <div className={`${globalClass}__group-line`}></div>
              <div className={`${globalClass}__group__wrapper`}>
                {group.map( (timer, key) => {
                    return (
                      <div className={`${globalClass}__item`} key={key}>
                        <Link
                          className={`${globalClass}__link`}
                          onClick={() => onSnooze(timer.value)}
                          key={key}
                        >
                          <span className={`${globalClass}__link__label`}>{timer.label}</span>
                          <span className={`${globalClass}__link__time`}>{displayTime(timer.dateValue, timer.value)}</span>
                        </Link>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ) 
}

export default SnoozeList