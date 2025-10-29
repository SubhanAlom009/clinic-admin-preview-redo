import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  User,
  Phone,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Card, CardContent } from "./ui/Card";
import { Modal } from "./ui/Modal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppointmentService } from "../services/AppointmentService";
import { DoctorSlotService, AvailableSlot } from "../services/DoctorSlotService";
import { SlotSelector } from "./doctorComponents/SlotSelector";

interface RescheduleRequest {
  id: string;
  appointment_id: string;
  patient_profile_id: string;
  clinic_id: string;
  doctor_id: string;
  current_datetime: string;
  requested_datetime: string;
  requested_slot_id?: string; // NEW: Slot-based reschedule request
  reason?: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;

  // Relations
  appointments?: {
    appointment_type: string;
    doctor_slot_id?: string;
    doctor_slot?: {
      slot_name: string;
      slot_date: string;
      start_time: string;
      end_time: string;
    };
    clinic_doctors: {
      doctor_profiles: {
        full_name: string;
        primary_specialization: string;
      };
    };
  };
  patient_profiles?: {
    full_name: string;
    phone: string;
    email?: string;
  };
}

interface RescheduleRequestsProps {
  onRequestUpdate?: () => void;
}

export function RescheduleRequests({
  onRequestUpdate,
}: RescheduleRequestsProps) {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RescheduleRequest[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedRequest, setSelectedRequest] =
    useState<RescheduleRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { user } = useAuth();

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reschedule_requests")
        .select(
          `
          *,
          appointments!appointment_id (
            appointment_type,
            doctor_slot_id,
            doctor_slot:doctor_slots (
              slot_name,
              slot_date,
              start_time,
              end_time
            ),
            clinic_doctors!clinic_doctor_id (
              doctor_profiles!doctor_profile_id (
                full_name,
                primary_specialization
              )
            )
          ),
          patient_profiles!patient_profile_id (
            full_name,
            phone,
            email
          )
        `
        )
        .eq("clinic_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching reschedule requests:", error);
      toast.error("Failed to load reschedule requests");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    let filtered = requests;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.patient_profiles?.full_name
            ?.toLowerCase()
            .includes(searchLower) ||
          request.patient_profiles?.phone?.includes(searchTerm) ||
          request.appointments?.clinic_doctors?.doctor_profiles?.full_name
            ?.toLowerCase()
            .includes(searchLower)
      );
    }

    setFilteredRequests(filtered);
  }, [searchTerm, statusFilter, requests]);

  // Fetch available slots for approval
  const fetchAvailableSlots = async (date: string, doctorId: string) => {
    if (!date || !doctorId) {
      setAvailableSlots([]);
      return;
    }

    try {
      setLoadingSlots(true);
      const result = await DoctorSlotService.getAvailableSlots(doctorId, date);
      
      if (result.success && result.data) {
        setAvailableSlots(result.data);
      } else {
        setAvailableSlots([]);
        toast.error("Failed to load available slots");
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      setAvailableSlots([]);
      toast.error("Failed to load available slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleApproveClick = (request: RescheduleRequest) => {
    setSelectedRequest(request);
    // Set initial date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = format(tomorrow, "yyyy-MM-dd");
    setSelectedDate(dateString);
    setSelectedSlot(null);
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }

    try {
      setActionLoading(selectedRequest.id);

      // Update the original appointment using AppointmentService for slot-based rescheduling
      const updateResult = await AppointmentService.updateAppointment(selectedRequest.appointment_id, {
        doctor_slot_id: selectedSlot.id,
        appointment_datetime: `${selectedSlot.slot_date}T${selectedSlot.start_time}Z`,
        slot_booking_order: selectedSlot.current_bookings + 1,
        status: "scheduled" as any,
      });

      if (!updateResult.success) {
        throw new Error(updateResult.error?.message || "Failed to update appointment");
      }

      // Update the reschedule request status
      const { error: requestError } = await (supabase as any)
        .from("reschedule_requests")
        .update({
          status: "approved",
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (requestError) throw requestError;

      toast.success("Reschedule request approved successfully!");
      setShowApproveModal(false);
      setSelectedRequest(null);
      setSelectedSlot(null);
      fetchRequests();
      onRequestUpdate?.();
    } catch (error: any) {
      console.error("Error approving reschedule request:", error);
      toast.error(error.message || "Failed to approve reschedule request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      setActionLoading(selectedRequest.id);

      const { error } = await (supabase as any)
        .from("reschedule_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast.success("Reschedule request rejected");
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedRequest(null);
      fetchRequests();
      onRequestUpdate?.();
    } catch (error: any) {
      console.error("Error rejecting reschedule request:", error);
      toast.error(error.message || "Failed to reject reschedule request");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reschedule Requests
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve patient reschedule requests
          </p>
        </div>
        <Button
          onClick={fetchRequests}
          variant="outline"
          size="sm"
          className="mt-4 sm:mt-0"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by patient name, phone, or doctor..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchTerm(e.target.value)
                }
                className="pl-10"
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setStatusFilter(e.target.value)
              }
              className="min-w-[150px]"
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "all", label: "All Requests" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No reschedule requests
            </h3>
            <p className="text-gray-500">
              {statusFilter === "pending"
                ? "No pending reschedule requests at the moment."
                : `No ${statusFilter} reschedule requests found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card
              key={request.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold text-gray-900">
                          {request.patient_profiles?.full_name}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {request.status.charAt(0).toUpperCase() +
                          request.status.slice(1)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        {request.patient_profiles?.phone}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        <div>
                          <div className="text-red-600">
                            Current:{" "}
                            {request.appointments?.doctor_slot ? (
                              <>
                                {request.appointments.doctor_slot.slot_name} on{" "}
                                {format(
                                  new Date(request.appointments.doctor_slot.slot_date),
                                  "MMM dd, yyyy"
                                )}{" "}
                                at {request.appointments.doctor_slot.start_time}
                              </>
                            ) : (
                              format(
                                new Date(request.current_datetime),
                                "MMM dd, yyyy 'at' HH:mm"
                              )
                            )}
                          </div>
                          <div className="text-green-600">
                            Requested:{" "}
                            {request.requested_slot_id ? (
                              "New slot selection"
                            ) : (
                              format(
                                new Date(request.requested_datetime),
                                "MMM dd, yyyy 'at' HH:mm"
                              )
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        Dr.{" "}
                        {
                          request.appointments?.clinic_doctors?.doctor_profiles
                            ?.full_name
                        }
                      </div>
                    </div>

                    {request.reason && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Reason:</span>{" "}
                          {request.reason}
                        </p>
                      </div>
                    )}

                    {request.status === "rejected" &&
                      request.rejection_reason && (
                        <div className="mt-3">
                          <p className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
                            <span className="font-medium">
                              Rejection Reason:
                            </span>{" "}
                            {request.rejection_reason}
                          </p>
                        </div>
                      )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetailsModal(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {request.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveClick(request)}
                          disabled={actionLoading === request.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRejectModal(true);
                          }}
                          disabled={actionLoading === request.id}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Request Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Reschedule Request Details"
        size="lg"
      >
        {selectedRequest && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Patient Information
                </h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {selectedRequest.patient_profiles?.full_name}
                  </p>
                  <p>
                    <span className="font-medium">Phone:</span>{" "}
                    {selectedRequest.patient_profiles?.phone}
                  </p>
                  {selectedRequest.patient_profiles?.email && (
                    <p>
                      <span className="font-medium">Email:</span>{" "}
                      {selectedRequest.patient_profiles.email}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Appointment Details
                </h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Doctor:</span> Dr.{" "}
                    {
                      selectedRequest.appointments?.clinic_doctors
                        ?.doctor_profiles?.full_name
                    }
                  </p>
                  <p>
                    <span className="font-medium">Current Time:</span>{" "}
                    {format(
                      new Date(selectedRequest.current_datetime),
                      "MMMM dd, yyyy 'at' hh:mm aa"
                    )}
                  </p>
                  <p>
                    <span className="font-medium">Requested Time:</span>{" "}
                    {format(
                      new Date(selectedRequest.requested_datetime),
                      "MMMM dd, yyyy 'at' hh:mm aa"
                    )}
                  </p>
                  <p>
                    <span className="font-medium">Type:</span>{" "}
                    {selectedRequest.appointments?.appointment_type}
                  </p>
                </div>
              </div>
            </div>

            {selectedRequest.reason && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Reason for Reschedule
                </h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {selectedRequest.reason}
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              {selectedRequest.status === "pending" && (
                <>
                  <Button
                    onClick={() => handleApprove()}
                    disabled={actionLoading === selectedRequest.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDetailsModal(false);
                      setShowRejectModal(true);
                    }}
                    disabled={actionLoading === selectedRequest.id}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Request Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setSelectedRequest(null);
          setSelectedSlot(null);
          setSelectedDate("");
        }}
        title="Approve Reschedule Request"
        size="lg"
      >
        {selectedRequest && (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                Reschedule Request Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Patient:</span>
                  <p className="text-gray-900">
                    {selectedRequest.patient_profiles?.full_name}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Doctor:</span>
                  <p className="text-gray-900">
                    {selectedRequest.appointments?.clinic_doctors?.doctor_profiles?.full_name}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Current Slot:</span>
                  <p className="text-gray-900">
                    {selectedRequest.appointments?.doctor_slot ? (
                      <>
                        {selectedRequest.appointments.doctor_slot.slot_name} on{" "}
                        {format(
                          new Date(selectedRequest.appointments.doctor_slot.slot_date),
                          "MMM dd, yyyy"
                        )}{" "}
                        at {selectedRequest.appointments.doctor_slot.start_time}
                      </>
                    ) : (
                      format(
                        new Date(selectedRequest.current_datetime),
                        "MMM dd, yyyy 'at' HH:mm"
                      )
                    )}
                  </p>
                </div>
                {selectedRequest.reason && (
                  <div>
                    <span className="font-medium text-gray-700">Reason:</span>
                    <p className="text-gray-900">{selectedRequest.reason}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Select New Time Slot
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Date *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                    if (selectedRequest.doctor_id) {
                      fetchAvailableSlots(e.target.value, selectedRequest.doctor_id);
                    }
                  }}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Time Slot *
                  </label>
                  {loadingSlots ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading available slots...</p>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <SlotSelector
                      doctorId={selectedRequest.doctor_id}
                      date={selectedDate}
                      onSlotSelect={(slot) => setSelectedSlot(slot)}
                      selectedSlot={selectedSlot?.id}
                    />
                  ) : (
                    <div className="text-center py-4 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-500">No slots available for this date</p>
                      <p className="text-xs text-gray-400 mt-1">Please select a different date</p>
                    </div>
                  )}
                  {!selectedSlot && selectedDate && availableSlots.length > 0 && (
                    <p className="mt-1 text-sm text-red-600">Please select a time slot</p>
                  )}
                </div>
              )}

              {selectedSlot && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <h4 className="text-sm font-medium text-green-900">Selected Slot</h4>
                  <p className="text-sm text-green-700">
                    {selectedSlot.slot_name} - {selectedSlot.start_time} to {selectedSlot.end_time}
                  </p>
                  <p className="text-xs text-green-600">
                    Available capacity: {selectedSlot.available_capacity}/{selectedSlot.max_capacity}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedRequest(null);
                  setSelectedSlot(null);
                  setSelectedDate("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={!selectedSlot || actionLoading !== null || loadingSlots}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve Request
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Request Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason("");
        }}
        title="Reject Reschedule Request"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Please provide a reason for rejecting this reschedule request:
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setRejectionReason(e.target.value)
            }
            placeholder="Enter rejection reason..."
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
