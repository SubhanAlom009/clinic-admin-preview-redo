import { useState } from "react";
import {
  Users,
  UserCheck,
  Calendar,
  Receipt,
  AlertTriangle,
  Plus,
  Clock,
  User,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { MetricCard } from "../components/ui/MetricCard";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { AddPatientModal } from "../components/patientComponents/AddPatientModal";
import { AddAppointmentModal } from "../components/appointmentComponents/AddAppointmentModal";
import { AddBillModal } from "../components/billComponents/AddBillModal";
import { format } from "date-fns";

export function Dashboard() {
  const { metrics, loading, refetch: refetchMetrics } = useDashboardMetrics();
  const { activities, loading: activitiesLoading, refetch: refetchActivities } = useRecentActivity();
  const [activeModal, setActiveModal] = useState<
    "patient" | "appointment" | "bill" | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchMetrics(), refetchActivities()]);
    } catch (error) {
      console.error("Error refreshing dashboard:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome to your clinic management system
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={handleRefresh}
            size="sm"
            variant="outline"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setActiveModal("patient")}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
          <Button
            onClick={() => setActiveModal("appointment")}
            size="sm"
            variant="outline"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          title="Total Patients"
          value={metrics.totalPatients}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Total Doctors"
          value={metrics.totalDoctors}
          icon={UserCheck}
          color="green"
        />
        <MetricCard
          title="Today's Appointments"
          value={metrics.todayAppointments}
          icon={Calendar}
          color="yellow"
        />
        <MetricCard
          title="Pending Bills"
          value={metrics.pendingBills}
          icon={Receipt}
          color="red"
        />
        <MetricCard
          title="Overdue Follow-ups"
          value={metrics.overdueFollowups}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setActiveModal("patient")}
              className="w-full justify-start"
              variant="outline"
            >
              <Users className="h-5 w-5 mr-3" />
              Add New Patient
            </Button>
            <Button
              onClick={() => setActiveModal("appointment")}
              className="w-full justify-start"
              variant="outline"
            >
              <Calendar className="h-5 w-5 mr-3" />
              Schedule Appointment
            </Button>
            <Button
              onClick={() => setActiveModal("bill")}
              className="w-full justify-start"
              variant="outline"
            >
              <Receipt className="h-5 w-5 mr-3" />
              Generate Bill
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {activitiesLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No recent activity</p>
                <p className="text-sm">
                  Activity will appear here as you use the system
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.slice(0, 5).map((activity) => {
                  const getActivityIcon = () => {
                    switch (activity.type) {
                      case "appointment":
                        return Calendar;
                      case "payment":
                        return CreditCard;
                      case "patient":
                        return User;
                      case "doctor":
                        return UserCheck;
                      default:
                        return Clock;
                    }
                  };

                  const getActivityColor = () => {
                    switch (activity.type) {
                      case "appointment":
                        return "bg-blue-50 text-blue-600";
                      case "payment":
                        return "bg-green-50 text-green-600";
                      case "patient":
                        return "bg-purple-50 text-purple-600";
                      case "doctor":
                        return "bg-orange-50 text-orange-600";
                      default:
                        return "bg-gray-50 text-gray-600";
                    }
                  };

                  const ActivityIcon = getActivityIcon();

                  return (
                    <div
                      key={activity.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg ${getActivityColor()
                        .replace("text-", "bg-")
                        .replace("-600", "-50")}`}
                    >
                      <div className={`p-1 rounded-full ${getActivityColor()}`}>
                        <ActivityIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(
                            new Date(activity.timestamp),
                            "MMM d, h:mm a"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {activeModal === "patient" && (
        <AddPatientModal 
          isOpen={true} 
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null);
            // Refresh dashboard metrics after adding patient
            refetchMetrics();
          }}
        />
      )}
      {activeModal === "appointment" && (
        <AddAppointmentModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "bill" && (
        <AddBillModal isOpen={true} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
