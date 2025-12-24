import { Modal } from "../ui/Modal";
import {
  User,
  MapPin,
  FileText,
  Edit,
  Phone,
  Calendar,
  Mail,
  Heart,
  Pill,
  AlertTriangle,
  Stethoscope,
  Clock,
  Shield,
  Activity,
} from "lucide-react";
import { PatientProfileWithClinic } from "../../services/PatientProfileService";
import { format } from "date-fns";
import { formatAddressForDisplay } from "../../validation/AddressValidation";
import { capitalizeWords } from "../../utils/textUtils";

interface ViewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  patient: PatientProfileWithClinic | null;
}

export function ViewPatientModal({
  isOpen,
  onClose,
  onEdit,
  patient,
}: ViewPatientModalProps) {
  if (!patient) return null;

  // optional avatar field - safe read in case db has `avatar_url` or `photo_url`
  const pRec = patient as unknown as Record<string, unknown>;
  const avatar =
    (pRec["avatar_url"] as string | undefined) ??
    (pRec["photo_url"] as string | undefined) ??
    null;

  // Helper functions to extract data from the new schema
  const getAge = () => {
    if (patient.date_of_birth) {
      const birthDate = new Date(patient.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
      return `${age} yrs`;
    }
    return "—";
  };

  const getDisplayAddress = () => {
    // Ensure we pass a valid address object or null
    const address = patient.primary_address;
    if (!address || (typeof address === 'object' && Object.keys(address).length === 0)) {
      return "No address provided";
    }
    return formatAddressForDisplay(address);
  };

  // Helper function to extract emergency contact as string
  const getEmergencyContact = () => {
    const emergencyContact = patient.emergency_contact;

    // Handle different types of emergency_contact data
    if (!emergencyContact) return "—";

    // If it's a string, return it directly
    if (typeof emergencyContact === 'string') {
      return emergencyContact;
    }

    // If it's an object, try to extract phone number
    if (typeof emergencyContact === 'object') {
      // Cast to a record type to access dynamic properties
      const ec = emergencyContact as Record<string, unknown>;

      // Handle different possible structures
      if (ec.phone) return String(ec.phone);
      if (ec.number) return String(ec.number);
      if (ec.contact) return String(ec.contact);

      // If it's an empty object, return dash
      if (Object.keys(ec).length === 0) return "—";

      // If we can't extract a meaningful value, return dash
      return "—";
    }

    return "—";
  };

  const allergies = patient.allergies ?? [];
  const chronic = patient.chronic_conditions ?? [];
  const medications = patient.medications ?? [];
  const previousSurgeries = patient.previous_surgeries ?? [];
  const familyHistory = patient.family_history ?? "";
  const additionalNotes = patient.medical_notes ?? "";

  // compact list of summary tags was removed — inline tag rendering is used below

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="p-0">
        {/* Header Section with Gradient Background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={`${patient.full_name} avatar`}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <User className="h-8 w-8 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {capitalizeWords(patient.full_name)}
                </h1>
                <p className="text-blue-100 text-sm">
                  Patient ID: {patient.id.slice(0, 8)}...
                </p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-blue-100">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Registered {format(new Date(patient.created_at), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{getAge()}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => onEdit?.()}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Patient</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {/* Contact Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Phone</p>
                  <p className="text-gray-900 font-semibold">{patient.phone}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Mail className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-600 font-medium">Email</p>
                  <p className="text-gray-900 font-semibold break-all">{patient.email || "—"}</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-orange-600 font-medium">Emergency Contact</p>
                  <p className="text-gray-900 font-semibold">{getEmergencyContact()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-600" />
              <span>Personal Information</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Gender</p>
                <p className="font-medium text-gray-900">{patient.gender || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Blood Group</p>
                <p className="font-medium text-gray-900">{patient.blood_group || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Aadhar Number</p>
                <p className="font-medium text-gray-900">{patient.aadhar_number || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Date of Birth</p>
                <p className="font-medium text-gray-900">
                  {patient.date_of_birth ? format(new Date(patient.date_of_birth), "MMM d, yyyy") : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span>Address Information</span>
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed">
                {getDisplayAddress()}
              </p>
            </div>
          </div>

          {/* Medical History */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <Stethoscope className="h-5 w-5 text-blue-600" />
              <span>Medical History</span>
            </h3>

            <div className="space-y-6">
              {/* Allergies */}
              <div className="border-l-4 border-red-200 pl-4">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h4 className="font-medium text-gray-900">Allergies</h4>
                </div>
                {allergies && allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {allergies.map((allergy, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm border border-red-200"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No known allergies</p>
                )}
              </div>

              {/* Chronic Conditions */}
              <div className="border-l-4 border-orange-200 pl-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Heart className="h-5 w-5 text-orange-500" />
                  <h4 className="font-medium text-gray-900">Chronic Conditions</h4>
                </div>
                {chronic && chronic.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {chronic.map((condition, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm border border-orange-200"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No chronic conditions</p>
                )}
              </div>

              {/* Current Medications */}
              <div className="border-l-4 border-blue-200 pl-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Pill className="h-5 w-5 text-blue-500" />
                  <h4 className="font-medium text-gray-900">Current Medications</h4>
                </div>
                {medications && medications.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {medications.map((medication, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                      >
                        {medication}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No current medications</p>
                )}
              </div>

              {/* Previous Surgeries */}
              <div className="border-l-4 border-purple-200 pl-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Activity className="h-5 w-5 text-purple-500" />
                  <h4 className="font-medium text-gray-900">Previous Surgeries</h4>
                </div>
                {previousSurgeries && previousSurgeries.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {previousSurgeries.map((surgery, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm border border-purple-200"
                      >
                        {surgery}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No previous surgeries</p>
                )}
              </div>

              {/* Family History */}
              {(familyHistory && familyHistory.trim()) && (
                <div className="border-l-4 border-gray-200 pl-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <h4 className="font-medium text-gray-900">Family History</h4>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{familyHistory}</p>
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {(additionalNotes && additionalNotes.trim()) && (
                <div className="border-l-4 border-gray-200 pl-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <h4 className="font-medium text-gray-900">Additional Notes</h4>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{additionalNotes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
