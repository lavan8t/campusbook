import type { TimeSlotDef, BookingSpan } from "../types/timetable";

export const CAMPUS_TIMEZONE = "Asia/Kolkata";
export const TIMETABLE_START_HOUR = 8;
export const TIMETABLE_END_HOUR = 21;
export const SLOT_DURATION_MINUTES = 30;
export const TOTAL_SLOTS = (TIMETABLE_END_HOUR - TIMETABLE_START_HOUR) * 2; // 26 slots

export function generateTimeSlots(): TimeSlotDef[] {
  const slots: TimeSlotDef[] = [];
  let index = 0;
  for (let hour = TIMETABLE_START_HOUR; hour < TIMETABLE_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      slots.push({ slotIndex: index++, time, label: time, hour, minute });
    }
  }
  return slots;
}

export function formatDateDDMMYYYY(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return "";
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: CAMPUS_TIMEZONE,
    });
  }
  return String(dateVal);
}

export function formatDateDayDDMonYYYY(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return "";
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: CAMPUS_TIMEZONE,
    });
  }
  return String(dateVal);
}

export function formatTimeRailway(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return "";
  if (typeof dateVal === "string" && /^\d{1,2}:\d{2}$/.test(dateVal.trim())) {
    const parts = dateVal.trim().split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: CAMPUS_TIMEZONE,
    });
  }
  const match = String(dateVal).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : String(dateVal);
}

export function timeToSlotIndex(timeStr: string): number {
  if (!timeStr) return -1;
  if (timeStr.includes("T") || timeStr.includes("Z")) {
    const parts = parseIsoParts(timeStr);
    if (!parts) return -1;
    const minutesFromStart = parts.minutes - TIMETABLE_START_HOUR * 60;
    if (minutesFromStart < 0) return -1;
    return Math.floor(minutesFromStart / SLOT_DURATION_MINUTES);
  }
  let cleanTime = timeStr;
  if (cleanTime.includes(" ")) {
    const parts = cleanTime.split(" ");
    cleanTime = parts[1] || parts[0];
  }
  const [hStr, mStr] = cleanTime.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return -1;
  const minutesFromStart = (h - TIMETABLE_START_HOUR) * 60 + m;
  if (minutesFromStart < 0) return -1;
  return Math.floor(minutesFromStart / SLOT_DURATION_MINUTES);
}

export function formatSlotTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseIsoParts(isoStr: string): { date: string; minutes: number } | null {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (!isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: CAMPUS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);

    let year = "", month = "", day = "", hour = 0, minute = 0;
    for (const p of parts) {
      if (p.type === "year") year = p.value;
      if (p.type === "month") month = p.value;
      if (p.type === "day") day = p.value;
      if (p.type === "hour") hour = parseInt(p.value, 10);
      if (p.type === "minute") minute = parseInt(p.value, 10);
    }
    return {
      date: `${year}-${month}-${day}`,
      minutes: hour * 60 + minute,
    };
  }

  const match = isoStr.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  if (match) {
    return {
      date: match[1],
      minutes: parseInt(match[2], 10) * 60 + parseInt(match[3], 10),
    };
  }
  return null;
}

export function getBookingSpan(startIso: string, endIso: string, targetDateStr: string): BookingSpan {
  const startParts = parseIsoParts(startIso);
  const endParts = parseIsoParts(endIso);

  if (!startParts || !endParts) {
    return { startSlot: -1, spanSlots: 0, isVisible: false, clampedStart: false, clampedEnd: false };
  }

  // Filter if not overlapping target date
  if (startParts.date !== targetDateStr && endParts.date !== targetDateStr) {
    return { startSlot: -1, spanSlots: 0, isVisible: false, clampedStart: false, clampedEnd: false };
  }

  const timetableStartMinutes = TIMETABLE_START_HOUR * 60; // 480 (08:00)
  const timetableEndMinutes = TIMETABLE_END_HOUR * 60; // 1260 (21:00)

  let startMinutes = startParts.minutes;
  let endMinutes = endParts.minutes;

  if (startParts.date < targetDateStr) {
    startMinutes = 0;
  }
  if (endParts.date > targetDateStr) {
    endMinutes = 24 * 60;
  }

  if (endMinutes <= timetableStartMinutes || startMinutes >= timetableEndMinutes) {
    return { startSlot: -1, spanSlots: 0, isVisible: false, clampedStart: false, clampedEnd: false };
  }

  const clampedStartMin = Math.max(timetableStartMinutes, startMinutes);
  const clampedEndMin = Math.min(timetableEndMinutes, endMinutes);

  const startSlot = Math.floor((clampedStartMin - timetableStartMinutes) / SLOT_DURATION_MINUTES);
  const endSlot = Math.ceil((clampedEndMin - timetableStartMinutes) / SLOT_DURATION_MINUTES);
  const spanSlots = Math.max(1, endSlot - startSlot);

  return {
    startSlot,
    spanSlots,
    isVisible: true,
    clampedStart: startMinutes < timetableStartMinutes,
    clampedEnd: endMinutes > timetableEndMinutes,
  };
}

export function getSystemDateYYYYMMDD(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  label: string;
  durationHours: number;
}

export function calculateContinuousFreeSlots(
  rangeStartMinutes: number,
  rangeEndMinutes: number,
  busyIntervals: [number, number][]
): FreeSlot[] {
  const sorted = busyIntervals
    .map(([s, e]) => [Math.max(rangeStartMinutes, s), Math.min(rangeEndMinutes, e)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const interval of sorted) {
    if (!merged.length) {
      merged.push([interval[0], interval[1]]);
    } else {
      const last = merged[merged.length - 1];
      if (interval[0] <= last[1]) {
        last[1] = Math.max(last[1], interval[1]);
      } else {
        merged.push([interval[0], interval[1]]);
      }
    }
  }

  const free: FreeSlot[] = [];
  let curr = rangeStartMinutes;

  for (const [busyStart, busyEnd] of merged) {
    if (busyStart > curr) {
      const startH = Math.floor(curr / 60);
      const startM = curr % 60;
      const endH = Math.floor(busyStart / 60);
      const endM = busyStart % 60;
      const sTime = formatSlotTime(startH, startM);
      const eTime = formatSlotTime(endH, endM);
      free.push({
        startMinutes: curr,
        endMinutes: busyStart,
        startTime: sTime,
        endTime: eTime,
        label: `${sTime} – ${eTime}`,
        durationHours: Math.round(((busyStart - curr) / 60) * 10) / 10,
      });
    }
    curr = Math.max(curr, busyEnd);
  }

  if (curr < rangeEndMinutes) {
    const startH = Math.floor(curr / 60);
    const startM = curr % 60;
    const endH = Math.floor(rangeEndMinutes / 60);
    const endM = rangeEndMinutes % 60;
    const sTime = formatSlotTime(startH, startM);
    const eTime = formatSlotTime(endH, endM);
    free.push({
      startMinutes: curr,
      endMinutes: rangeEndMinutes,
      startTime: sTime,
      endTime: eTime,
      label: `${sTime} – ${eTime}`,
      durationHours: Math.round(((rangeEndMinutes - curr) / 60) * 10) / 10,
    });
  }

  return free;
}
