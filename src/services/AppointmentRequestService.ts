/**
 * Appointment Request Service
 * Handles patient appointment requests that require admin approval
 */
import { supabase } from "../lib/supabase";
import { combineLocalDateTimeToIso } from "../lib/utils";
import { BaseService, ServiceResponse } from "./BaseService";
import {
  convertUTCToISTTime24,
  extractISTDateForInput,
} from "../utils/timezoneUtils";

export interface AppointmentRequest {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  clinic_id: string;
  doctor_id: string;
  doctor_slot_id?: string;
  requested_datetime: string;
  assigned_appointment_time?: string; // Auto-calculated specific appointment time
  request_order?: number; // 0-based order within the slot
  requested_duration?: number;
  appointment_type: string;
  priority: "normal" | "high" | "urgent";
  symptoms?: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string;
  processed_by?: string;
  processed_at?: string;
  appointment_id?: string;
  created_at: string;
  updated_at: string;

  // Relations
  clinic_doctor?: {
    id: string;
    doctor_profile?: {
      full_name: string;
      primary_specialization: string;
    };
  };
  doctor_slot?: {
    id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_bookings: number;
    slot_date: string;
  };
}

export interface GetRequestsFilters {
  status?: string;
  searchTerm?: string;
  doctorId?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class AppointmentRequestService extends BaseService {
  static async getAppointmentRequests(
    filters: GetRequestsFilters = {}
  ): Promise<ServiceResponse<AppointmentRequest[]>> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return { error: new Error("User not authenticated"), success: false };
      }

      // Build query with filters
      let query = supabase
        .from("appointment_requests")
        .select(
          `
          *,
          clinic_doctor:clinic_doctors!doctor_id (
            id,
            doctor_profile:doctor_profiles (
              full_name,
              primary_specialization
            )
          ),
          doctor_slot:doctor_slots!doctor_slot_id (
            id,
            slot_name,
            start_time,
            end_time,
            max_capacity,
            current_bookings,
            slot_date
          )
        `
        )
        .eq("clinic_id", user.id);

      // Apply status filter
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      // Apply date filters
      if (filters.dateFrom) {
        query = query.gte("requested_datetime", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("requested_datetime", filters.dateTo);
      }

      // Apply doctor filter
      if (filters.doctorId) {
        query = query.eq("doctor_id", filters.doctorId);
      }

      // Apply priority filter
      if (filters.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }

      // Order by creation date (newest first)
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching appointment requests:", error);
        return {
          error: new Error("Failed to fetch appointment requests"),
          success: false,
        };
      }

