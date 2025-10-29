import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DoctorProfileWithClinic } from "../../services/DoctorProfileService";
import { AlertTriangle, User, Calendar, Clock } from "lucide-react";

interface DeleteDoctorModalProps {
  doctor: DoctorProfileWithClinic;
  upcomingAppointmentsCount: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteDoctorModal({
  doctor,
  upcomingAppointmentsCount,
  isOpen,
  onClose,
  onConfirm,
}: DeleteDoctorModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmValid = confirmationText === "DELETE";

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
      setConfirmationText("");
    } catch (error) {
      console.error("Error deleting doctor:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
      setConfirmationText("");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Doctor?"
      size="lg"
    >
      <div className="p-6 space-y-6">
        {/* Warning Header */}
        <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900">
              This action cannot be undone
            </h3>
            <p className="text-sm text-red-700 mt-1">
              This will permanently delete Dr. {doctor.full_name} and all associated data from your clinic.
            </p>
          </div>
        </div>

        {/* Doctor Details */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900">Doctor Information</h4>
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">{doctor.full_name}</p>
                <p className="text-sm text-gray-600">{doctor.primary_specialization}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Role: {doctor.clinic_doctor?.role_in_clinic}</p>
                <p className="text-sm text-gray-600">
                  Employment: {doctor.clinic_doctor?.employment_type}
                </p>
              </div>
            </div>

            {upcomingAppointmentsCount > 0 && (
              <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    ⚠️ This doctor has {upcomingAppointmentsCount} upcoming appointment{upcomingAppointmentsCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-yellow-700">
                    These appointments will be cancelled and patients will be notified.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* What will be deleted */}
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-gray-900">What will be deleted:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span>Doctor profile and clinic relationship</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span>All appointment slots (marked as inactive)</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span>All future appointments (cancelled)</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              <span>Appointment history (preserved for audit)</span>
            </li>
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Type <span className="font-bold text-red-600">DELETE</span> to confirm:
          </label>
          <Input
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="Type DELETE here"
            className={confirmationText && !isConfirmValid ? "border-red-500" : ""}
            disabled={isDeleting}
          />
          {confirmationText && !isConfirmValid && (
            <p className="text-red-500 text-sm">
              Please type exactly "DELETE" to confirm
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
          >
            {isDeleting ? "Deleting..." : "Delete Doctor"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
