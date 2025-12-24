/**
 * Doctor Slot Service
 * Handles all slot-related database operations for doctors
 */
import { supabase } from "../lib/supabase";
import { BaseService, ServiceResponse } from "./BaseService";
import { Database } from "../types/database";

type DoctorSlot = Database["public"]["Tables"]["doctor_slots"]["Row"];
type DoctorSlotInsert = Database["public"]["Tables"]["doctor_slots"]["Insert"];
type DoctorSlotUpdate = Database["public"]["Tables"]["doctor_slots"]["Update"];

export interface CreateSlotData {
  slot_name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  slot_type?: 'in-clinic' | 'video'; // Type of slot
}

export interface UpdateSlotData {
  slot_name?: string;
  start_time?: string;
  end_time?: string;
  max_capacity?: number;
}

export interface AvailableSlot extends DoctorSlot {
  available_capacity: number;
  is_full: boolean;
}

export class DoctorSlotService extends BaseService {
  /**
   * Create multiple slots for a doctor on a specific date or date range
   */
  static async createSlots(
    clinicDoctorId: string,
    date: string,
    slots: CreateSlotData[],
    recurringEndDate?: string
  ): Promise<ServiceResponse<DoctorSlot[]>> {
    try {
      this.validateRequired({
        clinicDoctorId,
        date,
        slots,
      });

      // Validate slot times don't overlap
      this.validateSlotTimes(slots);

      // Check if doctor exists and belongs to current user's clinic
      const user = await this.getCurrentUser();
      const { data: doctor, error: doctorError } = await supabase
        .from("clinic_doctors")
        .select("id")
        .eq("id", clinicDoctorId)
        .eq("clinic_id", user.id)
        .single();

      if (doctorError || !doctor) {
        throw new Error("Doctor not found or access denied");
      }

      // Check for existing slots on the same date (with same slot_type)
      const { data: existingSlots, error: existingError } = await supabase
        .from("doctor_slots")
        .select("slot_name, slot_type")
        .eq("clinic_doctor_id", clinicDoctorId)
        .eq("slot_date", date)
        .eq("is_active", true);

      if (existingError) throw existingError;

      // Create a set of existing slot name + type combinations
      const existingSlotKeys = new Set(
        (existingSlots || []).map(
          (slot: any) => `${slot.slot_name}|${slot.slot_type || 'in-clinic'}`
        )
      );

      // Check for duplicates - same name AND same type
      const duplicateNames = slots.filter((slot) => {
        const slotKey = `${slot.slot_name}|${slot.slot_type || 'in-clinic'}`;
        return existingSlotKeys.has(slotKey);
      });

      if (duplicateNames.length > 0) {
        throw new Error(
          `Slots with these names already exist for the same type: ${duplicateNames
            .map((s) => `${s.slot_name} (${s.slot_type || 'in-clinic'})`)
            .join(", ")}`
        );
      }

      // Create slots
      const slotsToInsert: DoctorSlotInsert[] = slots.map((slot) => ({
        clinic_doctor_id: clinicDoctorId,
        slot_date: date,
        slot_name: slot.slot_name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        max_capacity: slot.max_capacity,
        current_bookings: 0,
        is_active: true,
        slot_type: slot.slot_type || 'in-clinic', // Default to in-clinic
      } as any));

      const { data: createdSlots, error } = await supabase
        .from("doctor_slots")
        .insert(slotsToInsert)
        .select();

      if (error) throw error;

      return { data: createdSlots || [], success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get available slots for a doctor on a specific date
   */
  static async getAvailableSlots(
    clinicDoctorId: string,
    date: string
  ): Promise<ServiceResponse<AvailableSlot[]>> {
    try {
      this.validateRequired({
        clinicDoctorId,
        date,
      });

      console.log(
        `🔍 Fetching available slots for doctor ${clinicDoctorId} on ${date}`
      );

      const { data: slots, error } = await supabase
        .from("doctor_slots")
        .select("*")
        .eq("clinic_doctor_id", clinicDoctorId)
        .eq("slot_date", date)
        .eq("is_active", true)
        .order("start_time", { ascending: true });

      if (error) throw error;

      console.log(`📊 Found ${slots?.length || 0} slots for ${date}`);

      if (!slots || slots.length === 0) {
        console.log(
          `⚠️ No slots found for doctor ${clinicDoctorId} on ${date}`
        );
        return { data: [], success: true };
      }

      // Filter out past slots and calculate real-time availability
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format

      const availableSlots: AvailableSlot[] = [];

      for (const slotData of slots) {
        const slot = slotData as any;

        // Check if slot is not in the past
        const isPast =
          slot.slot_date === currentDate && slot.end_time <= currentTime;

        if (isPast) {
          console.log(
            `⏰ Skipping past slot: ${slot.slot_name} (${slot.start_time} - ${slot.end_time})`
          );
          continue;
        }

        // Calculate real-time capacity for this slot
        // Count active appointments
        const { count: activeAppointments } = await supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("doctor_slot_id", slot.id)
          .in("status", ["scheduled", "checked-in", "in-progress"]);

        // Count pending requests for this slot's time range
        const slotStart = `${slot.slot_date}T${slot.start_time}`;
        const slotEnd = `${slot.slot_date}T${slot.end_time}`;

        const { data: allPendingRequests } = await supabase
          .from("appointment_requests")
          .select("requested_datetime")
          .eq("doctor_id", clinicDoctorId)
          .eq("status", "pending");

        const pendingRequestsInSlot =
          allPendingRequests?.filter((req: any) => {
            const reqTime = new Date(req.requested_datetime);
            const reqTimeString = reqTime.toISOString();
            const slotStartTime = new Date(slotStart).toISOString();
            const slotEndTime = new Date(slotEnd).toISOString();
            return (
              reqTimeString >= slotStartTime && reqTimeString <= slotEndTime
            );
          }).length || 0;

        const totalBookings = (activeAppointments || 0) + pendingRequestsInSlot;
        const realAvailableCapacity = slot.max_capacity - totalBookings;
        const isFull = totalBookings >= slot.max_capacity;

        console.log(
          `📋 Slot: ${slot.slot_name} | Capacity: ${realAvailableCapacity}/${slot.max_capacity} | Active: ${activeAppointments} | Pending: ${pendingRequestsInSlot} | Full: ${isFull}`
        );

        availableSlots.push({
          ...slot,
          available_capacity: realAvailableCapacity,
          is_full: isFull,
        });
      }

      console.log(`✅ Returning ${availableSlots.length} available slots`);
      return { data: availableSlots, success: true };
    } catch (error) {
      console.error("❌ Error in getAvailableSlots:", error);
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get all slots for a doctor (including inactive)
   */
  static async getDoctorSlots(
    clinicDoctorId: string,
    filters?: {
      date?: string;
      activeOnly?: boolean;
    }
  ): Promise<ServiceResponse<DoctorSlot[]>> {
    try {
      this.validateRequired({ clinicDoctorId });

      let query = supabase
        .from("doctor_slots")
        .select("*")
        .eq("clinic_doctor_id", clinicDoctorId);

      if (filters?.date) {
        query = query.eq("slot_date", filters.date);
      }

      if (filters?.activeOnly !== false) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      return { data: data || [], success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update slot capacity
   */
  static async updateSlotCapacity(
    slotId: string,
    newCapacity: number
  ): Promise<ServiceResponse<DoctorSlot>> {
    try {
      this.validateRequired({ slotId, newCapacity });

      if (newCapacity < 1 || newCapacity > 50) {
        throw new Error("Capacity must be between 1 and 50");
      }

      // Check if slot belongs to current user's clinic
      const user = await this.getCurrentUser();
      const { data: slot, error: slotError } = await supabase
        .from("doctor_slots")
        .select(
          `
          *,
          clinic_doctors!inner(
            clinic_id
          )
        `
        )
        .eq("id", slotId)
        .eq("clinic_doctors.clinic_id", user.id)
        .single();

      if (slotError || !slot) {
        throw new Error("Slot not found or access denied");
      }

      if (slot.current_bookings > newCapacity) {
        throw new Error(
          `Cannot reduce capacity below current bookings (${slot.current_bookings})`
        );
      }

      const { data, error } = await supabase
        .from("doctor_slots")
        .update({
          max_capacity: newCapacity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slotId)
        .select()
        .single();

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Update slot details
   */
  static async updateSlot(
    slotId: string,
    updateData: UpdateSlotData
  ): Promise<ServiceResponse<DoctorSlot>> {
    try {
      this.validateRequired({ slotId });

      // Check if slot belongs to current user's clinic
      const user = await this.getCurrentUser();
      const { data: slot, error: slotError } = await supabase
        .from("doctor_slots")
        .select(
          `
          *,
          clinic_doctors!inner(
            clinic_id
          )
        `
        )
        .eq("id", slotId)
        .eq("clinic_doctors.clinic_id", user.id)
        .single();

      if (slotError || !slot) {
        throw new Error("Slot not found or access denied");
      }

      // Validate time changes
      if (updateData.start_time || updateData.end_time) {
        const newStartTime = updateData.start_time || slot.start_time;
        const newEndTime = updateData.end_time || slot.end_time;

        if (newEndTime <= newStartTime) {
          throw new Error("End time must be after start time");
        }

        // Check for overlapping slots
        const { data: overlappingSlots, error: overlapError } = await supabase
          .from("doctor_slots")
          .select("id, slot_name, start_time, end_time")
          .eq("clinic_doctor_id", slot.clinic_doctor_id)
          .eq("slot_date", slot.slot_date)
          .eq("is_active", true)
          .neq("id", slotId);

        if (overlapError) throw overlapError;

        const overlaps = (overlappingSlots || []).filter((otherSlot) => {
          return (
            newStartTime < otherSlot.end_time &&
            newEndTime > otherSlot.start_time
          );
        });

        if (overlaps.length > 0) {
          throw new Error(
            `Slot overlaps with: ${overlaps.map((s) => s.slot_name).join(", ")}`
          );
        }
      }

      // Validate capacity changes
      if (updateData.max_capacity !== undefined) {
        if (updateData.max_capacity < 1 || updateData.max_capacity > 50) {
          throw new Error("Capacity must be between 1 and 50");
        }
        if (slot.current_bookings > updateData.max_capacity) {
          throw new Error(
            `Cannot reduce capacity below current bookings (${slot.current_bookings})`
          );
        }
      }

      const { data, error } = await supabase
        .from("doctor_slots")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slotId)
        .select()
        .single();

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Soft delete slot (set is_active = false)
   */
  static async deleteSlot(slotId: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ slotId });

      // Check if slot belongs to current user's clinic
      const user = await this.getCurrentUser();
      const { data: slot, error: slotError } = await supabase
        .from("doctor_slots")
        .select(
          `
          *,
          clinic_doctors!inner(
            clinic_id
          )
        `
        )
        .eq("id", slotId)
        .eq("clinic_doctors.clinic_id", user.id)
        .single();

      if (slotError || !slot) {
        throw new Error("Slot not found or access denied");
      }

      if (slot.current_bookings > 0) {
        throw new Error("Cannot delete slot with existing bookings");
      }

      const { error } = await supabase
        .from("doctor_slots")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slotId);

      if (error) throw error;
      return { data: true, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get slot statistics for a doctor
   */
  static async getSlotStatistics(
    clinicDoctorId: string,
    dateRange?: {
      startDate: string;
      endDate: string;
    }
  ): Promise<
    ServiceResponse<{
      totalSlots: number;
      totalCapacity: number;
      totalBookings: number;
      averageUtilization: number;
    }>
  > {
    try {
      this.validateRequired({ clinicDoctorId });

      let query = supabase
        .from("doctor_slots")
        .select("max_capacity, current_bookings")
        .eq("clinic_doctor_id", clinicDoctorId)
        .eq("is_active", true);

      if (dateRange) {
        query = query
          .gte("slot_date", dateRange.startDate)
          .lte("slot_date", dateRange.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const slots = data || [];
      const totalSlots = slots.length;
      const totalCapacity = slots.reduce(
        (sum, slot) => sum + slot.max_capacity,
        0
      );
      const totalBookings = slots.reduce(
        (sum, slot) => sum + slot.current_bookings,
        0
      );
      const averageUtilization =
        totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;

      return {
        data: {
          totalSlots,
          totalCapacity,
          totalBookings,
          averageUtilization: Math.round(averageUtilization * 100) / 100,
        },
        success: true,
      };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Create multiple slots for a date
   */
  static async createSlotsForDate(
    doctorId: string,
    date: string,
    slots: CreateSlotData[]
  ): Promise<ServiceResponse<DoctorSlot[]>> {
    try {
      this.validateRequired({ doctorId, date, slots });

      // Get the clinic_doctor_id for the doctor
      const user = await this.getCurrentUser();
      const { data: clinicDoctor, error: doctorError } = await supabase
        .from("clinic_doctors")
        .select("id")
        .eq("doctor_profile_id", doctorId)
        .eq("clinic_id", user.id)
        .eq("is_active", true)
        .single();

      if (doctorError || !clinicDoctor) {
        throw new Error("Doctor not found or access denied");
      }

      return await this.createSlots(clinicDoctor.id, date, slots);
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Bulk operations
   */
  static async bulkUpdateSlotStatus(
    slotIds: string[],
    isActive: boolean
  ): Promise<ServiceResponse<number>> {
    try {
      this.validateRequired({ slotIds });

      if (slotIds.length === 0) {
        return { data: 0, success: true };
      }

      // Check if slots belong to current user's clinic
      const user = await this.getCurrentUser();
      const { data: slots, error: slotsError } = await supabase
        .from("doctor_slots")
        .select(
          `
          id,
          clinic_doctors!inner(
            clinic_id
          )
        `
        )
        .in("id", slotIds)
        .eq("clinic_doctors.clinic_id", user.id);

      if (slotsError || !slots) {
        throw new Error("Slots not found or access denied");
      }

      // Update slots
      const { error } = await supabase
        .from("doctor_slots")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .in("id", slotIds);

      if (error) throw error;

      return { data: slots.length, success: true };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  static async bulkDeleteSlots(
    slotIds: string[]
  ): Promise<ServiceResponse<{ deleted: number; failed: string[] }>> {
    try {
      this.validateRequired({ slotIds });

      if (slotIds.length === 0) {
        return { data: { deleted: 0, failed: [] }, success: true };
      }

      // Check if slots belong to current user's clinic and have no bookings
      const user = await this.getCurrentUser();
      const { data: slots, error: slotsError } = await supabase
        .from("doctor_slots")
        .select(
          `
          id,
          current_bookings,
          clinic_doctors!inner(
            clinic_id
          )
        `
        )
        .in("id", slotIds)
        .eq("clinic_doctors.clinic_id", user.id);

      if (slotsError || !slots) {
        throw new Error("Slots not found or access denied");
      }

      const deletableSlots = slots.filter(
        (slot) => slot.current_bookings === 0
      );
      const failedSlots = slots.filter((slot) => slot.current_bookings > 0);

      if (deletableSlots.length === 0) {
        return {
          data: {
            deleted: 0,
            failed: failedSlots.map((slot) => slot.id),
          },
          success: true,
        };
      }

      // Delete deletable slots
      const { error } = await supabase
        .from("doctor_slots")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in(
          "id",
          deletableSlots.map((slot) => slot.id)
        );

      if (error) throw error;

      return {
        data: {
          deleted: deletableSlots.length,
          failed: failedSlots.map((slot) => slot.id),
        },
        success: true,
      };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Get slots with filters
   */
  static async getSlotsWithFilters(
    doctorId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      slotName?: string;
      slotType?: "in-clinic" | "video";
      status?: "active" | "inactive" | "all";
    },
    pagination?: { page: number; limit: number }
  ): Promise<ServiceResponse<{ slots: DoctorSlot[]; total: number }>> {
    try {
      this.validateRequired({ doctorId });

      // Get the clinic_doctor_id for the doctor
      const user = await this.getCurrentUser();
      const { data: clinicDoctor, error: doctorError } = await supabase
        .from("clinic_doctors")
        .select("id")
        .eq("doctor_profile_id", doctorId)
        .eq("clinic_id", user.id)
        .eq("is_active", true)
        .single();

      if (doctorError || !clinicDoctor) {
        throw new Error("Doctor not found or access denied");
      }

      let query = supabase
        .from("doctor_slots")
        .select("*", { count: "exact" })
        .eq("clinic_doctor_id", clinicDoctor.id);

      // Apply filters
      if (filters.startDate) {
        query = query.gte("slot_date", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("slot_date", filters.endDate);
      }
      if (filters.slotName) {
        query = query.ilike("slot_name", `%${filters.slotName}%`);
      }
      if (filters.slotType) {
        query = query.eq("slot_type", filters.slotType);
      }
      if (filters.status === "active") {
        query = query.eq("is_active", true);
      } else if (filters.status === "inactive") {
        query = query.eq("is_active", false);
      }

      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }

      // Order by date and time
      query = query
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });

      const { data, error, count } = await query;

      if (error) throw error;

      // Filter out past slots for admin view (optional - admin might want to see all slots)
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD format

      const filteredSlots = (data || []).filter((slot: any) => {
        // If slot is for today, check if it's not past
        if (slot.slot_date === currentDate) {
          return slot.end_time > currentTime;
        }
        // If slot is for future date, include it
        return slot.slot_date > currentDate;
      });

      return {
        data: {
          slots: filteredSlots,
          total: filteredSlots.length,
        },
        success: true,
      };
    } catch (error) {
      return { error: this.handleError(error), success: false };
    }
  }

  /**
   * Private method to validate slot times don't overlap
   */
  private static validateSlotTimes(slots: CreateSlotData[]): void {
    if (slots.length === 0) return;

    // Sort slots by start time
    const sortedSlots = [...slots].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );

    // Check for overlapping slots
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const current = sortedSlots[i];
      const next = sortedSlots[i + 1];

      if (current.end_time > next.start_time) {
        throw new Error(
          `Slot "${current.slot_name}" overlaps with "${next.slot_name}"`
        );
      }
    }

    // Validate individual slot times
    for (const slot of slots) {
      if (slot.end_time <= slot.start_time) {
        throw new Error(
          `Slot "${slot.slot_name}": End time must be after start time`
        );
      }
    }
  }
}
