import { format, subDays, differenceInCalendarDays, parseISO, startOfWeek } from 'date-fns'

export const today = () => format(new Date(), 'yyyy-MM-dd')

// Monday-based week start (yyyy-MM-dd) for the given date (default: today)
export const weekStart = (date = new Date()) =>
  format(startOfWeek(date instanceof Date ? date : new Date(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')

export const toDateStr = (date) => format(new Date(date), 'yyyy-MM-dd')

export const daysBetween = (a, b) =>
  Math.abs(differenceInCalendarDays(new Date(a), new Date(b)))

export const yesterday = () => toDateStr(subDays(new Date(), 1))

export const last365Days = () => {
  const days = []
  for (let i = 364; i >= 0; i--) {
    days.push(toDateStr(subDays(new Date(), i)))
  }
  return days
}

export const parseDate = (str) => parseISO(str)
