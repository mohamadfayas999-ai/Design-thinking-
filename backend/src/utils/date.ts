/**
 * Date and time parsing utilities for WASHWISE laundry slots.
 */

/**
 * Parses a slot date string ("YYYY-MM-DD") and time string (e.g. "09:00 AM", "02:00 PM", "14:00")
 * into a local Date object representing the slot start time.
 */
export function parseSlotDateTime(dateStr: string, timeStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let hours = 0;
  let minutes = 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

/**
 * Checks whether a slot's starting time is strictly in the future relative to reference time (defaults to current time).
 * According to rule: slot is available only when: slot start time > current time.
 */
export function isSlotInFuture(dateStr: string, startTimeStr: string, now: Date = new Date()): boolean {
  const slotDate = parseSlotDateTime(dateStr, startTimeStr);
  return slotDate.getTime() > now.getTime();
}
