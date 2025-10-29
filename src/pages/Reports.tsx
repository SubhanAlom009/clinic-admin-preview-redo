import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Calendar,
  TrendingUp,
  Activity,
  Download,
  BarChart3,
  LineChart,
  PieChart,
} from "lucide-react";
import {
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  Bar,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { AppointmentStatus, BillingStatus } from "../constants";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

// Type definitions for Reports page
interface AppointmentData {
  id: string;
  status: string;
  appointment_datetime: string;
  created_at: string;
}

interface BillData {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface ClinicPatientData {
  id: string;
  created_at: string;
  patient_profile: {
    full_name: string;
  };
}

interface ClinicDoctorData {
  id: string;
  created_at: string;
  doctor_profile: {
    full_name: string;
  };
}

interface ReportData {
  appointmentStats: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  revenueStats: {
    totalRevenue: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  patientStats: {
    totalPatients: number;
    newPatients: number;
    returningPatients: number;
  };
  doctorStats: {
    totalDoctors: number;
    averageAppointments: number;
  };
}

interface ChartData {
  appointmentTrends: Array<{
    date: string;
    completed: number;
    cancelled: number;
    scheduled: number;
  }>;
  revenueTrends: Array<{
    date: string;
    revenue: number;
    paid: number;
    pending: number;
  }>;
  appointmentDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  revenueDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

type ChartView = "line" | "bar" | "area" | "pie";

export function Reports() {
  const [reportData, setReportData] = useState<ReportData>({
    appointmentStats: { total: 0, completed: 0, cancelled: 0, noShow: 0 },
    revenueStats: {
      totalRevenue: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
    },
    patientStats: { totalPatients: 0, newPatients: 0, returningPatients: 0 },
    doctorStats: { totalDoctors: 0, averageAppointments: 0 },
  });

  const [chartData, setChartData] = useState<ChartData>({
    appointmentTrends: [],
    revenueTrends: [],
    appointmentDistribution: [],
    revenueDistribution: [],
  });

  const [dateRange, setDateRange] = useState("thisMonth");
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<ChartView>("bar");
  const { user } = useAuth();

  // Define colors for charts (memoized to prevent useEffect dependency issues)
  const COLORS = useMemo(
    () => ({
      primary: "#3B82F6",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
      purple: "#8B5CF6",
      indigo: "#6366F1",
    }),
    []
  );

  useEffect(() => {
    if (!user) return;

    const fetchReportData = async () => {
      setLoading(true);

      const today = new Date();
      let startDate: Date;
      let endDate: Date = today;

      switch (dateRange) {
        case "last7Days":
          startDate = subDays(today, 7);
          break;
        case "last30Days":
          startDate = subDays(today, 30);
          break;
        case "thisMonth":
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
          break;
        default:
          startDate = subDays(today, 30);
      }

      try {
        // Execute all queries in parallel for better performance
        const [
          appointmentsResult,
          billsResult,
          allPatientsResult,
          newPatientsResult,
          doctorsResult,
        ] = await Promise.all([
          // Fetch appointment statistics
          supabase
            .from("appointments")
            .select("id, status, appointment_datetime, created_at")
            .eq("user_id", user.id)
            .gte("appointment_datetime", startDate.toISOString())
            .lte("appointment_datetime", endDate.toISOString()),

          // Fetch revenue statistics
          supabase
            .from("bills")
            .select("id, total_amount, status, created_at")
            .eq("user_id", user.id)
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString()),

          // Fetch all patient statistics using clinic_patients
          supabase
            .from("clinic_patients")
            .select(
              `
              id,
              created_at,
              patient_profile:patient_profiles(full_name)
            `
            )
            .eq("clinic_id", user.id),

          // Fetch new patients in date range using clinic_patients
          supabase
            .from("clinic_patients")
            .select(
              `
              id,
              created_at,
              patient_profile:patient_profiles(full_name)
            `
            )
            .eq("clinic_id", user.id)
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString()),

          // Fetch doctor statistics using clinic_doctors
          supabase
            .from("clinic_doctors")
            .select(
              `
              id,
              created_at,
              is_active,
              doctor_profile:doctor_profiles(full_name)
            `
            )
            .eq("clinic_id", user.id)
            .eq("is_active", true),
        ]);

        // Extract data from results
        const appointments =
          (appointmentsResult.data as AppointmentData[]) || [];
        const bills = (billsResult.data as BillData[]) || [];
        const allPatients =
          (allPatientsResult.data as ClinicPatientData[]) || [];
        const newPatients =
          (newPatientsResult.data as ClinicPatientData[]) || [];
        const doctors = (doctorsResult.data as ClinicDoctorData[]) || [];

        // Calculate statistics with proper typing
        const appointmentStats = {
          total: appointments.length,
          completed: appointments.filter(
            (a: AppointmentData) => a.status === AppointmentStatus.COMPLETED
          ).length,
          cancelled: appointments.filter(
            (a: AppointmentData) => a.status === AppointmentStatus.CANCELLED
          ).length,
          noShow: appointments.filter(
            (a: AppointmentData) => a.status === AppointmentStatus.NO_SHOW
          ).length,
        };

        const revenueStats = {
          totalRevenue: bills.reduce(
            (sum: number, bill: BillData) => sum + bill.total_amount,
            0
          ),
          paidAmount: bills
            .filter((b: BillData) => b.status === BillingStatus.PAID)
            .reduce(
              (sum: number, bill: BillData) => sum + bill.total_amount,
              0
            ),
          pendingAmount: bills
            .filter((b: BillData) => b.status === BillingStatus.PENDING)
            .reduce(
              (sum: number, bill: BillData) => sum + bill.total_amount,
              0
            ),
          overdueAmount: bills
            .filter((b: BillData) => b.status === BillingStatus.OVERDUE)
            .reduce(
              (sum: number, bill: BillData) => sum + bill.total_amount,
              0
            ),
        };

        const patientStats = {
          totalPatients: allPatients.length,
          newPatients: newPatients.length,
          returningPatients: allPatients.length - newPatients.length,
        };

        const doctorStats = {
          totalDoctors: doctors.length,
          averageAppointments: doctors.length
            ? Math.round(appointmentStats.total / doctors.length)
            : 0,
        };

        setReportData({
          appointmentStats,
          revenueStats,
          patientStats,
          doctorStats,
        });

        // Generate chart data
        const generateChartData = () => {
          // Appointment distribution for pie chart
          const appointmentDistribution = [
            {
              name: "Completed",
              value: appointmentStats.completed,
              color: COLORS.success,
            },
            {
              name: "Cancelled",
              value: appointmentStats.cancelled,
              color: COLORS.danger,
            },
            {
              name: "No Show",
              value: appointmentStats.noShow,
              color: COLORS.warning,
            },
            {
              name: "Scheduled",
              value:
                appointmentStats.total -
                appointmentStats.completed -
                appointmentStats.cancelled -
                appointmentStats.noShow,
              color: COLORS.primary,
            },
          ].filter((item) => item.value > 0);

          // Revenue distribution for pie chart
          const revenueDistribution = [
            {
              name: "Paid",
              value: revenueStats.paidAmount,
              color: COLORS.success,
            },
            {
              name: "Pending",
              value: revenueStats.pendingAmount,
              color: COLORS.warning,
            },
            {
              name: "Overdue",
              value: revenueStats.overdueAmount,
              color: COLORS.danger,
            },
          ].filter((item) => item.value > 0);

          // Generate daily trends for line/bar charts
          const appointmentTrends = [];
          const revenueTrends = [];

          // Create sample trend data for the selected period
          const daysInPeriod = Math.min(
            30,
            Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          );

          for (let i = 0; i < daysInPeriod; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            // Filter appointments for this day
            const dayAppointments = appointments.filter((apt) => {
              const aptDate = new Date(apt.appointment_datetime);
              return aptDate.toDateString() === currentDate.toDateString();
            });

            // Filter bills for this day
            const dayBills = bills.filter((bill) => {
              const billDate = new Date(bill.created_at);
              return billDate.toDateString() === currentDate.toDateString();
            });

            appointmentTrends.push({
              date: format(currentDate, "MMM dd"),
              completed: dayAppointments.filter(
                (a: AppointmentData) => a.status === AppointmentStatus.COMPLETED
              ).length,
              cancelled: dayAppointments.filter(
                (a: AppointmentData) => a.status === AppointmentStatus.CANCELLED
              ).length,
              scheduled: dayAppointments.filter(
                (a: AppointmentData) => a.status === AppointmentStatus.SCHEDULED
              ).length,
            });

            revenueTrends.push({
              date: format(currentDate, "MMM dd"),
              revenue: dayBills.reduce(
                (sum: number, bill: BillData) => sum + bill.total_amount,
                0
              ),
              paid: dayBills
                .filter((b: BillData) => b.status === BillingStatus.PAID)
                .reduce(
                  (sum: number, bill: BillData) => sum + bill.total_amount,
                  0
                ),
              pending: dayBills
                .filter((b: BillData) => b.status === BillingStatus.PENDING)
                .reduce(
                  (sum: number, bill: BillData) => sum + bill.total_amount,
                  0
                ),
            });
          }

          return {
            appointmentTrends,
            revenueTrends,
            appointmentDistribution,
            revenueDistribution,
          };
        };

        setChartData(generateChartData());
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [user, dateRange, COLORS]);

  // Chart rendering functions
  const renderAppointmentChart = () => {
    if (chartView === "pie") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RechartsPieChart>
            <Pie
              data={chartData.appointmentDistribution}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${((percent || 0) * 100).toFixed(0)}%`
              }
            >
              {chartData.appointmentDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </RechartsPieChart>
        </ResponsiveContainer>
      );
    }

    if (chartView === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart data={chartData.appointmentTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="completed"
              stroke={COLORS.success}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="cancelled"
              stroke={COLORS.danger}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="scheduled"
              stroke={COLORS.primary}
              strokeWidth={2}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      );
    }

    if (chartView === "area") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData.appointmentTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="completed"
              stackId="1"
              stroke={COLORS.success}
              fill={COLORS.success}
            />
            <Area
              type="monotone"
              dataKey="cancelled"
              stackId="1"
              stroke={COLORS.danger}
              fill={COLORS.danger}
            />
            <Area
              type="monotone"
              dataKey="scheduled"
              stackId="1"
              stroke={COLORS.primary}
              fill={COLORS.primary}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Default bar chart
    return (
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart data={chartData.appointmentTrends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" fill={COLORS.success} />
          <Bar dataKey="cancelled" fill={COLORS.danger} />
          <Bar dataKey="scheduled" fill={COLORS.primary} />
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  };

  const renderRevenueChart = () => {
    if (chartView === "pie") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RechartsPieChart>
            <Pie
              data={chartData.revenueDistribution}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, value }) => `${name} ₹${(value || 0).toFixed(0)}`}
            >
              {chartData.revenueDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`₹${value.toFixed(2)}`, "Amount"]}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      );
    }

    if (chartView === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart data={chartData.revenueTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [`₹${value.toFixed(2)}`, "Amount"]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={COLORS.primary}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="paid"
              stroke={COLORS.success}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="pending"
              stroke={COLORS.warning}
              strokeWidth={2}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      );
    }

    if (chartView === "area") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData.revenueTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [`₹${value.toFixed(2)}`, "Amount"]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="paid"
              stackId="1"
              stroke={COLORS.success}
              fill={COLORS.success}
            />
            <Area
              type="monotone"
              dataKey="pending"
              stackId="1"
              stroke={COLORS.warning}
              fill={COLORS.warning}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Default bar chart
    return (
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart data={chartData.revenueTrends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip
            formatter={(value: number) => [`₹${value.toFixed(2)}`, "Amount"]}
          />
          <Legend />
          <Bar dataKey="revenue" fill={COLORS.primary} />
          <Bar dataKey="paid" fill={COLORS.success} />
          <Bar dataKey="pending" fill={COLORS.warning} />
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  };

  const exportReport = () => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    switch (dateRange) {
      case "last7Days":
        startDate = subDays(today, 7);
        break;
      case "last30Days":
        startDate = subDays(today, 30);
        break;
      case "thisMonth":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      default:
        startDate = subDays(today, 30);
    }

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>AbhiCure Clinic - Reports & Analytics</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 40px; 
            background-color: #f8fafc;
          }
          .report-container {
            background: white;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px; 
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
          }
          .company-name { 
            font-size: 32px; 
            font-weight: bold; 
            color: #2563eb; 
            margin-bottom: 8px;
          }
          .section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }
          .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 15px;
          }
          .stat-item {
            text-align: center;
            padding: 15px;
            background: #f9fafb;
            border-radius: 6px;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .stat-label {
            font-size: 14px;
            color: #6b7280;
          }
          .appointment-stats .stat-value { color: #2563eb; }
          .revenue-stats .stat-value { color: #059669; }
          .patient-stats .stat-value { color: #7c3aed; }
          .doctor-stats .stat-value { color: #dc2626; }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <div class="company-name">AbhiCure Clinic</div>
            <p>Reports & Analytics</p>
            <p><strong>Period:</strong> ${format(
              startDate,
              "MMMM d, yyyy"
            )} - ${format(endDate, "MMMM d, yyyy")}</p>
            <p><strong>Generated on:</strong> ${format(
              today,
              "MMMM d, yyyy h:mm a"
            )}</p>
          </div>
          
          <div class="section appointment-stats">
            <div class="section-title">📅 Appointment Analytics</div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.appointmentStats.total
                }</div>
                <div class="stat-label">Total Appointments</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.appointmentStats.completed
                }</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.appointmentStats.cancelled
                }</div>
                <div class="stat-label">Cancelled</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.appointmentStats.noShow
                }</div>
                <div class="stat-label">No Show</div>
              </div>
            </div>
          </div>

          <div class="section revenue-stats">
            <div class="section-title">💰 Revenue Analytics</div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">₹${reportData.revenueStats.totalRevenue.toFixed(
                  2
                )}</div>
                <div class="stat-label">Total Revenue</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">₹${reportData.revenueStats.paidAmount.toFixed(
                  2
                )}</div>
                <div class="stat-label">Paid Amount</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">₹${reportData.revenueStats.pendingAmount.toFixed(
                  2
                )}</div>
                <div class="stat-label">Pending Amount</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">₹${reportData.revenueStats.overdueAmount.toFixed(
                  2
                )}</div>
                <div class="stat-label">Overdue Amount</div>
              </div>
            </div>
          </div>

          <div class="section patient-stats">
            <div class="section-title">👥 Patient Analytics</div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.patientStats.totalPatients
                }</div>
                <div class="stat-label">Total Patients</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.patientStats.newPatients
                }</div>
                <div class="stat-label">New Patients</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.patientStats.returningPatients
                }</div>
                <div class="stat-label">Returning Patients</div>
              </div>
            </div>
          </div>

          <div class="section doctor-stats">
            <div class="section-title">👨‍⚕️ Doctor Performance</div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.doctorStats.totalDoctors
                }</div>
                <div class="stat-label">Total Doctors</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${
                  reportData.doctorStats.averageAppointments
                }</div>
                <div class="stat-label">Avg. Appointments per Doctor</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>AbhiCure Clinic Management System</strong></p>
            <p>This report was generated automatically by the clinic management system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([reportHTML], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinic-report-${format(
      today,
      "yyyy-MM-dd"
    )}-${dateRange}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
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
            Reports & Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive insights into your clinic performance
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
          <Select
            name="dateRange"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: "last7Days", label: "Last 7 Days" },
              { value: "last30Days", label: "Last 30 Days" },
              { value: "thisMonth", label: "This Month" },
            ]}
          />

          {/* Chart View Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant={chartView === "bar" ? "primary" : "outline"}
              size="sm"
              onClick={() => setChartView("bar")}
              className="px-3 py-1"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={chartView === "line" ? "primary" : "outline"}
              size="sm"
              onClick={() => setChartView("line")}
              className="px-3 py-1 ml-1"
            >
              <LineChart className="h-4 w-4" />
            </Button>
            <Button
              variant={chartView === "area" ? "primary" : "outline"}
              size="sm"
              onClick={() => setChartView("area")}
              className="px-3 py-1 ml-1"
            >
              <Activity className="h-4 w-4" />
            </Button>
            <Button
              variant={chartView === "pie" ? "primary" : "outline"}
              size="sm"
              onClick={() => setChartView("pie")}
              className="px-3 py-1 ml-1"
            >
              <PieChart className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={exportReport}>
            <Download className="h-5 w-5 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointment Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Appointment Trends
              </div>
              <div className="text-sm text-gray-500 capitalize">
                {chartView} view
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>{renderAppointmentChart()}</CardContent>
        </Card>

        {/* Revenue Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Revenue Trends
              </div>
              <div className="text-sm text-gray-500 capitalize">
                {chartView} view
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>{renderRevenueChart()}</CardContent>
        </Card>
      </div>

      {/* Rest of your existing JSX remains the same */}
      {/* Appointment Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Appointment Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {reportData.appointmentStats.total}
              </p>
              <p className="text-sm text-gray-600">Total Appointments</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {reportData.appointmentStats.completed}
              </p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                {reportData.appointmentStats.cancelled}
              </p>
              <p className="text-sm text-gray-600">Cancelled</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600">
                {reportData.appointmentStats.noShow}
              </p>
              <p className="text-sm text-gray-600">No Show</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Revenue Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                ₹{reportData.revenueStats.totalRevenue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Total Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                ₹{reportData.revenueStats.paidAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Paid Amount</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">
                ₹{reportData.revenueStats.pendingAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Pending Amount</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">
                ₹{reportData.revenueStats.overdueAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Overdue Amount</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient & Doctor Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Patient Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {reportData.patientStats.totalPatients}
                </p>
                <p className="text-sm text-gray-600">Total Patients</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {reportData.patientStats.newPatients}
                </p>
                <p className="text-sm text-gray-600">New Patients</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {reportData.patientStats.returningPatients}
                </p>
                <p className="text-sm text-gray-600">Returning</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Doctor Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {reportData.doctorStats.totalDoctors}
                </p>
                <p className="text-sm text-gray-600">Total Doctors</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {reportData.doctorStats.averageAppointments}
                </p>
                <p className="text-sm text-gray-600">Avg. Appointments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
