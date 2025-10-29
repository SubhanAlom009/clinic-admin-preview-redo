import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Combine a local date (YYYY-MM-DD) and time (HH:MM or HH:MM:SS)
// into an ISO string in UTC. This ensures we store TIMESTAMPTZ consistently.
export function combineLocalDateTimeToIso(
  dateStr: string,
  timeStr: string
): string {
  const normalizedTime = timeStr.includes(":") ? timeStr : `${timeStr}:00`;
  const localDateTime = new Date(`${dateStr}T${normalizedTime}`);
  if (isNaN(localDateTime.getTime())) {
    throw new Error("Invalid date/time provided to combineLocalDateTimeToIso");
  }
  return localDateTime.toISOString();
}

// Returns the appointment interval in minutes for a slot queue.
// For now this defaults to 40 (30 consult + 10 gap).
export function getAppointmentIntervalMinutes(): number {
  return 40;
}

// Round a Date up to the next interval boundary (in minutes)
export function roundUpToInterval(date: Date, intervalMinutes: number): Date {
  const d = new Date(date);
  const ms = d.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  const rounded = Math.ceil(ms / intervalMs) * intervalMs;
  return new Date(rounded);
}