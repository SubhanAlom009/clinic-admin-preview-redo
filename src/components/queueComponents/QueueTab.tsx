/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  UserCheck,
  Calendar,
  Search,
  RefreshCw,
  Activity,
  Users,
  CheckCircle,
  PlayCircle,
  User,
  X,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Card, CardContent } from "../ui/Card";
import { MetricCard } from "../ui/MetricCard";
import { AppointmentService } from "../../services/AppointmentService";
import { AppointmentStatus } from "../../constants";
import { useAuth } from "../../hooks/useAuth";
import { AppointmentWithRelations } from "../../services/AppointmentService";
import { format } from "date-fns";
import { supabase } from "../../lib/supabase";
import { QueueManagementModal } from "./QueueManagementModal";
import { PrescriptionUploadModal } from "../appointmentComponents/PrescriptionUploadModal";

// Custom Doctor interface for queue display
interface Doctor {
  id: string;
  name: string;
  specialization: string;
  phone: string;
  user_id: string;
  employee_id: string | null;
}

export function QueueTab() {
  const [queueData, setQueueData] = useState<AppointmentWithRelations[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [queueManagementOpen, setQueueManagementOpen] = useState(false);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [
    selectedAppointmentForPrescription,
    setSelectedAppointmentForPrescription,
  ] = useState<AppointmentWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const { user } = useAuth();

  // Auto-select first doctor when doctors are loaded
  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctor) {
      console.log("Auto-selecting first doctor:", doctors[0]);
      setSelectedDoctor(doctors[0].id);
    }
  }, [doctors, selectedDoctor]);

  const fetchDoctors = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("clinic_doctors")
        .select(
          `
          id,
          employee_id,
          is_active,
          doctor_profile:doctor_profiles(
            id, full_name, primary_specialization, phone
          )
        `
        )
        .eq("clinic_id", user.id)
        .eq("is_active", true)
        .order("doctor_profile(full_name)");

      if (error) throw error;

      // Transform the data to match the expected Doctor interface
      const doctorsData = (data || []).map((clinicDoctor: any) => ({
        id: clinicDoctor.id,
        name: clinicDoctor.doctor_profile?.full_name || "Unknown",
        specialization:
          clinicDoctor.doctor_profile?.primary_specialization || "General",
        phone: clinicDoctor.doctor_profile?.phone || "",
        user_id: user.id,
        employee_id: clinicDoctor.employee_id,
      }));

      setDoctors(doctorsData as any);
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  }, [user?.id]);

  const fetchQueue = useCallback(async () => {
    if (!user?.id || !selectedDoctor) {
      console.log("Skipping fetchQueue - missing user or selectedDoctor:", {
        user: !!user?.id,
        selectedDoctor,
      });
      return;
    }

    try {
      setLoading(true);

      console.log("Fetching queue with filters:", {
        selectedDoctor,
        selectedDate,
        user_id: user.id,
      });

      // Use AppointmentService - always filter by doctor in queue tab
      const response = await AppointmentService.getAppointments({
        clinicDoctorId: selectedDoctor, // Always require doctor selection
        date:
          selectedDate && selectedDate.trim() !== "" ? selectedDate : undefined,
        searchTerm: searchTerm || undefined,
      });

      console.log("Service response:", response);

      if (response.success && response.data) {
        console.log(
          "Fetched queue data:",
          response.data.length,
          "appointments"
        );

        // Auto-assign queue positions to appointments that don't have them
        const dataWithPositions = response.data.map((appointment, index) => {
          if (
            !appointment.queue_position &&
            appointment.status !== AppointmentStatus.COMPLETED
          ) {
            // Assign a temporary queue position for display purposes
            return { ...appointment, queue_position: 999 + index };
          }
          return appointment;
        });

        // Sort appointments: active appointments by queue_position, completed by datetime
        const sorted = dataWithPositions.sort((a, b) => {
          // Completed appointments go to bottom, sorted by completion time (newest first)
          if (
            a.status === AppointmentStatus.COMPLETED &&
            b.status === AppointmentStatus.COMPLETED
          ) {
            return (
              new Date(b.actual_end_time || b.updated_at).getTime() -
              new Date(a.actual_end_time || a.updated_at).getTime()
            );
          }

          // Active appointments stay at top
          if (
            a.status !== AppointmentStatus.COMPLETED &&
            b.status === AppointmentStatus.COMPLETED
          ) {
            return -1;
          }
          if (
            a.status === AppointmentStatus.COMPLETED &&
            b.status !== AppointmentStatus.COMPLETED
          ) {
            return 1;
          }

          // For active appointments, sort by queue_position, then by datetime
          const aPos = a.queue_position || 999;
          const bPos = b.queue_position || 999;
          if (aPos !== bPos) {
            return aPos - bPos;
          }

          return (
            new Date(a.appointment_datetime).getTime() -
            new Date(b.appointment_datetime).getTime()
          );
        });
        setQueueData(sorted);
        setLastRefresh(new Date());
      } else {
        console.error("Error from service:", response.error);
        setQueueData([]);
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
      setQueueData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctor, selectedDate, user?.id, searchTerm]);

  useEffect(() => {
    if (user) {
      fetchDoctors();
      // Don't call fetchQueue here - it will be called by the selectedDoctor effect
    }
  }, [user, fetchDoctors]);

  useEffect(() => {
    fetchQueue();
  }, [selectedDoctor, selectedDate, searchTerm, fetchQueue]);

  // Enhanced real-time subscription for queue updates
  useEffect(() => {
    if (!user?.id || !selectedDoctor) return;

    console.log(
      "Setting up real-time subscription for doctor:",
      selectedDoctor
    );

    const channel = supabase
      .channel(`queue-updates-${user.id}-${selectedDoctor}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_doctor_id=eq.${selectedDoctor}`,
        },
        (payload) => {
          console.log("Real-time queue update received:", {
            eventType: payload.eventType,
            table: payload.table,
            new: payload.new,
            old: payload.old,
          });

          // Debounced refresh to avoid too many rapid updates
          setTimeout(() => {
            fetchQueue();
          }, 500);
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
      });

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedDoctor, fetchQueue]);

  // Queue recalculation is handled automatically by database triggers
  // Positions update instantly when appointment status/check-in changes

  const updateAppointmentStatus = async (
    id: string,
    status: string,
    updates: Record<string, string | boolean | null> = {}
  ) => {
    try {
      setActionLoading(id);

      // Update appointment - database trigger will auto-recalculate queue positions
      const { error } = await AppointmentService.updateAppointment(id, {
        status: status as AppointmentStatus,
        ...updates,
      });

      if (error) throw error;

      console.log(
        "Appointment status updated. Queue positions auto-recalculated by database trigger."
      );
      // Real-time subscription will automatically refresh the queue
    } catch (error) {
      console.error("Error updating appointment:", error);
      alert("Error updating appointment status");
    } finally {
      setActionLoading(null);
    }
  };

  const checkInPatient = (appointment: AppointmentWithRelations) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.CHECKED_IN, {
      patient_checked_in: true,
      checked_in_at: new Date().toISOString(),
    });
  };

  const startAppointment = (appointment: AppointmentWithRelations) => {
    updateAppointmentStatus(appointment.id, AppointmentStatus.IN_PROGRESS, {
      actual_start_time: new Date().toISOString(),
    });
  };

  const completeAppointment = async (appointment: AppointmentWithRelations) => {
    // Open prescription upload modal instead of directly completing
    setSelectedAppointmentForPrescription(appointment);
    setPrescriptionModalOpen(true);
  };

  const handlePrescriptionSuccess = () => {
    console.log("Appointment completed with prescription. Refreshing queue...");

    // Immediate refresh to show changes
    setTimeout(() => {
      fetchQueue();
      console.log("Queue refreshed after completion");
    }, 1000);
  };

  const markAsNoShow = async (appointment: AppointmentWithRelations) => {
    try {
      setActionLoading(appointment.id);

      // Update appointment - database trigger will auto-recalculate queue positions
      const { error } = await AppointmentService.updateAppointment(
        appointment.id,
        {
          status: AppointmentStatus.NO_SHOW,
        }
      );

      if (error) throw error;

      console.log(
        "Appointment marked as no-show. Queue recalculation triggered. Refreshing queue..."
      );

      if (error) throw error;

      console.log("Appointment marked as no-show. Queue auto-recalculated.");
      // Real-time subscription will automatically refresh the queue
    } catch (error) {
      console.error("Error marking appointment as no-show:", error);
      alert("Error marking appointment as no-show");
    } finally {
      setActionLoading(null);
    }
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
      case AppointmentStatus.NO_SHOW:
        return "bg-gray-100 text-gray-800 border-gray-200";
      case AppointmentStatus.CANCELLED:
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getActionButton = (appointment: AppointmentWithRelations) => {
    const isLoading = actionLoading === appointment.id;

    switch (appointment.status) {
      case AppointmentStatus.SCHEDULED:
        if (!appointment.patient_checked_in) {
          return (
            <div className="flex space-x-2">
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
              <Button
                size="sm"
                onClick={() => markAsNoShow(appointment)}
                disabled={isLoading}
                className="bg-gray-600 hover:bg-gray-700"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                No Show
              </Button>
            </div>
          );
        }
        return (
          <div className="flex space-x-2">
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
            <Button
              size="sm"
              onClick={() => markAsNoShow(appointment)}
              disabled={isLoading}
              className="bg-gray-600 hover:bg-gray-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              No Show
            </Button>
          </div>
        );
      case AppointmentStatus.CHECKED_IN:
        return (
          <div className="flex space-x-2">
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
            <Button
              size="sm"
              onClick={() => markAsNoShow(appointment)}
              disabled={isLoading}
              className="bg-gray-600 hover:bg-gray-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              No Show
            </Button>
          </div>
        );
      case AppointmentStatus.IN_PROGRESS:
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
      case AppointmentStatus.COMPLETED:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      case AppointmentStatus.NO_SHOW:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <X className="h-3 w-3 mr-1" />
            No Show
          </span>
        );
      default:
        return null;
    }
  };

  const filteredQueue = queueData.filter((appointment) => {
    const patient = appointment.clinic_patient;
    const doctor = appointment.clinic_doctor;

    const searchMatch =
      !searchTerm ||
      patient?.patient_profile?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      doctor?.doctor_profile?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      appointment.id.toString().includes(searchTerm);

    const matchesDoctor =
      selectedDoctor === "" || appointment.clinic_doctor?.id === selectedDoctor;

    return searchMatch && matchesDoctor;
  });

  // Separate active and completed appointments
  const activeAppointments = filteredQueue
    .filter(
      (appointment) =>
        appointment.status !== AppointmentStatus.COMPLETED &&
        appointment.status !== AppointmentStatus.NO_SHOW &&
        appointment.status !== AppointmentStatus.CANCELLED
    )
    .sort((a, b) => {
      // Sort active appointments by queue_position (nulls last), then by datetime
      const aPos = a.queue_position || 999;
      const bPos = b.queue_position || 999;
      if (aPos !== bPos) {
        return aPos - bPos;
      }
      return (
        new Date(a.appointment_datetime).getTime() -
        new Date(b.appointment_datetime).getTime()
      );
    });

  const completedAppointments = filteredQueue
    .filter(
      (appointment) =>
        appointment.status === AppointmentStatus.COMPLETED ||
        appointment.status === AppointmentStatus.NO_SHOW ||
        appointment.status === AppointmentStatus.CANCELLED
    )
    .sort((a, b) => {
      // Sort completed appointments by completion time (newest first)
      return (
        new Date(b.actual_end_time || b.updated_at).getTime() -
        new Date(a.actual_end_time || a.updated_at).getTime()
      );
    });

  // Get current appointments based on active tab
  const currentAppointments =
    activeTab === "active" ? activeAppointments : completedAppointments;

  const queueStats = {
    total: activeAppointments.length, // Only count active appointments in queue
    checkedIn: activeAppointments.filter(
      (a) => a.patient_checked_in || a.status === AppointmentStatus.CHECKED_IN
    ).length,
    inProgress: activeAppointments.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    ).length,
    completed: completedAppointments.length, // Completed appointments count
  };

  const stats = {
    scheduled: activeAppointments.filter(
      (a) => a.status === AppointmentStatus.SCHEDULED
    ).length,
    inProgress: activeAppointments.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS
    ).length,
    completed: completedAppointments.length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total"
          value={queueStats.total}
          icon={Users}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Checked In"
          value={queueStats.checkedIn}
          icon={CheckCircle}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="In Progress"
          value={queueStats.inProgress}
          icon={Activity}
          trend={{ value: 0, isPositive: true }}
        />
        <MetricCard
          title="Completed"
          value={queueStats.completed}
          icon={CheckCircle}
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center justify-between mb-4">
            {/* Tab Buttons */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "active"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                Active Queue ({activeAppointments.length})
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "completed"
                    ? "bg-white text-green-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                Completed ({completedAppointments.length})
              </button>
            </div>

            {/* Queue Management Button */}
            {selectedDoctor && activeTab === "active" && (
              <Button
                onClick={() => setQueueManagementOpen(true)}
                variant="outline"
                size="sm"
                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                <Activity className="h-4 w-4 mr-2" />
                Queue Management
              </Button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search patients, phone numbers, or appointment IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="min-w-[150px]"
                options={[
                  { value: "", label: "Select Doctor" },
                  ...doctors.map((doctor) => ({
                    value: doctor.id,
                    label: `Dr. ${doctor.name}`,
                  })),
                ]}
                required
              />

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {(selectedDoctor ||
                searchTerm ||
                selectedDate !== format(new Date(), "yyyy-MM-dd")) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDoctor("");
                      setSelectedDate(format(new Date(), "yyyy-MM-dd"));
                      setSearchTerm("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-100 mt-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {currentAppointments.length}
              </span>{" "}
              {activeTab === "active" ? "in queue" : "completed"}
            </div>
            {activeTab === "active" && (
              <>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600">
                    {stats.scheduled}
                  </span>{" "}
                  scheduled
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-orange-600">
                    {stats.inProgress}
                  </span>{" "}
                  in progress
                </div>
              </>
            )}
            {activeTab === "completed" && (
              <div className="text-sm text-gray-600">
                <span className="font-medium text-green-600">
                  {stats.completed}
                </span>{" "}
                total completed today
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : currentAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === "active"
                ? "No active appointments"
                : "No completed appointments"}
            </h3>
            <p className="text-gray-500">
              {selectedDoctor || selectedDate
                ? `No ${activeTab} appointments found for the selected filters.`
                : `No ${activeTab} appointments yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentAppointments.map((appointment) => (
            <Card
              key={appointment.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Only show queue position for active appointments */}
                    {activeTab === "active" && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            #{appointment.queue_position || "?"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {appointment.clinic_patient?.patient_profile
                            ?.full_name || "Unknown Patient"}
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
                            : appointment.status
                              ?.replace("-", " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                        {appointment.emergency_status && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            🚨 EMERGENCY
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {format(
                            new Date(appointment.appointment_datetime),
                            "h:mm a"
                          )}
                        </div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          <span className="font-mono text-sm">
                            #{appointment.queue_position || "?"}
                          </span>
                        </div>
                        {appointment.clinic_doctor && (
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 mr-1" />
                            Dr.{" "}
                            {
                              appointment.clinic_doctor.doctor_profile
                                ?.full_name
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Only show action buttons for active appointments */}
                    {activeTab === "active" && getActionButton(appointment)}
                  </div>
                </div>

                {appointment.emergency_status &&
                  appointment.emergency_reason && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">
                          🚨 Emergency Reason:
                        </span>{" "}
                        {appointment.emergency_reason}
                      </p>
                    </div>
                  )}

                {appointment.symptoms && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Symptoms:</span>{" "}
                      {appointment.symptoms}
                    </p>
                  </div>
                )}

                {appointment.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notes:</span>{" "}
                      {appointment.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Queue Management Modal */}
      <QueueManagementModal
        isOpen={queueManagementOpen}
        onClose={() => setQueueManagementOpen(false)}
        selectedDoctor={selectedDoctor}
        selectedDate={selectedDate}
        doctors={doctors}
        onRefreshQueue={fetchQueue}
      />

      {/* Prescription Upload Modal */}
      <PrescriptionUploadModal
        isOpen={prescriptionModalOpen}
        onClose={() => {
          setPrescriptionModalOpen(false);
          setSelectedAppointmentForPrescription(null);
        }}
        appointment={selectedAppointmentForPrescription}
        onSuccess={handlePrescriptionSuccess}
      />
    </div>
  );
}
