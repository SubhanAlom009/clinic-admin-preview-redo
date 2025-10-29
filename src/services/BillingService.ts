/**
 * Billing Service
 * Handles all billing and payment-related database operations
 * Updated for Global Identity System - uses clinic_patients for bill relationships
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";

export type BillData = {
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

  // Joined relations
  clinic_patient?: {
    id: string;
    patient_profile_id: string;
    clinic_id: string;
    patient_profile?: {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
    };
  } | null;
};

export class BillingService extends BaseService {
  /**
   * Get all bills for the current clinic
   */
  static async getBills(): Promise<ServiceResponse<BillData[]>> {
    try {
      const user = await this.getCurrentUser();

      // Get clinic profile to find clinic_id
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        throw new Error("No clinic profile found");
      }

      const { data, error } = await supabase
        .from("bills")
        .select(
          `
          *,
          clinic_patient:clinic_patients!inner(
            id,
            patient_profile_id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          )
        `
        )
        .eq("clinic_patient.clinic_id", clinicProfile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        data: (data as BillData[]) || [],
        success: true,
      };
    } catch (error) {
      return {
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Get payment history for the current clinic (bills with payment_date)
   */
  static async getPaymentHistory(): Promise<ServiceResponse<BillData[]>> {
    try {
      const user = await this.getCurrentUser();

      // Get clinic profile to find clinic_id
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        throw new Error("No clinic profile found");
      }

      const { data, error } = await supabase
        .from("bills")
        .select(
          `
          *,
          clinic_patient:clinic_patients!inner(
            id,
            patient_profile_id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          )
        `
        )
        .eq("clinic_patient.clinic_id", clinicProfile.id)
        .not("payment_date", "is", null)
        .order("payment_date", { ascending: false });

      if (error) throw error;

      return {
        data: (data as BillData[]) || [],
        success: true,
      };
    } catch (error) {
      return {
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Get a specific bill by ID
   */
  static async getBillById(billId: string): Promise<ServiceResponse<BillData>> {
    try {
      const user = await this.getCurrentUser();

      // Get clinic profile to find clinic_id
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        throw new Error("No clinic profile found");
      }

      const { data, error } = await supabase
        .from("bills")
        .select(
          `
          *,
          clinic_patient:clinic_patients!inner(
            id,
            patient_profile_id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          )
        `
        )
        .eq("id", billId)
        .eq("clinic_patient.clinic_id", clinicProfile.id)
        .single();

      if (error) throw error;

      return {
        data: data as BillData,
        success: true,
      };
    } catch (error) {
      return {
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Get bills by status
   */
  static async getBillsByStatus(
    status: string
  ): Promise<ServiceResponse<BillData[]>> {
    try {
      const user = await this.getCurrentUser();

      // Get clinic profile to find clinic_id
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        throw new Error("No clinic profile found");
      }

      const { data, error } = await supabase
        .from("bills")
        .select(
          `
          *,
          clinic_patient:clinic_patients!inner(
            id,
            patient_profile_id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          )
        `
        )
        .eq("clinic_patient.clinic_id", clinicProfile.id)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        data: (data as BillData[]) || [],
        success: true,
      };
    } catch (error) {
      return {
        error: this.handleError(error),
        success: false,
      };
    }
  }

  /**
   * Get bills for a specific patient
   */
  static async getBillsByPatient(
    clinicPatientId: string
  ): Promise<ServiceResponse<BillData[]>> {
    try {
      const user = await this.getCurrentUser();

      // Get clinic profile to find clinic_id
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        throw new Error("No clinic profile found");
      }

      const { data, error } = await supabase
        .from("bills")
        .select(
          `
          *,
          clinic_patient:clinic_patients!inner(
            id,
            patient_profile_id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          )
        `
        )
        .eq("clinic_patient.clinic_id", clinicProfile.id)
        .eq("clinic_patient_id", clinicPatientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        data: (data as BillData[]) || [],
        success: true,
      };
    } catch (error) {
      return {
        error: this.handleError(error),
        success: false,
      };
    }
  }
}
