/**
 * Slot Validation Schemas
 * Zod schemas for slot creation and booking validation
 */
import { z } from "zod";

// Slot creation schema
export const createSlotSchema = z.object({
  slot_name: z.string()
    .min(1, "Slot name is required")
    .max(50, "Slot name too long")
    .trim(),
  start_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .refine((time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    }, "Invalid time"),
  end_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .refine((time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    }, "Invalid time"),
  max_capacity: z.number()
    .min(1, "Capacity must be at least 1")
    .max(50, "Capacity cannot exceed 50")
    .int("Capacity must be a whole number"),
}).refine((data) => {
  const start = new Date(`2000-01-01T${data.start_time}:00`);
  const end = new Date(`2000-01-01T${data.end_time}:00`);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["end_time"]
});

// Multiple slots creation schema
export const createMultipleSlotsSchema = z.array(createSlotSchema)
  .min(1, "At least one slot is required")
  .max(10, "Cannot create more than 10 slots at once")
  .refine((slots) => {
    // Check for duplicate slot names
    const names = slots.map(slot => slot.slot_name.toLowerCase());
    return names.length === new Set(names).size;
  }, {
    message: "Slot names must be unique",
  })
  .refine((slots) => {
    // Check for overlapping time slots
    const sortedSlots = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const current = sortedSlots[i];
      const next = sortedSlots[i + 1];
      
      if (current.end_time > next.start_time) {
        return false;
      }
    }
    
    return true;
  }, {
    message: "Slots cannot overlap in time",
  });

// Slot booking schema
export const slotBookingSchema = z.object({
  slot_id: z.string()
    .min(1, "Slot selection is required")
    .uuid("Invalid slot ID"),
  appointment_type: z.string()
    .min(1, "Appointment type is required")
    .max(100, "Appointment type too long"),
  symptoms: z.string()
    .max(1000, "Symptoms description too long")
    .optional()
    .or(z.literal("")),
  notes: z.string()
    .max(1000, "Notes too long")
    .optional()
    .or(z.literal("")),
});

// Slot update schema
export const updateSlotSchema = z.object({
  slot_name: z.string()
    .min(1, "Slot name is required")
    .max(50, "Slot name too long")
    .trim()
    .optional(),
  start_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .optional(),
  end_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .optional(),
  max_capacity: z.number()
    .min(1, "Capacity must be at least 1")
    .max(50, "Capacity cannot exceed 50")
    .int("Capacity must be a whole number")
    .optional(),
}).refine((data) => {
  // Only validate time relationship if both times are provided
  if (data.start_time && data.end_time) {
    const start = new Date(`2000-01-01T${data.start_time}:00`);
    const end = new Date(`2000-01-01T${data.end_time}:00`);
    return end > start;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["end_time"]
});

// Doctor slot settings schema
export const doctorSlotSettingsSchema = z.object({
  default_slot_duration: z.number()
    .min(60, "Minimum duration is 60 minutes")
    .max(480, "Maximum duration is 480 minutes")
    .int("Duration must be a whole number"),
  max_patients_per_slot: z.number()
    .min(1, "Minimum capacity is 1 patient")
    .max(50, "Maximum capacity is 50 patients")
    .int("Capacity must be a whole number"),
  slot_creation_enabled: z.boolean(),
});

// Slot search/filter schema
export const slotFilterSchema = z.object({
  clinic_doctor_id: z.string()
    .uuid("Invalid doctor ID")
    .optional(),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional(),
  active_only: z.boolean()
    .default(true)
    .optional(),
  date_range: z.object({
    start_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format"),
    end_date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format"),
  }).optional(),
}).refine((data) => {
  if (data.date_range) {
    const start = new Date(data.date_range.start_date);
    const end = new Date(data.date_range.end_date);
    return end >= start;
  }
  return true;
}, {
  message: "End date must be after or equal to start date",
  path: ["date_range", "end_date"]
});

// Export TypeScript types
export type CreateSlotData = z.infer<typeof createSlotSchema>;
export type CreateMultipleSlotsData = z.infer<typeof createMultipleSlotsSchema>;
export type SlotBookingData = z.infer<typeof slotBookingSchema>;
export type UpdateSlotData = z.infer<typeof updateSlotSchema>;
export type DoctorSlotSettingsData = z.infer<typeof doctorSlotSettingsSchema>;
export type SlotFilterData = z.infer<typeof slotFilterSchema>;

// Validation helper functions
export function validateSlotTimes(slots: CreateSlotData[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (slots.length === 0) {
    return { isValid: true, errors: [] };
  }

  // Sort slots by start time
  const sortedSlots = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Check for overlapping slots
  for (let i = 0; i < sortedSlots.length - 1; i++) {
    const current = sortedSlots[i];
    const next = sortedSlots[i + 1];
    
    if (current.end_time > next.start_time) {
      errors.push(`Slot "${current.slot_name}" overlaps with "${next.slot_name}"`);
    }
  }

  // Check individual slot validity
  for (const slot of slots) {
    if (slot.end_time <= slot.start_time) {
      errors.push(`Slot "${slot.slot_name}": End time must be after start time`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateSlotCapacity(
  currentBookings: number,
  newCapacity: number
): {
  isValid: boolean;
  error?: string;
} {
  if (newCapacity < 1 || newCapacity > 50) {
    return {
      isValid: false,
      error: "Capacity must be between 1 and 50",
    };
  }

  if (currentBookings > newCapacity) {
    return {
      isValid: false,
      error: `Cannot reduce capacity below current bookings (${currentBookings})`,
    };
  }

  return { isValid: true };
}

export function calculateSlotDuration(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

export function formatSlotTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function formatSlotTimeRange(startTime: string, endTime: string): string {
  return `${formatSlotTime(startTime)} - ${formatSlotTime(endTime)}`;
}

// Common slot names for suggestions
export const COMMON_SLOT_NAMES = [
  "Morning Slot",
  "Afternoon Slot",
  "Evening Slot",
  "Early Morning",
  "Late Morning",
  "Early Afternoon",
  "Late Afternoon",
  "Consultation Slot",
  "Follow-up Slot",
  "Emergency Slot",
] as const;

// Common slot durations in minutes
export const COMMON_SLOT_DURATIONS = [
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 300, label: "5 hours" },
] as const;

// Common slot capacities
export const COMMON_SLOT_CAPACITIES = [
  { value: 5, label: "5 patients" },
  { value: 10, label: "10 patients" },
  { value: 15, label: "15 patients" },
  { value: 20, label: "20 patients" },
  { value: 25, label: "25 patients" },
  { value: 30, label: "30 patients" },
] as const;
