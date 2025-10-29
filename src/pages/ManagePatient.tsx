import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PatientProfileService } from "../services/PatientProfileService";
import type { PatientProfileWithClinic } from "../services/PatientProfileService";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Droplet,
  Edit,
  Edit2,
  Trash2,
  Heart,
  Check,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

export function ManagePatient() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientProfileWithClinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<
    "personal" | "medical" | null
  >(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form data states
  const [personalFormData, setPersonalFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "" as "male" | "female" | "other" | "",
    blood_group: "",
    aadhar_number: "",
    emergency_contact: "",
    // Address fields
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
  });

  const [medicalFormData, setMedicalFormData] = useState({
    allergies: [] as string[],
    chronic_conditions: [] as string[],
    medications: [] as string[],
    previous_surgeries: [] as string[],
    family_history: "",
    medical_notes: "",
  });

  useEffect(() => {
    if (id) {
      fetchPatient();
    }
  }, [id]);

  useEffect(() => {
    if (patient) {
      initializeFormData();
    }
  }, [patient]);

  const fetchPatient = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const result = await PatientProfileService.getPatientById(id);

      if (result.success && result.data) {
        setPatient(result.data);
      } else {
        toast.error("Failed to load patient details");
        navigate("/admin/patients");
      }
    } catch (error) {
      console.error("Error fetching patient:", error);
      toast.error("Failed to load patient details");
      navigate("/admin/patients");
    } finally {
      setLoading(false);
    }
  };

  const initializeFormData = () => {
    if (!patient) return;

    // Parse emergency contact if it's an object
    let emergencyContactStr = "";
    if (patient.emergency_contact) {
      if (typeof patient.emergency_contact === "object") {
        const ec = patient.emergency_contact as {
          name?: string;
          relation?: string;
          phone?: string;
        };
        emergencyContactStr = `${ec.name || ""} (${ec.relation || ""}) - ${
          ec.phone || ""
        }`;
      } else {
        emergencyContactStr = String(patient.emergency_contact);
      }
    }

    setPersonalFormData({
      full_name: patient.full_name || "",
      email: patient.email || "",
      phone: patient.phone || "",
      date_of_birth: patient.date_of_birth || "",
      gender: (patient.gender as "male" | "female" | "other") || "",
      blood_group: patient.blood_group || "",
      aadhar_number: patient.aadhar_number || "",
      emergency_contact: emergencyContactStr,
      // Address fields
      address_line1: patient.primary_address?.address_line1 || "",
      address_line2: patient.primary_address?.address_line2 || "",
      city: patient.primary_address?.city || "",
      state: patient.primary_address?.state || "",
      postal_code: patient.primary_address?.postal_code || "",
    });

    setMedicalFormData({
      allergies: patient.allergies || [],
      chronic_conditions: patient.chronic_conditions || [],
      medications: patient.medications || [],
      previous_surgeries: patient.previous_surgeries || [],
      family_history: patient.family_history || "",
      medical_notes: patient.medical_notes || "",
    });
  };

  // Personal info update
  const handlePersonalInfoUpdate = async () => {
    setIsUpdating(true);
    try {
      const updateData = {
        ...personalFormData,
        gender: personalFormData.gender || undefined,
        primary_address: {
          address_line1: personalFormData.address_line1 || "",
          address_line2: personalFormData.address_line2,
          city: personalFormData.city || "",
          state: personalFormData.state || "",
          postal_code: personalFormData.postal_code || "",
        },
      };
      const result = await PatientProfileService.updatePatientProfile(
        id!,
        updateData
      );
      if (result.success) {
        toast.success("Personal information updated successfully");
        setEditingSection(null);
        fetchPatient();
      } else {
        toast.error(result.error?.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update personal information");
    } finally {
      setIsUpdating(false);
    }
  };

  // Medical info update
  const handleMedicalInfoUpdate = async () => {
    setIsUpdating(true);
    try {
      const result = await PatientProfileService.updatePatientProfile(
        id!,
        medicalFormData
      );
      if (result.success) {
        toast.success("Medical information updated successfully");
        setEditingSection(null);
        fetchPatient();
      } else {
        toast.error(result.error?.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update medical information");
    } finally {
      setIsUpdating(false);
    }
  };

  // Array manipulation helpers
  const addItem = (field: keyof typeof medicalFormData, value: string) => {
    if (!value.trim()) return;
    setMedicalFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value.trim()],
    }));
  };

  const removeItem = (field: keyof typeof medicalFormData, index: number) => {
    setMedicalFormData((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }));
  };

  const handleEditSection = (section: "personal" | "medical") => {
    initializeFormData();
    setEditingSection(section);
  };

  const handleCancelEdit = () => {
    initializeFormData();
    setEditingSection(null);
  };

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const result = await PatientProfileService.deletePatientFromClinic(id);

      if (result.success) {
        toast.success("Patient permanently removed from clinic");
        navigate("/admin/patients");
      } else {
        toast.error(result.error?.message || "Failed to delete patient");
      }
    } catch {
      toast.error("Failed to delete patient");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleBack = () => {
    navigate("/admin/patients");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Patient not found
          </h2>
          <p className="text-gray-600 mb-4">
            The requested patient could not be found.
          </p>
          <Button onClick={handleBack}>Back to Patients</Button>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const calculateAge = (dateOfBirth?: string): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <button
            onClick={handleBack}
            className="hover:text-blue-600 transition-colors"
          >
            Patients
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">{patient.full_name}</span>
        </nav>

        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-bold text-white">
                    {getInitials(patient.full_name)}
                  </span>
                </div>
              </div>

              {/* Patient Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {patient.full_name}
                </h1>

                <div className="flex items-center space-x-6 text-gray-600 mb-4">
                  {patient.date_of_birth && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      <span>
                        {calculateAge(patient.date_of_birth)} years old
                      </span>
                    </div>
                  )}
                  {patient.gender && (
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-blue-500" />
                      <span className="capitalize">{patient.gender}</span>
                    </div>
                  )}
                  {patient.blood_group && (
                    <div className="flex items-center space-x-2">
                      <Droplet className="h-5 w-5 text-blue-500" />
                      <span>{patient.blood_group}</span>
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  {patient.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>{patient.email}</span>
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mt-6 lg:mt-0">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 px-6 py-2 rounded-lg font-medium transition-all duration-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Patient
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* Personal Information */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <CardTitle className="flex items-center justify-between text-blue-900">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </div>
                {editingSection === "personal" ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      size="sm"
                      className="text-gray-600 hover:text-gray-700"
                      disabled={isUpdating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePersonalInfoUpdate}
                      size="sm"
                      disabled={isUpdating}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleEditSection("personal")}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {editingSection === "personal" ? (
                <div className="space-y-6">
                  {/* Basic Details Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                      Basic Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={personalFormData.full_name}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              full_name: e.target.value,
                            })
                          }
                          placeholder="Full Name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date of Birth
                        </label>
                        <Input
                          type="date"
                          value={personalFormData.date_of_birth}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              date_of_birth: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Gender
                        </label>
                        <select
                          value={personalFormData.gender}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              gender: e.target.value as
                                | "male"
                                | "female"
                                | "other"
                                | "",
                            })
                          }
                          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Blood Group
                        </label>
                        <select
                          value={personalFormData.blood_group}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              blood_group: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select blood group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                      Contact Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={personalFormData.phone}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+91 98765 43210"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <Input
                          type="email"
                          value={personalFormData.email}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              email: e.target.value,
                            })
                          }
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Contact
                        </label>
                        <Input
                          value={personalFormData.emergency_contact}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              emergency_contact: e.target.value,
                            })
                          }
                          placeholder="+91 98765 43210"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Identification Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                      Identification
                    </h4>
                    <div className="grid grid-cols-1 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Aadhar Number
                        </label>
                        <Input
                          value={personalFormData.aadhar_number}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              aadhar_number: e.target.value,
                            })
                          }
                          placeholder="1234 5678 9012"
                          maxLength={12}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="border-t pt-6 mt-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">
                      Address
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 1
                        </label>
                        <Input
                          value={personalFormData.address_line1}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              address_line1: e.target.value,
                            })
                          }
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 2
                        </label>
                        <Input
                          value={personalFormData.address_line2}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              address_line2: e.target.value,
                            })
                          }
                          placeholder="Apartment, suite, etc. (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City
                          </label>
                          <Input
                            value={personalFormData.city}
                            onChange={(e) =>
                              setPersonalFormData({
                                ...personalFormData,
                                city: e.target.value,
                              })
                            }
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State
                          </label>
                          <Input
                            value={personalFormData.state}
                            onChange={(e) =>
                              setPersonalFormData({
                                ...personalFormData,
                                state: e.target.value,
                              })
                            }
                            placeholder="State"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Postal Code
                          </label>
                          <Input
                            value={personalFormData.postal_code}
                            onChange={(e) =>
                              setPersonalFormData({
                                ...personalFormData,
                                postal_code: e.target.value,
                              })
                            }
                            placeholder="123456"
                            maxLength={6}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Basic Details */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                      Basic Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Full Name
                        </label>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {patient.full_name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Date of Birth
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {patient.date_of_birth
                            ? formatDate(patient.date_of_birth)
                            : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Gender
                        </label>
                        <p className="text-lg text-gray-900 mt-1 capitalize">
                          {patient.gender || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Blood Group
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {patient.blood_group || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                      Contact Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Phone Number
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {patient.phone}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Email Address
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {patient.email || "Not provided"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-500">
                          Emergency Contact
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {patient.emergency_contact &&
                          typeof patient.emergency_contact === "object"
                            ? (() => {
                                const ec = patient.emergency_contact as {
                                  name?: string;
                                  relation?: string;
                                  phone?: string;
                                };
                                return `${ec.name || ""} (${
                                  ec.relation || ""
                                }) - ${ec.phone || ""}`;
                              })()
                            : patient.emergency_contact || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Identification */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                      Identification
                    </h4>
                    <div className="grid grid-cols-1 gap-6 mt-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Aadhar Number
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {patient.aadhar_number || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Address Section */}
                  {patient.primary_address && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="text-md font-semibold text-gray-900 mb-4">
                        Address
                      </h4>
                      <div className="space-y-2 text-gray-700">
                        {patient.primary_address.address_line1 && (
                          <p>{patient.primary_address.address_line1}</p>
                        )}
                        {patient.primary_address.address_line2 && (
                          <p>{patient.primary_address.address_line2}</p>
                        )}
                        {(patient.primary_address.city ||
                          patient.primary_address.state ||
                          patient.primary_address.postal_code) && (
                          <p>
                            {patient.primary_address.city}
                            {patient.primary_address.city &&
                              patient.primary_address.state &&
                              ", "}
                            {patient.primary_address.state}
                            {(patient.primary_address.city ||
                              patient.primary_address.state) &&
                              patient.primary_address.postal_code &&
                              " - "}
                            {patient.primary_address.postal_code}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Medical History Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-50 rounded-t-xl">
              <CardTitle className="flex items-center justify-between text-blue-900">
                <div className="flex items-center">
                  <Heart className="h-5 w-5 mr-2" />
                  Medical History
                </div>
                {editingSection === "medical" ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setEditingSection(null)}
                      variant="outline"
                      size="sm"
                      className="text-gray-600 hover:text-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleMedicalInfoUpdate}
                      size="sm"
                      disabled={isUpdating}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleEditSection("medical")}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {editingSection === "medical" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allergies - Edit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allergies
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {medicalFormData.allergies.map((allergy, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                            >
                              {allergy}
                              <button
                                onClick={() => removeItem("allergies", idx)}
                                className="ml-1 hover:text-blue-900"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <Input
                          placeholder="Add allergy and press Enter"
                          onKeyPress={(e) => {
                            if (
                              e.key === "Enter" &&
                              e.currentTarget.value.trim()
                            ) {
                              addItem(
                                "allergies",
                                e.currentTarget.value.trim()
                              );
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Chronic Conditions - Edit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Chronic Conditions
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {medicalFormData.chronic_conditions.map(
                            (condition, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                              >
                                {condition}
                                <button
                                  onClick={() =>
                                    removeItem("chronic_conditions", idx)
                                  }
                                  className="ml-1 hover:text-blue-900"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          )}
                        </div>
                        <Input
                          placeholder="Add condition and press Enter"
                          onKeyPress={(e) => {
                            if (
                              e.key === "Enter" &&
                              e.currentTarget.value.trim()
                            ) {
                              addItem(
                                "chronic_conditions",
                                e.currentTarget.value.trim()
                              );
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Medications - Edit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Medications
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {medicalFormData.medications.map(
                            (medication, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                              >
                                {medication}
                                <button
                                  onClick={() => removeItem("medications", idx)}
                                  className="ml-1 hover:text-blue-900"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          )}
                        </div>
                        <Input
                          placeholder="Add medication and press Enter"
                          onKeyPress={(e) => {
                            if (
                              e.key === "Enter" &&
                              e.currentTarget.value.trim()
                            ) {
                              addItem(
                                "medications",
                                e.currentTarget.value.trim()
                              );
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Previous Surgeries - Edit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Previous Surgeries
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {medicalFormData.previous_surgeries.map(
                            (surgery, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                              >
                                {surgery}
                                <button
                                  onClick={() =>
                                    removeItem("previous_surgeries", idx)
                                  }
                                  className="ml-1 hover:text-blue-900"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          )}
                        </div>
                        <Input
                          placeholder="Add surgery and press Enter"
                          onKeyPress={(e) => {
                            if (
                              e.key === "Enter" &&
                              e.currentTarget.value.trim()
                            ) {
                              addItem(
                                "previous_surgeries",
                                e.currentTarget.value.trim()
                              );
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Family History & Medical Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Family History - Edit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Family History
                      </label>
                      <textarea
                        value={medicalFormData.family_history}
                        onChange={(e) =>
                          setMedicalFormData({
                            ...medicalFormData,
                            family_history: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        placeholder="Enter family medical history..."
                      />
                    </div>

                    {/* Medical Notes - Edit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Medical Notes
                      </label>
                      <textarea
                        value={medicalFormData.medical_notes}
                        onChange={(e) =>
                          setMedicalFormData({
                            ...medicalFormData,
                            medical_notes: e.target.value,
                          })
                        }
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        placeholder="Enter additional medical notes..."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Allergies - View */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Allergies
                    </label>
                    {patient.allergies && patient.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.allergies.map((allergy, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {allergy}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">None recorded</p>
                    )}
                  </div>

                  {/* Chronic Conditions - View */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Chronic Conditions
                    </label>
                    {patient.chronic_conditions &&
                    patient.chronic_conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.chronic_conditions.map((condition, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {condition}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">None recorded</p>
                    )}
                  </div>

                  {/* Medications - View */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Current Medications
                    </label>
                    {patient.medications && patient.medications.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.medications.map((medication, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {medication}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">None recorded</p>
                    )}
                  </div>

                  {/* Previous Surgeries - View */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Previous Surgeries
                    </label>
                    {patient.previous_surgeries &&
                    patient.previous_surgeries.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.previous_surgeries.map((surgery, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {surgery}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">None recorded</p>
                    )}
                  </div>

                  {/* Family History - View */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Family History
                    </label>
                    <p className="text-gray-700">
                      {patient.family_history || "Not provided"}
                    </p>
                  </div>

                  {/* Medical Notes - View */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Medical Notes
                    </label>
                    <p className="text-gray-700">
                      {patient.medical_notes || "No additional notes"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* End of cards */}
        </div>

        {/* Delete Patient Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Remove Patient from Clinic
                  </h3>
                  <p className="text-sm text-gray-500">
                    This will remove the patient from your clinic records
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to remove{" "}
                  <span className="font-semibold">{patient.full_name}</span>{" "}
                  from your clinic?
                </p>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    This will remove the patient's association with your clinic
                    but their profile will remain in the system.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1"
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Removing...
                    </>
                  ) : (
                    "Remove Patient"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