      // Apply search filter on client side for better performance with text fields
      let filteredData = data || [];
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          (req) =>
            req.patient_name?.toLowerCase().includes(searchLower) ||
            req.patient_phone?.includes(filters.searchTerm || "") ||
            req.appointment_type?.toLowerCase().includes(searchLower) ||
            req.clinic_doctor?.doctor_profile?.full_name
              ?.toLowerCase()
              .includes(searchLower)
        );
      }

      return { data: filteredData, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async approveRequest(
    requestId: string
  ): Promise<ServiceResponse<null>> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return { error: new Error("User not authenticated"), success: false };
      }

      // Get the appointment request details with slot information
      const { data: request, error: requestError } = await supabase
        .from("appointment_requests")
        .select(
          `
          *,
          doctor_slot:doctor_slots(*)
        `
        )
        .eq("id", requestId)
        .eq("clinic_id", user.id)
        .single();

      if (requestError || !request) {
        return {
          error: new Error("Appointment request not found"),
          success: false,
        };
      }

      // Type assertion for request object
      const requestData = request as any;

      if (requestData.status !== "pending") {
        return {
          error: new Error("Request has already been processed"),
          success: false,
        };
      }

      // Validate that appointment time exists in requested_datetime
      if (!requestData.requested_datetime) {
        return {
          error: new Error("No appointment time assigned to this request"),
          success: false,
        };
      }

      // ==========================================
      // 🆕 IMPROVED PATIENT PROFILE LOOKUP & CREATION
      // ==========================================

      console.log("🔍 DEBUG: Request patient data:", {
        name: requestData.patient_name,
        phone: requestData.patient_phone,
        email: requestData.patient_email,
      });

      // Validate required fields from request
      if (!requestData.patient_phone && !requestData.patient_email) {
        console.error("❌ Missing patient contact information");
        return {
          error: new Error("Patient phone or email is required"),
          success: false,
        };
      }

      if (!requestData.patient_name || requestData.patient_name.trim() === "") {
        console.error("❌ Missing patient name");
        return {
          error: new Error("Patient name is required"),
          success: false,
        };
      }

      // Try to find existing patient profile by phone OR email
      let patientProfile: { id: string; user_id?: string } | null = null;

      // Strategy 1: Search by phone (most reliable identifier)
      if (
        requestData.patient_phone &&
        requestData.patient_phone.trim() !== ""
      ) {
        console.log(
          "🔍 Searching for patient by phone:",
          requestData.patient_phone
        );

        const { data, error: phoneError } = await supabase
          .from("patient_profiles")
          .select("id, user_id, full_name, phone, email")
          .eq("phone", requestData.patient_phone.trim())
          .maybeSingle(); // ✅ Use maybeSingle() instead of single()

        if (phoneError) {
          console.error("❌ Phone lookup error:", phoneError);
        } else if (data) {
          patientProfile = data;
          console.log("✅ Found patient by phone:", {
            id: data.id,
            name: data.full_name,
            has_user_id: !!data.user_id,
          });
        } else {
          console.log(
            "ℹ️ No patient found with phone:",
            requestData.patient_phone
          );
        }
      }

      // Strategy 2: If not found by phone, try by email
      if (
        !patientProfile &&
        requestData.patient_email &&
        requestData.patient_email.trim() !== ""
      ) {
        console.log(
          "🔍 Searching for patient by email:",
          requestData.patient_email
        );

        const { data, error: emailError } = await supabase
          .from("patient_profiles")
          .select("id, user_id, full_name, phone, email")
          .eq("email", requestData.patient_email.trim())
          .maybeSingle();

        if (emailError) {
          console.error("❌ Email lookup error:", emailError);
        } else if (data) {
          patientProfile = data;
          console.log("✅ Found patient by email:", {
            id: data.id,
            name: data.full_name,
            has_user_id: !!data.user_id,
          });
        } else {
          console.log(
            "ℹ️ No patient found with email:",
            requestData.patient_email
          );
        }
      }

      // Strategy 3: Create new patient profile if not found
      if (!patientProfile) {
        console.log("📝 Patient profile not found. Creating new profile...");

        // Validate required fields for creation
        if (
          !requestData.patient_phone ||
          requestData.patient_phone.trim() === ""
        ) {
          return {
            error: new Error(
              "Patient phone number is required to create a new profile"
            ),
            success: false,
          };
        }

        const newProfileData = {
          full_name: requestData.patient_name.trim(),
          phone: requestData.patient_phone.trim(),
          email: requestData.patient_email?.trim() || null,
          // ✅ DON'T set created_by - leave it NULL for walk-in/app patients
          // ✅ DON'T set user_id - will be linked when patient signs up in app
          profile_verified: false,
          onboarding_completed: false,
        };

        console.log("🔍 Creating patient profile with data:", newProfileData);

        const { data: newPatientProfile, error: createProfileError } =
          await supabase
            .from("patient_profiles")
            .insert(newProfileData)
            .select("id, user_id, full_name, phone, email")
            .single();

        if (createProfileError) {
          console.error(
            "❌ Failed to create patient profile:",
            createProfileError
          );
          console.error("❌ Error code:", createProfileError.code);
          console.error("❌ Error message:", createProfileError.message);
          console.error("❌ Error details:", createProfileError.details);

          // Handle specific errors
          if (createProfileError.code === "23505") {
            // Unique constraint violation - profile might exist
            return {
              error: new Error(
                "A patient with this phone number or email already exists"
              ),
              success: false,
            };
          }

          return {
            error: new Error(
              `Failed to create patient profile: ${createProfileError.message}`
            ),
            success: false,
          };
        }

        if (!newPatientProfile) {
          console.error("❌ No data returned after patient profile creation");
          return {
            error: new Error(
              "Failed to create patient profile - no data returned"
            ),
            success: false,
          };
        }

        patientProfile = newPatientProfile;
        console.log("✅ Created new patient profile:", {
          id: patientProfile.id,
          name: newPatientProfile.full_name,
        });
      } else {
        console.log("✅ Using existing patient profile:", {
          id: patientProfile.id,
        });
      }

      // ==========================================
      // CHECK/CREATE CLINIC_PATIENT RECORD
      // ==========================================

      console.log("🔍 Checking for clinic_patient record:", {
        patient_profile_id: patientProfile.id,
        clinic_id: user.id,
      });

      let { data: clinicPatient, error: clinicPatientFetchError } =
        await supabase
          .from("clinic_patients")
          .select("id")
          .eq("patient_profile_id", patientProfile.id)
          .eq("clinic_id", user.id)
          .maybeSingle();

      if (clinicPatientFetchError) {
        console.error(
          "❌ Clinic patient fetch error:",
          clinicPatientFetchError
        );
        return {
          error: new Error(
            `Failed to check clinic patient record: ${clinicPatientFetchError.message}`
          ),
          success: false,
        };
      }

      if (!clinicPatient) {
        console.log("📝 Clinic patient record not found. Creating...");

        const clinicPatientData = {
          clinic_id: user.id,
          patient_profile_id: patientProfile.id,
          registration_source: "mobile_app" as const,
          relationship_status: "active" as const,
          first_visit_date: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD
          created_by: user.id, // Clinic admin who approved the request
        };

        console.log("🔍 Creating clinic_patient with data:", clinicPatientData);

        const { data: newClinicPatient, error: createError } = await supabase
          .from("clinic_patients")
          .insert(clinicPatientData)
          .select("id")
          .single();

        if (createError) {
          console.error(
            "❌ Failed to create clinic patient record:",
            createError
          );
          console.error("❌ Error code:", createError.code);
          console.error("❌ Error message:", createError.message);

          if (createError.code === "23505") {
            // Unique constraint violation - record might already exist
            // Try to fetch it again
            const { data: existingRecord } = await supabase
              .from("clinic_patients")
              .select("id")
              .eq("patient_profile_id", patientProfile.id)
              .eq("clinic_id", user.id)
              .maybeSingle();

            if (existingRecord) {
              clinicPatient = existingRecord;
              console.log(
                "✅ Found existing clinic_patient record after conflict:",
                clinicPatient.id
              );
            } else {
              return {
                error: new Error(
                  "Clinic patient record conflict - please try again"
                ),
                success: false,
              };
            }
          } else {
            return {
              error: new Error(
                `Failed to create clinic patient record: ${createError.message}`
              ),
              success: false,
            };
          }
        } else if (!newClinicPatient) {
          console.error("❌ No data returned after clinic patient creation");
          return {
            error: new Error(
              "Failed to create clinic patient record - no data returned"
            ),
            success: false,
          };
        } else {
          clinicPatient = newClinicPatient;
          console.log("✅ Created clinic patient record:", clinicPatient.id);
        }
      } else {
        console.log(
          "✅ Using existing clinic patient record:",
          clinicPatient.id
        );
      }

      // Find the slot based on the requested datetime and doctor
      // Convert UTC datetime from database to IST for proper slot comparison
      const requestedDateString = extractISTDateForInput(
        requestData.requested_datetime
      );
      const requestedTimeString = convertUTCToISTTime24(
        requestData.requested_datetime
      );

      // Get all slots for this doctor on the requested date
      const { data: doctorSlots, error: slotsError } = await supabase
        .from("doctor_slots")
        .select("*")
        .eq("clinic_doctor_id", requestData.doctor_id)
        .eq("slot_date", requestedDateString)
        .eq("is_active", true);

      if (slotsError || !doctorSlots || doctorSlots.length === 0) {
        return {
          error: new Error(
            "No active slots found for this doctor on the requested date"
          ),
          success: false,
        };
      }

      // Find the slot that contains the requested time
      console.log("🔍 Slot validation debug (FIXED):", {
        originalUTC: requestData.requested_datetime,
        convertedISTDate: requestedDateString,
        convertedISTTime: requestedTimeString,
        availableSlots: doctorSlots.map((slot: any) => ({
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          slot_name: slot.slot_name,
        })),
      });

      const requestedSlot = doctorSlots.find((slot: any) => {
        // Normalize time formats - remove seconds if present
        const slotStart = slot.start_time.slice(0, 5); // HH:MM
        const slotEnd = slot.end_time.slice(0, 5); // HH:MM
        const requestedTime = requestedTimeString.slice(0, 5); // HH:MM

        const isWithinSlot =
          requestedTime >= slotStart && requestedTime <= slotEnd;

        console.log(
          `🔍 Checking slot ${slot.slot_name}: ${slotStart}-${slotEnd}, requested IST: ${requestedTime}, within: ${isWithinSlot}`
        );
        console.log("🔍 Detailed comparison:", {
          originalSlotStart: slot.start_time,
          originalSlotEnd: slot.end_time,
          normalizedSlotStart: slotStart,
          normalizedSlotEnd: slotEnd,
          originalRequestedTime: requestedTimeString,
          normalizedRequestedTime: requestedTime,
          comparison1: `${requestedTime} >= ${slotStart} = ${
            requestedTime >= slotStart
          }`,
          comparison2: `${requestedTime} <= ${slotEnd} = ${
            requestedTime <= slotEnd
          }`,
          finalResult: isWithinSlot,
        });

        return isWithinSlot;
      });

      if (!requestedSlot) {
        return {
          error: new Error(
            "Requested time does not fall within any available slot"
          ),
          success: false,
        };
      }

      // Check capacity in real-time instead of relying on current_bookings field
      // Count active appointments for this slot
      const { count: activeAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_slot_id", (requestedSlot as any).id)
        .in("status", ["scheduled", "checked-in", "in-progress"]);

      // Count pending requests for this slot (excluding the current request being approved)
      const slotStart = combineLocalDateTimeToIso(
        requestedDateString,
        (requestedSlot as any).start_time
      );
      const slotEnd = combineLocalDateTimeToIso(
        requestedDateString,
        (requestedSlot as any).end_time
      );

      const { data: allPendingRequests } = await supabase
        .from("appointment_requests")
        .select("id, requested_datetime")
        .eq("doctor_id", requestData.doctor_id)
        .eq("status", "pending")
        .neq("id", requestId); // Exclude current request

      // Filter pending requests that fall within this slot's time range
      const pendingRequestsInSlot =
        allPendingRequests?.filter((req) => {
          const reqTime = new Date(req.requested_datetime).toISOString();
          return reqTime >= slotStart && reqTime <= slotEnd;
        }).length || 0;

      const totalBookings = (activeAppointments || 0) + pendingRequestsInSlot;

      console.log(`📊 Slot capacity check:`, {
        slotId: (requestedSlot as any).id,
        maxCapacity: (requestedSlot as any).max_capacity,
        activeAppointments: activeAppointments || 0,
        pendingRequests: pendingRequestsInSlot,
        totalBookings,
        hasCapacity: totalBookings < (requestedSlot as any).max_capacity,
      });

      // Check if slot has capacity (excluding the current request being approved)
      if (totalBookings >= (requestedSlot as any).max_capacity) {
        return {
          error: new Error(
            `Slot is at full capacity (${totalBookings}/${
              (requestedSlot as any).max_capacity
            })`
          ),
          success: false,
        };
      }

      // Prevent conflicts: ensure the requested exact time is not already booked
      const requestedIso = new Date(
        requestData.requested_datetime
      ).toISOString();
      const { data: existingAtTime } = await supabase
        .from("appointments")
        .select("id, appointment_datetime")
        .eq("doctor_slot_id", (requestedSlot as any).id)
        .eq("status", "scheduled");

      const conflict = (existingAtTime || []).some(
        (apt: any) =>
          new Date(apt.appointment_datetime).toISOString() === requestedIso
      );

      if (conflict) {
        return {
          error: new Error(
            "Requested time has already been booked. Please reject or choose a different time."
          ),
          success: false,
        };
      }

      // Create the appointment using the requested datetime
      const appointmentData = {
        user_id: user.id,
        clinic_patient_id: clinicPatient!.id,
        clinic_doctor_id: requestData.doctor_id,
        doctor_slot_id: (requestedSlot as any).id,
        appointment_datetime: requestData.requested_datetime, // Use the requested datetime which has the assigned time
        duration_minutes: 30, // Default duration
        status: "scheduled" as const,
        appointment_type: requestData.appointment_type,
        notes: requestData.notes || "",
        symptoms: requestData.symptoms || "",
      };

      console.log("🔍 Appointment data being inserted:", appointmentData);
      console.log("🔍 Request data:", requestData);
      console.log("🔍 Requested slot:", requestedSlot);

      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert(appointmentData as any)
        .select()
        .single();

      if (appointmentError) {
        console.error("❌ Appointment creation error:", appointmentError);
        console.error(
          "❌ Error details:",
          JSON.stringify(appointmentError, null, 2)
        );
      }

      if (appointmentError || !appointment) {
        return {
          error: new Error("Failed to create appointment"),
          success: false,
        };
      }

      // Note: Slot capacity was already incremented when the request was created
      // No need to increment again here

      // Update the request status
      const { error: updateError } = await supabase
        .from("appointment_requests")
        .update({
          status: "approved",
          processed_by: user.id,
          processed_at: new Date().toISOString(),
          appointment_id: (appointment as any).id,
        } as any)
        .eq("id", requestId);

      if (updateError) {
        return {
          error: new Error("Failed to update request status"),
          success: false,
        };
      }

      // Sync the slot booking count after approval
      await this.syncSlotBookingCount((requestedSlot as any).id);

      return { success: true, data: null };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async rejectRequest(
    requestId: string,
    reason: string
  ): Promise<ServiceResponse<null>> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return { error: new Error("User not authenticated"), success: false };
      }

      // Get the request details first to handle slot capacity
      const { data: request, error: requestError } = await supabase
        .from("appointment_requests")
        .select("*")
        .eq("id", requestId)
        .eq("clinic_id", user.id)
        .single();

      if (requestError || !request) {
        return {
          error: new Error("Request not found"),
          success: false,
        };
      }

      // Update the request status to rejected
      const { error: updateError } = await supabase
        .from("appointment_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        } as any)
        .eq("id", requestId)
        .eq("clinic_id", user.id);

      if (updateError) {
        return {
          error: new Error("Failed to reject appointment request"),
          success: false,
        };
      }

      // Find and sync the slot that this request was for
      // We need to find the slot based on the requested datetime and doctor
      const requestedDate = new Date((request as any).requested_datetime);
      const requestedDateString = requestedDate.toISOString().split("T")[0];
      const requestedTimeString = requestedDate.toTimeString().slice(0, 5);

      const { data: doctorSlots } = await supabase
        .from("doctor_slots")
        .select("id, start_time, end_time")
        .eq("clinic_doctor_id", (request as any).doctor_id)
        .eq("slot_date", requestedDateString)
        .eq("is_active", true);

      const affectedSlot = doctorSlots?.find((slot: any) => {
        return (
          requestedTimeString >= slot.start_time &&
          requestedTimeString <= slot.end_time
        );
      });

      if (affectedSlot) {
        // Sync the slot booking count after rejection
        await this.syncSlotBookingCount(affectedSlot.id);
      }

      return { success: true, data: null };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Recalculate appointment times for pending requests after a rejection
   */
  private static async recalculatePendingRequestTimes(
    slotId: string,
    rejectedOrder: number
  ): Promise<void> {
    try {
      // Get all pending requests for this slot with order > rejectedOrder
      const { data: pendingRequests, error } = await supabase
        .from("appointment_requests")
        .select("*")
        .eq("doctor_slot_id", slotId)
        .eq("status", "pending")
        .gt("request_order", rejectedOrder)
        .order("request_order", { ascending: true });

      if (error || !pendingRequests) {
        console.error(
          "Error fetching pending requests for recalculation:",
          error
        );
        return;
      }

      // Get slot details for time calculation
      const { data: slot, error: slotError } = await supabase
        .from("doctor_slots")
        .select("start_time, slot_date")
        .eq("id", slotId)
        .single();

      if (slotError || !slot) {
        console.error("Error fetching slot details:", slotError);
        return;
      }

      // Recalculate times for each pending request
      for (let i = 0; i < pendingRequests.length; i++) {
        const request = pendingRequests[i];
        const newOrder = rejectedOrder + i; // Shift order down by 1
        const intervalMinutes = 40; // 30min consult + 10min gap
        const offsetMinutes = newOrder * intervalMinutes;

        const slotStartDateTime = new Date(
          `${(slot as any).slot_date}T${(slot as any).start_time}:00`
        );
        slotStartDateTime.setMinutes(
          slotStartDateTime.getMinutes() + offsetMinutes
        );
        const newAssignedTime = slotStartDateTime.toISOString();

        // Update the request with new order and time
        await supabase
          .from("appointment_requests")
          .update({
            request_order: newOrder,
            assigned_appointment_time: newAssignedTime,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", (request as any).id);
      }
    } catch (error) {
      console.error("Error recalculating pending request times:", error);
    }
  }

  /**
   * Recalculate appointment times for all pending requests in a slot (gap-filling)
   */
  private static async recalculateAllPendingRequestTimes(
    slotId: string
  ): Promise<void> {
    try {
      // Get slot details
      const { data: slot, error: slotError } = await supabase
        .from("doctor_slots")
        .select("*")
        .eq("id", slotId)
        .single();

      if (slotError || !slot) {
        console.error("Failed to fetch slot details:", slotError);
        return;
      }

      // Get all existing appointments for this slot
      const { data: existingAppointments, error: appointmentsError } =
        await supabase
          .from("appointments")
          .select("appointment_datetime, slot_booking_order")
          .eq("doctor_slot_id", slotId)
          .eq("status", "scheduled")
          .order("slot_booking_order", { ascending: true });

      if (appointmentsError) {
        console.error(
          "Failed to fetch existing appointments:",
          appointmentsError
        );
        return;
      }

      // Get all pending requests for this slot
      const { data: pendingRequests, error: requestsError } = await supabase
        .from("appointment_requests")
        .select("*")
        .eq("doctor_slot_id", slotId)
        .eq("status", "pending")
        .order("created_at", { ascending: true }); // Order by creation time for fairness

      if (requestsError) {
        console.error("Failed to fetch pending requests:", requestsError);
        return;
      }

      if (!pendingRequests || pendingRequests.length === 0) {
        return; // No pending requests to recalculate
      }

      // Collect all occupied times
      const occupiedTimes = new Set();

      // Add existing appointments
      existingAppointments?.forEach((apt) => {
        const aptTime = new Date(apt.appointment_datetime);
        occupiedTimes.add(aptTime.getTime());
      });

      // Find available time slots
      const intervalMinutes = 40;
      const slotStartDateTime = new Date(
        `${(slot as any).slot_date}T${(slot as any).start_time}:00`
      );
      const slotEndDateTime = new Date(
        `${(slot as any).slot_date}T${(slot as any).end_time}:00`
      );

      const availableSlots: Date[] = [];

      for (let i = 0; i < (slot as any).max_capacity; i++) {
        const candidateTime = new Date(slotStartDateTime);
        candidateTime.setMinutes(
          candidateTime.getMinutes() + i * intervalMinutes
        );

        if (
          !occupiedTimes.has(candidateTime.getTime()) &&
          candidateTime < slotEndDateTime
        ) {
          availableSlots.push(candidateTime);
        }
      }

      // Assign available slots to pending requests
      for (
        let i = 0;
        i < pendingRequests.length && i < availableSlots.length;
        i++
      ) {
        const request = pendingRequests[i];
        const assignedTime = availableSlots[i].toISOString();
        const requestOrder = i;

        // Update the request with new order and time
        await supabase
          .from("appointment_requests")
          .update({
            request_order: requestOrder,
            assigned_appointment_time: assignedTime,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", (request as any).id);
      }
    } catch (error) {
      console.error("Error recalculating pending request times:", error);
    }
  }

  /**
   * Sync the current_bookings field in doctor_slots with actual active bookings
   */
  private static async syncSlotBookingCount(slotId: string): Promise<void> {
    try {
      // Get the slot details to know the date and time range
      const { data: slot } = await supabase
        .from("doctor_slots")
        .select("slot_date, start_time, end_time, clinic_doctor_id")
        .eq("id", slotId)
        .single();

      if (!slot) {
        console.error(`Slot ${slotId} not found`);
        return;
      }

      // Count active appointments for this slot
      const { count: activeAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_slot_id", slotId)
        .in("status", ["scheduled", "checked-in", "in-progress"]);

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

  static async getPendingRequestsCount(): Promise<number> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("appointment_requests")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", user.id)
        .eq("status", "pending");

      if (error) {
        console.error("Error getting pending requests count:", error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error("Error in getPendingRequestsCount:", error);
      return 0;
    }
  }
}
