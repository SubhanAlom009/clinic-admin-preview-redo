/**
 * ClinicProfileService
 * Handles clinic profile management operations using the Global Identity System
 */

import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import type { Database } from "../types/database";

type ClinicProfile = Database["public"]["Tables"]["clinic_profiles"]["Row"];
type CreateClinicProfileData =
  Database["public"]["Tables"]["clinic_profiles"]["Insert"];
type UpdateClinicProfileData =
  Database["public"]["Tables"]["clinic_profiles"]["Update"];

export interface ClinicProfileWithAuth extends ClinicProfile {
  // Additional fields for authentication context
  user_id: string;
}

export class ClinicProfileService extends BaseService {
  /**
   * Get clinic profile by ID
   */
  static async getClinicProfile(
    clinicId: string
  ): Promise<ServiceResponse<ClinicProfile>> {
    try {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .select("*")
        .eq("id", clinicId)
        .single();

      if (error) {
        console.error("Error fetching clinic profile:", error);
        return {
          data: undefined,
          error: this.handleError(error),
          success: false,
        };
      }

      return {
        data,
        error: undefined,
        success: true,
      };
    } catch (error) {
      console.error("Service error in getClinicProfile:", error);
      return {
        data: undefined,
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Update clinic profile
   */
  static async updateClinicProfile(
    clinicId: string,
    updateData: UpdateClinicProfileData
  ): Promise<ServiceResponse<ClinicProfile>> {
    try {
      const dataWithTimestamp = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("clinic_profiles")
        .update(dataWithTimestamp)
        .eq("id", clinicId)
        .select("*")
        .single();

      if (error) {
        console.error("Error updating clinic profile:", error);
        return {
          data: undefined,
          error: this.handleError(error),
          success: false,
        };
      }

      return {
        data,
        error: undefined,
        success: true,
      };
    } catch (error) {
      console.error("Service error in updateClinicProfile:", error);
      return {
        data: undefined,
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Create new clinic profile
   */
  static async createClinicProfile(
    profileData: CreateClinicProfileData
  ): Promise<ServiceResponse<ClinicProfile>> {
    try {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .insert(profileData)
        .select("*")
        .single();

      if (error) {
        console.error("Error creating clinic profile:", error);
        return {
          data: undefined,
          error: this.handleError(error),
          success: false,
        };
      }

      return {
        data,
        error: undefined,
        success: true,
      };
    } catch (error) {
      console.error("Service error in createClinicProfile:", error);
      return {
        data: undefined,
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Upload clinic logo to storage
   */
  static async uploadClinicLogo(
    clinicId: string,
    logoFile: File
  ): Promise<ServiceResponse<{ path: string; publicUrl: string }>> {
    try {
      const fileExt = logoFile.name.split(".").pop();
      const timestamp = Date.now();
      const fileName = `clinic_${clinicId}_logo_${timestamp}.${fileExt}`;

      // Upload to clinic-logos bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("clinic-logos")
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) {
        console.error("Error uploading clinic logo:", uploadError);
        return {
          data: undefined,
          error: this.handleError(uploadError),
          success: false,
        };
      }

      if (!uploadData?.path) {
        return {
          data: undefined,
          error: this.handleError(
            new Error("Upload completed but no path returned")
          ),
          success: false,
        };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("clinic-logos")
        .getPublicUrl(uploadData.path);

      return {
        data: {
          path: uploadData.path,
          publicUrl: urlData.publicUrl,
        },
        error: undefined,
        success: true,
      };
    } catch (error) {
      console.error("Service error in uploadClinicLogo:", error);
      return {
        data: undefined,
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Delete clinic logo from storage
   */
  static async deleteClinicLogo(
    logoPath: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { error } = await supabase.storage
        .from("clinic-logos")
        .remove([logoPath]);

      if (error) {
        console.error("Error deleting clinic logo:", error);
        return {
          data: false,
          error: this.handleError(error),
          success: false,
        };
      }

      return {
        data: true,
        error: undefined,
        success: true,
      };
    } catch (error) {
      console.error("Service error in deleteClinicLogo:", error);
      return {
        data: false,
        error: this.handleError(error),
        success: false,
      };
    }
  }
}

export type { ClinicProfile, CreateClinicProfileData, UpdateClinicProfileData };
