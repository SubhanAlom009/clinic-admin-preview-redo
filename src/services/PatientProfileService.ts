/**
 * Patient Profile Service
 * Handles global patient identity o  // Clinic relationship info
  clinic_patient?: {
    id: string;
    clinic_id: string;
    relationship_status: "active" | "inactive" | "transferred";
    registration_source: "clinic_admin" | "mobile_app" | "walk_in";
    created_at: string;
  };
 * Supports mobile app registration and clinic-specific relationships
 */

import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import type { Database } from "../types/database";
import type { AddressFormData } from "../validation/AddressValidation";

type PatientProfile = Database["public"]["Tables"]["patient_profiles"]["Row"];
type ClinicPatient = Database["public"]["Tables"]["clinic_patients"]["Row"];

export interface CreatePatientProfileData {
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other"; // lowercase to match DB
  primary_address?: AddressFormData;
  emergency_contact?: string; // Simple phone number string
  medical_notes?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[]; // DB has this field
  previous_surgeries?: string[]; // DB has this field
  family_history?: string; // DB has this field
  blood_group?: string;
  aadhar_number?: string;
}

export interface UpdatePatientProfileData {
  full_name?: string;
  phone?: string;
  email?: string;
  date_of_birth?: string;
  gender?: "male" | "female" | "other";
  primary_address?: AddressFormData;
  emergency_contact?: string; // Simple phone number string
  medical_notes?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  previous_surgeries?: string[];
  family_history?: string;
  blood_group?: string;
  aadhar_number?: string;
}

export interface PatientProfileWithClinic {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  primary_address?: AddressFormData;
  emergency_contact?: string | null; // Simple phone number string or null
  medical_notes?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  medications?: string[];
  previous_surgeries?: string[];
  family_history?: string;
  blood_group?: string;
  aadhar_number?: string;
  created_at: string;
  updated_at: string;

  // Clinic relationship info
  clinic_patient?: {
    id: string;
    clinic_id: string;
    status: "active" | "inactive" | "dormant";
    registration_source: "mobile_app" | "clinic_admin" | "walk_in";
    created_at: string;
  };
}

