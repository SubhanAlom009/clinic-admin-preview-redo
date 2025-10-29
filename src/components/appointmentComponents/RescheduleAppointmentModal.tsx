import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import {
  rescheduleAppointmentSchema,
  type RescheduleAppointmentFormData,
} from "../../validation/FormSchemas";
import { AppointmentWithRelations } from "../../types/database";
import { AppointmentStatus } from "../../constants";
import { format } from "date-fns";
import { AppointmentService } from "../../services/AppointmentService";
import {
  combineLocalDateTimeToIso,
  getAppointmentIntervalMinutes,
} from "../../lib/utils";
import {
  DoctorSlotService,
  AvailableSlot,
} from "../../services/DoctorSlotService";
import { SlotSelector } from "../doctorComponents/SlotSelector";
import { createUTCFromISTInput } from "../../utils/timezoneUtils";
import { toast } from "sonner";

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithRelations | null;
}

export function RescheduleAppointmentModal({
  isOpen,
  onClose,
  appointment,
}: RescheduleAppointmentModalProps) {
  const [formData, setFormData] = useState<RescheduleAppointmentFormData>({
    appointment_datetime: "",
    duration_minutes: "30",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { user } = useAuth();

  // Use our new validation system
  const { errors, validate, validateField, clearErrors } = useFormValidation(
    rescheduleAppointmentSchema
  );

  // Fetch available slots for the selected date and doctor
  const fetchAvailableSlots = async (date: string) => {
    if (!appointment?.clinic_doctor_id || !date) {
      setAvailableSlots([]);
      return;
    }

    try {
      setLoadingSlots(true);
      const result = await DoctorSlotService.getAvailableSlots(
        appointment.clinic_doctor_id,
        date
      );

      if (result.success && result.data) {
        setAvailableSlots(result.data);
      } else {
        setAvailableSlots([]);
        toast.error("Failed to load available slots");
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      setAvailableSlots([]);
      toast.error("Failed to load available slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (appointment) {
      // Set initial date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = format(tomorrow, "yyyy-MM-dd");
      setSelectedDate(dateString);

      setFormData({
        appointment_datetime: "",
        duration_minutes: (appointment.duration_minutes || 30).toString(),
        notes: appointment.notes || "",
      });
    }
  }, [appointment]);

  useEffect(() => {
    if (selectedDate && appointment?.clinic_doctor_id) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, appointment?.clinic_doctor_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !appointment || !selectedSlot) return;

    setLoading(true);
    clearErrors();

    try {
      // Validate that a slot is selected
      if (!selectedSlot) {
        toast.error("Please select a time slot");
        setLoading(false);
        return;
      }

      // Validate form data using our new validation system
      const validationResult = validate(formData);

      if (!validationResult.isValid) {
        toast.error("Please fix the validation errors");
        setLoading(false);
        return;
      }

      console.log("Rescheduling appointment to slot:", selectedSlot.id);

      // Compute next available time within slot using interval and occupancy
      const intervalMinutes = getAppointmentIntervalMinutes();
      const slotStartIso = createUTCFromISTInput(
        selectedSlot.slot_date,
        selectedSlot.start_time.slice(0, 5)
      );
      const slotEndIso = createUTCFromISTInput(
        selectedSlot.slot_date,
        selectedSlot.end_time.slice(0, 5)
      );

      // Fetch existing scheduled apts and pending requests overlapping this slot
      const [existingAppointmentsRes, pendingRequestsRes] = await Promise.all([
        (supabase as any)
          .from("appointments")
          .select("appointment_datetime")
          .eq("doctor_slot_id", selectedSlot.id)
          .eq("status", "scheduled"),
        (supabase as any)
          .from("appointment_requests")
          .select("requested_datetime")
          .eq("doctor_id", appointment?.clinic_doctor_id)
          .eq("status", "pending"),
      ]);

      if (existingAppointmentsRes.error || pendingRequestsRes.error) {
        throw new Error("Failed to check slot availability");
      }

      const existing = (existingAppointmentsRes.data || []) as Array<{
        appointment_datetime: string;
      }>;
      const pending = (pendingRequestsRes.data || []) as Array<{
        requested_datetime: string;
      }>;

      const occupiedTimes = new Set<number>();
      existing.forEach((a) =>
        occupiedTimes.add(new Date(a.appointment_datetime).getTime())
      );
      pending.forEach((r) => {
        const t = new Date(r.requested_datetime).toISOString();
        if (t >= slotStartIso && t <= slotEndIso) {
          occupiedTimes.add(new Date(r.requested_datetime).getTime());
        }
      });

      const slotStartLocal = new Date(
        `${selectedSlot.slot_date}T${selectedSlot.start_time}`
      );
      const slotEndLocal = new Date(
        `${selectedSlot.slot_date}T${selectedSlot.end_time}`
      );

      let assignedLocal = new Date(slotStartLocal);
      while (
        occupiedTimes.has(assignedLocal.getTime()) &&
        assignedLocal < slotEndLocal
      ) {
        assignedLocal = new Date(assignedLocal);
        assignedLocal.setMinutes(assignedLocal.getMinutes() + intervalMinutes);
      }

      if (assignedLocal >= slotEndLocal) {
        toast.error("This slot is at maximum capacity");
        setLoading(false);
        return;
      }

      const updateData = {
        doctor_slot_id: selectedSlot.id,
        appointment_datetime: assignedLocal.toISOString(),
        slot_booking_order: selectedSlot.current_bookings + 1, // Next position in slot
        notes: formData.notes || undefined,
        status: AppointmentStatus.SCHEDULED, // Set back to scheduled when rescheduled
      };

      console.log("Full update data:", updateData);

      // Use AppointmentService to ensure PGMQ integration
      const result = await AppointmentService.updateAppointment(
        appointment.id,
        updateData
      );

      if (!result.success) {
        console.error("Appointment update error:", result.error);
        throw new Error(
          result.error?.message || "Failed to reschedule appointment"
        );
      }

      console.log("Appointment rescheduled successfully");

      // Verify the status was set correctly by fetching the updated appointment
      const { data: updatedAppointment } = await (supabase as any)
        .from("appointments")
        .select("id, status, appointment_datetime, doctor_slot_id")
        .eq("id", appointment.id)
        .single();

      if (updatedAppointment) {
        console.log("Updated appointment status:", updatedAppointment.status);
        console.log(
          "Updated appointment slot:",
          updatedAppointment.doctor_slot_id
        );
        console.log(
          "Updated appointment datetime:",
          updatedAppointment.appointment_datetime
        );
      }

      // Create notification
      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "appointment",
        title: "Appointment Rescheduled",
        message: `Appointment for ${
          appointment.clinic_patient?.patient_profile?.full_name
        } has been rescheduled to ${selectedSlot.slot_name} on ${format(
          new Date(selectedSlot.slot_date),
          "MMM d, yyyy"
        )} at ${selectedSlot.start_time}`,
        priority: "normal",
      });

      toast.success("Appointment rescheduled successfully!");
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || "Failed to reschedule appointment";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear field error when user starts typing
    if (errors[name]) {
      validateField(name, value);
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    validateField(
      fieldName,
      formData[fieldName as keyof RescheduleAppointmentFormData]
    );
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Clear selected slot when date changes
  };

  if (!appointment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reschedule Appointment"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Current Appointment Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Current Appointment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Patient:</span>
              <p className="text-gray-900">
                {appointment.clinic_patient?.patient_profile?.full_name}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Doctor:</span>
              <p className="text-gray-900">
                {appointment.clinic_doctor?.doctor_profile?.full_name}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">
                Current Date & Time:
              </span>
              <p className="text-gray-900">
                {format(
                  new Date(appointment.appointment_datetime),
                  "MMM d, yyyy h:mm a"
                )}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Duration:</span>
              <p className="text-gray-900">
                {appointment.duration_minutes} minutes
              </p>
            </div>
          </div>
        </div>

        {/* New Appointment Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            New Appointment Details
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Time Slot *
                </label>
                {loadingSlots ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">
                      Loading available slots...
                    </p>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <SlotSelector
                    doctorId={appointment.clinic_doctor_id}
                    date={selectedDate}
                    onSlotSelect={handleSlotSelect}
                    selectedSlot={selectedSlot?.id}
                  />
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-500">
                      No slots available for this date
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Please select a different date
                    </p>
                  </div>
                )}
                {!selectedSlot && selectedDate && availableSlots.length > 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    Please select a time slot
                  </p>
                )}
              </div>
            )}

            {selectedSlot && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-blue-900">
                  Selected Slot
                </h4>
                <p className="text-sm text-blue-700">
                  {selectedSlot.slot_name} - {selectedSlot.start_time} to{" "}
                  {selectedSlot.end_time}
                </p>
                <p className="text-xs text-blue-600">
                  Available capacity: {selectedSlot.available_capacity}/
                  {selectedSlot.max_capacity}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reschedule Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("notes")}
              rows={3}
              className={`block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.notes
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300"
              }`}
              placeholder="Add any notes about the reschedule (optional)"
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedSlot || loadingSlots}
          >
            {loading ? "Rescheduling..." : "Reschedule Appointment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
