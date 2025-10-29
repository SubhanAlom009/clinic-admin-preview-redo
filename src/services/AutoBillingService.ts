/**
 * Auto Billing Service
 * Handles automatic bill generation when appointments are completed
 */
import { supabase } from "../lib/supabase";
import { BaseService } from "./BaseService";
import { NotificationService } from "./NotificationService";

export class AutoBillingService extends BaseService {
  /**
   * Auto-generate bill when appointment is completed
   */
  static async autoGenerateBill(appointmentId: string): Promise<void> {
    try {
      console.log("Auto-generating bill for appointment:", appointmentId);

      // Get appointment details
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select(`
          *,
          clinic_patient:clinic_patients(
            id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          ),
          clinic_doctor:clinic_doctors(
            id,
            consultation_fee,
            doctor_profile:doctor_profiles(
              id,
              full_name
            )
          )
        `)
        .eq("id", appointmentId)
        .single();

      if (appointmentError || !appointment) {
        console.error("Failed to fetch appointment:", appointmentError);
        return;
      }

      // Check if bill already exists
      const { data: existingBill } = await supabase
        .from("bills")
        .select("id")
        .eq("appointment_id", appointmentId)
        .single();

      if (existingBill) {
        console.log("Bill already exists for appointment:", appointmentId);
        return;
      }

      // Get current user (clinic admin)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated");
        return;
      }

      // Generate bill number
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      const billNumber = `INV-${year}${month}${day}-${random}`;

      // Get consultation fee (from appointment or doctor profile)
      const consultationFee = appointment.consultation_fee || 
                            appointment.clinic_doctor?.consultation_fee || 
                            0;

      if (consultationFee <= 0) {
        console.log("No consultation fee found, skipping auto-generation");
        return;
      }

      // Create auto-generated bill
      const billData = {
        user_id: user.id,
        appointment_id: appointmentId,
        clinic_patient_id: appointment.clinic_patient_id,
        bill_number: billNumber,
        amount: consultationFee,
        tax_amount: 0,
        total_amount: consultationFee,
        status: 'pending',
        notes: `Auto-generated bill for consultation with Dr. ${appointment.clinic_doctor?.doctor_profile?.full_name}`,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
      };

      console.log("Creating auto-generated bill:", billData);

      const { data: billResult, error: billError } = await (supabase as any)
        .from("bills")
        .insert(billData)
        .select()
        .single();

      if (billError) {
        console.error("Failed to create auto-generated bill:", billError);
        return;
      }

      console.log("Auto-generated bill created successfully:", billResult);

      // Send email notification to patient about bill generation
      try {
        if (appointment.clinic_patient?.patient_profile?.id) {
          // Get clinic details for notification
          const { data: clinicProfile } = await supabase
            .from("clinic_profiles")
            .select("clinic_name")
            .eq("id", user.id)
            .single();

          await NotificationService.sendBillingNotification(
            appointment.clinic_patient.patient_profile.id,
            'generated',
            {
              billNumber: billNumber,
              totalAmount: consultationFee,
              dueDate: billData.due_date,
              clinicName: clinicProfile?.clinic_name || 'Clinic',
              services: ['Consultation']
            }
          );
          console.log('Bill generation notification sent successfully');
        }
      } catch (notificationError) {
        console.error('Failed to send bill generation notification:', notificationError);
        // Don't fail the bill generation if notification fails
      }

    } catch (error) {
      console.error("Error in auto-generating bill:", error);
    }
  }

  /**
   * Check and auto-generate bills for recently completed appointments
   */
  static async processRecentCompletedAppointments(): Promise<void> {
    try {
      const user = await this.getCurrentUser();

      // Get recently completed appointments without bills
      const { data: appointments, error } = await supabase
        .from("appointments")
        .select(`
          id,
          status,
          consultation_fee,
          clinic_patient_id,
          clinic_doctor:clinic_doctors(consultation_fee)
        `)
        .eq("status", "completed")
        .gte("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .is("bills.id", null); // No existing bills

      if (error || !appointments) {
        console.error("Failed to fetch completed appointments:", error);
        return;
      }

      console.log(`Found ${appointments.length} completed appointments without bills`);

      // Auto-generate bills for each appointment
      for (const appointment of appointments) {
        await this.autoGenerateBill(appointment.id);
        
        // Add small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error("Error processing recent completed appointments:", error);
    }
  }
}
