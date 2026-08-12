import { valueByPath } from './utils'
import dayjs from 'dayjs'

export type DateGrouped<T> = T & {group: string}

export function timestampValue(value: string | number): number {
  if (typeof value === 'number') return value

  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? Date.parse(value) : numericValue
}

export default {
  increaseDays(value: number, date: Date = new Date()) {
    const result = new Date(date)
    result.setDate(date.getDate() + value)
    return result
  },

  groupDatedItems<T>(items: T[], timestampKey: string[], baseDate: Date = new Date()) : DateGrouped<T>[] {
    const result : DateGrouped<T>[] = []

    items.forEach((item) => {
      const value = valueByPath(item as AnyObject, timestampKey) as Maybe<string | number>
      if(value === undefined || value === null || value === '') return
      try {
        const timestamp = timestampValue(value)
        if(Number.isNaN(timestamp)) return
        const itemDate : dayjs.Dayjs = dayjs(timestamp)
        const base : dayjs.Dayjs = dayjs(baseDate)

        // console.log(value, itemDate)

        if(
          base.startOf('day') <= itemDate &&
          itemDate <= base.endOf('day')
        )
          result.push({ ...item, group: 'Today' })

        else if (
          base.add(1, 'day').startOf('day') <= itemDate &&
          itemDate <= base.add(1, 'day').endOf('day')
        )
          result.push({ ...item, group: 'Tomorrow' })

        else if (
          base.subtract(1, 'day').startOf('day') <= itemDate &&
          itemDate <= base.subtract(1, 'day').endOf('day')
        )
          result.push({ ...item, group: 'Yesterday' })

        else if (
          itemDate > base &&
          itemDate <= base.endOf('week')
        )
          result.push({ ...item, group: `This ${itemDate.format('dddd')}` })

        else if (
          base.startOf('year') <= itemDate && 
          itemDate <= base.endOf('year')
        )
          result.push({ ...item, group: itemDate.format('ddd, D MMM') })

        else 
          result.push({ ...item, group: itemDate.format('ddd, D MMM YYYY') })

      } catch { return }
    })
    return result
  }
}