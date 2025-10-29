import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/textarea";
import {
  CheckCircle,
  PlayCircle,
  XCircle,
  RotateCcw,
  DollarSign,
  Stethoscope,
  Pill,
  Upload,
  FileText,
  Image,
} from "lucide-react";
import { AppointmentWithRelations } from "../../types/database";
import { AppointmentStatus } from "../../constants";
import { format } from "date-fns";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { AutoBillingService } from "../../services/AutoBillingService";

// Narrow patch type for updates to satisfy Supabase TS (fallback to any fields we added)
type AppointmentUpdatePatch = Partial<
  Pick<
    AppointmentWithRelations,
    | "status"
    | "patient_checked_in"
    | "checked_in_at"
    | "actual_start_time"
    | "actual_end_time"
    | "duration_minutes"
    | "updated_at"
  >
> & { [key: string]: unknown };

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  appointment: AppointmentWithRelations | null;
  onClose: () => void;
  onReschedule: (appointment: AppointmentWithRelations) => void;
  onAfterUpdate?: (
    updated: Partial<AppointmentWithRelations> & { id: string }
  ) => void; // callback to refresh local state if desired
}

// Allowed transitions map (basic real-world guardrails)
const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CHECKED_IN]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_PROGRESS]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ], // Allow cancelling in-progress if needed
  [AppointmentStatus.COMPLETED]: [], // Completed appointments are final
  [AppointmentStatus.CANCELLED]: [AppointmentStatus.SCHEDULED], // Allow reactivating cancelled appointments
  [AppointmentStatus.NO_SHOW]: [AppointmentStatus.SCHEDULED], // Allow reactivating no-show appointments
  [AppointmentStatus.RESCHEDULED]: [AppointmentStatus.SCHEDULED], // Allow reactivating rescheduled appointments
};

// Helper function to check if appointment can be rescheduled
const canRescheduleAppointment = (
  appointment: AppointmentWithRelations
): boolean => {
  const status = appointment.status as AppointmentStatus;

  const isActiveStatus =
    status === AppointmentStatus.SCHEDULED ||
    status === AppointmentStatus.CHECKED_IN;
  const isFutureAppointment =
    new Date(appointment.appointment_datetime) > new Date();

  return isActiveStatus && isFutureAppointment;
};

export const AppointmentDetailsModal: React.FC<
  AppointmentDetailsModalProps
