import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Calendar, dateFnsLocalizer, View, Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import {
  AppointmentService,
  AppointmentWithRelations,
} from "../services/AppointmentService";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Card } from "./ui/Card";
// Icons removed after refactor – keep file lean
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./CalendarView.css";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type AppointmentWithDetails = AppointmentWithRelations;

interface CalendarEvent extends Event {
  resource: AppointmentWithDetails;
}

interface CalendarViewProps {
  defaultView?: View;
  onSelectAppointment?: (appointment: AppointmentWithRelations) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  defaultView = "month",
  onSelectAppointment,
}) => {
  const [view, setView] = useState<View>(defaultView);
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [showEventModal, setShowEventModal] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  // actionLoading & inline status actions removed (delegated to unified modal)
  const { user } = useAuth();

  // Fetch appointments with proper structure using AppointmentService
  const fetchAppointments = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const result = await AppointmentService.getAppointments();

      if (result.success && result.data) {
        console.log("Calendar appointments fetched:", result.data);
        setAppointments(result.data);
      } else if (result.error) {
        console.error("Error fetching appointments:", result.error);
        setAppointments([]);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAppointments();

    // Real-time subscription - listens for any appointment changes
    const subscription = supabase
      .channel("calendar-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          console.log("Real-time appointment update received");
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAppointments, user?.id]);

  // Convert appointments to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((appointment) => {
      const start = new Date(appointment.appointment_datetime);
      const end = new Date(
        start.getTime() + (appointment.duration_minutes || 30) * 60000
      );

      return {
        id: appointment.id,
        title: `${
          appointment.clinic_patient?.patient_profile?.full_name || "Unknown"
        } - ${
          appointment.clinic_doctor?.doctor_profile?.full_name || "Unknown Dr."
        }`,
        start,
        end,
        resource: appointment,
      };
    });
  }, [appointments]);

  // Modern status colors - Minimal palette
  const getEventStyle = (event: CalendarEvent) => {
    const status = event.resource.status;

    // Map status to CSS class for consistent styling
    const statusClass =
      {
        scheduled: "event-scheduled",
        "checked-in": "event-checked-in",
        "in-progress": "event-in-progress",
        completed: "event-completed",
        cancelled: "event-cancelled",
        "no-show": "event-no-show",
        rescheduled: "event-rescheduled",
      }[status || "scheduled"] || "event-scheduled";

    return {
      className: statusClass,
      style: {
        border: "none",
        fontSize: "12px",
        fontWeight: "500",
      },
    };
  };

  // Handle event selection - prevent double modal
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      if (onSelectAppointment) {
        onSelectAppointment(event.resource);
        return; // delegate to parent modal
      }
      setSelectedEvent(event);
      setShowEventModal(true);
    },
    [onSelectAppointment]
  );

  // Update appointment status
  // Inline update + status buttons removed in favor of unified modal in parent

  // Modern toolbar component
  const CustomToolbar = ({
    label,
    onNavigate,
    onView,
  }: {
    label: string;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
    onView: (view: View) => void;
  }) => (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 p-4 bg-gradient-to-r from-orange-50/30 to-rose-50/30 rounded-lg border border-orange-100/50">
      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("PREV")}
          className="hover:bg-orange-50 border-orange-200 text-orange-700"
        >
          ←
        </Button>
        <h2 className="font-medium text-lg text-gray-800">{label}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("NEXT")}
          className="hover:bg-orange-50 border-orange-200 text-orange-700"
        >
          →
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("TODAY")}
          className="hover:bg-orange-50 border-orange-200 text-orange-700"
        >
          Today
        </Button>
      </div>
      <div className="flex space-x-2 mt-2 sm:mt-0">
        {(["month", "week", "day"] as View[]).map((viewName) => (
          <Button
            key={viewName}
            variant={view === viewName ? "primary" : "outline"}
            size="sm"
            onClick={() => onView(viewName)}
            className={
              view === viewName
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "hover:bg-orange-50 border-orange-200 text-orange-700"
            }
          >
            {viewName.charAt(0).toUpperCase() + viewName.slice(1)}
          </Button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-blue-600 font-medium">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="h-[700px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={getEventStyle}
          components={{
            toolbar: CustomToolbar,
          }}
          className="modern-calendar"
          dayPropGetter={(date: Date) => ({
            style: {
              backgroundColor:
                date.toDateString() === new Date().toDateString()
                  ? "#EBF8FF"
                  : "white",
            },
          })}
        />
      </div>

      {/* Internal modal retained only if no parent handler supplied */}
      {!onSelectAppointment && (
        <Modal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          title="Appointment Details"
        >
          {selectedEvent && (
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                This view now delegates to the unified details modal when used
                from the Appointments page.
              </p>
              <Card className="p-4">
                Select an appointment from the main Appointments page to manage
                status.
              </Card>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
