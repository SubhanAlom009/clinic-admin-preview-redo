/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { X, Calendar, Loader2, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import {
  appointmentFormSchema,
  type AppointmentFormData,
} from "../../validation/FormSchemas";
import { AppointmentService } from "../../services/AppointmentService";
import {
  getAppointmentIntervalMinutes,
} from "../../lib/utils";
import { SlotSelector } from "../doctorComponents/SlotSelector";
import { toast } from "sonner";
import { createUTCFromISTInput } from "../../utils/timezoneUtils";

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAppointmentModal({
  isOpen,
  onClose,
}: AddAppointmentModalProps) {
  const [formData, setFormData] = useState<AppointmentFormData>({
    clinic_patient_id: "",
    clinic_doctor_id: "",
    doctor_slot_id: "", // CHANGED: Now using slot selection
    appointment_datetime: "", // CHANGED: Will be derived from slot
    appointment_type: "In-Clinic",
    notes: "",
    symptoms: "",
  });

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const { user } = useAuth();

  // Use our new validation system
  const { errors, validate, validateField, clearErrors } = useFormValidation(
    appointmentFormSchema
  );

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      console.log("Fetching patients and doctors for user:", user.id);

      try {
        const [patientsResult, doctorsResult] = await Promise.all([
          supabase
            .from("clinic_patients")
            .select(
              `
              id,
              patient_profile_id,
              patient_profile:patient_profiles(
                id,
                full_name,
                phone,
                email
              )
            `
            )
            .eq("clinic_id", user.id)
            .order("patient_profile(full_name)"),
          supabase
            .from("clinic_doctors")
            .select(
              `
              id,
              doctor_profile_id,
              employee_id,
              is_active,
              doctor_profile:doctor_profiles(
                id,
                full_name,
                primary_specialization,
                phone
              )
            `
            )
            .eq("clinic_id", user.id)
            .eq("is_active", true)
            .order("doctor_profile(full_name)"),
        ]);

        if (patientsResult.error) {
          console.error("Error fetching patients:", patientsResult.error);
          throw new Error("Failed to load patients");
        } else {
          console.log("Patients fetched:", patientsResult.data?.length);
          setPatients(patientsResult.data || []);
        }

        if (doctorsResult.error) {
          console.error("Error fetching doctors:", doctorsResult.error);
          throw new Error("Failed to load doctors");
        } else {
          console.log("Doctors fetched:", doctorsResult.data?.length);
          setDoctors(doctorsResult.data || []);
        }
      } catch (error: any) {
        setError(error.message || "Failed to load data");
        toast.error(error.message || "Failed to load data");
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, isOpen]);

  // Queue recalculation is now handled automatically by PGMQ

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    clearErrors();

    try {
      // Validate form data using our new validation system
      const validationResult = validate(formData);

      if (!validationResult.isValid) {
        toast.error("Please fix the validation errors");
        setLoading(false);
        return;
      }

      if (!selectedSlot) {
        toast.error("Please select a time slot");
        setLoading(false);
        return;
      }

      // Assign time in 40-minute intervals within the slot based on existing scheduled appointments
      const intervalMinutes = getAppointmentIntervalMinutes();

      // Count existing scheduled appointments and pending requests in this slot
      const [existingAppointmentsRes, pendingRequestsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("appointment_datetime")
          .eq("doctor_slot_id", selectedSlot.id)
          .eq("status", "scheduled"),
        supabase
          .from("appointment_requests")
          .select("requested_datetime")
          .eq("doctor_id", formData.clinic_doctor_id)
          .eq("status", "pending"),
      ]);

      const appointmentsError = existingAppointmentsRes.error;
      const requestsError = pendingRequestsRes.error;
      if (appointmentsError || requestsError) {
        console.error("Error fetching occupancy:", {
          appointmentsError,
          requestsError,
        });
        throw new Error("Failed to check slot availability");
      }

      // Filter pending requests to same date range
      const slotStartIso = createUTCFromISTInput(
        selectedDate,
        selectedSlot.start_time.slice(0, 5)
      );
      const slotEndIso = createUTCFromISTInput(
        selectedDate,
        selectedSlot.end_time.slice(0, 5)
      );

      const existingAppointments = existingAppointmentsRes.data || [];
      const pendingRequestsSameSlot = (pendingRequestsRes.data || []).filter(
        (req: any) => {
          const t = new Date(req.requested_datetime).toISOString();
          return t >= slotStartIso && t <= slotEndIso;
        }
      );

      if (appointmentsError) {
        console.error(
          "Error fetching existing appointments:",
          appointmentsError
        );
        throw new Error("Failed to check slot availability");
      }

      const scheduledCount =
        (existingAppointments?.length || 0) +
        (pendingRequestsSameSlot.length || 0);

      // Compute assigned local time: slot start + (scheduledCount * 40)
      const slotStartLocal = new Date(
        `${selectedSlot.slot_date}T${selectedSlot.start_time}`
      );
      const slotEndLocal = new Date(
        `${selectedSlot.slot_date}T${selectedSlot.end_time}`
      );

      // Compute next time purely by interval indices relative to slot start
      const now = new Date();
      const baseForNow = now > slotStartLocal ? now : slotStartLocal;
      const minutesFromStartForNow = Math.max(
        0,
        Math.ceil(
          (baseForNow.getTime() - slotStartLocal.getTime()) / (1000 * 60)
        )
      );
      const nextIndexFromNow = Math.ceil(
        minutesFromStartForNow / intervalMinutes
      );

      // Index after occupied (scheduled + pending in this slot)
      const nextIndexAfterOccupied = scheduledCount; // each occupies one interval step starting at slot start

      const candidateIndex = Math.max(nextIndexFromNow, nextIndexAfterOccupied);
      let assignedLocal = new Date(slotStartLocal);
      assignedLocal.setMinutes(
        slotStartLocal.getMinutes() + candidateIndex * intervalMinutes
      );

      // Validate does not exceed slot end
      if (assignedLocal >= slotEndLocal) {
        toast.error("This slot is at maximum capacity");
        setLoading(false);
        return;
      }

      const appointmentDateTime = assignedLocal.toISOString();
      console.log(
        "📅 Assigned appointment datetime (UTC ISO):",
        appointmentDateTime
      );

      // Create appointment using slot-based approach
      const appointmentData = {
        clinic_patient_id: formData.clinic_patient_id,
        clinic_doctor_id: formData.clinic_doctor_id,
        doctor_slot_id: formData.doctor_slot_id,
        appointment_datetime: appointmentDateTime,
        appointment_type: formData.appointment_type,
        notes: formData.notes || undefined,
        symptoms: formData.symptoms || undefined,
      };

      console.log("Creating slot-based appointment:", appointmentData);

      const { data, error: insertError } =
        await AppointmentService.createAppointment(appointmentData);

      if (insertError) {
        console.error("Appointment creation error:", insertError);
        console.error("Failed appointmentData:", appointmentData);
        throw insertError;
      }

      console.log("Appointment created successfully:", data);

      // Queue recalculation is now handled automatically by PGMQ
      console.log("Queue recalculation is now handled automatically by PGMQ");

      // Create notification
      const patient = patients.find((p) => p.id === formData.clinic_patient_id);
      const doctor = doctors.find((d) => d.id === formData.clinic_doctor_id);

      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "appointment",
        title: "New Appointment Scheduled",
        message: `Appointment scheduled for ${patient?.patient_profile?.full_name} with ${doctor?.doctor_profile?.full_name}`,
        priority: "normal",
      });

      // Show success toast
      toast.success(
        `Appointment scheduled successfully for ${patient?.patient_profile?.full_name} with Dr. ${doctor?.doctor_profile?.full_name}`
      );

      onClose();
      setFormData({
        clinic_patient_id: "",
        clinic_doctor_id: "",
        doctor_slot_id: "", // CHANGED: Added slot field
        appointment_datetime: "", // CHANGED: Now optional, derived from slot
        appointment_type: "In-Clinic Consultation",
        notes: "",
        symptoms: "",
      });
      setSelectedDate(""); // CHANGED: Reset slot selection
      setSelectedSlot(null); // CHANGED: Reset slot selection
      clearErrors();
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      const errorMessage = err.message || "Failed to create appointment";
      toast.error(`Failed to create appointment: ${errorMessage}`);
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
    console.log(`Form field changed: ${name} = ${value}`); // Debug log

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
    validateField(fieldName, formData[fieldName as keyof AppointmentFormData]);
  };

  // Handle slot selection
  const handleSlotSelect = (slot: any) => {
    console.log("📅 AddAppointmentModal - Slot selected:", slot);
    setSelectedSlot(slot);

    // Combine slot date and time for full datetime (UTC ISO) - FIXED for IST
    const fullDateTime = createUTCFromISTInput(
      slot.slot_date,
      slot.start_time.slice(0, 5) // Remove seconds if present
    );
    console.log("📅 Full datetime created (UTC ISO from IST):", fullDateTime);

    setFormData((prev) => ({
      ...prev,
      doctor_slot_id: slot.id,
      appointment_datetime: fullDateTime, // Store full datetime: "2025-10-15T16:30:00"
    }));
    console.log("📅 Form data updated with slot ID:", slot.id);
    validateField("doctor_slot_id", slot.id);
  };

  // Handle date selection for slot filtering
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // Clear slot selection when date changes
    setSelectedSlot(null);
    setFormData((prev) => ({
      ...prev,
      doctor_slot_id: "",
      appointment_datetime: "",
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* Loading Overlay */}
        {dataLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading data...</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h4 className="text-sm font-medium text-red-800">Error</h4>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-blue-600" />
            Schedule New Appointment
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient *
              </label>
              <select
                name="clinic_patient_id"
                value={formData.clinic_patient_id}
                onChange={handleInputChange}
                onBlur={() => handleFieldBlur("clinic_patient_id")}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.clinic_patient_id
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300"
                  }`}
                required
              >
                <option value="">Select a patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patient_profile?.full_name} -{" "}
                    {patient.patient_profile?.phone}
                  </option>
                ))}
              </select>
              {errors.clinic_patient_id && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.clinic_patient_id}
                </p>
              )}
              {patients.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No patients found. Add patients first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Doctor *
              </label>
              <select
                name="clinic_doctor_id"
                value={formData.clinic_doctor_id}
                onChange={handleInputChange}
                onBlur={() => handleFieldBlur("clinic_doctor_id")}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.clinic_doctor_id
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300"
                  }`}
                required
              >
                <option value="">Select a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.doctor_profile?.full_name} -{" "}
                    {doctor.doctor_profile?.primary_specialization}
                  </option>
                ))}
              </select>
              {errors.clinic_doctor_id && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.clinic_doctor_id}
                </p>
              )}
              {doctors.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No doctors found. Add doctors first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateSelect(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Select date to view available slots
              </p>
            </div>

            {selectedDate && formData.clinic_doctor_id && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Available Time Slots *
                </label>
                <SlotSelector
                  doctorId={formData.clinic_doctor_id}
                  date={selectedDate}
                  onSlotSelect={handleSlotSelect}
                  selectedSlot={selectedSlot?.id}
                />
                {errors.doctor_slot_id && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.doctor_slot_id}
                  </p>
                )}
              </div>
            )}

            {/* Visit Type Toggle - Matches Patient Webapp */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visit Type
              </label>
              <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, appointment_type: "In-Clinic Consultation" })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${formData.appointment_type === "In-Clinic Consultation"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  First Visit
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, appointment_type: "In-Clinic Follow-up" })}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${formData.appointment_type === "In-Clinic Follow-up"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Follow-up
                </button>
              </div>
              {errors.appointment_type && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.appointment_type}
                </p>
              )}
            </div>
          </div>

          {/* Reason for Visit - Single field replacing Symptoms + Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Visit <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("symptoms")}
              rows={3}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.symptoms
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300"
                }`}
              placeholder="Briefly describe symptoms or reason for visiting..."
            />
            {errors.symptoms && (
              <p className="mt-1 text-sm text-red-600">{errors.symptoms}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || dataLoading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Appointment"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
