import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { DashboardMetrics } from "../types";
import { AppointmentService } from "../services/AppointmentService";
import { PatientProfileService } from "../services/PatientProfileService";
import { DoctorProfileService } from "../services/DoctorProfileService";
import { format } from "date-fns";

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPatients: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    pendingBills: 0,
    overdueFollowups: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMetrics = async () => {
      try {
        const today = new Date();
        const todayDateString = format(today, "yyyy-MM-dd");

        console.log("Dashboard: Fetching metrics for clinic:", user.id);

        // Pass user.id as clinic_id to all service calls
        const [patientsResponse, doctorsResponse, appointmentsResponse] =
          await Promise.all([
            PatientProfileService.getClinicPatients(user.id),
            DoctorProfileService.getClinicDoctors(user.id),
            AppointmentService.getAppointments(user.id),
          ]);

        console.log("Dashboard: Service responses:", {
          patients: patientsResponse.success
            ? patientsResponse.data?.length
            : `Error: ${patientsResponse.error?.message}`,
          doctors: doctorsResponse.success
            ? doctorsResponse.data?.length
            : `Error: ${doctorsResponse.error?.message}`,
          appointments: appointmentsResponse.success
            ? appointmentsResponse.data?.length
            : `Error: ${appointmentsResponse.error?.message}`,
        });

        // Calculate metrics with error handling
        const totalPatients = patientsResponse.success
          ? patientsResponse.data?.length || 0
          : 0;
        const totalDoctors = doctorsResponse.success
          ? doctorsResponse.data?.length || 0
          : 0;

        // Filter today's appointments with defensive programming
        const todayAppointments = appointmentsResponse.success
          ? (appointmentsResponse.data || []).filter((appointment) => {
              try {
                const appointmentDate = format(
                  new Date(appointment.appointment_datetime),
                  "yyyy-MM-dd"
                );
                return appointmentDate === todayDateString;
              } catch {
                return false; // Skip invalid dates
              }
            }).length
          : 0;

        const newMetrics = {
          totalPatients,
          totalDoctors,
          todayAppointments,
          pendingBills: 0, // Will implement later
          overdueFollowups: 0, // Will implement later
        };

        console.log("Dashboard: Final metrics:", newMetrics);
        setMetrics(newMetrics);
      } catch (error) {
        console.error("Dashboard: Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!user) return;
    fetchMetrics();
  }, [user]);

  const refetch = async () => {
    setLoading(true);
    await fetchMetrics();
  };

  return { metrics, loading, refetch };
}
