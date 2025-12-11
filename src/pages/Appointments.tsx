import { useState, useEffect } from "react";
import { AppointmentStatus } from "../constants";
import {
  Calendar,
  Clock,
  Search,
  Grid3X3,
  List,
  CalendarDays,
  MonitorSpeaker,
  User,
  Eye,
  Edit3,
  Video,
  Link2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card, CardContent } from "../components/ui/Card";
import { AddAppointmentModal } from "../components/appointmentComponents/AddAppointmentModal";
import { RescheduleAppointmentModal } from "../components/appointmentComponents/RescheduleAppointmentModal";
import { AppointmentDetailsModal } from "../components/appointmentComponents/AppointmentDetailsModal";
import { CalendarView } from "../components/CalendarView";
import { QueueTab } from "../components/queueComponents/QueueTab";
import { AppointmentService } from "../services/AppointmentService";
import { useAuth } from "../hooks/useAuth";
import type { AppointmentWithRelations } from "../services/AppointmentService";
import { capitalizeWords } from "../utils/textUtils";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";

export function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>(
    []
  );
  const [filteredAppointments, setFilteredAppointments] = useState<
    AppointmentWithRelations[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [activeTab, setActiveTab] = useState<"appointments" | "queue">(
    "appointments"
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithRelations | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      const result = await AppointmentService.getAppointments();

      if (result.success && result.data) {
        setAppointments(result.data);
        setFilteredAppointments(result.data);
      } else if (result.error) {
        console.error("Error fetching appointments:", result.error);
      }
      setLoading(false);
    };

    fetchAppointments();

    // Set up real-time subscription for appointment changes
    console.log("Setting up real-time subscription for appointments");
    const channel = supabase
      .channel(`appointments-page-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          console.log("Real-time appointment update received:", payload);
          // Refetch appointments when any change occurs
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    let filtered = appointments;

    if (searchTerm) {
      filtered = filtered.filter(
        (appointment) =>
          appointment.clinic_patient?.patient_profile?.full_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          appointment.clinic_doctor?.doctor_profile?.full_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          appointment.clinic_patient?.patient_profile?.phone?.includes(
            searchTerm
          )
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(
        (appointment) => appointment.status === statusFilter
      );
    }

    // Keep the original order from AppointmentService (already sorted by created_at desc)
    // Don't re-sort here to avoid conflicts with service-level sorting

    setFilteredAppointments(filtered);
  }, [searchTerm, statusFilter, appointments]);

  // local optimistic update helper after modal actions
  const applyLocalPatch = (
    patch: Partial<AppointmentWithRelations> & { id: string }
  ) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === patch.id ? { ...a, ...patch } : a))
    );
    setFilteredAppointments((prev) =>
      prev.map((a) => (a.id === patch.id ? { ...a, ...patch } : a))
    );
  };

  const openDetails = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleRescheduleAppointment = (
    appointment: AppointmentWithRelations
  ) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(false);
    setIsRescheduleModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedAppointment(null);
    setIsRescheduleModalOpen(false);
    setShowDetailsModal(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Appointments & Queue
          </h1>
          <p className="text-gray-600 mt-1">
            Manage appointments and monitor live queue
          </p>
        </div>
        {activeTab === "appointments" && (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 sm:mt-0"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Schedule Appointment
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardContent className="py-0">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("appointments")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "appointments"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <div className="flex items-center space-x-2">
                <CalendarDays className="h-4 w-4" />
                <span>Appointment Management</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === "queue"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <div className="flex items-center space-x-2">
                <MonitorSpeaker className="h-4 w-4" />
                <span>Live Queue Dashboard</span>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === "appointments" ? (
        <div className="space-y-6">
          {/* Search and Filter for Appointments */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search by patient or doctor name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  label=""
                  name="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Statuses" },
                    { value: AppointmentStatus.SCHEDULED, label: "Scheduled" },
                    { value: AppointmentStatus.COMPLETED, label: "Completed" },
                    { value: AppointmentStatus.CANCELLED, label: "Cancelled" },
                    { value: AppointmentStatus.NO_SHOW, label: "No Show" },
                    {
                      value: AppointmentStatus.RESCHEDULED,
                      label: "Rescheduled",
                    },
                    {
                      value: AppointmentStatus.CHECKED_IN,
                      label: "Checked-In",
                    },
                    {
                      value: AppointmentStatus.IN_PROGRESS,
                      label: "In-Progress",
                    },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {/* View Toggle */}
          <div className="flex justify-end">
            <div className="flex rounded-lg border border-gray-200 bg-white p-1">
              <Button
                variant={viewMode === "list" ? "primary" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center space-x-2"
              >
                <List className="h-4 w-4" />
                <span>List</span>
              </Button>
              <Button
                variant={viewMode === "calendar" ? "primary" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="flex items-center space-x-2"
              >
                <Grid3X3 className="h-4 w-4" />
                <span>Calendar</span>
              </Button>
            </div>
          </div>

          {/* Content based on view mode */}
          {viewMode === "calendar" ? (
            <CalendarView onSelectAppointment={openDetails} />
          ) : (
            /* Appointments Table */
            <Card>
              <CardContent className="p-4">
                <div className="overflow-auto max-h-[60vh]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Delays
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Queue
                        </th>
                        <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAppointments.map((appointment, index) => {
                        const statusStyles = {
                          [AppointmentStatus.SCHEDULED]:
                            "bg-blue-100 text-blue-800",
                          [AppointmentStatus.CHECKED_IN]:
                            "bg-green-100 text-green-800",
                          [AppointmentStatus.IN_PROGRESS]:
                            "bg-yellow-100 text-yellow-800",
                          [AppointmentStatus.COMPLETED]:
                            "bg-emerald-100 text-emerald-800",
                          [AppointmentStatus.CANCELLED]:
                            "bg-red-100 text-red-800",
                          [AppointmentStatus.NO_SHOW]:
                            "bg-gray-100 text-gray-800",
                        };

                        const isToday =
                          new Date(
                            appointment.appointment_datetime
                          ).toDateString() === new Date().toDateString();
                        const isPast =
                          new Date(appointment.appointment_datetime) <
                          new Date();

                        return (
                          <tr key={appointment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {index + 1}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                    {capitalizeWords(
                                      appointment.clinic_patient
                                        ?.patient_profile?.full_name
                                    )}
                                    {isToday && (
                                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                        Today
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {
                                      appointment.clinic_patient
                                        ?.patient_profile?.phone
                                    }
                                  </div>
                                  {appointment.queue_position && (
                                    <div className="text-xs text-gray-400">
                                      Queue #{appointment.queue_position}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-700">
                              <div>
                                <div className="font-medium">
                                  Dr.{" "}
                                  {capitalizeWords(
                                    appointment.clinic_doctor?.doctor_profile
                                      ?.full_name
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {
                                    appointment.clinic_doctor?.doctor_profile
                                      ?.primary_specialization
                                  }
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-700">
                              <div>
                                <div className="font-medium">
                                  {format(
                                    new Date(appointment.appointment_datetime),
                                    "MMM d, yyyy"
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(
                                    new Date(appointment.appointment_datetime),
                                    "h:mm a"
                                  )}
                                </div>
                                {appointment.doctor_slot && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    Slot: {appointment.doctor_slot.slot_name}
                                    {appointment.slot_booking_order && (
                                      <span className="ml-1">
                                        (#{appointment.slot_booking_order})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-700">
                              <div>
                                <div className="font-medium flex items-center gap-1">
                                  {appointment.appointment_type || "General"}
                                  {appointment.appointment_type
                                    ?.toLowerCase()
                                    .includes("video") && (
                                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                        <Video className="w-3 h-3 inline" />
                                      </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {appointment.duration_minutes || 30} min
                                  {appointment.doctor_slot?.max_capacity && (
                                    <span className="block text-blue-600">
                                      Capacity:{" "}
                                      {appointment.doctor_slot.current_bookings}
                                      /{appointment.doctor_slot.max_capacity}
                                    </span>
                                  )}
                                  {appointment.actual_start_time &&
                                    appointment.actual_end_time &&
                                    appointment.status ===
                                    AppointmentStatus.COMPLETED && (
                                      <span className="text-orange-600 block">
                                        Actual:{" "}
                                        {Math.round(
                                          (new Date(
                                            appointment.actual_end_time
                                          ).getTime() -
                                            new Date(
                                              appointment.actual_start_time
                                            ).getTime()) /
                                          (1000 * 60)
                                        )}{" "}
                                        min
                                      </span>
                                    )}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusStyles[
                                  appointment.status as keyof typeof statusStyles
                                ] || statusStyles[AppointmentStatus.SCHEDULED]
                                  }`}
                              >
                                {(appointment.status || "scheduled").replace(
                                  "_",
                                  " "
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-700">
                              {Number(appointment.delay_minutes ?? 0) > 0 ? (
                                <div className="text-red-600">
                                  <div className="font-medium">
                                    +{appointment.delay_minutes}m
                                  </div>
                                  <div className="text-xs text-red-500">
                                    delay
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-700">
                              {typeof appointment.queue_position ===
                                "number" ? (
                                <div>
                                  <div className="font-medium">
                                    #{appointment.queue_position}
                                  </div>
                                  {/* ETA removed from list view */}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Video Call Link - Copy to clipboard */}
                                {appointment.appointment_type
                                  ?.toLowerCase()
                                  .includes("video") &&
                                  (appointment as any).video_call_id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Include patient data for sidebar
                                        const patientName = appointment.clinic_patient?.patient_profile?.full_name || "Patient";
                                        const symptoms = (appointment as any).symptoms || "Not provided";
                                        const params = new URLSearchParams({
                                          callId: (appointment as any).video_call_id,
                                          userId: `doctor-${appointment.clinic_doctor?.id || "doc"}`,
                                          userName: `Dr. ${appointment.clinic_doctor?.doctor_profile?.full_name || "Doctor"}`,
                                          patientName: patientName,
                                          patientSymptoms: symptoms,
                                        });
                                        const link = `${window.location.origin}/admin/video-room?${params.toString()}`;
                                        navigator.clipboard.writeText(link);
                                        alert("Video call link copied to clipboard!");
                                      }}
                                      className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                      title="Copy Video Call Link"
                                    >
                                      <Link2 className="w-4 h-4" />
                                    </button>
                                  )}
                                <button
                                  onClick={() => openDetails(appointment)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {!isPast &&
                                  appointment.status !==
                                  AppointmentStatus.CANCELLED &&
                                  appointment.status !==
                                  AppointmentStatus.COMPLETED &&
                                  appointment.status !==
                                  AppointmentStatus.NO_SHOW && (
                                    <button
                                      onClick={() =>
                                        handleRescheduleAppointment(appointment)
                                      }
                                      className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
                                      title="Reschedule"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredAppointments.length === 0 && (
                    <div className="text-center py-8">
                      <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No appointments
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {searchTerm || statusFilter
                          ? "No appointments match your search criteria."
                          : "Get started by creating a new appointment."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        // Queue Dashboard Tab Content
        <QueueTab />
      )
      }

      {/* Modals */}
      <AddAppointmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <RescheduleAppointmentModal
        isOpen={isRescheduleModalOpen}
        onClose={handleCloseModals}
        appointment={selectedAppointment as any}
      />

      <AppointmentDetailsModal
        isOpen={showDetailsModal}
        appointment={selectedAppointment as any}
        onClose={() => setShowDetailsModal(false)}
        onReschedule={handleRescheduleAppointment as any}
        onAfterUpdate={applyLocalPatch as any}
      />
    </div >
  );
}
