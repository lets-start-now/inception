import { getTimes } from 'suncalc'

// Tashkent, Uzbekistan — fixed UTC+5 year-round (no DST observed).
const LAT = 41.2995
const LNG = 69.2401
const UTC_OFFSET_HOURS = 5

const pad2 = (n) => String(n).padStart(2, '0')

/** Y/M/D of `instant` as observed in Tashkent, independent of the device's own timezone. */
function tashkentYMD(instant) {
  const shifted = new Date(instant.getTime() + UTC_OFFSET_HOURS * 3600 * 1000)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() }
}

/** The real-world instant for Tashkent local noon on the given Y-M-D — a safe
 *  reference moment (always inside that Tashkent calendar day) for solar math. */
function tashkentNoonUTC(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12 - UTC_OFFSET_HOURS, 0, 0))
}

/** Maghrib (sunset) instant for the Tashkent calendar date containing `instant`. */
export function maghribFor(instant = new Date()) {
  const { y, m, d } = tashkentYMD(instant)
  return getTimes(tashkentNoonUTC(y, m, d), LAT, LNG).sunset
}

/**
 * The "habit day" (yyyy-MM-dd, Tashkent calendar) for the given instant.
 * The day rolls over at Maghrib (sunset), not midnight — matching the
 * traditional Islamic day convention: before today's Maghrib the habit day
 * is still "today"; at/after it, it becomes "tomorrow".
 */
export function habitDateFor(instant = new Date()) {
  const rolledOver = instant.getTime() >= maghribFor(instant).getTime()
  const target = rolledOver ? new Date(instant.getTime() + 24 * 3600 * 1000) : instant
  const t = tashkentYMD(target)
  return `${t.y}-${pad2(t.m)}-${pad2(t.d)}`
}

/** Milliseconds until the next Maghrib (i.e. until the habit day next rolls over). */
export function msUntilNextMaghrib(instant = new Date()) {
  const m1 = maghribFor(instant)
  if (instant.getTime() < m1.getTime()) return m1.getTime() - instant.getTime()
  return maghribFor(new Date(instant.getTime() + 24 * 3600 * 1000)).getTime() - instant.getTime()
}

/** Current time-of-day in Tashkent, formatted "HH:MM". */
export function tashkentTimeHM(instant = new Date()) {
  return instant.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
}

/** A Date's Maghrib formatted as "HH:MM" in Tashkent local time. */
export function maghribHM(instant = new Date()) {
  return maghribFor(instant).toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
}
