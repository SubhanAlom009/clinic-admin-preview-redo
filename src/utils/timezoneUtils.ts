/**
 * UTC-IST Timezone Conversion Utilities for Clinic Admin
 *
 * INSTALL FIRST: npm install date-fns date-fns-tz
 *
 * Core principle: Database stores everything in UTC, we display everything in IST
 * - All data from database is assumed to be UTC
 * - All user input is assumed to be IST and converted to UTC before saving
 * - All displays convert UTC to IST
 */

import { format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Convert UTC datetime string to IST for display
 * @param utcDateTime - UTC datetime string from database
 * @returns Formatted IST datetime string like "17 Oct 2024, 5:00 PM"
 */
export const convertUTCToIST = (utcDateTime: string): string => {
  if (!utcDateTime) return "Invalid Date";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    return format(istDate, "dd MMM yyyy, h:mm a");
  } catch (error) {
    console.error("Error converting UTC to IST:", error);
    return "Invalid Date";
  }
};

/**
 * Convert UTC datetime to IST date only
 * @param utcDateTime - UTC datetime string from database
 * @returns Formatted IST date string like "17 Oct 2024"
 */
export const convertUTCToISTDate = (utcDateTime: string): string => {
  if (!utcDateTime) return "Invalid Date";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    return format(istDate, "dd MMM yyyy");
  } catch (error) {
    console.error("Error converting UTC to IST date:", error);
    return "Invalid Date";
  }
};

/**
 * Convert UTC datetime to IST time only
 * @param utcDateTime - UTC datetime string from database
 * @returns Formatted IST time string like "5:00 PM"
 */
export const convertUTCToISTTime = (utcDateTime: string): string => {
  if (!utcDateTime) return "Invalid Time";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    return format(istDate, "h:mm a");
  } catch (error) {
    console.error("Error converting UTC to IST time:", error);
    return "Invalid Time";
  }
};

/**
 * Convert UTC datetime to IST time in 24-hour format for slot comparison
 * @param utcDateTime - UTC datetime string from database
 * @returns Time string in HH:MM format (IST)
 */
export const convertUTCToISTTime24 = (utcDateTime: string): string => {
  if (!utcDateTime) return "";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    return format(istDate, "HH:mm");
  } catch (error) {
    console.error("Error converting UTC to IST time 24h:", error);
    return "";
  }
};

/**
 * Convert IST datetime input to UTC for database storage
 * @param istDateTime - IST datetime string from user input
 * @returns UTC datetime string for database
 */
export const convertISTToUTC = (istDateTime: string): string => {
  if (!istDateTime) return "";

  try {
    const istDate = parseISO(istDateTime);
    const utcDate = fromZonedTime(istDate, IST_TIMEZONE);
    return utcDate.toISOString();
  } catch (error) {
    console.error("Error converting IST to UTC:", error);
    return "";
  }
};

/**
 * Create UTC datetime from IST date and time inputs
 * @param istDate - Date string in YYYY-MM-DD format (IST)
 * @param istTime - Time string in HH:MM format (IST)
 * @returns UTC datetime string for database
 */
export const createUTCFromISTInput = (
  istDate: string,
  istTime: string
): string => {
  if (!istDate || !istTime) return "";

  try {
    // Combine date and time in IST
    const istDateTime = `${istDate}T${istTime}:00`;
    const istDateObj = parseISO(istDateTime);

    // Convert IST to UTC using date-fns-tz (this handles DST and all edge cases)
    const utcDate = fromZonedTime(istDateObj, IST_TIMEZONE);

    return utcDate.toISOString();
  } catch (error) {
    console.error("Error creating UTC from IST input:", error);
    return "";
  }
};

/**
 * Get current IST datetime as UTC string for database
 * @returns Current datetime in UTC format
 */
export const getCurrentUTCDateTime = (): string => {
  return new Date().toISOString();
};

/**
 * Format UTC datetime with relative information (Today, Tomorrow, etc.)
 * @param utcDateTime - UTC datetime string from database
 * @returns Formatted string like "Today, 2:30 PM" or "17 Oct 2024, 2:30 PM"
 */
export const formatUTCAsRelativeIST = (utcDateTime: string): string => {
  if (!utcDateTime) return "Invalid Date";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    const istTime = format(istDate, "h:mm a");

    // Check if it's today, tomorrow, etc. in IST
    const now = new Date();
    const istNow = toZonedTime(now, IST_TIMEZONE);

    const diffDays = Math.floor(
      (istDate.getTime() - istNow.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return `Today, ${istTime}`;
    } else if (diffDays === 1) {
      return `Tomorrow, ${istTime}`;
    } else if (diffDays === -1) {
      return `Yesterday, ${istTime}`;
    } else if (Math.abs(diffDays) <= 7) {
      const weekday = format(istDate, "EEEE");
      return `${weekday}, ${istTime}`;
    } else {
      // For other dates, show full date
      const istDateStr = format(istDate, "dd MMM yyyy");
      return `${istDateStr}, ${istTime}`;
    }
  } catch (error) {
    console.error("Error formatting UTC as relative IST:", error);
    return "Invalid Date";
  }
};

/**
 * Validate if a datetime string is valid
 * @param dateTime - String to validate
 * @returns True if valid datetime
 */
export const isValidDateTime = (dateTime: string): boolean => {
  if (!dateTime || typeof dateTime !== "string") {
    return false;
  }

  try {
    const date = parseISO(dateTime);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};

/**
 * Extract IST date from UTC datetime for form inputs
 * @param utcDateTime - UTC datetime string from database
 * @returns Date string in YYYY-MM-DD format (IST)
 */
export const extractISTDateForInput = (utcDateTime: string): string => {
  if (!utcDateTime) return "";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    return format(istDate, "yyyy-MM-dd");
  } catch (error) {
    console.error("Error extracting IST date for input:", error);
    return "";
  }
};

/**
 * Extract IST time from UTC datetime for form inputs
 * @param utcDateTime - UTC datetime string from database
 * @returns Time string in HH:MM format (IST)
 */
export const extractISTTimeForInput = (utcDateTime: string): string => {
  if (!utcDateTime) return "";

  try {
    const utcDate = parseISO(utcDateTime);
    const istDate = toZonedTime(utcDate, IST_TIMEZONE);
    return format(istDate, "HH:mm");
  } catch (error) {
    console.error("Error extracting IST time for input:", error);
    return "";
  }
};

// Legacy compatibility - keep the old function names but use new implementations
export const formatAppointmentDateTime = convertUTCToIST;
export const formatAppointmentDate = convertUTCToISTDate;
export const formatAppointmentTime = convertUTCToISTTime;
export const formatRelativeDate = formatUTCAsRelativeIST;