export class PatientProfileService extends BaseService {
  /**
   * Find or create a patient profile by phone number
   * Used for mobile app registration and walk-in patients
   */
  static async findOrCreatePatientProfile(
    profileData: CreatePatientProfileData
  ): Promise<ServiceResponse<PatientProfile>> {
    try {
      this.validateRequired({
        full_name: profileData.full_name, // Use full_name instead of name
        phone: profileData.phone,
      });

      // First try to find existing profile by phone (handle errors gracefully)
      const { data: existingProfile } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("phone", profileData.phone)
        .maybeSingle(); // Use maybeSingle to avoid errors when not found

      if (existingProfile) {
        return { data: existingProfile, success: true };
      }

      // Create new profile if not found
      const user = await this.getCurrentUser();
      console.log("Service getCurrentUser result:", user.id);

      const insertData = {
        full_name: profileData.full_name,
        phone: profileData.phone,
        email: profileData.email,
        date_of_birth: profileData.date_of_birth,
        gender:
          profileData.gender && profileData.gender.trim()
            ? profileData.gender.toLowerCase() // Keep lowercase as per database types
            : null,
        primary_address: profileData.primary_address,
        emergency_contact: profileData.emergency_contact,
        medical_notes: profileData.medical_notes,
        allergies: profileData.allergies,
        chronic_conditions: profileData.chronic_conditions,
        medications: profileData.medications,
        previous_surgeries: profileData.previous_surgeries,
        family_history: profileData.family_history,
        blood_group: profileData.blood_group,
        aadhar_number: profileData.aadhar_number,
        // Ensure required fields have defaults
        onboarding_completed: false,
        preferred_language: "en",
        profile_verified: false,
        user_id: null, // Patient doesn't have a user account yet
        created_by: user.id, // Add the creator's ID for RLS policy
      };

      console.log("About to insert patient profile:", insertData);

      const { data: newProfile, error } = await supabase
        .from("patient_profiles")
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;

      return { data: newProfile, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Link a patient profile to a clinic
   * Creates the clinic_patients relationship
   */
  static async linkPatientToClinic(
    patientProfileId: string,
    registrationSource:
      | "mobile_app"
      | "clinic_admin"
      | "walk_in" = "clinic_admin"
  ): Promise<ServiceResponse<ClinicPatient>> {
    try {
      const user = await this.getCurrentUser();

      // Check if relationship already exists
      const { data: existingLink } = await supabase
        .from("clinic_patients")
        .select("*")
        .eq("patient_profile_id", patientProfileId)
        .eq("clinic_id", user.id)
        .maybeSingle();

      if (existingLink) {
        return { data: existingLink, success: true };
      }

      // Create new clinic-patient relationship
      const { data: clinicPatient, error } = await supabase
        .from("clinic_patients")
        .insert({
          patient_profile_id: patientProfileId,
          clinic_id: user.id,
          relationship_status:
            registrationSource === "walk_in" ? "inactive" : "active", // Use relationship_status not status
          registration_source: registrationSource, // ✅ Track how patient was added
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      return { data: clinicPatient, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get all patients for current clinic with their profiles
   */
  static async getClinicPatients(filters?: {
    status?: "active" | "inactive" | "dormant";
    searchTerm?: string;
  }): Promise<ServiceResponse<PatientProfileWithClinic[]>> {
    try {
      const user = await this.getCurrentUser();

      let query = supabase
        .from("clinic_patients")
        .select(
          `
          *,
          patient_profiles!patient_profile_id(*)
        `
        )
        .eq("clinic_id", user.id);

      if (filters?.status) {
        query = query.eq("relationship_status", filters.status);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      // Transform and filter data
      let patients: PatientProfileWithClinic[] = (data || []).map(
        (cp: any) => ({
          ...cp.patient_profiles,
          clinic_patient: {
            id: cp.id,
            clinic_id: cp.clinic_id,
            relationship_status: cp.relationship_status,
            registration_source: cp.registration_source,
            created_at: cp.created_at,
          },
        })
      );

      // Apply search filter
      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        patients = patients.filter(
          (patient) =>
            patient.full_name?.toLowerCase().includes(searchLower) ||
            patient.phone?.includes(filters.searchTerm || "") ||
            patient.email?.toLowerCase().includes(searchLower)
        );
      }

      return { data: patients, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get patient profile by ID with clinic relationship
   */
  static async getPatientById(
    patientProfileId: string
  ): Promise<ServiceResponse<PatientProfileWithClinic>> {
    try {
      const user = await this.getCurrentUser();

      const { data, error } = await supabase
        .from("patient_profiles")
        .select(
          `
          *,
          clinic_patients!inner(
            id,
            clinic_id,
            relationship_status,
            registration_source,
            created_at
          )
        `
        )
        .eq("id", patientProfileId)
        .eq("clinic_patients.clinic_id", user.id)
        .single();

      if (error) throw error;

      const patient: PatientProfileWithClinic = {
        ...(data as any),
        clinic_patient: Array.isArray((data as any).clinic_patients)
          ? (data as any).clinic_patients[0]
          : (data as any).clinic_patients,
      };

      return { data: patient, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update patient profile
   */
  static async updatePatientProfile(
    patientProfileId: string,
    updateData: UpdatePatientProfileData
  ): Promise<ServiceResponse<PatientProfile>> {
    try {
      // Map gender to database format (keep lowercase)
      const mappedUpdateData = {
        ...updateData,
        gender: updateData.gender
          ? updateData.gender.toLowerCase() // Keep lowercase as per database types
          : updateData.gender,
      };

      const { data, error } = await (supabase
        .from("patient_profiles")
        .update({
          ...mappedUpdateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientProfileId)
        .select()
        .single() as any);

      if (error) throw error;

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Delete a patient from the clinic (removes the clinic-patient relationship)
   * This will unlink the patient from the clinic but keep their profile
   */
  static async deletePatientFromClinic(
    patientProfileId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const user = await this.getCurrentUser();

      // Delete the clinic-patient relationship
      const { error } = await supabase
        .from("clinic_patients")
        .delete()
        .eq("patient_profile_id", patientProfileId)
        .eq("clinic_id", user.id);

      if (error) throw error;

      return { data: true, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update clinic-patient relationship status
   */
  static async updateClinicPatientStatus(
    clinicPatientId: string,
    status: "active" | "inactive" | "dormant"
  ): Promise<ServiceResponse<ClinicPatient>> {
    try {
      const user = await this.getCurrentUser();

      const { data, error } = await (supabase
        .from("clinic_patients")
        .update({
          relationship_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clinicPatientId)
        .eq("clinic_id", user.id)
        .select()
        .single() as any);

      if (error) throw error;

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Create a new patient (combines profile creation and clinic linking)
   * Used by clinic admin to add new patients
   */
  static async createPatient(
    profileData: CreatePatientProfileData,
    registrationSource:
      | "clinic_admin"
      | "mobile_app"
      | "walk_in" = "clinic_admin"
  ): Promise<ServiceResponse<PatientProfileWithClinic>> {
    try {
      // First create or find the patient profile
      const profileResult = await this.findOrCreatePatientProfile(profileData);
      if (!profileResult.success || !profileResult.data) {
        return { error: profileResult.error, success: false };
      }

      // Then link to clinic
      const linkResult = await this.linkPatientToClinic(
        profileResult.data.id,
        registrationSource
      );
      if (!linkResult.success || !linkResult.data) {
        return { error: linkResult.error, success: false };
      }

      // Return full patient data
      const patientResult = await this.getPatientById(profileResult.data.id);
      return patientResult;
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Search patients by phone number across all profiles
   * Used for linking existing patients to new clinics
   */
  static async searchPatientsByPhone(
    phone: string
  ): Promise<ServiceResponse<PatientProfile[]>> {
    try {
      const { data, error } = await supabase
        .from("patient_profiles")
        .select("*")
        .ilike("phone", `%${phone}%`)
        .limit(10);

      if (error) throw error;

      return { data: data || [], success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }
}
