/**
 * Application Constants and Enums
 * Centralized location for all repeated strings and magic values
 */

// Appointment Status Enum
export enum AppointmentStatus {
  SCHEDULED = "scheduled",
  CHECKED_IN = "checked-in",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  NO_SHOW = "no-show",
  RESCHEDULED = "rescheduled",
}

// Billing Status Enum
export enum BillingStatus {
  PENDING = "pending",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

// Job Queue Types
export enum JobType {
  RECALCULATE_QUEUE = "RECALCULATE_QUEUE",
  SEND_NOTIFICATION = "SEND_NOTIFICATION",
  CLEANUP_EXPIRED = "CLEANUP_EXPIRED",
  BACKUP_DATA = "BACKUP_DATA",
}

// Job Status
export enum JobStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

// Notification Types
export enum NotificationType {
  APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER",
  ETA_UPDATE = "ETA_UPDATE",
  APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED",
  APPOINTMENT_RESCHEDULED = "APPOINTMENT_RESCHEDULED",
  PAYMENT_DUE = "PAYMENT_DUE",
}

// Time Constants
export const TIME_CONSTANTS = {
  DEFAULT_APPOINTMENT_DURATION: 30, // minutes
  BUFFER_TIME_BETWEEN_APPOINTMENTS: 5, // minutes
  CLINIC_OPEN_HOUR: 9,
  CLINIC_CLOSE_HOUR: 17,
  ETA_UPDATE_THRESHOLD: 5, // minutes - only send notification if ETA changes by this much
  AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
  NOTIFICATION_RETRY_DELAY: 60000, // 1 minute
} as const;

// UI Constants
export const UI_CONSTANTS = {
  MAX_SEARCH_RESULTS: 50,
  PAGINATION_SIZE: 20,
  DEBOUNCE_DELAY: 300, // milliseconds
  TOAST_DURATION: 5000, // milliseconds
} as const;

// Priority Levels
export enum Priority {
  LOW = 1,
  NORMAL = 3,
  HIGH = 5,
  URGENT = 10,
}

// Doctor Specializations
export const DOCTOR_SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
  "Neurology",
  "Psychiatry",
  "Gynecology",
  "ENT",
  "Ophthalmology",
  "Dentistry",
] as const;

// Status Colors for UI
export const STATUS_COLORS = {
  [AppointmentStatus.SCHEDULED]: "blue",
  [AppointmentStatus.CHECKED_IN]: "yellow",
  [AppointmentStatus.IN_PROGRESS]: "orange",
  [AppointmentStatus.COMPLETED]: "green",
  [AppointmentStatus.CANCELLED]: "red",
  [AppointmentStatus.NO_SHOW]: "gray",
  [AppointmentStatus.RESCHEDULED]: "purple",
} as const;

// Validation Rules
export const VALIDATION_RULES = {
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 15,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[+]?[1-9][\d]{0,15}$/,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
  APPOINTMENT_NOT_FOUND: "Appointment not found.",
  DOCTOR_NOT_AVAILABLE: "Doctor is not available at the selected time.",
  INVALID_TIME_SLOT: "Please select a valid time slot.",
  PHONE_INVALID: "Please enter a valid phone number.",
  EMAIL_INVALID: "Please enter a valid email address.",
  REQUIRED_FIELD: "This field is required.",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  APPOINTMENT_CREATED: "Appointment created successfully!",
  APPOINTMENT_UPDATED: "Appointment updated successfully!",
  APPOINTMENT_CANCELLED: "Appointment cancelled successfully!",
  PATIENT_CHECKED_IN: "Patient checked in successfully!",
  PAYMENT_PROCESSED: "Payment processed successfully!",
  NOTIFICATION_SENT: "Notification sent successfully!",
} as const;
