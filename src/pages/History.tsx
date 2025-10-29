import { useState, useEffect } from "react";
import {
  History as HistoryIcon,
  User,
  Calendar,
  Receipt,
  Activity,
  Search,
  Eye,
  X,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { AppointmentService } from "../services/AppointmentService";
import { BillingService, BillData } from "../services/BillingService";
import { useAuth } from "../hooks/useAuth";
import { format } from "date-fns";

interface HistoryRecord {
  id: string;
  type: "appointment" | "payment" | "system";
  title: string;
  description: string;
  date: string;
  patient?: {
    id?: string;
    full_name?: string;
    phone?: string;
    email?: string;
  };
  doctor?: {
    id?: string;
    full_name?: string;
    primary_specialization?: string;
  };
  amount?: number;
  status?: string;
  details?: {
    symptoms?: string;
    diagnosis?: string;
    prescription?: string;
    notes?: string;
    duration?: number;
    billNumber?: string;
    amount?: number;
    taxAmount?: number;
    paymentMode?: string;
    paymentDate?: string;
    dueDate?: string;
    [key: string]: unknown;
  };
}

export function History() {
  const [activeTab, setActiveTab] = useState("all");
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<HistoryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(
    null
  );
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchHistoryData = async () => {
      try {
        // Fetch appointments using AppointmentService
        const appointmentsResponse = await AppointmentService.getAppointments();

        // Transform data into unified history records
        const records: HistoryRecord[] = [];

        // Add appointment records
        if (appointmentsResponse.success && appointmentsResponse.data) {
          appointmentsResponse.data.forEach((appointment) => {
            const patientName =
              appointment.clinic_patient?.patient_profile?.full_name ||
              "Unknown Patient";
            const doctorName =
              appointment.clinic_doctor?.doctor_profile?.full_name ||
              "Unknown Doctor";
            const doctorSpecialization =
              appointment.clinic_doctor?.doctor_profile
                ?.primary_specialization || "";

            records.push({
              id: appointment.id,
              type: "appointment",
              title: `Appointment with ${patientName}`,
              description: `${doctorName}${
                doctorSpecialization ? ` - ${doctorSpecialization}` : ""
              }`,
              date: appointment.appointment_datetime,
              patient: appointment.clinic_patient?.patient_profile,
              doctor: appointment.clinic_doctor?.doctor_profile,
              status: appointment.status,
              details: {
                symptoms: appointment.symptoms,
                diagnosis: appointment.diagnosis,
                prescription: appointment.prescription,
                notes: appointment.notes,
                duration: appointment.duration_minutes,
              },
            });
          });
        }

        // Fetch bills/payments data
        const billsResponse = await BillingService.getBills();

        // Add bill records
        if (billsResponse.success && billsResponse.data) {
          billsResponse.data.forEach((bill: BillData) => {
            records.push({
              id: bill.id,
              type: "payment",
              title: `Payment - Bill #${bill.bill_number}`,
              description: `₹${bill.total_amount.toFixed(2)} - ${
                bill.status || "Pending"
              }`,
              date: bill.created_at,
              patient: bill.clinic_patient?.patient_profile
                ? {
                    id: bill.clinic_patient.patient_profile.id,
                    full_name: bill.clinic_patient.patient_profile.full_name,
                    phone:
                      bill.clinic_patient.patient_profile.phone || undefined,
                    email:
                      bill.clinic_patient.patient_profile.email || undefined,
                  }
                : undefined,
              amount: bill.total_amount,
              status: bill.status || undefined,
              details: {
                billNumber: bill.bill_number,
                amount: bill.amount,
                taxAmount: bill.tax_amount || undefined,
                paymentMode: bill.payment_mode || undefined,
                paymentDate: bill.payment_date || undefined,
                dueDate: bill.due_date || undefined,
                notes: bill.notes || undefined,
              },
            });
          });
        }

        // Sort all records by date (newest first)
        records.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setHistoryRecords(records);
        setFilteredRecords(records);
      } catch (error) {
        console.error("Error fetching history data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, [user]);

  useEffect(() => {
    let filtered = historyRecords;

    // Filter by active tab
    if (activeTab !== "all") {
      filtered = filtered.filter((record) => record.type === activeTab);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (record.patient?.full_name &&
            record.patient.full_name
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (record.doctor?.full_name &&
            record.doctor.full_name
              .toLowerCase()
              .includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by type
    if (typeFilter) {
      filtered = filtered.filter((record) => record.type === typeFilter);
    }

    setFilteredRecords(filtered);
  }, [activeTab, searchTerm, typeFilter, historyRecords]);

  const handleViewDetails = (record: HistoryRecord) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case "appointment":
        return Calendar;
      case "payment":
        return Receipt;
      case "system":
        return Activity;
      default:
        return HistoryIcon;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return "bg-green-100 text-green-800";
      case "scheduled":
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "no_show":
        return "bg-gray-100 text-gray-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const tabs = [
    { id: "all", label: "All Records", icon: HistoryIcon },
    { id: "appointment", label: "Appointments", icon: Calendar },
    { id: "payment", label: "Payments", icon: Receipt },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex space-x-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded w-24"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">History & Records</h1>
        <p className="text-gray-600 mt-1">
          Complete timeline of clinic activities and patient records
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
          flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
          ${
            activeTab === tab.id
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }
        `}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by patient name, description, or details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              label=""
              name="typeFilter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: "", label: "All Types" },
                { value: "appointment", label: "Appointments" },
                { value: "payment", label: "Payments" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <div className="space-y-4">
        {filteredRecords.map((record, index) => {
          const Icon = getRecordIcon(record.type);
          return (
            <Card
              key={record.id}
              className="hover:shadow-md transition-shadow duration-200"
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`p-2 rounded-full ${
                        record.type === "appointment"
                          ? "bg-blue-100"
                          : record.type === "payment"
                          ? "bg-green-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          record.type === "appointment"
                            ? "text-blue-600"
                            : record.type === "payment"
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      />
                    </div>
                    {index < filteredRecords.length - 1 && (
                      <div className="w-px h-16 bg-gray-200 mt-2"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {record.title}
                          </h3>
                          {record.status && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                record.status
                              )}`}
                            >
                              {record.status.replace("_", " ").toUpperCase()}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-600 mb-2">
                          {record.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(
                              new Date(record.date),
                              "MMM d, yyyy h:mm a"
                            )}
                          </div>
                          {record.patient && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {record.patient.full_name}
                            </div>
                          )}
                          {record.amount && (
                            <div className="flex items-center">
                              <Receipt className="h-4 w-4 mr-1" />₹
                              {record.amount.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-4 lg:mt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(record)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold">Record Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">
                  {selectedRecord.title}
                </h3>
                <p className="text-gray-600 mb-4">
                  {selectedRecord.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <span className="text-sm font-medium text-gray-500">
                      Date & Time
                    </span>
                    <p className="text-gray-900">
                      {format(
                        new Date(selectedRecord.date),
                        "MMMM d, yyyy h:mm a"
                      )}
                    </p>
                  </div>
                  {selectedRecord.patient && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Patient
                      </span>
                      <p className="text-gray-900">
                        {selectedRecord.patient.full_name}
                      </p>
                    </div>
                  )}
                  {selectedRecord.status && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Status
                      </span>
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          selectedRecord.status
                        )}`}
                      >
                        {selectedRecord.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Information */}
              {selectedRecord.details && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">
                    Detailed Information
                  </h4>

                  {selectedRecord.type === "appointment" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedRecord.details.symptoms && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Symptoms
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.symptoms}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.diagnosis && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Diagnosis
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.diagnosis}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.prescription && (
                        <div className="md:col-span-2">
                          <span className="font-medium text-gray-700">
                            Prescription
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.prescription}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.notes && (
                        <div className="md:col-span-2">
                          <span className="font-medium text-gray-700">
                            Notes
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.notes}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.duration && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Duration
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.duration} minutes
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedRecord.type === "payment" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <span className="font-medium text-gray-700">
                          Bill Number
                        </span>
                        <p className="text-gray-600 mt-1">
                          {selectedRecord.details.billNumber}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Amount
                        </span>
                        <p className="text-gray-600 mt-1">
                          ₹{selectedRecord.details.amount}
                        </p>
                      </div>
                      {selectedRecord.details?.taxAmount &&
                        selectedRecord.details.taxAmount > 0 && (
                          <div>
                            <span className="font-medium text-gray-700">
                              Tax
                            </span>
                            <p className="text-gray-600 mt-1">
                              ₹{selectedRecord.details.taxAmount}
                            </p>
                          </div>
                        )}
                      {selectedRecord.details.paymentMode && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Payment Mode
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.paymentMode.toUpperCase()}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.paymentDate && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Payment Date
                          </span>
                          <p className="text-gray-600 mt-1">
                            {format(
                              new Date(selectedRecord.details.paymentDate),
                              "MMM d, yyyy"
                            )}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.dueDate && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Due Date
                          </span>
                          <p className="text-gray-600 mt-1">
                            {format(
                              new Date(selectedRecord.details.dueDate),
                              "MMM d, yyyy"
                            )}
                          </p>
                        </div>
                      )}
                      {selectedRecord.details.notes && (
                        <div className="md:col-span-3">
                          <span className="font-medium text-gray-700">
                            Notes
                          </span>
                          <p className="text-gray-600 mt-1">
                            {selectedRecord.details.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredRecords.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <HistoryIcon className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No history records found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || typeFilter || activeTab !== "all"
                ? "Try adjusting your search criteria or filters"
                : "History will appear here as you use the system"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
