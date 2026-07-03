import { format, subDays, differenceInCalendarDays, parseISO, startOfWeek } from 'date-fns'
import { habitDateFor } from './islamicTime'

// The app's "day" rolls over at Maghrib (sunset) in Tashkent, Uzbekistan —
// not at local midnight. See islamicTime.js for the sunset calculation.
// This is the single source of truth for "today" used everywhere: task
// logging, daily/weekly summaries, streaks, and the leaderboard.
export const today = () => habitDateFor(new Date())

// Monday-based week start (yyyy-MM-dd) for the given date.
// Defaults to the current habit-day (Maghrib-aware "today"), not the raw
// device date, so the weekly window also rolls over at sunset.
export const weekStart = (date = parseISO(today())) =>
  format(startOfWeek(date instanceof Date ? date : new Date(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')

export const toDateStr = (date) => format(new Date(date), 'yyyy-MM-dd')

export const daysBetween = (a, b) =>
  Math.abs(differenceInCalendarDays(new Date(a), new Date(b)))

export const yesterday = () => toDateStr(subDays(parseISO(today()), 1))

export const last365Days = () => {
  const anchor = parseISO(today())
  const days = []
  for (let i = 364; i >= 0; i--) {
    days.push(toDateStr(subDays(anchor, i)))
  }
  return days
}

export const parseDate = (str) => parseISO(str)
