import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  Clock,
  User,
  CheckCircle,
  PlayCircle,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { AppointmentStatus } from "../../constants";
import { PrescriptionUploadModal } from "../appointmentComponents/PrescriptionUploadModal";

// Define QueueAppointment interface directly instead of importing from nonexistent types
interface QueueAppointment {
  id: string;
  clinic_doctor_id: string;
  clinic_patient_id: string;
  appointment_datetime: string;
  status: string;
  queue_position?: number;
  symptoms?: string;
  notes?: string;
  patient_checked_in?: boolean;
  checked_in_at?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  created_at?: string;
  updated_at?: string;
  clinic_patient?: {
    id: string;
    patient_profile: {
      id: string;
      full_name: string;
      phone: string;
      email: string;
    };
  } | null;
  clinic_doctor?: {
    id: string;
    doctor_profile: {
      id: string;
      full_name: string;
      phone: string;
      primary_specialization: string;
    };
  } | null;
}

interface Props {
  doctorId: string;
  selectedDate: string;
}

export function QueueManagement({ doctorId, selectedDate }: Props) {
  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [selectedAppointmentForPrescription, setSelectedAppointmentForPrescription] = useState<QueueAppointment | null>(null);
  const { user } = useAuth();

  const fetchQueue = async () => {
    if (!user || !doctorId || !selectedDate) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          *,
          clinic_patient:clinic_patients!clinic_patient_id(
            *,
            patient_profile:patient_profiles!patient_profile_id(
              id, full_name, phone, email
            )
          ),
          clinic_doctor:clinic_doctors!clinic_doctor_id(
            *,
            doctor_profile:doctor_profiles!doctor_profile_id(
              id, full_name, phone, primary_specialization
            )
          )
        `
        )
        .eq("clinic_doctor_id", doctorId)
        .eq("appointment_datetime::date", selectedDate)
        .in("status", [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.IN_PROGRESS,
          AppointmentStatus.COMPLETED,
        ])
        .order("appointment_datetime", { ascending: false });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Subscribe to appointment changes
    const subscription = supabase
      .channel(`queue-${doctorId}-${selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_doctor_id=eq.${doctorId}`,
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [doctorId, selectedDate, user]);

  const updateAppointmentStatus = async (
    id: string,
    status: string,
    updates: Record<string, any> = {}
  ) => {
    try {
      setActionLoading(id);

      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      };

      const { error } = await (supabase
        .from("appointments") as any)
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      await fetchQueue();
    } catch (error) {
      console.error("Error updating appointment:", error);
      alert("Error updating appointment status");
    } finally {
      setActionLoading(null);
    }
  };

  const checkInPatient = (appointment: QueueAppointment) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.CHECKED_IN, {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
    });
  };

  const startAppointment = (appointment: QueueAppointment) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.IN_PROGRESS, {
      actual_start_time: new Date().toISOString(),
    });
  };

  const completeAppointment = async (appointment: QueueAppointment) => {
    // Open prescription upload modal instead of directly completing
    setSelectedAppointmentForPrescription(appointment);
    setPrescriptionModalOpen(true);
  };

  const handlePrescriptionSuccess = async () => {
    console.log("Appointment completed with prescription. Refreshing queue...");
    await fetchQueue();
  };

  const getStatusColor = (status: string, checkedIn: boolean) => {
    switch (status) {
      case AppointmentStatus.COMPLETED:
        return "bg-green-100 text-green-800 border-green-200";
      case AppointmentStatus.IN_PROGRESS:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case AppointmentStatus.CHECKED_IN:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case AppointmentStatus.SCHEDULED:
        return checkedIn
          ? "bg-yellow-100 text-yellow-800 border-yellow-200"
          : "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getActionButton = (appointment: QueueAppointment) => {
    const isLoading = actionLoading === appointment.id;

    switch (appointment.status) {
      case "Scheduled":
        if (!appointment.patient_checked_in) {
          return (
            <Button
              size="sm"
              onClick={() => checkInPatient(appointment)}
              disabled={isLoading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Check In
            </Button>
          );
        }
        return (
          <Button
            size="sm"
            onClick={() => startAppointment(appointment)}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start
          </Button>
        );
      case "Checked-In":
        return (
          <Button
            size="sm"
            onClick={() => startAppointment(appointment)}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Start
          </Button>
        );
      case "In-Progress":
        return (
          <Button
            size="sm"
            onClick={() => completeAppointment(appointment)}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Complete
          </Button>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No appointments scheduled
          </h3>
          <p className="text-gray-500">
            No appointments found for the selected date.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Queue for {format(parseISO(selectedDate), "MMMM d, yyyy")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchQueue}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {appointments.map((appointment, index) => (
          <Card
            key={appointment.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        #{index + 1}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {appointment.clinic_patient?.patient_profile?.full_name || "Unknown Patient"}
                      </h4>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          appointment.status,
                          appointment.patient_checked_in || false
                        )}`}
                      >
                        {appointment.status === AppointmentStatus.SCHEDULED &&
                          appointment.patient_checked_in
                          ? "Checked-In"
                          : appointment.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(
                          parseISO(appointment.appointment_datetime),
                          "HH:mm"
                        )}
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {appointment.clinic_patient?.patient_profile?.phone || "Unknown"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {getActionButton(appointment)}
                </div>
              </div>

              {appointment.symptoms && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Symptoms:</span>{" "}
                    {appointment.symptoms}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prescription Upload Modal */}
      <PrescriptionUploadModal
        isOpen={prescriptionModalOpen}
        onClose={() => {
          setPrescriptionModalOpen(false);
          setSelectedAppointmentForPrescription(null);
        }}
        appointment={selectedAppointmentForPrescription as any}
        onSuccess={handlePrescriptionSuccess}
      />
    </div>
  );
}
