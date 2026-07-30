import * as _ from 'underscore'

export type SnoozeDay = {
  day?: number
  dayInc?: number
  month?: number
  monthInc?: number
  year?: number
  yearInc?: number
  weekday?: Weekdays
  date?: number
}

export type SnoozeTime = {
  timeInc?: [number, number, number?, number?]
  daytime?: [number, number, number?, number?]
}

export enum Weekdays {
  Sun = 0,
  Mon = 1,
  Tue = 2,
  Wed = 3,
  Thu = 4,
  Fri = 5,
  Sat = 6
}

export enum StandardTimers {
  inHour = 'today_hour',
  later = 'today_later',
  evening = 'today_evening',
  afternoon = 'today_afternoon',

  tomorrow_now = 'tomorrow_now',
  tomorrow_morning = 'tomorrow_morning',
  tomorrow_evening = 'tomorrow_evening',
  tomorrow_afternoon = 'tomorrow_afternoon',

  nextWeekend = 'saturday_afternoon',
  nextMonday = 'monday_morning',
  inWeek = 'inweek_morning',

  nextMonth = 'nextmonth_morning',
  inMonth = 'inmonth_morning',
  someday = 'random_afternoon',

  test = 'today_now'
}

export const StandardTimerGroups = [
  { 
    label: 'Today',
    date: [{dayInc: 0} as SnoozeDay],
    content: [StandardTimers.inHour, StandardTimers.later, StandardTimers.afternoon, StandardTimers.evening]
  },
  {
    label: 'Tomorrow',
    date: [{dayInc: 1} as SnoozeDay],
    content: [StandardTimers.tomorrow_now, StandardTimers.tomorrow_morning, StandardTimers.tomorrow_afternoon, StandardTimers.tomorrow_evening]
  },
  {
    label: 'Within week',
    date: [{dayInc:7} as SnoozeDay],
    content: [StandardTimers.nextWeekend, StandardTimers.nextMonday, StandardTimers.inWeek]
  },
  {
    label: 'Longer time',
    date: [ ],
    content: [StandardTimers.nextMonth, StandardTimers.inMonth, StandardTimers.someday]
  }
]

class SnoozeTools {
  
  public Days : { [key: string]: SnoozeDay } = {
    'today': { dayInc: 0},
    'tomorrow': { dayInc: 1},
    'monday': { weekday: Weekdays.Mon},
    'saturday': { weekday: Weekdays.Sat},
    'inweek': { dayInc: 7 },
    'inmonth': { monthInc: 1 },
    'nextmonth': { monthInc: 1, day: 1 },
    'random': {}
  }

  public Times: { [key: string]: SnoozeTime } = {
    'morning': { daytime: [9, 0] },
    'afternoon': { daytime: [13, 0] },
    'evening': { daytime: [20, 0] },
    'later': { timeInc: [3, 0] },
    'hour': { timeInc: [1, 0] },
    'now': { timeInc: [0,0,10,0] },
  }

  constructor() {

  }

  getStandardSnooze(snooze: StandardTimers, baseDate: Date = new Date()) : Date {
    const [dateParamName, timeParamName] = snooze.split('_')
    const dateParam = dateParamName == 'random' ? 
      { monthInc: 3, dayInc: Math.floor(Math.random() * 30)} : this.Days[dateParamName]
    const timeParam = this.Times[timeParamName]
    return this.getCustomSnooze(dateParam, timeParam)
  }

  getCustomSnooze(date: SnoozeDay, time: SnoozeTime, baseDate: Date = new Date()) : Date {
    return this.setTime(
      this.setDay(
        baseDate,
        date
      ),
    time)
  }

  getStandardDescription(snooze: StandardTimers) : string {
    switch(snooze) {
      case StandardTimers.tomorrow_morning: return 'Morning'
      case StandardTimers.tomorrow_now: return 'Same time'
      case StandardTimers.tomorrow_evening: return 'Evening'
      case StandardTimers.tomorrow_afternoon: return 'Afternoon'
      case StandardTimers.evening: return 'Evening'
      case StandardTimers.afternoon: return 'Afternoon'
      case StandardTimers.nextMonday: return 'Next Monday'
      case StandardTimers.nextWeekend: return 'Next weekend'
      case StandardTimers.inWeek: return 'In a week'
      case StandardTimers.nextMonth: return 'Next month'
      case StandardTimers.inMonth: return 'In a month'
      case StandardTimers.later: return 'Later today'
      case StandardTimers.inHour: return 'In an hour'
      case StandardTimers.someday: return 'Someday'
      case StandardTimers.test: return 'Test immediately'
      default: return ''
    }
  }

  setDay(base: Date, params: SnoozeDay) : Date {
    if(params.date) return new Date(params.date)

    const now = new Date()
    const month = params.month || (now.getMonth() + (params.monthInc || 0) )
    const day = this.calcDay(params)
    const year = params.year || (now.getFullYear() + (params.yearInc || 0) )
    base.setDate(day)
    base.setMonth(month)
    base.setFullYear(year)
    base.setHours(0,0,0,0)
    return base
  }

  setTime(base: Date, params: SnoozeTime) : Date {
    const now = new Date()
    if(params.timeInc) {
      base.setHours(
        now.getHours() + params.timeInc[0], 
        now.getMinutes() + params.timeInc[1],
        now.getSeconds() + (params.timeInc[2] || 0),
        now.getMilliseconds() + (params.timeInc[3] || 0)
      )
      return base
    } else if (params.daytime) {
      base.setHours(params.daytime[0], params.daytime[1], params.daytime[2] || 0, params.daytime[3] || 0)
      return base
    } else {
      return base
    }
  }

  private calcDay(params: SnoozeDay) : number {
    const now = new Date()
    if(params.day != undefined || params.dayInc != undefined) {
      return params.day || (now.getDate() + (params.dayInc || 0) )
    } else if(params.weekday != undefined ) {
      const dayDiff = params.weekday - now.getDay()
      const dayInc = dayDiff <= 0 ? dayDiff + 7 : dayDiff
      return now.getDate() + dayInc
    } else {
      return now.getDate()
    }
  }
}

export default new SnoozeTools()