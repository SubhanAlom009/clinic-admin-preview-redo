/**
 * Review Service
 * Handles fetching patient reviews/feedback for doctors
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";

export interface PatientReview {
    id: string;
    patient_rating: number;
    patient_feedback: string;
    appointment_datetime: string;
    patient_name?: string;
    appointment_type?: string;
}

export class ReviewService extends BaseService {
    /**
     * Get all reviews for a specific clinic doctor
     */
    static async getDoctorReviews(
        clinicDoctorId: string,
        limit: number = 20
    ): Promise<ServiceResponse<PatientReview[]>> {
        try {
            const { data, error } = await supabase
                .from("appointments")
                .select(
                    `
          id,
          patient_rating,
          patient_feedback,
          appointment_datetime,
          appointment_type,
          clinic_patient:clinic_patients(
            patient_profile:patient_profiles(
              full_name
            )
          )
        `
                )
                .eq("clinic_doctor_id", clinicDoctorId)
                .not("patient_feedback", "is", null)
                .order("appointment_datetime", { ascending: false })
                .limit(limit);

            if (error) throw error;

            // Map data to include patient name
            const reviews: PatientReview[] = (data || []).map((item: any) => ({
                id: item.id,
                patient_rating: item.patient_rating,
                patient_feedback: item.patient_feedback,
                appointment_datetime: item.appointment_datetime,
                appointment_type: item.appointment_type,
                patient_name: item.clinic_patient?.patient_profile?.full_name || "Anonymous",
            }));

            return { data: reviews, success: true };
        } catch (error) {
            return { error: this.handleError(error), success: false };
        }
    }
}
