import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
  Stethoscope,
  Video,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Card, CardContent } from "./ui/Card";
import { Modal } from "./ui/Modal";
import {
  AppointmentRequestService,
  AppointmentRequest,
} from "../services/AppointmentRequestService";

import { toast } from "sonner";
import {
  convertUTCToISTDate,
  convertUTCToISTTime,
  convertUTCToIST,
} from "../utils/timezoneUtils";

interface AppointmentRequestsProps {
  onRequestUpdate?: () => void;
}

export function AppointmentRequests({
  onRequestUpdate,
}: AppointmentRequestsProps) {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<
    AppointmentRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedRequest, setSelectedRequest] =
    useState<AppointmentRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await AppointmentRequestService.getAppointmentRequests({
        status: statusFilter === "all" ? undefined : statusFilter,
        searchTerm: searchTerm || undefined,
      });

      if (response.success && response.data) {
        setRequests(response.data);
      } else {
        console.error("Error fetching requests:", response.error);
        toast.error("Failed to load appointment requests");
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load appointment requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    // Apply search filter
    let filtered = requests;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.patient_name?.toLowerCase().includes(searchLower) ||
          request.patient_phone?.includes(searchTerm) ||
          request.appointment_type?.toLowerCase().includes(searchLower) ||
          request.clinic_doctor?.doctor_profile?.full_name
            ?.toLowerCase()
            .includes(searchLower)
      );
    }

    setFilteredRequests(filtered);
  }, [searchTerm, requests]);

  const handleApproveClick = (request: AppointmentRequest) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) {
      toast.error("No request selected");
      return;
    }

    try {
      setActionLoading(selectedRequest.id);

      // Approve request using auto-assigned time (no admin time selection needed)
      const response = await AppointmentRequestService.approveRequest(
        selectedRequest.id
      );

      if (response.success) {
        toast.success("Appointment request approved and scheduled!");
        setShowApproveModal(false);
        setSelectedRequest(null);
        fetchRequests();
        onRequestUpdate?.();
      } else {
        toast.error(response.error?.message || "Failed to approve request");
      }
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request");
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
      const response = await AppointmentRequestService.rejectRequest(
        selectedRequest.id,
        rejectionReason
      );

      if (response.success) {
        toast.success("Appointment request rejected");
        setShowRejectModal(false);
        setRejectionReason("");
        setSelectedRequest(null);
        fetchRequests();
        onRequestUpdate?.();
      } else {
        toast.error(response.error?.message || "Failed to reject request");
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
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
            Appointment Requests
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve patient appointment requests
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search by patient name, phone, or appointment type..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchTerm(e.target.value)
                }
                className="pl-4 pr-4 py-2 w-full"
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
              No appointment requests
            </h3>
            <p className="text-gray-500">
              {statusFilter === "pending"
                ? "No pending requests at the moment."
                : `No ${statusFilter} requests found.`}
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
                        {getPriorityIcon(request.priority)}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {request.patient_name}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {request.status.charAt(0).toUpperCase() +
                          request.status.slice(1)}
                      </span>
                      {request.appointment_type?.toLowerCase().includes("video") && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200">
                          <Video className="h-3 w-3" />
                          Video
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        {request.patient_phone}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {convertUTCToISTDate(request.requested_datetime)}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        {convertUTCToISTTime(request.requested_datetime)}
                      </div>
                      <div className="flex items-center">
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Dr. {request.clinic_doctor?.doctor_profile?.full_name}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Type:</span>{" "}
                        {request.appointment_type}
                      </p>
                      {request.symptoms && (
                        <p className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">Symptoms:</span>{" "}
                          {request.symptoms}
                        </p>
                      )}
                    </div>
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
        title="Appointment Request Details"
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
                    {selectedRequest.patient_name}
                  </p>
                  <p>
                    <span className="font-medium">Phone:</span>{" "}
                    {selectedRequest.patient_phone}
                  </p>
                  {selectedRequest.patient_email && (
                    <p>
                      <span className="font-medium">Email:</span>{" "}
                      {selectedRequest.patient_email}
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
                    {selectedRequest.clinic_doctor?.doctor_profile?.full_name}
                  </p>
                  <p>
                    <span className="font-medium">Date:</span>{" "}
                    {convertUTCToISTDate(selectedRequest.requested_datetime)}
                  </p>
                  <p>
                    <span className="font-medium">Time:</span>{" "}
                    {convertUTCToISTTime(selectedRequest.requested_datetime)}
                  </p>
                  <p>
                    <span className="font-medium">Duration:</span>{" "}
                    {selectedRequest.requested_duration || 30} minutes
                  </p>
                  <p>
                    <span className="font-medium">Type:</span>{" "}
                    {selectedRequest.appointment_type}
                  </p>
                  <p>
                    <span className="font-medium">Priority:</span>
                    <span
                      className={`ml-1 px-2 py-1 rounded text-xs ${selectedRequest.priority === "urgent"
                          ? "bg-red-100 text-red-800"
                          : selectedRequest.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                    >
                      {selectedRequest.priority.charAt(0).toUpperCase() +
                        selectedRequest.priority.slice(1)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {selectedRequest.symptoms && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Symptoms</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {selectedRequest.symptoms}
                </p>
              </div>
            )}

            {selectedRequest.notes && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Additional Notes
                </h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {selectedRequest.notes}
                </p>
              </div>
            )}

            {selectedRequest.status === "rejected" &&
              selectedRequest.rejection_reason && (
                <div>
                  <h4 className="font-semibold text-red-900 mb-2">
                    Rejection Reason
                  </h4>
                  <p className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
                    {selectedRequest.rejection_reason}
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
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleApproveClick(selectedRequest);
                    }}
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
        }}
        title="Approve Appointment Request"
        size="lg"
      >
        {selectedRequest && (
          <div className="p-6 space-y-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                Appointment Request Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Patient:</span>
                  <p className="text-gray-900">
                    {selectedRequest.patient_name}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Phone:</span>
                  <p className="text-gray-900">
                    {selectedRequest.patient_phone}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Doctor:</span>
                  <p className="text-gray-900">
                    {selectedRequest.clinic_doctor?.doctor_profile?.full_name}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <p className="text-gray-900">
                    {selectedRequest.appointment_type}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Priority:</span>
                  <p className="text-gray-900">{selectedRequest.priority}</p>
                </div>
                {selectedRequest.symptoms && (
                  <div>
                    <span className="font-medium text-gray-700">Symptoms:</span>
                    <p className="text-gray-900">{selectedRequest.symptoms}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Appointment Request Details
              </h3>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-3">
                  Requested Appointment Details
                </h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium text-gray-700">Patient:</span>
                    <span className="text-gray-900">
                      {" "}
                      {selectedRequest.patient_name}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <span className="text-gray-900">
                      {" "}
                      {selectedRequest.patient_phone}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">
                      Requested Date & Time:
                    </span>
                    <span className="text-gray-900 font-semibold">
                      {" "}
                      {selectedRequest.requested_datetime
                        ? convertUTCToIST(selectedRequest.requested_datetime)
                        : "Not specified"}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">
                      Appointment Type:
                    </span>
                    <span className="text-gray-900">
                      {" "}
                      {selectedRequest.appointment_type}
                    </span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Priority:</span>
                    <span className="text-gray-900">
                      {" "}
                      {selectedRequest.priority}
                    </span>
                  </p>
                  {selectedRequest.symptoms && (
                    <p>
                      <span className="font-medium text-gray-700">
                        Symptoms:
                      </span>
                      <span className="text-gray-900">
                        {" "}
                        {selectedRequest.symptoms}
                      </span>
                    </p>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  ✓ Patient will receive this exact requested time when approved
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedRequest(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={actionLoading !== null}
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
        title="Reject Appointment Request"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Please provide a reason for rejecting this appointment request:
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
