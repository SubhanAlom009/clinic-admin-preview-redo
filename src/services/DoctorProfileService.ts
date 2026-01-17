/**
 * Doctor Profile Service
 * Handles global doctor identity operations
 * Supports multi-clinic doctor relationships
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import type { Database } from "../types/database";

type DoctorProfile = Database["public"]["Tables"]["doctor_profiles"]["Row"];
type ClinicDoctor = Database["public"]["Tables"]["clinic_doctors"]["Row"];

export interface CreateDoctorProfileData {
  full_name: string;
  phone: string;
  email?: string;
  primary_specialization: string;
  secondary_specializations?: string[];
  qualifications?: string[];
  medical_license_number?: string;
  experience_years?: number; // ✅ Changed from years_of_experience to match DB
  consultation_fee?: number;
  languages?: string[]; // ✅ Changed from languages_spoken to match DB
  bio?: string;
  date_of_birth?: string; // ✅ Added for DOB
  gender?: 'male' | 'female' | 'other'; // ✅ Added for gender
  // Slot settings
  default_slot_duration?: number;
  max_patients_per_slot?: number;
  slot_creation_enabled?: boolean;
}

export interface UpdateDoctorProfileData {
  full_name?: string; // ✅ Changed from name to match DB
  phone?: string;
  email?: string;
  primary_specialization?: string;
  secondary_specializations?: string[];
  qualifications?: string[];
  medical_license_number?: string;
  experience_years?: number; // ✅ Changed from years_of_experience to match DB
  consultation_fee?: number;
  languages?: string[]; // ✅ Changed from languages_spoken to match DB
  bio?: string;
  signature_url?: string; // Doctor's signature image URL
  date_of_birth?: string; // ✅ Added for DOB
  gender?: 'male' | 'female' | 'other'; // ✅ Added for gender
}

export interface DoctorProfileWithClinic {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  primary_specialization: string;
  secondary_specializations?: string[];
  qualifications?: string[];
  medical_license_number?: string;
  experience_years?: number; // ✅ Changed from years_of_experience to match DB
  consultation_fee?: number;
  languages?: string[]; // ✅ Changed from languages_spoken to match DB
  bio?: string;
  created_at: string;
  updated_at: string;

  // Clinic relationship info (updated to match actual clinic_doctors schema)
  clinic_doctor?: {
    id: string;
    employee_id?: string;
    clinic_id: string;
    role_in_clinic: string; // ✅ Matches DB field name
    consultation_fee?: number; // ✅ From clinic_doctors table
    is_active: boolean; // ✅ Matches DB
    employment_type?: "Full-time" | "Part-time" | "Visiting" | "Consultant" | null;
    // Slot settings
    default_slot_duration?: number;
    max_patients_per_slot?: number;
    slot_creation_enabled?: boolean;
    rating?: number | null;
    total_reviews?: number | null;
    created_at: string;
  };
}

export interface DoctorWithSlots extends DoctorProfileWithClinic {
  upcoming_slots: {
    id: string;
    slot_date: string;
    slot_name: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_bookings: number;
    is_active: boolean;
  }[];
}

export class DoctorProfileService extends BaseService {
  // Role mapping from TypeScript interface to database enum
  private static mapRoleToDatabase(
    role: "primary" | "consultant" | "resident" | "visiting"
  ): string {
    const roleMap = {
      primary: "Senior_Consultant",
      consultant: "Consultant",
      resident: "Junior_Doctor",
      visiting: "Visiting_Doctor",
    };
    return roleMap[role];
  }
  /**
   * Find or create a doctor profile by phone number
   * Used for adding doctors to clinics
   */
  static async findOrCreateDoctorProfile(
    profileData: CreateDoctorProfileData
  ): Promise<ServiceResponse<DoctorProfile>> {
    try {
      this.validateRequired({
        full_name: profileData.full_name,
        phone: profileData.phone,
        primary_specialization: profileData.primary_specialization,
      });

      // First try to find existing profile by phone
      const { data: existingProfile } = await supabase
        .from("doctor_profiles")
        .select("*")
        .eq("phone", profileData.phone)
        .single();

      if (existingProfile) {
        return { data: existingProfile, success: true };
      }

      // Create new profile if not found
      const user = await this.getCurrentUser();

      const { data: newProfile, error } = await supabase
        .from("doctor_profiles")
        .insert({
          full_name: profileData.full_name,
          phone: profileData.phone,
          email: profileData.email,
          primary_specialization: profileData.primary_specialization,
          secondary_specializations: profileData.secondary_specializations,
          qualifications: profileData.qualifications || ["General Practice"], // ✅ Provide default to satisfy constraint
          medical_license_number:
            profileData.medical_license_number || `TEMP_${Date.now()}`, // ✅ Provide temp license number
          experience_years: profileData.experience_years, // ✅ Fixed field name
          consultation_fee: profileData.consultation_fee,
          languages: profileData.languages, // ✅ Fixed field name
          bio: profileData.bio,
          date_of_birth: profileData.date_of_birth, // ✅ Added DOB
          gender: profileData.gender, // ✅ Added gender
          created_by: user.id, // ✅ Add created_by for RLS
        } as any)
        .select()
        .single();
      if (error) throw error;

      return { data: newProfile, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Link a doctor profile to a clinic
   * Creates the clinic_doctors relationship
   */
  static async linkDoctorToClinic(
    doctorProfileId: string,
    role: "primary" | "consultant" | "resident" | "visiting" = "primary",
    consultationFeeOverride?: number,
    availabilitySchedule?: Record<string, unknown>,
    slotSettings?: {
      default_slot_duration?: number;
      max_patients_per_slot?: number;
      slot_creation_enabled?: boolean;
    }
  ): Promise<ServiceResponse<ClinicDoctor>> {
    try {
      const user = await this.getCurrentUser();

      // Check if relationship already exists
      const { data: existingLink } = await supabase
        .from("clinic_doctors")
        .select("*")
        .eq("doctor_profile_id", doctorProfileId)
        .eq("clinic_id", user.id)
        .single();

      if (existingLink) {
        return { data: existingLink, success: true };
      }

      // Create new clinic-doctor relationship
      const { data: clinicDoctor, error } = await supabase
        .from("clinic_doctors")
        .insert({
          doctor_profile_id: doctorProfileId,
          clinic_id: user.id,
          role_in_clinic: this.mapRoleToDatabase(role), // ✅ Map to correct DB enum
          is_active: true, // ✅ Fixed field name and value
          consultation_fee: consultationFeeOverride,
          availability_schedule: availabilitySchedule,
          // Slot settings
          default_slot_duration: slotSettings?.default_slot_duration,
          max_patients_per_slot: slotSettings?.max_patients_per_slot,
          slot_creation_enabled: slotSettings?.slot_creation_enabled,
        } as any)
        .select()
        .single();

      if (error) throw error;

      return { data: clinicDoctor, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get all doctors for current clinic with their profiles
   */
  static async getClinicDoctors(filters?: {
    status?: "active" | "inactive" | "on_leave";
    role?: "primary" | "consultant" | "resident" | "visiting";
    specialization?: string;
    searchTerm?: string;
  }): Promise<ServiceResponse<DoctorProfileWithClinic[]>> {
    try {
      const user = await this.getCurrentUser();

      let query = supabase
        .from("clinic_doctors")
        .select(
          `
          *,
          doctor_profile:doctor_profiles(*)
        `
        )
        .eq("clinic_id", user.id);

      if (filters?.status) {
        // Map status to is_active boolean
        const isActive = filters.status === "active";
        query = query.eq("is_active", isActive);
      }

      if (filters?.role) {
        // Map role to role_in_clinic
        const dbRole = this.mapRoleToDatabase(filters.role);
        query = query.eq("role_in_clinic", dbRole);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      // Transform and filter data
      let doctors: DoctorProfileWithClinic[] = (data || []).map((cd: any) => ({
        ...cd.doctor_profile,
        clinic_doctor: {
          id: cd.id,
          employee_id: cd.employee_id,
          clinic_id: cd.clinic_id,
          role_in_clinic: cd.role_in_clinic,
          is_active: cd.is_active,
          availability_schedule: cd.availability_schedule,
          consultation_fee: cd.consultation_fee,
          // Slot settings
          default_slot_duration: cd.default_slot_duration,
          max_patients_per_slot: cd.max_patients_per_slot,
          slot_creation_enabled: cd.slot_creation_enabled,
          rating: cd.rating,
          total_reviews: cd.total_reviews,
          created_at: cd.created_at,
        },
      }));

      // Apply additional filters
      if (filters?.specialization) {
        doctors = doctors.filter(
          (doctor) =>
            doctor.primary_specialization
              ?.toLowerCase()
              .includes(filters.specialization!.toLowerCase()) ||
            doctor.secondary_specializations?.some((spec) =>
              spec.toLowerCase().includes(filters.specialization!.toLowerCase())
            )
        );
      }

      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        doctors = doctors.filter(
          (doctor) =>
            doctor.full_name?.toLowerCase().includes(searchLower) ||
            doctor.phone?.includes(filters.searchTerm || "") ||
            doctor.email?.toLowerCase().includes(searchLower) ||
            doctor.primary_specialization
              ?.toLowerCase()
              .includes(searchLower) ||
            doctor.clinic_doctor?.employee_id?.includes(
              // ✅ Fixed field name
              filters.searchTerm || ""
            )
        );
      }

      return { data: doctors, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get doctor profile by ID with clinic relationship
   */
  static async getDoctorById(
    doctorProfileId: string
  ): Promise<ServiceResponse<DoctorProfileWithClinic>> {
    try {
      const user = await this.getCurrentUser();

      const { data, error } = await supabase
        .from("doctor_profiles")
        .select(
          `
          *,
          clinic_doctors!inner(
            id,
            employee_id,
            clinic_id,
            role_in_clinic,
            is_active,
            availability_schedule,
            consultation_fee,
            default_slot_duration,
            max_patients_per_slot,
            slot_creation_enabled,
            rating,
            total_reviews,
            created_at
          )
        `
        )
        .eq("id", doctorProfileId)
        .eq("clinic_doctors.clinic_id", user.id)
        .single();

      if (error) throw error;

      const doctor: DoctorProfileWithClinic = {
        ...data,
        clinic_doctor: Array.isArray(data.clinic_doctors)
          ? data.clinic_doctors[0]
          : data.clinic_doctors,
      };

      return { data: doctor, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update doctor profile
   */
  static async updateDoctorProfile(
    doctorProfileId: string,
    updateData: UpdateDoctorProfileData
  ): Promise<ServiceResponse<DoctorProfile>> {
    try {
      const { data, error } = await supabase
        .from("doctor_profiles")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", doctorProfileId)
        .select()
        .single();

      if (error) throw error;

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update clinic-doctor relationship
   */
  static async updateClinicDoctor(
    clinicDoctorId: string,
    updateData: {
      role?: "primary" | "consultant" | "resident" | "visiting";
      status?: "active" | "inactive" | "on_leave";
      consultation_fee_override?: number;
      availability_schedule?: Record<string, unknown>;
    }
  ): Promise<ServiceResponse<ClinicDoctor>> {
    try {
      const user = await this.getCurrentUser();

      const { data, error } = await supabase
        .from("clinic_doctors")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", clinicDoctorId)
        .eq("clinic_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Create a new doctor (combines profile creation and clinic linking)
   * Used by clinic admin to add new doctors
   */
  static async createDoctor(
    profileData: CreateDoctorProfileData,
    role: "primary" | "consultant" | "resident" | "visiting" = "primary",
    consultationFeeOverride?: number,
    availabilitySchedule?: Record<string, unknown>
  ): Promise<ServiceResponse<DoctorProfileWithClinic>> {
    try {
      // First create or find the doctor profile
      const profileResult = await this.findOrCreateDoctorProfile(profileData);
      if (!profileResult.success || !profileResult.data) {
        return { error: profileResult.error, success: false };
      }

      // Extract slot settings from profile data
      const slotSettings = {
        default_slot_duration: profileData.default_slot_duration,
        max_patients_per_slot: profileData.max_patients_per_slot,
        slot_creation_enabled: profileData.slot_creation_enabled,
      };

      // Then link to clinic
      const linkResult = await this.linkDoctorToClinic(
        profileResult.data.id,
        role,
        consultationFeeOverride,
        availabilitySchedule,
        slotSettings
      );
      if (!linkResult.success || !linkResult.data) {
        return { error: linkResult.error, success: false };
      }

      // Return full doctor data
      const doctorResult = await this.getDoctorById(profileResult.data.id);
      return doctorResult;
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Search doctors by phone number or name across all profiles
   * Used for linking existing doctors to new clinics
   */
  static async searchDoctors(
    searchTerm: string
  ): Promise<ServiceResponse<DoctorProfile[]>> {
    try {
      const { data, error } = await supabase
        .from("doctor_profiles")
        .select("*")
        .or(
          `phone.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,primary_specialization.ilike.%${searchTerm}%`
        )
        .limit(10);

      if (error) throw error;

      return { data: data || [], success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Delete a doctor from the clinic (removes the clinic-doctor relationship)
   * This will unlink the doctor from the clinic but keep their profile
   */
  static async deleteDoctorFromClinic(
    doctorProfileId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const user = await this.getCurrentUser();

      // Delete the clinic-doctor relationship
      const { error } = await supabase
        .from("clinic_doctors")
        .delete()
        .eq("doctor_profile_id", doctorProfileId)
        .eq("clinic_id", user.id);

      if (error) throw error;

      return { data: true, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Remove doctor from clinic (deactivate relationship)
   */
  static async removeDoctorFromClinic(
    clinicDoctorId: string
  ): Promise<ServiceResponse<void>> {
    try {
      const user = await this.getCurrentUser();

      const { error } = await supabase
        .from("clinic_doctors")
        .update({
          is_active: false, // ✅ Use correct field name
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", clinicDoctorId)
        .eq("clinic_id", user.id);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update doctor slot settings
   */
  static async updateDoctorSlotSettings(
    clinicDoctorId: string,
    slotSettings: {
      default_slot_duration?: number;
      max_patients_per_slot?: number;
      slot_creation_enabled?: boolean;
    }
  ): Promise<ServiceResponse<ClinicDoctor>> {
    try {
      const user = await this.getCurrentUser();

      const { data, error } = await supabase
        .from("clinic_doctors")
        .update({
          ...slotSettings,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", clinicDoctorId)
        .eq("clinic_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get doctor with upcoming slots (next 4 weeks)
   */
  static async getDoctorWithUpcomingSlots(
    doctorId: string
  ): Promise<ServiceResponse<DoctorWithSlots>> {
    try {
      const user = await this.getCurrentUser();

      // First get the doctor profile with clinic relationship
      const doctorResult = await this.getDoctorById(doctorId);
      if (!doctorResult.success || !doctorResult.data) {
        return { error: doctorResult.error, success: false };
      }

      // Get the clinic_doctor_id for slot queries
      const clinicDoctorId = doctorResult.data.clinic_doctor?.id;
      if (!clinicDoctorId) {
        return {
          error: new Error("Doctor not linked to clinic"),
          success: false,
        };
      }

      // Calculate date range (next 4 weeks)
      const today = new Date();
      const fourWeeksFromNow = new Date();
      fourWeeksFromNow.setDate(today.getDate() + 28);

      // Get upcoming slots
      const { data: slots, error: slotsError } = await supabase
        .from("doctor_slots")
        .select("*")
        .eq("clinic_doctor_id", clinicDoctorId)
        .gte("slot_date", today.toISOString().split("T")[0])
        .lte("slot_date", fourWeeksFromNow.toISOString().split("T")[0])
        .eq("is_active", true)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotsError) throw slotsError;

      const doctorWithSlots: DoctorWithSlots = {
        ...doctorResult.data,
        upcoming_slots: slots || [],
      };

      return { data: doctorWithSlots, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Delete doctor with cleanup (appointments, slots)
   */
  /**
   * Toggle doctor active status (activate/deactivate)
   * When deactivating: cancels future appointments and deactivates slots
   * When activating: just sets is_active to true
   */
  static async toggleDoctorActiveStatus(
    doctorId: string,
    isActive: boolean
  ): Promise<
    ServiceResponse<{ affectedAppointments?: number; affectedSlots?: number }>
  > {
    try {
      const user = await this.getCurrentUser();

      // Get the clinic_doctor_id
      const doctorResult = await this.getDoctorById(doctorId);
      if (!doctorResult.success || !doctorResult.data?.clinic_doctor?.id) {
        return {
          error: new Error("Doctor not found or not linked to clinic"),
          success: false,
        };
      }

      const clinicDoctorId = doctorResult.data.clinic_doctor.id;
      let affectedAppointments = 0;
      let affectedSlots = 0;

      // If deactivating, cancel future appointments and deactivate slots
      if (!isActive) {
        // Count future appointments that will be cancelled
        const { count: appointmentCount } = await supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("clinic_doctor_id", clinicDoctorId)
          .in("status", ["scheduled", "checked-in", "in-progress"])
          .gte("appointment_datetime", new Date().toISOString());

        // Count slots that will be deactivated
        const { count: slotCount } = await supabase
          .from("doctor_slots")
          .select("*", { count: "exact", head: true })
          .eq("clinic_doctor_id", clinicDoctorId)
          .eq("is_active", true);

        affectedAppointments = appointmentCount || 0;
        affectedSlots = slotCount || 0;

        // Cancel all future appointments
        const { error: appointmentsError } = await supabase
          .from("appointments")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("clinic_doctor_id", clinicDoctorId)
          .in("status", ["scheduled", "checked-in", "in-progress"])
          .gte("appointment_datetime", new Date().toISOString());

        if (appointmentsError) throw appointmentsError;

        // Deactivate all slots
        const { error: slotsError } = await supabase
          .from("doctor_slots")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("clinic_doctor_id", clinicDoctorId)
          .eq("is_active", true);

        if (slotsError) throw slotsError;
      }

      // Update clinic-doctor relationship active status
      const { error: clinicDoctorError } = await supabase
        .from("clinic_doctors")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clinicDoctorId)
        .eq("clinic_id", user.id);

      if (clinicDoctorError) throw clinicDoctorError;

      return {
        data: {
          affectedAppointments,
          affectedSlots,
        },
        success: true,
      };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Permanently delete doctor from clinic (hard delete)
   * This will remove the clinic_doctors relationship entirely
   * Note: This should only be used when you want to completely remove the doctor from the clinic
   */
  static async deleteDoctorWithCleanup(
    doctorId: string
  ): Promise<
    ServiceResponse<{ deletedAppointments: number; deletedSlots: number }>
  > {
    try {
      const user = await this.getCurrentUser();

      // Get the clinic_doctor_id
      const doctorResult = await this.getDoctorById(doctorId);
      if (!doctorResult.success || !doctorResult.data?.clinic_doctor?.id) {
        return {
          error: new Error("Doctor not found or not linked to clinic"),
          success: false,
        };
      }

      const clinicDoctorId = doctorResult.data.clinic_doctor.id;

      // Count future appointments that will be cancelled
      const { count: appointmentCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("clinic_doctor_id", clinicDoctorId)
        .in("status", ["scheduled", "checked-in", "in-progress"])
        .gte("appointment_datetime", new Date().toISOString());

      // Count slots that will be deleted
      const { count: slotCount } = await supabase
        .from("doctor_slots")
        .select("*", { count: "exact", head: true })
        .eq("clinic_doctor_id", clinicDoctorId);

      // Cancel all future appointments
      const { error: appointmentsError } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("clinic_doctor_id", clinicDoctorId)
        .in("status", ["scheduled", "checked-in", "in-progress"])
        .gte("appointment_datetime", new Date().toISOString());

      if (appointmentsError) throw appointmentsError;

      // Delete all doctor slots (hard delete)
      const { error: slotsError } = await supabase
        .from("doctor_slots")
        .delete()
        .eq("clinic_doctor_id", clinicDoctorId);

      if (slotsError) throw slotsError;

      // Delete clinic-doctor relationship (hard delete)
      const { error: clinicDoctorError } = await supabase
        .from("clinic_doctors")
        .delete()
        .eq("id", clinicDoctorId)
        .eq("clinic_id", user.id);

      if (clinicDoctorError) throw clinicDoctorError;

      return {
        data: {
          deletedAppointments: appointmentCount || 0,
          deletedSlots: slotCount || 0,
        },
        success: true,
      };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }
}