> = ({ isOpen, appointment, onClose, onReschedule, onAfterUpdate }) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [showBillingForm, setShowBillingForm] = useState(false);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionUploading, setPrescriptionUploading] = useState(false);
  const [billingAmount, setBillingAmount] = useState("");
  const [billingNotes, setBillingNotes] = useState("");
  const [appointmentBills, setAppointmentBills] = useState<any[]>([]);

  // Fetch bills for this appointment
  useEffect(() => {
    const fetchAppointmentBills = async () => {
      if (!appointment?.id) return;

      try {
        const { data, error } = await supabase
          .from("bills")
          .select(
            `
            *,
            clinic_patient:clinic_patients(
              id,
              patient_profile:patient_profiles(
                full_name,
                phone,
                email
              )
            )
          `
          )
          .eq("appointment_id", appointment.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching appointment bills:", error);
          return;
        }

        console.log("Fetched bills for appointment:", data);
        setAppointmentBills(data || []);
      } catch (error) {
        console.error("Error in fetchAppointmentBills:", error);
      }
    };

    fetchAppointmentBills();
  }, [appointment?.id]);

  if (!appointment) return null;

  // Get appointment status
  const normalizedStatus = appointment.status as AppointmentStatus;

  // Guard against invalid status values
  if (
    !normalizedStatus ||
    !allowedTransitions[normalizedStatus as AppointmentStatus]
  ) {
    console.warn("Invalid appointment status:", appointment.status);
    console.warn("Normalized status:", normalizedStatus);
    console.warn("Available statuses:", Object.keys(allowedTransitions));
    console.warn("Full appointment object:", appointment);
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Appointment Details"
        size="lg"
      >
        <div className="p-6">
          <p className="text-red-600">
            Invalid appointment status: "{appointment.status}". Please refresh
            and try again.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Expected one of: {Object.keys(allowedTransitions).join(", ")}
          </p>
        </div>
      </Modal>
    );
  }

  // Use normalized status for the rest of the component
  const currentStatus = normalizedStatus;

  const performUpdate = async (
    nextStatus: AppointmentStatus,
    extra: AppointmentUpdatePatch = {}
  ) => {
    try {
      setActionLoading(nextStatus);

      // Start with basic fields that definitely exist
      const updateData: Record<string, unknown> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      // Clean and validate the extra data
      const cleanExtra = { ...extra };
      Object.keys(cleanExtra).forEach((key) => {
        const value = cleanExtra[key];
        if (
          value === null ||
          value === undefined ||
          value === "null" ||
          value === ""
        ) {
          delete cleanExtra[key];
        }
      });

      // Only add enhanced fields if they're provided and the columns exist
      if (cleanExtra.patient_checked_in !== undefined) {
        updateData.patient_checked_in = cleanExtra.patient_checked_in;
      }
      if (cleanExtra.checked_in_at) {
        updateData.checked_in_at = cleanExtra.checked_in_at;
      }
      if (cleanExtra.actual_start_time) {
        updateData.actual_start_time = cleanExtra.actual_start_time;
      }
      if (cleanExtra.actual_end_time) {
        updateData.actual_end_time = cleanExtra.actual_end_time;
      }
      if (cleanExtra.duration_minutes !== undefined) {
        updateData.duration_minutes = cleanExtra.duration_minutes;
      }
      if (
        cleanExtra.diagnosis &&
        typeof cleanExtra.diagnosis === "string" &&
        cleanExtra.diagnosis.trim()
      ) {
        updateData.diagnosis = cleanExtra.diagnosis.trim();
      }
      if (
        cleanExtra.prescription &&
        typeof cleanExtra.prescription === "string" &&
        cleanExtra.prescription.trim()
      ) {
        updateData.prescription = cleanExtra.prescription.trim();
      }

      console.log("Updating appointment with data:", updateData);
      console.log("Appointment ID:", appointment.id);
      console.log("Appointment ID type:", typeof appointment.id);
      console.log("Current user ID:", appointment.user_id);
      console.log("User ID type:", typeof appointment.user_id);
      console.log("Full appointment object:", appointment);

      // Validate required fields
      if (!appointment.id) {
        throw new Error("Appointment ID is required");
      }

      // Build the query - use appointment ID as primary filter
      const { error, data } = await (supabase as any)
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id)
        .select();

      console.log("Supabase response:", { error, data });

      if (error) {
        console.error("Supabase error details:", error);
        throw error;
      }

      // Auto-generate bill if appointment is completed
      if (nextStatus === AppointmentStatus.COMPLETED) {
        console.log("Appointment completed, auto-generating bill...");
        try {
          await AutoBillingService.autoGenerateBill(appointment.id);
          toast.success("Appointment completed and bill generated!");
        } catch (billError) {
          console.error("Failed to auto-generate bill:", billError);
          toast.warning(
            "Appointment completed, but bill generation failed. Please create bill manually."
          );
        }
      }

      // Trigger queue recalculation for status changes that affect queue order
      if (
        nextStatus === AppointmentStatus.COMPLETED ||
        nextStatus === AppointmentStatus.NO_SHOW ||
        nextStatus === AppointmentStatus.CANCELLED
      ) {
        console.log("Status change requires queue recalculation...");
        // Note: Queue recalculation will be handled by the queue components
        // This is just for logging purposes
      }

      onAfterUpdate?.({ id: appointment.id, ...updateData });
      onClose();
    } catch (e) {
      console.error("Failed to update appointment", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to update appointment: ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = (target: AppointmentStatus) => {
    if (
      !allowedTransitions[currentStatus as AppointmentStatus]?.includes(target)
    )
      return;
    const extra: AppointmentUpdatePatch = {};
    switch (target) {
      case AppointmentStatus.CHECKED_IN:
        extra.patient_checked_in = true;
        extra.checked_in_at = new Date().toISOString();
        break;
      case AppointmentStatus.IN_PROGRESS:
        extra.actual_start_time = new Date().toISOString();
        break;
      case AppointmentStatus.COMPLETED:
        extra.actual_end_time = new Date().toISOString();
        // Update duration_minutes with actual consultation time if we have start time
        if (appointment.actual_start_time) {
          const actualDuration = Math.round(
            (new Date().getTime() -
              new Date(appointment.actual_start_time).getTime()) /
              (1000 * 60)
          );
          extra.duration_minutes = actualDuration;
        }
        break;
    }
    performUpdate(target, extra);
  };

  const can = (target: AppointmentStatus) =>
    allowedTransitions[currentStatus as AppointmentStatus]?.includes(target) ??
    false;

  const actionButtons: {
    key: string;
    label: string;
    status: string;
    icon: React.ReactNode;
    variant?: string;
    className?: string;
  }[] = [
    {
      key: "checkin",
      label: "Check In",
      status: AppointmentStatus.CHECKED_IN,
      icon: <CheckCircle className="h-4 w-4 mr-2" />,
      className:
        "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100",
    },
    {
      key: "start",
      label: "Start",
      status: AppointmentStatus.IN_PROGRESS,
      icon: <PlayCircle className="h-4 w-4 mr-2" />,
      className: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
    },
    {
      key: "complete",
      label: "Complete",
      status: AppointmentStatus.COMPLETED,
      icon: <CheckCircle className="h-4 w-4 mr-2" />,
      className:
        "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
    },
    {
      key: "noshow",
      label: "No Show",
      status: AppointmentStatus.NO_SHOW,
      icon: <XCircle className="h-4 w-4 mr-2" />,
      className: "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
    },
    {
      key: "cancel",
      label: "Cancel",
      status: AppointmentStatus.CANCELLED,
      icon: <XCircle className="h-4 w-4 mr-2" />,
      className: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Appointment Details"
      size="lg"
    >
      <div className="p-6 space-y-6">
        {/* Header with Date/Time in top right */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-8 bg-orange-400 rounded-full"></div>
            <h3 className="text-lg font-medium text-gray-900">
              Appointment Details
            </h3>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-600">
              {format(
                new Date(appointment.appointment_datetime),
                "MMM dd, yyyy"
              )}
            </p>
            <p className="text-xs text-gray-500">
              {format(new Date(appointment.appointment_datetime), "hh:mm a")} •{" "}
              {appointment.duration_minutes || 30} min
              {appointment.actual_start_time &&
                appointment.actual_end_time &&
                appointment.duration_minutes !==
                  Math.round(
                    (new Date(appointment.actual_end_time).getTime() -
                      new Date(appointment.actual_start_time).getTime()) /
                      (1000 * 60)
                )}
            </p>
          </div>
        </div>

        {/* Main Info Card */}
        <Card className="p-6 bg-white border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Patient Information */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Patient Information
                </h4>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-gray-900">
                    {appointment.clinic_patient?.patient_profile?.full_name ||
                      "Unknown Patient"}
                  </p>
                  <div className="space-y-1">
                    {appointment.clinic_patient?.patient_profile?.phone && (
                      <p className="text-sm text-gray-600">
                        Phone:{" "}
                        {appointment.clinic_patient.patient_profile.phone}
                      </p>
                    )}
                    {appointment.clinic_patient?.patient_profile?.email && (
                      <p className="text-sm text-gray-600">
                        Email:{" "}
                        {appointment.clinic_patient.patient_profile.email}
                      </p>
                    )}
                    <div className="flex space-x-4 text-sm text-gray-600">
                      {appointment.clinic_patient?.patient_profile
                        ?.date_of_birth && (
                        <span>
                          Age:{" "}
                          {new Date().getFullYear() -
                            new Date(
                              appointment.clinic_patient.patient_profile.date_of_birth
                            ).getFullYear()}
                        </span>
                      )}
                      {appointment.clinic_patient?.patient_profile?.gender && (
                        <span>
                          Gender:{" "}
                          {appointment.clinic_patient.patient_profile.gender}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Doctor Information */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Doctor Information
                </h4>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-gray-900">
                    Dr.{" "}
                    {appointment.clinic_doctor?.doctor_profile?.full_name ||
                      "Unknown Doctor"}
                  </p>
                  <div className="space-y-1">
                    {appointment.clinic_doctor?.doctor_profile
                      ?.primary_specialization && (
                      <p className="text-sm text-gray-600">
                        Specialization:{" "}
                        {
                          appointment.clinic_doctor.doctor_profile
                            .primary_specialization
                        }
                      </p>
                    )}
                    {appointment.clinic_doctor?.doctor_profile
                      ?.experience_years && (
                      <p className="text-sm text-gray-600">
                        Experience:{" "}
                        {
                          appointment.clinic_doctor.doctor_profile
                            .experience_years
                        }{" "}
                        years
                      </p>
                    )}
                    {appointment.clinic_doctor?.doctor_profile
                      ?.consultation_fee && (
                      <p className="text-sm text-gray-600">
                        Consultation Fee: ₹
                        {
                          appointment.clinic_doctor.doctor_profile
                            .consultation_fee
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Medical Information Section */}
          {appointment.clinic_patient && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-lg font-semibold text-gray-800 mb-6">
                Medical Information
              </h4>

              <div className="space-y-6">
                {/* Allergies */}
                {appointment.clinic_patient?.patient_profile?.allergies &&
                  appointment.clinic_patient.patient_profile.allergies.length >
                    0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        Allergies
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                        {appointment.clinic_patient.patient_profile.allergies.map(
                          (allergy: string, index: number) => (
                            <li key={index}>{allergy}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {/* Current Medications */}
                {appointment.clinic_patient?.patient_profile?.medications &&
                  appointment.clinic_patient.patient_profile.medications
                    .length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        Current Medications
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                        {appointment.clinic_patient.patient_profile.medications.map(
                          (medication: string, index: number) => (
                            <li key={index}>{medication}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {/* Previous Surgeries */}
                {appointment.clinic_patient?.patient_profile
                  ?.previous_surgeries &&
                  appointment.clinic_patient.patient_profile.previous_surgeries
                    .length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        Previous Surgeries
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                        {appointment.clinic_patient.patient_profile.previous_surgeries.map(
                          (surgery: string, index: number) => (
                            <li key={index}>{surgery}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {/* Family History */}
                {appointment.clinic_patient?.patient_profile
                  ?.family_history && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      Family History
                    </h5>
                    <p className="text-sm text-gray-700 ml-4">
                      {
                        appointment.clinic_patient.patient_profile
                          .family_history
                      }
                    </p>
                  </div>
                )}

                {/* Additional Notes */}
                {appointment.clinic_patient?.patient_profile?.medical_notes && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      Medical Notes
                    </h5>
                    <p className="text-sm text-gray-700 ml-4">
                      {appointment.clinic_patient.patient_profile.medical_notes}
                    </p>
                  </div>
                )}

                {/* Emergency Contact */}
                {appointment.clinic_patient?.patient_profile
                  ?.emergency_contact && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      Emergency Contact
                    </h5>
                    <p className="text-sm text-gray-700 ml-4">
                      {JSON.stringify(
                        appointment.clinic_patient.patient_profile
                          .emergency_contact
                      )}
                    </p>
                  </div>
                )}

                {/* Show message if no medical information is available */}
                {!appointment.clinic_patient?.patient_profile?.allergies
                  ?.length &&
                  !appointment.clinic_patient?.patient_profile?.medications
                    ?.length &&
                  !appointment.clinic_patient?.patient_profile
                    ?.previous_surgeries?.length &&
                  !appointment.clinic_patient?.patient_profile
                    ?.family_history &&
                  !appointment.clinic_patient?.patient_profile?.medical_notes &&
                  !appointment.clinic_patient?.patient_profile
                    ?.emergency_contact && (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-500">
                        No medical information available for this patient
                      </p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Status and Queue Information */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Appointment Status
            </h4>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Status:</span>
                <span
                  className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                    currentStatus === AppointmentStatus.SCHEDULED
                      ? "bg-blue-100 text-blue-800"
                      : currentStatus === AppointmentStatus.CHECKED_IN
                      ? "bg-orange-100 text-orange-800"
                      : currentStatus === AppointmentStatus.IN_PROGRESS
                      ? "bg-purple-100 text-purple-800"
                      : currentStatus === AppointmentStatus.COMPLETED
                      ? "bg-green-100 text-green-800"
                      : currentStatus === AppointmentStatus.CANCELLED
                      ? "bg-red-100 text-red-800"
                      : currentStatus === AppointmentStatus.NO_SHOW
                      ? "bg-gray-100 text-gray-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {currentStatus}
                </span>
              </div>
              {typeof appointment.queue_position === "number" && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Queue Position:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                    #{appointment.queue_position}
                  </span>
                </div>
              )}
              {appointment.checked_in_at && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Checked In:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                    {format(new Date(appointment.checked_in_at), "hh:mm a")}
                  </span>
                </div>
              )}
              {appointment.actual_start_time && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Started:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                    {format(new Date(appointment.actual_start_time), "hh:mm a")}
                  </span>
                </div>
              )}
              {appointment.actual_end_time && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Ended:</span>
                  <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {format(new Date(appointment.actual_end_time), "hh:mm a")}
                  </span>
                </div>
              )}
            </div>

            {/* Timing Analysis (if applicable) */}
            {(appointment.checked_in_at ||
              appointment.actual_start_time ||
              appointment.actual_end_time) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  Timing Details
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {appointment.checked_in_at &&
                    appointment.actual_start_time && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-blue-700 font-medium">
                          Waiting Time
                        </p>
                        <p className="text-blue-600">
                          {Math.round(
                            (new Date(appointment.actual_start_time).getTime() -
                              new Date(appointment.checked_in_at).getTime()) /
                              (1000 * 60)
                          )}{" "}
                          minutes
                        </p>
                      </div>
                    )}
                  {appointment.actual_start_time &&
                    appointment.actual_end_time && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-green-700 font-medium">
                          Actual Consultation Duration
                        </p>
                        <p className="text-green-600">
                          {Math.round(
                            (new Date(appointment.actual_end_time).getTime() -
                              new Date(
                                appointment.actual_start_time
                              ).getTime()) /
                              (1000 * 60)
                          )}{" "}
                          minutes
                          {appointment.duration_minutes && (
                            <span className="text-gray-500 text-xs block">
                              (Planned: {appointment.duration_minutes} min)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  {/* {appointment.estimated_start_time &&
                    appointment.actual_start_time && (
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <p className="text-yellow-700 font-medium">
                          Schedule Variance
                        </p>
                        <p className="text-yellow-600">
                          {Math.round(
                            (new Date(appointment.actual_start_time).getTime() -
                              new Date(
                                appointment.estimated_start_time
                              ).getTime()) /
                              (1000 * 60)
                          )}{" "}
                          minutes{" "}
                          {new Date(appointment.actual_start_time).getTime() >
                          new Date(appointment.estimated_start_time).getTime()
                            ? "late"
                            : "early"}
                        </p>
                      </div>
                    )} */}
                </div>
              </div>
            )}

            {/* Appointment Details */}
            <div className="space-y-4">
              {appointment.symptoms && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Symptoms
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.symptoms}
                  </p>
                </div>
              )}
              {appointment.notes && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.notes}
                  </p>
                </div>
              )}
              {appointment.diagnosis && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Diagnosis
                  </h5>
                  <p className="text-gray-700 bg-white p-3 rounded-lg border border-gray-200 text-sm">
                    {appointment.diagnosis}
                  </p>
                </div>
              )}
              {!!(
                appointment.prescription &&
                appointment.prescription.trim() &&
                appointment.prescription !== "0"
              ) && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Prescription
                  </h5>
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 p-3 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Prescription Uploaded
                    </span>
                  </div>
                </div>
              )}

              {/* Billing Information */}
              {/* Bills Section */}
              {appointmentBills.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Bills ({appointmentBills.length})
                  </h5>
                  <div className="space-y-2">
                    {appointmentBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="bg-blue-50 border border-blue-200 p-3 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-blue-600" />
                            <div>
                              <span className="text-sm font-medium text-blue-800">
                                {bill.bill_number}
                              </span>
                              <div className="text-xs text-blue-600">
                                Status: {bill.status?.toUpperCase()}
                              </div>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-blue-900">
                            ₹{bill.total_amount}
                          </span>
                        </div>
                        {bill.notes && (
                          <div className="mt-2 text-xs text-gray-600">
                            {bill.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consultation Fee (fallback if no bills) */}
              {appointmentBills.length === 0 &&
                !!(
                  appointment.clinic_doctor?.consultation_fee &&
                  appointment.clinic_doctor.consultation_fee > 0
                ) && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">
                      Consultation Fee
                    </h5>
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            Consultation Fee
                          </span>
                        </div>
                        <span className="text-lg font-bold text-blue-900">
                          ₹{appointment.clinic_doctor?.consultation_fee}
                        </span>
                      </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Actions
          </h4>
          <div className="flex flex-wrap gap-3">
            {actionButtons
              .filter((b) => can(b.status as AppointmentStatus))
              .map((b) => (
                <Button
                  key={b.key}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(b.status as AppointmentStatus)}
                  disabled={actionLoading === b.status}
                  className="text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  {b.icon}
                  {b.label}
                </Button>
              ))}

            {/* Reschedule Button - Only for active future appointments, not cancelled/completed/past */}
            {canRescheduleAppointment(appointment) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReschedule(appointment)}
                className="text-orange-700 border-orange-300 hover:bg-orange-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Reschedule
              </Button>
            )}

            {/* Medical Actions for In-Progress and Completed */}
            {(currentStatus === AppointmentStatus.IN_PROGRESS ||
              currentStatus === AppointmentStatus.COMPLETED) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiagnosisForm(true)}
                  className="text-blue-700 border-blue-300 hover:bg-blue-50"
                >
                  <Stethoscope className="h-4 w-4 mr-2" />
                  {appointment.diagnosis ? "Edit Diagnosis" : "Add Diagnosis"}
                </Button>
                  <Button
                    variant="outline"
                    size="sm"
                  onClick={() => setShowPrescriptionForm(true)}
                  className="text-purple-700 border-purple-300 hover:bg-purple-50"
                >
                  <Pill className="h-4 w-4 mr-2" />
                  {appointment.prescription
                    ? "Edit Prescription"
                    : "Add Prescription"}
                  </Button>
                {currentStatus === AppointmentStatus.COMPLETED && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBillingForm(true)}
                    className="text-green-700 border-green-300 hover:bg-green-50"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Generate Bill
                  </Button>
                )}
              </>
            )}

            {/* Reactivate Button for Cancelled/No-Show */}
            {(currentStatus === AppointmentStatus.CANCELLED ||
              currentStatus === AppointmentStatus.NO_SHOW) && (
                  <Button
                    variant="outline"
                    size="sm"
                onClick={() => handleAction(AppointmentStatus.SCHEDULED)}
                disabled={actionLoading === AppointmentStatus.SCHEDULED}
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                <RotateCcw className="h-4 w-4 mr-2" /> Reactivate
                  </Button>
                )}
          </div>
        </div>

        {/* Diagnosis Form Modal */}
        {showDiagnosisForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Add/Edit Diagnosis</h3>
              <Textarea
                value={diagnosisText}
                onChange={(e) => setDiagnosisText(e.target.value)}
                placeholder="Enter diagnosis details..."
                rows={4}
                className="mb-4"
              />
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    if (diagnosisText.trim()) {
                      try {
                        await performUpdate(currentStatus, {
                          diagnosis: diagnosisText.trim(),
                        });
                        setDiagnosisText("");
                        setShowDiagnosisForm(false);
                        toast.success("Diagnosis saved successfully!");
                      } catch (err) {
                        toast.error(
                          "Failed to save diagnosis. Please try again."
                        );
                      }
                    }
                  }}
                  className="flex-1"
                >
                  Save Diagnosis
                </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                    setDiagnosisText("");
                    setShowDiagnosisForm(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                  </Button>
              </div>
            </div>
          </div>
        )}

        {/* Prescription Form Modal */}
        {showPrescriptionForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Pill className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Upload Prescription
                </h3>
              </div>

              <div className="space-y-6">
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-purple-50 rounded-full mb-4">
                      <Upload className="h-8 w-8 text-purple-600" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Upload Prescription File
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Drag and drop your prescription image or PDF here, or
                      click to browse
                    </p>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPrescriptionFile(file);
                      }}
                      className="hidden"
                      id="prescription-upload"
                    />
                    <label
                      htmlFor="prescription-upload"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 cursor-pointer transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </label>
                  </div>
                </div>

                {/* Selected File Display */}
                {prescriptionFile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        {prescriptionFile.type.startsWith("image/") ? (
                          <Image className="h-5 w-5 text-green-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">
                          {prescriptionFile.name}
                        </p>
                        <p className="text-xs text-green-700">
                          {(prescriptionFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => setPrescriptionFile(null)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-blue-100 rounded">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Supported Formats
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Images (JPG, PNG, GIF) and PDF files. Maximum file size:
                        5MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  disabled={prescriptionUploading || !prescriptionFile}
                  onClick={async () => {
                    try {
                      if (prescriptionFile) {
                        setPrescriptionUploading(true);
                        const clinicId =
                          (appointment as any)?.clinic_doctor?.clinic_id ||
                          (appointment as any)?.clinic_patient?.clinic_id ||
                          "unknown-clinic";
                        const ext =
                          prescriptionFile.name.split(".").pop() || "bin";
                        const path = `clinic_${clinicId}/appointment_${
                          appointment.id
                        }/${Date.now()}.${ext}`;

                        const { error: upErr } = await supabase.storage
                          .from("prescriptions")
                          .upload(path, prescriptionFile, {
                            cacheControl: "3600",
                            upsert: true,
                            contentType: prescriptionFile.type || undefined,
                          });

                        if (upErr) throw upErr;

                        await performUpdate(currentStatus, {
                          prescription: path,
                        });
                        setPrescriptionFile(null);
                        setShowPrescriptionForm(false);
                        toast.success("Prescription uploaded successfully!");
                      }
                    } catch (err) {
                      console.error("Prescription save error:", err);
                      toast.error(
                        "Failed to save prescription. Please try again."
                      );
                    } finally {
                      setPrescriptionUploading(false);
                    }
                  }}
                  className="flex-1"
                >
                  {prescriptionUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Prescription
                    </>
                  )}
                </Button>
              <Button
                variant="outline"
                  onClick={() => {
                    setPrescriptionFile(null);
                    setShowPrescriptionForm(false);
                  }}
                  className="flex-1"
                >
                  Cancel
              </Button>
              </div>
            </div>
          </div>
        )}

        {/* Billing Form Modal */}
        {showBillingForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Generate Bill</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consultation Fee
                  </label>
                  <Input
                    type="number"
                    value={billingAmount}
                    onChange={(e) => setBillingAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="mb-2"
                  />
          </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <Textarea
                    value={billingNotes}
                    onChange={(e) => setBillingNotes(e.target.value)}
                    placeholder="Any additional billing notes..."
                    rows={3}
                  />
        </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={async () => {
                    if (billingAmount) {
                      try {
                        // Generate bill number
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(
                          2,
                          "0"
                        );
                        const day = String(now.getDate()).padStart(2, "0");
                        const random = Math.floor(Math.random() * 1000)
                          .toString()
                          .padStart(3, "0");
                        const billNumber = `INV-${year}${month}${day}-${random}`;

                        // Get current user (clinic admin)
                        const {
                          data: { user },
                        } = await supabase.auth.getUser();
                        if (!user) throw new Error("User not authenticated");

                        // Create the bill record
                        const billData = {
                          user_id: user.id, // Clinic admin who creates the bill
                          appointment_id: appointment.id,
                          clinic_patient_id: appointment.clinic_patient?.id,
                          bill_number: billNumber,
                          amount: parseFloat(billingAmount),
                          tax_amount: 0,
                          total_amount: parseFloat(billingAmount),
                          status: "pending",
                          notes: billingNotes || "",
                          due_date: new Date(
                            Date.now() + 30 * 24 * 60 * 60 * 1000
                          )
                            .toISOString()
                            .split("T")[0], // 30 days from now
                        };

                        console.log("Creating bill with data:", billData);

                        const { data: billResult, error: billError } = await (
                          supabase as any
                        )
                          .from("bills")
                          .insert(billData)
                          .select()
                          .single();

                        if (billError) {
                          console.error("Bill creation error:", billError);
                          throw billError;
                        }

                        console.log("Bill created successfully:", billResult);

                        // Also update the appointment with consultation fee
                        await performUpdate(currentStatus, {
                          consultation_fee: parseFloat(billingAmount),
                        });

                        setBillingAmount("");
                        setBillingNotes("");
                        setShowBillingForm(false);
                        toast.success(
                          `Bill ${billNumber} generated for ₹${billingAmount}`
                        );

                        // Refresh bills list
                        setAppointmentBills((prev) => [billResult, ...prev]);

                        // Trigger refresh of appointment data
                        if (onAfterUpdate) {
                          onAfterUpdate({
                            id: appointment.id,
                            consultation_fee: parseFloat(billingAmount),
                          } as any);
                        }
                      } catch (err) {
                        console.error("Bill generation error:", err);
                        toast.error(
                          "Failed to generate bill. Please try again."
                        );
                      }
                    }
                  }}
                  className="flex-1"
                >
                  Generate Bill
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBillingAmount("");
                    setBillingNotes("");
                    setShowBillingForm(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
