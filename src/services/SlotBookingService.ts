/**
 * Slot Booking Service
 * Handles appointment booking within time slots
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import { AppointmentService, CreateAppointmentData } from "./AppointmentService";
import { combineLocalDateTimeToIso } from "../lib/utils";
import { Database } from "../types/database";

type SlotBooking = Database["public"]["Tables"]["slot_bookings"]["Row"];
type SlotBookingInsert = Database["public"]["Tables"]["slot_bookings"]["Insert"];

export interface AppointmentWithSlot {
  id: string;
  clinic_patient_id: string;
  clinic_doctor_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  status: string;
  appointment_type?: string;
  notes?: string;
  symptoms?: string;
  doctor_slot_id: string;
  slot_booking_order: number;
  created_at: string;
  updated_at: string;
  
  // Slot information
  slot_info: {
    id: string;
    slot_name: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_bookings: number;
  };
  
  // Patient and doctor info
  clinic_patient?: {
    id: string;
    patient_profile: {
      id: string;
      full_name: string;
      phone: string;
      email?: string;
    };
  };
  clinic_doctor?: {
    id: string;
    doctor_profile: {
      id: string;
      full_name: string;
      primary_specialization: string;
    };
  };
}

export interface SlotQueueItem {
  booking_order: number;
  appointment: {
    id: string;
    status: string;
    appointment_datetime: string;
    queue_position?: number;
    clinic_patient: {
      patient_profile: {
        full_name: string;
        phone: string;
      };
    };
  };
}

export class SlotBookingService extends BaseService {
  /**
   * Book an appointment in a specific slot
   */
  static async bookSlot(
    slotId: string,
    appointmentData: CreateAppointmentData
  ): Promise<ServiceResponse<AppointmentWithSlot>> {
    try {
      this.validateRequired({ slotId, appointmentData });

      // Get slot information and validate capacity
      const { data: slot, error: slotError } = await supabase
        .from("doctor_slots")
        .select("*")
        .eq("id", slotId)
        .eq("is_active", true)
        .single();

      if (slotError || !slot) {
        throw new Error("Slot not found or inactive");
      }

      // Check slot capacity
      if (slot.current_bookings >= slot.max_capacity) {
        throw new Error("Slot is full. Please choose another slot.");
      }

      // Check if slot date is in the future
      const slotDate = new Date(slot.slot_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (slotDate < today) {
        throw new Error("Cannot book appointments in past slots");
      }

      // Get next booking order
      const { data: lastBooking, error: bookingError } = await supabase
        .from("slot_bookings")
        .select("booking_order")
        .eq("doctor_slot_id", slotId)
        .order("booking_order", { ascending: false })
        .limit(1);

      if (bookingError) throw bookingError;

      const nextOrder = (lastBooking?.[0]?.booking_order || 0) + 1;

      // Create appointment with slot information
      const appointmentResult = await AppointmentService.createAppointment({
        ...appointmentData,
        doctor_slot_id: slotId,
        slot_booking_order: nextOrder,
        appointment_datetime: combineLocalDateTimeToIso(slot.slot_date, slot.start_time),
        duration_minutes: this.calculateSlotDuration(slot.start_time, slot.end_time),
      });

      if (!appointmentResult.success || !appointmentResult.data) {
        throw new Error(appointmentResult.error?.message || "Failed to create appointment");
      }

      // Create slot booking record
      const { error: slotBookingError } = await supabase
        .from("slot_bookings")
        .insert({
          doctor_slot_id: slotId,
          appointment_id: appointmentResult.data.id,
          booking_order: nextOrder,
        });

      if (slotBookingError) throw slotBookingError;

      // Return appointment with slot information
      const appointmentWithSlot: AppointmentWithSlot = {
        ...appointmentResult.data,
        doctor_slot_id: slotId,
        slot_booking_order: nextOrder,
        slot_info: {
          id: slot.id,
          slot_name: slot.slot_name,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          max_capacity: slot.max_capacity,
          current_bookings: slot.current_bookings + 1,
        },
      };

      return { data: appointmentWithSlot, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get queue for a specific slot
   */
  static async getSlotQueue(slotId: string): Promise<ServiceResponse<SlotQueueItem[]>> {
    try {
      this.validateRequired({ slotId });

      const { data, error } = await supabase
        .from("slot_bookings")
        .select(`
          booking_order,
          appointment:appointments!inner(
            id,
            status,
            appointment_datetime,
            queue_position,
            clinic_patient:clinic_patients!inner(
              patient_profile:patient_profiles!inner(
                full_name,
                phone
              )
            )
          )
        `)
        .eq("doctor_slot_id", slotId)
        .order("booking_order", { ascending: true });

      if (error) throw error;

      return { data: data || [], success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Cancel a slot booking
   */
  static async cancelSlotBooking(appointmentId: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ appointmentId });

      // Get slot booking information
      const { data: slotBooking, error: bookingError } = await supabase
        .from("slot_bookings")
        .select(`
          doctor_slot_id,
          booking_order,
          doctor_slots!inner(
            clinic_doctors!inner(
              clinic_id
            )
          )
        `)
        .eq("appointment_id", appointmentId)
        .single();

      if (bookingError || !slotBooking) {
        throw new Error("Slot booking not found");
      }

      // Check if user has access to this clinic
      const user = await this.getCurrentUser();
      if (slotBooking.doctor_slots.clinic_doctors.clinic_id !== user.id) {
        throw new Error("Access denied");
      }

      // Delete the slot booking record (this will trigger the capacity update)
      const { error: deleteError } = await supabase
        .from("slot_bookings")
        .delete()
        .eq("appointment_id", appointmentId);

      if (deleteError) throw deleteError;

      // Update appointment status to cancelled
      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          updated_at: new Date().toISOString()
        })
        .eq("id", appointmentId);

      if (appointmentError) throw appointmentError;

      return { data: true, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Reschedule appointment to a different slot
   */
  static async rescheduleToSlot(
    appointmentId: string,
    newSlotId: string
  ): Promise<ServiceResponse<AppointmentWithSlot>> {
    try {
      this.validateRequired({ appointmentId, newSlotId });

      // Get current slot booking
      const { data: currentBooking, error: currentError } = await supabase
        .from("slot_bookings")
        .select(`
          doctor_slot_id,
          booking_order,
          doctor_slots!inner(
            clinic_doctors!inner(
              clinic_id
            )
          )
        `)
        .eq("appointment_id", appointmentId)
        .single();

      if (currentError || !currentBooking) {
        throw new Error("Current slot booking not found");
      }

      // Check if user has access
      const user = await this.getCurrentUser();
      if (currentBooking.doctor_slots.clinic_doctors.clinic_id !== user.id) {
        throw new Error("Access denied");
      }

      // Get new slot information
      const { data: newSlot, error: slotError } = await supabase
        .from("doctor_slots")
        .select(`
          *,
          clinic_doctors!inner(
            clinic_id
          )
        `)
        .eq("id", newSlotId)
        .eq("is_active", true)
        .single();

      if (slotError || !newSlot) {
        throw new Error("New slot not found or inactive");
      }

      // Check if new slot belongs to same clinic
      if (newSlot.clinic_doctors.clinic_id !== user.id) {
        throw new Error("New slot access denied");
      }

      // Check new slot capacity
      if (newSlot.current_bookings >= newSlot.max_capacity) {
        throw new Error("New slot is full");
      }

      // Get next booking order for new slot
      const { data: lastBooking, error: bookingError } = await supabase
        .from("slot_bookings")
        .select("booking_order")
        .eq("doctor_slot_id", newSlotId)
        .order("booking_order", { ascending: false })
        .limit(1);

      if (bookingError) throw bookingError;

      const nextOrder = (lastBooking?.[0]?.booking_order || 0) + 1;

      // Start transaction-like operations
      // 1. Delete old slot booking
      const { error: deleteError } = await supabase
        .from("slot_bookings")
        .delete()
        .eq("appointment_id", appointmentId);

      if (deleteError) throw deleteError;

      // 2. Update appointment
      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({
          doctor_slot_id: newSlotId,
          slot_booking_order: nextOrder,
          appointment_datetime: combineLocalDateTimeToIso(
            newSlot.slot_date,
            newSlot.start_time
          ),
          duration_minutes: this.calculateSlotDuration(newSlot.start_time, newSlot.end_time),
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);

      if (appointmentError) throw appointmentError;

      // 3. Create new slot booking
      const { error: insertError } = await supabase
        .from("slot_bookings")
        .insert({
          doctor_slot_id: newSlotId,
          appointment_id: appointmentId,
          booking_order: nextOrder,
        });

      if (insertError) throw insertError;

      // Get updated appointment data
      const { data: appointment, error: fetchError } = await supabase
        .from("appointments")
        .select(`
          *,
          clinic_patient:clinic_patients!inner(
            patient_profile:patient_profiles!inner(
              full_name,
              phone,
              email
            )
          ),
          clinic_doctor:clinic_doctors!inner(
            doctor_profile:doctor_profiles!inner(
              full_name,
              primary_specialization
            )
          )
        `)
        .eq("id", appointmentId)
        .single();

      if (fetchError || !appointment) {
        throw new Error("Failed to fetch updated appointment");
      }

      const appointmentWithSlot: AppointmentWithSlot = {
        ...appointment,
        slot_info: {
          id: newSlot.id,
          slot_name: newSlot.slot_name,
          slot_date: newSlot.slot_date,
          start_time: newSlot.start_time,
          end_time: newSlot.end_time,
          max_capacity: newSlot.max_capacity,
          current_bookings: newSlot.current_bookings + 1,
        },
      };

      return { data: appointmentWithSlot, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get appointment with slot information
   */
  static async getAppointmentWithSlot(
    appointmentId: string
  ): Promise<ServiceResponse<AppointmentWithSlot>> {
    try {
      this.validateRequired({ appointmentId });

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          clinic_patient:clinic_patients!inner(
            patient_profile:patient_profiles!inner(
              full_name,
              phone,
              email
            )
          ),
          clinic_doctor:clinic_doctors!inner(
            doctor_profile:doctor_profiles!inner(
              full_name,
              primary_specialization
            )
          ),
          doctor_slots!inner(
            id,
            slot_name,
            slot_date,
            start_time,
            end_time,
            max_capacity,
            current_bookings
          )
        `)
        .eq("id", appointmentId)
        .single();

      if (error || !data) {
        throw new Error("Appointment not found");
      }

      const appointmentWithSlot: AppointmentWithSlot = {
        ...data,
        slot_info: {
          id: data.doctor_slots.id,
          slot_name: data.doctor_slots.slot_name,
          slot_date: data.doctor_slots.slot_date,
          start_time: data.doctor_slots.start_time,
          end_time: data.doctor_slots.end_time,
          max_capacity: data.doctor_slots.max_capacity,
          current_bookings: data.doctor_slots.current_bookings,
        },
      };

      return { data: appointmentWithSlot, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get available slots for booking (for patient app)
   */
  static async getAvailableSlotsForBooking(
    clinicDoctorId: string,
    date: string
  ): Promise<ServiceResponse<Array<{
    id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
    available_capacity: number;
    is_full: boolean;
  }>>> {
    try {
      this.validateRequired({ clinicDoctorId, date });

      const { data: slots, error } = await supabase
        .from("doctor_slots")
        .select("*")
        .eq("clinic_doctor_id", clinicDoctorId)
        .eq("slot_date", date)
        .eq("is_active", true)
        .order("start_time", { ascending: true });

      if (error) throw error;

      const availableSlots = (slots || []).map(slot => ({
        id: slot.id,
        slot_name: slot.slot_name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        available_capacity: slot.max_capacity - slot.current_bookings,
        is_full: slot.current_bookings >= slot.max_capacity,
      }));

      return { data: availableSlots, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Private method to calculate slot duration in minutes
   */
  private static calculateSlotDuration(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }
}
