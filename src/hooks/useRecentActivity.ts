import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { AppointmentService } from "../services/AppointmentService";

interface RecentActivity {
  id: string;
  type: "appointment" | "payment" | "patient" | "doctor";
  title: string;
  timestamp: string;
}

export function useRecentActivity() {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRecentActivity = async () => {
      try {
        const activities: RecentActivity[] = [];

        // Get appointments without filters - the service will scope by clinic internally
        const appointmentsResponse = await AppointmentService.getAppointments();

        if (appointmentsResponse.success && appointmentsResponse.data) {
          const recentAppointments = appointmentsResponse.data
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )
            .slice(0, 10);

          recentAppointments.forEach((appointment) => {
            // Extract patient and doctor names
            const patientName =
              appointment.clinic_patient?.patient_profile?.full_name;
            const doctorName =
              appointment.clinic_doctor?.doctor_profile?.full_name;

            // Skip appointments without proper patient/doctor data
            if (!patientName || !doctorName) {
              console.warn(
                "Skipping appointment due to missing patient/doctor data:",
                {
                  appointmentId: appointment.id,
                  hasPatient: !!patientName,
                  hasDoctor: !!doctorName,
                }
              );
              return;
            }

            let activityTitle = "";
            switch (appointment.status) {
              case "scheduled":
                activityTitle = `Appointment scheduled for ${patientName} with ${doctorName}`;
                break;
              case "completed":
                activityTitle = `Appointment completed for ${patientName} with ${doctorName}`;
                break;
              case "cancelled":
                activityTitle = `Appointment cancelled for ${patientName} with ${doctorName}`;
                break;
              default:
                activityTitle = `Appointment ${appointment.status} for ${patientName} with ${doctorName}`;
            }

            activities.push({
              id: appointment.id,
              type: "appointment",
              title: activityTitle,
              timestamp: appointment.created_at,
            });
          });
        } else {
          console.error(
            "Failed to fetch appointments for recent activity:",
            appointmentsResponse.error?.message
          );
        }

        setActivities(activities.slice(0, 10));
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!user) return;
    fetchRecentActivity();
  }, [user]);

  const refetch = async () => {
    setLoading(true);
    await fetchRecentActivity();
  };

  return { activities, loading, refetch };
}
