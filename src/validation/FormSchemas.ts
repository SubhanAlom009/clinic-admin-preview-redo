import { z } from "zod";
import { addressFormSchema } from "./AddressValidation";
import { VALIDATION_RULES } from "../constants";

// Common field schemas that can be reused across forms
export const commonFieldSchemas = {
  full_name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .refine((s) => s.trim().length > 0, "Name is required"),

  phone: z.string()
    .min(1, "Phone number is required")
    .regex(VALIDATION_RULES.PHONE_REGEX, "Invalid phone number"),

  email: z.string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),

  aadhar_number: z.string()
    .regex(/^\d{12}$/, "Aadhar must be exactly 12 digits")
    .optional()
    .or(z.literal("")),

  blood_group: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),

  gender: z.enum(["male", "female", "other"]).optional(),

  date_of_birth: z.string().optional(),

  emergency_contact: z.string().optional(),

  medical_notes: z.string().optional(),
};

// Patient form validation schema
export const patientFormSchema = z.object({
  ...commonFieldSchemas,
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
  medications: z.string().optional(),
  previous_surgeries: z.string().optional(),
  family_history: z.string().optional(),
  primary_address: addressFormSchema, // Reuse existing address validation
});

// Doctor form validation schema
export const doctorFormSchema = z.object({
  ...commonFieldSchemas,
  primary_specialization: z.string()
    .min(1, "Primary specialization is required")
    .refine((s) => s.trim().length > 0, "Primary specialization is required"),

  medical_license_number: z.string()
    .min(1, "Medical license number is required")
    .refine((s) => s.trim().length > 0, "Medical license number is required"),

  consultation_fee: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid fee amount")
    .min(1, "Consultation fee is required"),

  experience_years: z.string()
    .regex(/^\d+$/, "Experience must be a number")
    .min(1, "Experience years is required")
    .refine((val) => {
      const num = parseInt(val);
      return num >= 0 && num <= 50;
    }, "Experience must be between 0 and 50 years"),

  qualifications: z.string().optional(),
  secondary_specializations: z.string().optional(),
  languages: z.string().optional(),
  bio: z.string().optional(),
  
  // Slot settings
  default_slot_duration: z.string()
    .regex(/^\d+$/, "Duration must be a number")
    .refine((val) => {
      const num = parseInt(val);
      return num >= 60 && num <= 480;
    }, "Duration must be between 60 and 480 minutes"),

  max_patients_per_slot: z.string()
    .regex(/^\d+$/, "Capacity must be a number")
    .refine((val) => {
      const num = parseInt(val);
      return num >= 1 && num <= 50;
    }, "Capacity must be between 1 and 50 patients"),

  slot_creation_enabled: z.boolean().optional(),
});

// Appointment form validation schema
export const appointmentFormSchema = z.object({
  clinic_patient_id: z.string()
    .min(1, "Patient selection is required")
    .refine((s) => s.trim().length > 0, "Please select a patient"),

  clinic_doctor_id: z.string()
    .min(1, "Doctor selection is required")
    .refine((s) => s.trim().length > 0, "Please select a doctor"),

  doctor_slot_id: z.string()
    .min(1, "Slot selection is required")
    .refine((s) => s.trim().length > 0, "Please select a time slot"),

  appointment_datetime: z.string().optional(), // CHANGED: Now optional, derived from slot

  appointment_type: z.string()
    .min(1, "Appointment type is required")
    .refine((s) => s.trim().length > 0, "Appointment type is required"),

  notes: z.string().optional(),
  symptoms: z.string().optional(),
});

// Billing form validation schema
export const billingFormSchema = z.object({
  clinic_patient_id: z.string()
    .min(1, "Patient selection is required")
    .refine((s) => s.trim().length > 0, "Please select a patient"),

  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount")
    .min(1, "Amount is required")
    .refine((val) => {
      const num = parseFloat(val);
      return num > 0;
    }, "Amount must be greater than 0"),

  tax_amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid tax amount")
    .optional()
    .or(z.literal("")),

  due_date: z.string()
    .min(1, "Due date is required")
    .refine((val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Due date must be today or in the future"),

  notes: z.string().optional(),
});

// Prescription form validation schema
export const prescriptionFormSchema = z.object({
  diagnosis: z.string()
    .min(1, "Diagnosis is required")
    .refine((s) => s.trim().length > 0, "Diagnosis is required"),

  notes: z.string().optional(),

  followUpDate: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true; // Optional field
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Follow-up date must be today or in the future"),

  files: z.array(z.any()).min(1, "At least one prescription file is required"),
});

// Export types for use in components
export type PatientFormData = z.infer<typeof patientFormSchema>;
export type DoctorFormData = z.infer<typeof doctorFormSchema>;
export type AppointmentFormData = z.infer<typeof appointmentFormSchema>;
export type BillingFormData = z.infer<typeof billingFormSchema>;
export type PrescriptionFormData = z.infer<typeof prescriptionFormSchema>;

// Validation helper functions
export function validatePatientForm(data: Partial<PatientFormData>) {
  return patientFormSchema.safeParse(data);
}

export function validateDoctorForm(data: Partial<DoctorFormData>) {
  return doctorFormSchema.safeParse(data);
}

export function validateAppointmentForm(data: Partial<AppointmentFormData>) {
  return appointmentFormSchema.safeParse(data);
}

export function validateBillingForm(data: Partial<BillingFormData>) {
  return billingFormSchema.safeParse(data);
}

export function validatePrescriptionForm(data: Partial<PrescriptionFormData>) {
  return prescriptionFormSchema.safeParse(data);
}

// Reschedule appointment schema
export const rescheduleAppointmentSchema = z.object({
  appointment_datetime: z.string().optional(), // Now optional, derived from slot
  duration_minutes: z.string().optional(), // Now optional, derived from slot
  notes: z.string().optional(),
});

export type RescheduleAppointmentFormData = z.infer<typeof rescheduleAppointmentSchema>;

export function validateRescheduleAppointmentForm(data: Partial<RescheduleAppointmentFormData>) {
  return rescheduleAppointmentSchema.safeParse(data);
}
