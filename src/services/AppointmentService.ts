/**
 * Appointment Service
 * Handles all appointment-related database operations
 * Updated for Global Identity System - uses clinic_patients and clinic_doctors
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import { AppointmentStatus, ERROR_MESSAGES } from "../constants";
import { Database } from "../types/database";
import { ClinicProfileService } from "./ClinicProfileService";
import { WhatsAppService } from "./WhatsAppService";
import {
  convertUTCToISTTime24,
  extractISTDateForInput,
} from "../utils/timezoneUtils";

export type AppointmentWithRelations = {
  id: string;
  user_id: string;
  clinic_patient_id: string;
  clinic_doctor_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  status: string;
  appointment_type?: string;
  delay_minutes?: number;
  notes?: string;
  symptoms?: string;
  diagnosis?: string;
  prescription?: string;
  queue_position?: number;
  estimated_start_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  patient_checked_in?: boolean;
  checked_in_at?: string;
  emergency_status?: boolean;
  emergency_reason?: string;
  consultation_fee?: number;
  doctor_slot_id?: string; // CHANGED: Added slot reference
  slot_booking_order?: number; // CHANGED: Added slot position
  created_at: string;
  updated_at: string;

  // Joined relations
  clinic_patient?: {
    id: string;
    patient_profile_id: string;
    clinic_id: string;
    patient_profile: {
      id: string;
      full_name: string;
      phone: string;
      email?: string;
    };
  };
  clinic_doctor?: {
    id: string;
    doctor_profile_id: string;
    clinic_id: string;
    role_in_clinic: string;
    consultation_fee?: number;
    doctor_profile: {
      id: string;
      full_name: string;
      phone: string;
      primary_specialization: string;
    };
  };
  // CHANGED: Added slot information
  doctor_slot?: {
    id: string;
    slot_name: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_bookings: number;
  };
};

export interface CreateAppointmentData {
  clinic_patient_id: string;
  clinic_doctor_id: string;
  doctor_slot_id: string; // CHANGED: Now required for slot-based booking
  appointment_datetime: string; // CHANGED: Now derived from slot
  slot_booking_order?: number; // CHANGED: Position in slot queue
  treatment_type?: string; // DEPRECATED: Use appointment_type instead
  description?: string; // DEPRECATED: Use notes instead
  duration_minutes?: number; // CHANGED: Now derived from slot duration
  estimated_duration?: number; // DEPRECATED: For backward compatibility
  appointment_type?: string;
  notes?: string;
  symptoms?: string;
  emergency_status?: boolean;
  emergency_reason?: string;
  priority?: number;
  service_day?: string; // DEPRECATED: For queue management
}

export interface UpdateAppointmentData {
  status?: AppointmentStatus;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  patient_checked_in?: boolean;
  checked_in_at?: string;
  appointment_datetime?: string; // CHANGED: Allow updating appointment time
  doctor_slot_id?: string; // CHANGED: Allow rescheduling to different slot
  slot_booking_order?: number; // CHANGED: Update queue position
  service_day?: string; // DEPRECATED: For queue management
  delay_minutes?: number | null; // Allow clearing delay
  delay_reason?: string | null; // Allow clearing delay reason
  is_rescheduled?: boolean; // Mark appointment as rescheduled
}

export class AppointmentService extends BaseService {
  static async getAppointments(filters?: {
    clinicDoctorId?: string; // CHANGED: from doctorId
    clinicPatientId?: string; // CHANGED: from patientId
    doctorSlotId?: string; // CHANGED: Added slot filtering
    date?: string;
    status?: AppointmentStatus;
    searchTerm?: string;
  }): Promise<ServiceResponse<AppointmentWithRelations[]>> {
    try {
      const user = await this.getCurrentUser();

      const clinicRes = await ClinicProfileService.getClinicProfile(user.id);
      const clinicId = clinicRes?.data?.id;

      let query = supabase.from("appointments").select(
        `
          *,
          clinic_patient:clinic_patients(
            *,
            patient_profile:patient_profiles(
              id, full_name, phone, email
            )
          ),
          clinic_doctor:clinic_doctors(
            *,
            doctor_profile:doctor_profiles(
              id, full_name, phone, primary_specialization
            )
          ),
          doctor_slot:doctor_slots(
            id, slot_name, slot_date, start_time, end_time, max_capacity, current_bookings, slot_type
          )
        `
      );

      if (clinicId) {
        // Fetch clinic doctor and patient ids first, then query appointments
        const { data: clinicDoctors } = await supabase
          .from("clinic_doctors")
          .select("id")
          .eq("clinic_id", clinicId);

        const { data: clinicPatients } = await supabase
          .from("clinic_patients")
          .select("id")
          .eq("clinic_id", clinicId);

        const doctorIds = (clinicDoctors || []).map((d: any) => d.id);
        const patientIds = (clinicPatients || []).map((p: any) => p.id);

        let results: any[] = [];

        if (doctorIds.length > 0) {
          const { data: byDoctor } = await query
            .in("clinic_doctor_id", doctorIds)
            .order("created_at", { ascending: false })
            .order("emergency_status", { ascending: false })
            .order("queue_position", { ascending: true, nullsFirst: true })
            .order("appointment_datetime", { ascending: true });
          results = results.concat(byDoctor || []);
        }

        if (patientIds.length > 0) {
          const { data: byPatient } = await query
            .in("clinic_patient_id", patientIds)
            .order("created_at", { ascending: false })
            .order("emergency_status", { ascending: false })
            .order("queue_position", { ascending: true, nullsFirst: true })
            .order("appointment_datetime", { ascending: true });
          results = results.concat(byPatient || []);
        }

        // merge/dedupe by id
        const merged: any[] = [];
        const seen = new Set();
        for (const appt of results) {
          if (!seen.has(appt.id)) {
            seen.add(appt.id);
            merged.push(appt);
          }
        }

        // apply client-side filters (date/status/searchTerm) on merged results
        let filteredData = merged;
        if (filters?.date) {
          const startOfDay = `${filters.date}T00:00:00.000Z`;
          const endOfDay = `${filters.date}T23:59:59.999Z`;
          filteredData = filteredData.filter(
            (a) =>
              a.appointment_datetime >= startOfDay &&
              a.appointment_datetime <= endOfDay
          );
        }

        if (filters?.status) {
          filteredData = filteredData.filter(
            (a) => a.status === filters.status
          );
        }

        if (filters?.doctorSlotId) {
          filteredData = filteredData.filter(
            (a) => a.doctor_slot_id === filters.doctorSlotId
          );
        }

        if (filters?.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          filteredData = filteredData.filter(
            (appointment: AppointmentWithRelations) =>
              appointment.clinic_patient?.patient_profile?.full_name
                ?.toLowerCase()
                .includes(searchLower) ||
              appointment.clinic_doctor?.doctor_profile?.full_name
                ?.toLowerCase()
                .includes(searchLower) ||
              appointment.clinic_patient?.patient_profile?.phone?.includes(
                filters.searchTerm || ""
              ) ||
              appointment.id.toString().includes(filters.searchTerm || "")
          );
        }

        // sort merged results with latest created first, then same as normal query
        filteredData.sort((a: any, b: any) => {
          // First sort by creation time (latest first)
          const createdTimeA = new Date(a.created_at).getTime();
          const createdTimeB = new Date(b.created_at).getTime();
          if (createdTimeA !== createdTimeB) {
            return createdTimeB - createdTimeA; // Latest first
          }

          // Then by emergency status
          if (a.emergency_status === b.emergency_status) {
            if (a.queue_position == null && b.queue_position != null) return 1;
            if (a.queue_position != null && b.queue_position == null) return -1;
            if (a.queue_position !== b.queue_position)
              return (a.queue_position || 0) - (b.queue_position || 0);
            return (
              new Date(a.appointment_datetime).getTime() -
              new Date(b.appointment_datetime).getTime()
            );
          }
          return (b.emergency_status ? 1 : 0) - (a.emergency_status ? 1 : 0);
        });

        return { data: filteredData, success: true };
      } else {
        query = query.eq("user_id", user.id);
      }

      // Apply filters
      if (filters?.clinicDoctorId) {
        query = query.eq("clinic_doctor_id", filters.clinicDoctorId);
      }

      if (filters?.clinicPatientId) {
        query = query.eq("clinic_patient_id", filters.clinicPatientId);
      }

      if (filters?.date) {
        const startOfDay = `${filters.date}T00:00:00.000Z`;
        const endOfDay = `${filters.date}T23:59:59.999Z`;
        query = query
          .gte("appointment_datetime", startOfDay)
          .lte("appointment_datetime", endOfDay);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      // Order by latest created first, then emergency status, then queue position
      query = query
        .order("created_at", { ascending: false }) // Latest created appointments first
        .order("emergency_status", { ascending: false }) // Emergency appointments first
        .order("queue_position", { ascending: true, nullsFirst: true }) // Then by queue position
        .order("appointment_datetime", { ascending: true }); // Finally by time

      const { data, error } = await query;

      if (error) throw error;

      // Apply search filter client-side for patient/doctor names and phone numbers
      let filteredData = data || [];
      if (filters?.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          (appointment: AppointmentWithRelations) =>
            appointment.clinic_patient?.patient_profile?.full_name
              ?.toLowerCase()
              .includes(searchLower) ||
            appointment.clinic_doctor?.doctor_profile?.full_name
              ?.toLowerCase()
              .includes(searchLower) ||
            appointment.clinic_patient?.patient_profile?.phone?.includes(
              filters.searchTerm || ""
            ) ||
            appointment.id.toString().includes(filters.searchTerm || "")
        );
      }

      return { data: filteredData, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async getAppointmentById(
    id: string
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    try {
      const user = await this.getCurrentUser();

      const clinicRes = await ClinicProfileService.getClinicProfile(user.id);
      const clinicId = clinicRes?.data?.id;

      const baseQuery = supabase.from("appointments").select(
        `
          *,
          clinic_patient:clinic_patients(
            *,
            patient_profile:patient_profiles(
              id, full_name, phone, email
            )
          ),
          clinic_doctor:clinic_doctors(
            *,
            doctor_profile:doctor_profiles(
              id, full_name, phone, primary_specialization
            )
          ),
          doctor_slot:doctor_slots(
            id, slot_name, slot_date, start_time, end_time, max_capacity, current_bookings
          )
        `
      );
      const result = await baseQuery.eq("id", id).single();
      const { data, error } = result;

      if (error) throw error;

      // If clinic context exists, ensure appointment belongs to clinic
      if (clinicId) {
        const belongsToClinic =
          (data as any)?.clinic_doctor?.clinic_id === clinicId ||
          (data as any)?.clinic_patient?.clinic_id === clinicId;
        if (!belongsToClinic) {
          throw new Error("Appointment not found for this clinic");
        }
      } else {
        // fallback ownership check
        if ((data as any)?.user_id !== user.id) {
          throw new Error("Appointment not found");
        }
      }

      if (error) throw error;

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async createAppointment(
    appointmentData: CreateAppointmentData
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    try {
      const user = await this.getCurrentUser();

      this.validateRequired({
        clinic_patient_id: appointmentData.clinic_patient_id,
        clinic_doctor_id: appointmentData.clinic_doctor_id,
        doctor_slot_id: appointmentData.doctor_slot_id,
        appointment_datetime: appointmentData.appointment_datetime,
      });

      // Insert appointment and return only the new id to avoid complex
      // combined insert+select queries that may trigger DB-side objects
      type AppointmentInsert =
        Database["public"]["Tables"]["appointments"]["Insert"];

      const insertPayload: AppointmentInsert = {
        user_id: user.id,
        clinic_patient_id: appointmentData.clinic_patient_id,
        clinic_doctor_id: appointmentData.clinic_doctor_id,
        doctor_slot_id: appointmentData.doctor_slot_id,
        slot_booking_order: appointmentData.slot_booking_order,
        appointment_datetime: appointmentData.appointment_datetime,
        appointment_type:
          appointmentData.appointment_type || appointmentData.treatment_type,
        notes: appointmentData.notes || appointmentData.description,
        symptoms: appointmentData.symptoms,
        status: AppointmentStatus.SCHEDULED,
        emergency_status: appointmentData.emergency_status ?? false,
        duration_minutes: appointmentData.duration_minutes ?? 30,
      };

      // Get consultation fee from clinic_doctors and store it in appointment
      try {
        const { data: clinicDoctorRow } = await supabase
          .from("clinic_doctors")
          .select("consultation_fee")
          .eq("id", appointmentData.clinic_doctor_id)
          .single();

        const consultationFee = (clinicDoctorRow as any)?.consultation_fee;

        if (typeof consultationFee === "number" && consultationFee >= 0) {
          (insertPayload as any).consultation_fee = consultationFee;
        }
      } catch (feeErr) {
        // Not critical: if fee lookup fails, continue without consultation_fee
        console.warn("Failed to get consultation fee:", feeErr);
      }

      // Primary attempt: insert + return id (minimal select)
      let newId: string | undefined;
      try {
        const insertRes = await supabase
          .from("appointments")
          .insert(insertPayload as any)
          .select("id")
          .single();

        // debug log to capture full server response
        // eslint-disable-next-line no-console
        console.debug("Appointment insert response:", insertRes);

        if (insertRes.error) throw insertRes.error;

        newId = (insertRes.data as { id: string } | null)?.id;
      } catch (insertErr: any) {
        // eslint-disable-next-line no-console
        console.warn(
          "Primary insert failed, attempting safe fallback:",
          insertErr
        );

        // Fallback: try minimal insert then locate created row by matching unique fields
        try {
          const minimalRes = await supabase
            .from("appointments")
            .insert(insertPayload as any);

          // debug log the minimal response
          // eslint-disable-next-line no-console
          console.debug("Minimal insert response:", minimalRes);

          if (minimalRes.error) throw minimalRes.error;

          // Try to locate the created row by matching unique-ish fields
          const { data: foundRows, error: findError } = await supabase
            .from("appointments")
            .select(
              `
              *,
              clinic_patient:clinic_patients(
                *,
                patient_profile:patient_profiles(id, full_name, phone, email)
              ),
              clinic_doctor:clinic_doctors(
                *,
                doctor_profile:doctor_profiles(id, full_name, phone, primary_specialization)
              )
            `
            )
            .eq("user_id", user.id)
            .eq("clinic_doctor_id", appointmentData.clinic_doctor_id)
            .eq("clinic_patient_id", appointmentData.clinic_patient_id)
            .eq("appointment_datetime", appointmentData.appointment_datetime)
            .order("created_at", { ascending: false })
            .limit(1);

          // debug
          // eslint-disable-next-line no-console
          console.debug("Find after minimal insert:", { foundRows, findError });

          if (findError) throw findError;
          if (
            !foundRows ||
            (Array.isArray(foundRows) && foundRows.length === 0)
          ) {
            throw new Error(
              "Inserted appointment not found after minimal insert"
            );
          }

          // derive id from found row
          const found = Array.isArray(foundRows)
            ? foundRows[0]
            : (foundRows as any);
          newId = found?.id;
        } catch (fallbackErr: any) {
          // eslint-disable-next-line no-console
          console.error("Fallback insert failed:", fallbackErr);
          // rethrow original error for upstream handling
          throw insertErr;
        }
      }

      if (!newId) {
        throw new Error("Failed to create appointment (no id)");
      }

      // Queue recalculation is handled automatically by database trigger
      // No need to manually enqueue jobs here

      // Sync slot booking count after creating appointment
      if (appointmentData.doctor_slot_id) {
        await this.syncSlotBookingCount(appointmentData.doctor_slot_id);
      }

      // Fetch full appointment with relations using the existing helper
      const fetched = await this.getAppointmentById(newId);

      if (!fetched.data) {
        throw new Error("Failed to fetch created appointment");
      }

      return { data: fetched.data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async updateAppointment(
    id: string,
    updateData: UpdateAppointmentData
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    try {
      const user = await this.getCurrentUser();

      // Get current appointment to check ownership and get service details
      const { data: currentAppt, error: fetchError } = await supabase
        .from("appointments")
        .select(
          `
          *,
          clinic_doctor:clinic_doctors!clinic_doctor_id(clinic_id)
        `
        )
        .eq("id", id)
        .single();

      if (fetchError || !currentAppt) {
        console.error("Error fetching appointment:", fetchError);
        throw new Error(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      // Check ownership - appointment belongs to user's clinic
      const appointmentClinicId = (currentAppt as any)?.clinic_doctor
        ?.clinic_id;
      if (appointmentClinicId !== user.id) {
        throw new Error("You don't have permission to update this appointment");
      }

      // Update appointment
      const updateObject = {
        ...updateData,
        updated_at: new Date().toISOString(),
      } as any;

      const { data, error } = await (supabase
        .from("appointments")
        .update(updateObject)
        .eq("id", id)
        .select(
          `
          *,
          clinic_patient:clinic_patients(
            *,
            patient_profile:patient_profiles(
              id, full_name, phone, email
            )
          ),
          clinic_doctor:clinic_doctors(
            *,
            doctor_profile:doctor_profiles(
              id, full_name, phone, primary_specialization
            )
          ),
          doctor_slot:doctor_slots(*)
        `
        )
        .single() as any);

      if (error) throw error;

      // Sync slot booking count after updating appointment (in case status changed)
      if (data.doctor_slot_id) {
        await this.syncSlotBookingCount(data.doctor_slot_id);
      }

      // Queue recalculation is now handled automatically by database trigger
      // when status changes to completed/cancelled/no-show
      // No need to manually enqueue jobs here

      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async deleteAppointment(id: string): Promise<ServiceResponse<void>> {
    try {
      const user = await this.getCurrentUser();

      // Get appointment details before deletion to check ownership AND for WhatsApp notification
      const { data: appointment } = await supabase
        .from("appointments")
        .select(
          `
          *,
          clinic_doctor:clinic_doctors!clinic_doctor_id(clinic_id),
          clinic_patient:clinic_patients!clinic_patient_id(
            patient_profile:patient_profiles(full_name, phone)
          ),
          doctor_details:clinic_doctors!clinic_doctor_id(
            doctor_profile:doctor_profiles(full_name)
          )
        `
        )
        .eq("id", id)
        .single();

      if (!appointment) {
        throw new Error(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      // Check ownership via clinic
      const appointmentClinicId = (appointment as any)?.clinic_doctor
        ?.clinic_id;
      if (appointmentClinicId !== user.id) {
        throw new Error("You don't have permission to delete this appointment");
      }

      // Extract patient info for WhatsApp before deletion
      const patientPhone = (appointment as any)?.clinic_patient?.patient_profile
        ?.phone;
      const patientName =
        (appointment as any)?.clinic_patient?.patient_profile?.full_name ||
        "Patient";
      const appointmentDatetime = (appointment as any)?.appointment_datetime;

      // Get slot_id before deletion for sync
      const slotId = (appointment as any)?.doctor_slot_id;

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Sync slot booking count after deletion
      if (slotId) {
        await this.syncSlotBookingCount(slotId);
      }

      // Send WhatsApp cancellation notification
      if (patientPhone && appointmentDatetime) {
        try {
          const appointmentDate = extractISTDateForInput(appointmentDatetime);
          const appointmentTime = convertUTCToISTTime24(appointmentDatetime);

          await WhatsAppService.sendAppointmentCancelled({
            phone: patientPhone,
            patientName: patientName,
            appointmentDate: appointmentDate,
            appointmentTime: appointmentTime,
          });

          console.log("✅ WhatsApp cancellation sent to:", patientPhone);
        } catch (whatsappError) {
          console.error("WhatsApp notification failed:", whatsappError);
          // Don't fail the deletion if WhatsApp fails
        }
      }

      // Queue recalculation is handled automatically by database trigger
      // No need to manually enqueue jobs here

      return { success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async checkInPatient(
    appointmentId: string
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    return this.updateAppointment(appointmentId, {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
      status: AppointmentStatus.CHECKED_IN,
    });
  }

  static async startAppointment(
    appointmentId: string
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.IN_PROGRESS,
      actual_start_time: new Date().toISOString(),
    });
  }

  static async completeAppointment(
    appointmentId: string,
    data: { diagnosis?: string; prescription?: string }
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.COMPLETED,
      actual_end_time: new Date().toISOString(),
      ...data,
    });
  }

  static async rescheduleAppointment(
    appointmentId: string,
    newDateTime: string,
    newServiceDay: string
  ): Promise<ServiceResponse<AppointmentWithRelations>> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.RESCHEDULED,
      appointment_datetime: newDateTime,
      service_day: newServiceDay,
    });
  }

  /**
   * Sync the current_bookings field in doctor_slots with actual active bookings
   */
  private static async syncSlotBookingCount(slotId: string): Promise<void> {
    try {
      // Count active appointments for this slot
      const { count: activeAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_slot_id", slotId)
        .in("status", ["scheduled", "checked-in", "in-progress"]);

      // Get the slot details to know the doctor and date range
      const { data: slot } = await supabase
        .from("doctor_slots")
        .select("slot_date, start_time, end_time, clinic_doctor_id")
        .eq("id", slotId)
        .single();

      if (!slot) {
        console.error(`Slot ${slotId} not found`);
        return;
      }

      // Count pending requests for this doctor on this date within this time range
      const slotStart = `${slot.slot_date}T${slot.start_time}`;
      const slotEnd = `${slot.slot_date}T${slot.end_time}`;

      const { data: allPendingRequests } = await supabase
        .from("appointment_requests")
        .select("requested_datetime")
        .eq("doctor_id", slot.clinic_doctor_id)
        .eq("status", "pending");

      // Filter pending requests that fall within this slot's time range
      const pendingRequestsInSlot =
        allPendingRequests?.filter((req) => {
          const reqTime = new Date(req.requested_datetime);
          const reqTimeString = reqTime.toISOString();
          const slotStartTime = new Date(slotStart).toISOString();
          const slotEndTime = new Date(slotEnd).toISOString();
          return reqTimeString >= slotStartTime && reqTimeString <= slotEndTime;
        }).length || 0;

      const actualBookings = (activeAppointments || 0) + pendingRequestsInSlot;

      // Update the slot's current_bookings field
      await supabase
        .from("doctor_slots")
        .update({
          current_bookings: actualBookings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slotId);

      console.log(
        `✅ Synced slot ${slotId} booking count to ${actualBookings} (${activeAppointments} active + ${pendingRequestsInSlot} pending)`
      );
    } catch (error) {
      console.error("Error syncing slot booking count:", error);
    }
  }

  /**
   * Manually sync all slot booking counts (useful for fixing existing data)
   */
  static async syncAllSlotBookingCounts(): Promise<void> {
    try {
      const user = await this.getCurrentUser();

      // Get all clinic doctors for this clinic first
      const { data: clinicDoctors } = await supabase
        .from("clinic_doctors")
        .select("id")
        .eq("clinic_id", user.id);

      if (!clinicDoctors || clinicDoctors.length === 0) {
        console.log("No doctors found for this clinic");
        return;
      }

      const doctorIds = clinicDoctors.map((d: any) => d.id);

      // Get all active slots for these doctors
      const { data: slots } = await supabase
        .from("doctor_slots")
        .select("id")
        .eq("is_active", true)
        .in("clinic_doctor_id", doctorIds);

      if (slots) {
        console.log(`🔄 Syncing ${slots.length} slots...`);

        for (const slot of slots) {
          await this.syncSlotBookingCount((slot as any).id);
        }

        console.log("✅ All slot booking counts synced!");
      }
    } catch (error: any) {
      console.error("Error syncing all slot booking counts:", error);
    }
  }
}
