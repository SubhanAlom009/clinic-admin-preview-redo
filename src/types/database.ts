// Import Address types from validation
import type { Address, AddressFormData } from "../validation/AddressValidation";

// Re-export for convenience
export type { Address, AddressFormData };

export interface Database {
  public: {
    Tables: {
      clinic_profiles: {
        Row: {
          id: string;
          clinic_name: string;
          admin_name: string;
          contact_email: string;
          contact_phone: string | null;
          primary_address: AddressFormData | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
          clinic_logo: string | null;
        };
        Insert: {
          id?: string;
          clinic_name: string;
          admin_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          primary_address?: AddressFormData | null;
          logo_url?: string | null;
          clinic_logo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          clinic_name?: string;
          admin_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          primary_address?: AddressFormData | null;
          logo_url?: string | null;
          clinic_logo?: string | null;
          updated_at?: string;
        };
      };

      patient_profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          full_name: string;
          date_of_birth: string | null;
          gender: "male" | "female" | "other" | null;
          // address: any | null; // jsonb
          // emergency_contact: any | null; // jsonb
          medical_id: string | null;
          allergies: string[] | null;
          chronic_conditions: string[] | null;
          medications: string[] | null;
          previous_surgeries: string[] | null;
          family_history: string | null;
          push_token: string | null;
          onboarding_completed: boolean | null;
          preferred_language: string | null;
          created_at: string;
          updated_at: string;
          aadhar_number: string | null;
          primary_address: AddressFormData | null;
          emergency_contact: any | null; // jsonb (array)
          blood_group: string | null;
          medical_notes: string | null;
          user_id: string | null;
          profile_verified: boolean | null;
          verification_documents: any | null; // jsonb
          created_by: string | null;
        };
        Insert: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          full_name: string;
          date_of_birth?: string | null;
          gender?: "male" | "female" | "other" | null;
          // address?: any | null;
          // emergency_contact?: any | null;
          medical_id?: string | null;
          allergies?: string[] | null;
          chronic_conditions?: string[] | null;
          medications?: string[] | null;
          previous_surgeries?: string[] | null;
          family_history?: string | null;
          push_token?: string | null;
          onboarding_completed?: boolean | null;
          preferred_language?: string | null;
          aadhar_number?: string | null;
          primary_address?: AddressFormData | null;
          emergency_contact?: any | null;
          blood_group?: string | null;
          medical_notes?: string | null;
          user_id?: string | null;
          profile_verified?: boolean | null;
          verification_documents?: any | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          phone?: string | null;
          full_name?: string;
          date_of_birth?: string | null;
          gender?: "male" | "female" | "other" | null;
          // address?: any | null;
          // emergency_contact?: any | null;
          medical_id?: string | null;
          allergies?: string[] | null;
          chronic_conditions?: string[] | null;
          medications?: string[] | null;
          previous_surgeries?: string[] | null;
          family_history?: string | null;
          push_token?: string | null;
          onboarding_completed?: boolean | null;
          preferred_language?: string | null;
          aadhar_number?: string | null;
          primary_address?: AddressFormData | null;
          emergency_contact?: any | null;
          blood_group?: string | null;
          medical_notes?: string | null;
          user_id?: string | null;
          profile_verified?: boolean | null;
          verification_documents?: any | null;
          created_by?: string | null;
          updated_at?: string;
        };
      };

      doctor_profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          full_name: string;
          specialization: string;
          qualifications: string[]; // CHECK in SQL requires content
          experience_years: number;
          license_number: string | null;
          bio: string | null;
          languages: string[] | null;
          consultation_fee: number | null;
          rating: number;
          total_reviews: number;
          availability_schedule: any | null;
          is_available: boolean | null;
          push_token: string | null;
          onboarding_completed: boolean | null;
          preferred_language: string | null;
          created_at: string;
          updated_at: string;
          medical_license_number: string; // enforced non-null by CHECK in SQL
          date_of_birth: string | null;
          gender: string | null;
          primary_specialization: string | null;
          secondary_specializations: string[] | null;
          primary_address: AddressFormData | null;
          medical_council_registration: any | null;
          verification_documents: any | null;
          professional_verified: boolean | null;
          user_id: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          full_name: string;
          specialization: string;
          qualifications: string[];
          experience_years?: number;
          license_number?: string | null;
          bio?: string | null;
          languages?: string[] | null;
          consultation_fee?: number | null;
          rating?: number;
          total_reviews?: number;
          availability_schedule?: any | null;
          is_available?: boolean | null;
          push_token?: string | null;
          onboarding_completed?: boolean | null;
          preferred_language?: string | null;
          medical_license_number: string;
          date_of_birth?: string | null;
          gender?: string | null;
          primary_specialization?: string | null;
          secondary_specializations?: string[] | null;
          primary_address?: AddressFormData | null;
          medical_council_registration?: any | null;
          verification_documents?: any | null;
          professional_verified?: boolean | null;
          user_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          phone?: string | null;
          full_name?: string;
          specialization?: string;
          qualifications?: string[];
          experience_years?: number;
          license_number?: string | null;
          bio?: string | null;
          languages?: string[] | null;
          consultation_fee?: number | null;
          rating?: number;
          total_reviews?: number;
          availability_schedule?: any | null;
          is_available?: boolean | null;
          push_token?: string | null;
          onboarding_completed?: boolean | null;
          preferred_language?: string | null;
          medical_license_number?: string;
          date_of_birth?: string | null;
          gender?: string | null;
          primary_specialization?: string | null;
          secondary_specializations?: string[] | null;
          primary_address?: AddressFormData | null;
          medical_council_registration?: any | null;
          verification_documents?: any | null;
          professional_verified?: boolean | null;
          user_id?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
      };

      clinic_patients: {
        Row: {
          id: string;
          clinic_id: string | null;
          patient_profile_id: string | null;
          clinic_medical_history: any | null;
          clinic_allergies: string[] | null;
          clinic_notes: string | null;
          insurance_info: any | null;
          relationship_status: "active" | "inactive" | "dormant" | null;
          first_visit_date: string | null;
          last_visit_date: string | null;
          total_visits: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          patient_profile_id?: string | null;
          clinic_medical_history?: any | null;
          clinic_allergies?: string[] | null;
          clinic_notes?: string | null;
          insurance_info?: any | null;
          relationship_status?: "active" | "inactive" | "dormant" | null;
          first_visit_date?: string | null;
          last_visit_date?: string | null;
          total_visits?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          clinic_medical_history?: any | null;
          clinic_allergies?: string[] | null;
          clinic_notes?: string | null;
          insurance_info?: any | null;
          relationship_status?: "active" | "inactive" | "dormant" | null;
          first_visit_date?: string | null;
          last_visit_date?: string | null;
          total_visits?: number;
          updated_at?: string;
          created_by?: string | null;
        };
      };

      clinic_doctors: {
        Row: {
          id: string;
          clinic_id: string | null;
          doctor_profile_id: string | null;
          employee_id: string | null;
          role_in_clinic:
            | "Owner"
            | "Partner"
            | "Senior_Consultant"
            | "Consultant"
            | "Junior_Doctor"
            | "Visiting_Doctor"
            | "Intern";
          consultation_fee: number | null;
          default_slot_duration: number | null;
          max_patients_per_slot: number | null;
          slot_creation_enabled: boolean | null;
          department: string | null;
          specialization_in_clinic: string | null;
          default_consultation_duration: number | null;
          availability_schedule: any | null;
          can_manage_appointments: boolean | null;
          can_access_billing: boolean | null;
          can_manage_patients: boolean | null;
          admin_permissions: any | null;
          employment_type:
            | "Full-time"
            | "Part-time"
            | "Visiting"
            | "Consultant"
            | null;
          employment_start_date: string;
          employment_end_date: string | null;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          doctor_profile_id?: string | null;
          employee_id?: string | null;
          role_in_clinic?:
            | "Owner"
            | "Partner"
            | "Senior_Consultant"
            | "Consultant"
            | "Junior_Doctor"
            | "Visiting_Doctor"
            | "Intern";
          consultation_fee?: number | null;
          default_slot_duration?: number | null;
          max_patients_per_slot?: number | null;
          slot_creation_enabled?: boolean | null;
          department?: string | null;
          specialization_in_clinic?: string | null;
          default_consultation_duration?: number | null;
          availability_schedule?: any | null;
          can_manage_appointments?: boolean | null;
          can_access_billing?: boolean | null;
          can_manage_patients?: boolean | null;
          admin_permissions?: any | null;
          employment_type?:
            | "Full-time"
            | "Part-time"
            | "Visiting"
            | "Consultant"
            | null;
          employment_start_date?: string;
          employment_end_date?: string | null;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          employee_id?: string | null;
          role_in_clinic?:
            | "Owner"
            | "Partner"
            | "Senior_Consultant"
            | "Consultant"
            | "Junior_Doctor"
            | "Visiting_Doctor"
            | "Intern";
          consultation_fee?: number | null;
          default_slot_duration?: number | null;
          max_patients_per_slot?: number | null;
          slot_creation_enabled?: boolean | null;
          department?: string | null;
          specialization_in_clinic?: string | null;
          default_consultation_duration?: number | null;
          availability_schedule?: any | null;
          can_manage_appointments?: boolean | null;
          can_access_billing?: boolean | null;
          can_manage_patients?: boolean | null;
          admin_permissions?: any | null;
          employment_type?:
            | "Full-time"
            | "Part-time"
            | "Visiting"
            | "Consultant"
            | null;
          employment_end_date?: string | null;
          is_active?: boolean | null;
          updated_at?: string;
          created_by?: string | null;
        };
      };

      appointments: {
        Row: {
          id: string;
          user_id: string | null;
          appointment_datetime: string;
          duration_minutes: number | null;
          status: string | null;
          notes: string | null;
          symptoms: string | null;
          diagnosis: string | null;
          prescription: string | null;
          created_at: string;
          updated_at: string;
          checked_in_at: string | null;
          patient_checked_in: boolean | null;
          estimated_start_time: string | null;
          actual_start_time: string | null;
          actual_end_time: string | null;
          queue_position: number | null;
          emergency_status: boolean | null;
          emergency_reason: string | null;
          delay_minutes: number | null;
          appointment_type: string | null;
          clinic_patient_id: string | null;
          clinic_doctor_id: string | null;
          consultation_fee: number | null;
          doctor_slot_id: string | null;
          slot_booking_order: number | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          appointment_datetime: string;
          duration_minutes?: number | null;
          status?: string | null;
          notes?: string | null;
          symptoms?: string | null;
          diagnosis?: string | null;
          prescription?: string | null;
          created_at?: string;
          updated_at?: string;
          checked_in_at?: string | null;
          patient_checked_in?: boolean | null;
          estimated_start_time?: string | null;
          actual_start_time?: string | null;
          actual_end_time?: string | null;
          queue_position?: number | null;
          emergency_status?: boolean | null;
          emergency_reason?: string | null;
          delay_minutes?: number | null;
          appointment_type?: string | null;
          clinic_patient_id?: string | null;
          clinic_doctor_id?: string | null;
          consultation_fee?: number | null;
          doctor_slot_id?: string | null;
          slot_booking_order?: number | null;
        };
        Update: {
          appointment_datetime?: string;
          duration_minutes?: number | null;
          status?: string | null;
          notes?: string | null;
          symptoms?: string | null;
          diagnosis?: string | null;
          prescription?: string | null;
          updated_at?: string;
          checked_in_at?: string | null;
          patient_checked_in?: boolean | null;
          estimated_start_time?: string | null;
          actual_start_time?: string | null;
          actual_end_time?: string | null;
          queue_position?: number | null;
          emergency_status?: boolean | null;
          emergency_reason?: string | null;
          delay_minutes?: number | null;
          appointment_type?: string | null;
          clinic_patient_id?: string | null;
          clinic_doctor_id?: string | null;
          consultation_fee?: number | null;
          doctor_slot_id?: string | null;
          slot_booking_order?: number | null;
        };
      };

      doctor_slots: {
        Row: {
          id: string;
          clinic_doctor_id: string;
          slot_date: string;
          slot_name: string;
          start_time: string;
          end_time: string;
          max_capacity: number;
          current_bookings: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_doctor_id: string;
          slot_date: string;
          slot_name: string;
          start_time: string;
          end_time: string;
          max_capacity?: number;
          current_bookings?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slot_name?: string;
          start_time?: string;
          end_time?: string;
          max_capacity?: number;
          current_bookings?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };

      slot_bookings: {
        Row: {
          id: string;
          doctor_slot_id: string;
          appointment_id: string;
          booking_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor_slot_id: string;
          appointment_id: string;
          booking_order?: number;
          created_at?: string;
        };
        Update: {
          booking_order?: number;
        };
      };

      bills: {
        Row: {
          id: string;
          user_id: string | null;
          appointment_id: string | null;
          bill_number: string;
          amount: number;
          tax_amount: number | null;
          total_amount: number;
          status: string | null;
          payment_mode: string | null;
          payment_date: string | null;
          due_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          clinic_patient_id: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          appointment_id?: string | null;
          bill_number: string;
          amount: number;
          tax_amount?: number | null;
          total_amount: number;
          status?: string | null;
          payment_mode?: string | null;
          payment_date?: string | null;
          due_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          clinic_patient_id?: string | null;
        };
        Update: {
          appointment_id?: string | null;
          bill_number?: string;
          amount?: number;
          tax_amount?: number | null;
          total_amount?: number;
          status?: string | null;
          payment_mode?: string | null;
          payment_date?: string | null;
          due_date?: string | null;
          notes?: string | null;
          updated_at?: string;
          clinic_patient_id?: string | null;
        };
      };

      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          table_name: string;
          record_id?: string | null;
          old_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          timestamp?: string;
        };
        Update: {
          action?: string;
          table_name?: string;
          record_id?: string | null;
          old_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          timestamp?: string;
        };
      };

      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          type: "appointment" | "payment" | "followup" | "system";
          title: string;
          message: string;
          status: "unread" | "read" | null;
          priority: "low" | "normal" | "high" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          type: "appointment" | "payment" | "followup" | "system";
          title: string;
          message: string;
          status?: "unread" | "read" | null;
          priority?: "low" | "normal" | "high" | null;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          type?: "appointment" | "payment" | "followup" | "system";
          title?: string;
          message?: string;
          status?: "unread" | "read" | null;
          priority?: "low" | "normal" | "high" | null;
          created_at?: string;
        };
      };

      appointment_requests: {
        Row: {
          id: string;
          patient_name: string;
          patient_phone: string;
          patient_email: string | null;
          clinic_id: string;
          doctor_id: string;
          requested_datetime: string;
          requested_duration: number | null;
          appointment_type: string;
          priority: "normal" | "high" | "urgent" | null;
          symptoms: string | null;
          notes: string | null;
          status: "pending" | "approved" | "rejected" | null;
          rejection_reason: string | null;
          processed_by: string | null;
          processed_at: string | null;
          appointment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_name: string;
          patient_phone: string;
          patient_email?: string | null;
          clinic_id: string;
          doctor_id: string;
          requested_datetime: string;
          requested_duration?: number | null;
          appointment_type: string;
          priority?: "normal" | "high" | "urgent" | null;
          symptoms?: string | null;
          notes?: string | null;
          status?: "pending" | "approved" | "rejected" | null;
          rejection_reason?: string | null;
          processed_by?: string | null;
          processed_at?: string | null;
          appointment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          patient_name?: string;
          patient_phone?: string;
          patient_email?: string | null;
          clinic_id?: string;
          doctor_id?: string;
          requested_datetime?: string;
          requested_duration?: number | null;
          appointment_type?: string;
          priority?: "normal" | "high" | "urgent" | null;
          symptoms?: string | null;
          notes?: string | null;
          status?: "pending" | "approved" | "rejected" | null;
          rejection_reason?: string | null;
          processed_by?: string | null;
          processed_at?: string | null;
          appointment_id?: string | null;
          updated_at?: string;
        };
      };
      reschedule_requests: {
        Row: {
          id: string;
          appointment_id: string;
          patient_id: string;
          clinic_id: string;
          doctor_id: string;
          current_datetime: string;
          requested_datetime: string;
          reason: string | null;
          status: "pending" | "approved" | "rejected";
          processed_by: string | null;
          processed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          patient_id: string;
          clinic_id: string;
          doctor_id: string;
          current_datetime: string;
          requested_datetime: string;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected";
          processed_by?: string | null;
          processed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string;
          patient_id?: string;
          clinic_id?: string;
          doctor_id?: string;
          current_datetime?: string;
          requested_datetime?: string;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected";
          processed_by?: string | null;
          processed_at?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// helper joined types (optional)
export interface ClinicPatientWithProfile {
  id: string;
  clinic_id: string | null;
  patient_profile_id: string | null;
  clinic_medical_history?: any | null;
  clinic_allergies?: string[] | null;
  clinic_notes?: string | null;
  insurance_info?: any | null;
  first_visit_date?: string | null;
  last_visit_date?: string | null;
  total_visits: number;
  relationship_status?: "active" | "inactive" | "dormant" | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  patient_profile?: Database["public"]["Tables"]["patient_profiles"]["Row"];
}

export interface ClinicDoctorWithProfile {
  id: string;
  clinic_id: string | null;
  doctor_profile_id: string | null;
  employee_id?: string | null;
  role_in_clinic:
    | "Owner"
    | "Partner"
    | "Senior_Consultant"
    | "Consultant"
    | "Junior_Doctor"
    | "Visiting_Doctor"
    | "Intern";
  consultation_fee?: number | null;
  default_consultation_duration?: number | null;
  availability_schedule?: any | null;
  can_manage_appointments?: boolean | null;
  can_access_billing?: boolean | null;
  can_manage_patients?: boolean | null;
  admin_permissions?: any | null;
  employment_type?:
    | "Full-time"
    | "Part-time"
    | "Visiting"
    | "Consultant"
    | null;
  employment_start_date?: string;
  employment_end_date?: string | null;
  is_active?: boolean | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  doctor_profile?: Database["public"]["Tables"]["doctor_profiles"]["Row"];
}

export interface AppointmentWithRelations {
  id: string;
  user_id?: string | null;
  appointment_datetime: string;
  duration_minutes?: number | null;
  status?: string | null;
  appointment_type?: string | null;
  delay_minutes?: number | null;
  notes?: string | null;
  symptoms?: string | null;
  diagnosis?: string | null;
  prescription?: string | null;
  queue_position?: number | null;
  estimated_start_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  patient_checked_in?: boolean | null;
  checked_in_at?: string | null;
  emergency_status?: boolean | null;
  emergency_reason?: string | null;
  created_at: string;
  updated_at: string;
  clinic_patient?: ClinicPatientWithProfile | null;
  clinic_doctor?: ClinicDoctorWithProfile | null;
}

export interface BillWithRelations {
  id: string;
  user_id?: string | null;
  clinic_patient_id?: string | null;
  appointment_id?: string | null;
  bill_number: string;
  amount: number;
  tax_amount?: number | null;
  total_amount: number;
  status?: string | null;
  payment_mode?: string | null;
  payment_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  clinic_patient?: ClinicPatientWithProfile | null;
  appointment?: AppointmentWithRelations | null;
}
