import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DoctorProfileService } from "../services/DoctorProfileService";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { SlotCreationForm } from "../components/doctorComponents/SlotCreationForm";
import { SlotsManagementTable } from "../components/doctorComponents/SlotsManagementTable";
import { toast } from "sonner";
import {
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  GraduationCap,
  Clock,
  Users,
  Calendar as CalendarIcon,
  Star,
  Award,
  TrendingUp,
  CalendarDays,
  Plus,
  Globe2,
  FileText,
  Power,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

export function ManageDoctor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [upcomingAppointmentsCount, setUpcomingAppointmentsCount] = useState(0);
  const [editingSection, setEditingSection] = useState<
    "personal" | "professional" | "slots" | null
  >(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form data states for each section
  const [personalFormData, setPersonalFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    medical_license_number: "",
    date_of_birth: "",
    gender: "",
  });

  const [professionalFormData, setProfessionalFormData] = useState({
    primary_specialization: "",
    secondary_specializations: [] as string[],
    qualifications: [] as string[],
    experience_years: 0,
    bio: "",
    languages: [] as string[],
  });

  useEffect(() => {
    if (id) {
      fetchDoctor();
    }
  }, [id]);

  useEffect(() => {
    if (doctor) {
      initializeFormData();
    }
  }, [doctor]);

  const fetchDoctor = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const result = await DoctorProfileService.getDoctorWithUpcomingSlots(id);

      if (result.success && result.data) {
        console.log("Doctor data:", result.data);
        console.log("Clinic doctor:", result.data.clinic_doctor);
        console.log(
          "Consultation fee from clinic_doctor:",
          result.data.clinic_doctor?.consultation_fee
        );
        console.log(
          "Consultation fee from doctor:",
          result.data.consultation_fee
        );
        setDoctor(result.data);
        // Count upcoming appointments from slots
        const totalBookings = result.data.upcoming_slots.reduce(
          (sum, slot) => sum + slot.current_bookings,
          0
        );
        setUpcomingAppointmentsCount(totalBookings);
      } else {
        toast.error("Failed to load doctor details");
        navigate("/admin/doctors");
      }
    } catch (error) {
      console.error("Error fetching doctor:", error);
      toast.error("Failed to load doctor details");
      navigate("/admin/doctors");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActiveStatus = async () => {
    if (!id || !doctor) return;

    const newStatus = !doctor.clinic_doctor?.is_active;
    const actionText = newStatus ? "activated" : "deactivated";

    setIsTogglingStatus(true);
    try {
      const result = await DoctorProfileService.toggleDoctorActiveStatus(
        id,
        newStatus
      );

      if (result.success) {
        const message = newStatus
          ? `Doctor ${actionText} successfully.`
          : `Doctor ${actionText} successfully. ${result.data?.affectedAppointments || 0
          } appointments cancelled, ${result.data?.affectedSlots || 0
          } slots deactivated.`;

        toast.success(message);
        setShowToggleModal(false);
        fetchDoctor(); // Refresh data
      } else {
        toast.error(
          result.error?.message || `Failed to ${actionText.slice(0, -1)} doctor`
        );
      }
    } catch (error) {
      console.error("Error toggling doctor status:", error);
      toast.error(`Failed to ${actionText.slice(0, -1)} doctor`);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const result = await DoctorProfileService.deleteDoctorWithCleanup(id);

      if (result.success && result.data) {
        toast.success(
          `Doctor permanently deleted from clinic. ${result.data.deletedAppointments} appointments cancelled, ${result.data.deletedSlots} slots removed.`
        );
        navigate("/admin/doctors");
      } else {
        toast.error(result.error?.message || "Failed to delete doctor");
      }
    } catch (error) {
      console.error("Error deleting doctor:", error);
      toast.error("Failed to delete doctor");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleBack = () => {
    navigate("/admin/doctors");
  };

  // Initialize form data when entering edit mode or on doctor load
  const initializeFormData = () => {
    if (!doctor) return;

    setPersonalFormData({
      full_name: doctor.full_name || "",
      email: doctor.email || "",
      phone: doctor.phone || "",
      medical_license_number: doctor.medical_license_number || "",
      date_of_birth: doctor.date_of_birth || "",
      gender: doctor.gender || "",
    });

    setProfessionalFormData({
      primary_specialization: doctor.primary_specialization || "",
      secondary_specializations: doctor.secondary_specializations || [],
      qualifications: doctor.qualifications || [],
      experience_years: doctor.experience_years || 0,
      bio: doctor.bio || "",
      languages: doctor.languages || [],
    });
  };

  // Personal info update
  const handlePersonalInfoUpdate = async () => {
    setIsUpdating(true);
    try {
      const result = await DoctorProfileService.updateDoctorProfile(
        id!,
        personalFormData
      );
      if (result.success) {
        toast.success("Personal information updated successfully");
        setEditingSection(null);
        fetchDoctor(); // Refresh data
      } else {
        toast.error(result.error?.message || "Failed to update");
      }
    } catch (error) {
      toast.error("Failed to update personal information");
    } finally {
      setIsUpdating(false);
    }
  };

  // Professional details update
  const handleProfessionalInfoUpdate = async () => {
    setIsUpdating(true);
    try {
      const result = await DoctorProfileService.updateDoctorProfile(
        id!,
        professionalFormData
      );
      if (result.success) {
        toast.success("Professional details updated successfully");
        setEditingSection(null);
        fetchDoctor(); // Refresh data
      } else {
        toast.error(result.error?.message || "Failed to update");
      }
    } catch (error) {
      toast.error("Failed to update professional details");
    } finally {
      setIsUpdating(false);
    }
  };

  // Array manipulation helpers
  const addItem = (field: keyof typeof professionalFormData, value: string) => {
    if (!value.trim()) return;
    setProfessionalFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value.trim()],
    }));
  };

  const removeItem = (
    field: keyof typeof professionalFormData,
    index: number
  ) => {
    setProfessionalFormData((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }));
  };

  // Handle edit button clicks
  const handleEditSection = (
    section: "personal" | "professional" | "slots"
  ) => {
    initializeFormData();
    setEditingSection(section);
  };

  // Handle cancel - reset form and exit edit mode
  const handleCancelEdit = () => {
    initializeFormData();
    setEditingSection(null);
  };

  // Handle slots created callback
  const handleSlotsCreated = (slots: any[]) => {
    toast.success(`Successfully created ${slots.length} slot(s)`);
    fetchDoctor(); // Refresh data
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading doctor details...</p>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Doctor not found
          </h2>
          <p className="text-gray-600 mb-4">
            The requested doctor could not be found.
          </p>
          <Button onClick={handleBack}>Back to Doctors</Button>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <button
            onClick={handleBack}
            className="hover:text-blue-600 transition-colors"
          >
            Doctors
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">
            Dr. {doctor.full_name}
          </span>
        </nav>

        {/* Hero Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-bold text-white">
                    {getInitials(doctor.full_name)}
                  </span>
                </div>
              </div>

              {/* Doctor Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    Dr. {doctor.full_name}
                  </h1>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${doctor.clinic_doctor?.is_active
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}
                  >
                    {doctor.clinic_doctor?.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-center space-x-6 text-gray-600 mb-4">
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">
                      {doctor.primary_specialization}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-blue-500" />
                    <span>{doctor.experience_years || 0} years experience</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span>
                      {upcomingAppointmentsCount} upcoming appointments
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  {doctor.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>{doctor.email}</span>
                    </div>
                  )}
                  {doctor.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{doctor.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mt-6 lg:mt-0">
              <Button
                variant="outline"
                onClick={() => setShowToggleModal(true)}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${doctor.clinic_doctor?.is_active
                    ? "text-orange-600 border-orange-200 hover:bg-orange-50"
                    : "text-green-600 border-green-200 hover:bg-green-50"
                  }`}
              >
                <Power className="h-4 w-4 mr-2" />
                {doctor.clinic_doctor?.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 px-6 py-2 rounded-lg font-medium transition-all duration-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Slots</p>
                <p className="text-2xl font-bold text-gray-900">
                  {doctor.upcoming_slots?.length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Booked Appointments
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {upcomingAppointmentsCount}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Experience</p>
                <p className="text-2xl font-bold text-gray-900">
                  {doctor.experience_years || 0}y
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Star className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Consultation Fee
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {doctor.clinic_doctor?.consultation_fee
                    ? `₹${doctor.clinic_doctor.consultation_fee}`
                    : doctor.consultation_fee
                      ? `₹${doctor.consultation_fee}`
                      : "Not set"}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* Personal & Professional Info */}
          <div className="space-y-6">
            {/* Personal Information */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                <CardTitle className="flex items-center justify-between text-blue-900">
                  <div className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Personal Information
                  </div>
                  {editingSection !== "personal" && (
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <Input
                          value={personalFormData.full_name}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              full_name: e.target.value,
                            })
                          }
                          placeholder="Dr. John Smith"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
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
                          placeholder="doctor@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number *
                        </label>
                        <Input
                          value={personalFormData.phone}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+1234567890"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Medical License Number *
                        </label>
                        <Input
                          value={personalFormData.medical_license_number}
                          onChange={(e) =>
                            setPersonalFormData({
                              ...personalFormData,
                              medical_license_number: e.target.value,
                            })
                          }
                          placeholder="ML123456"
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
                              gender: e.target.value,
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
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handlePersonalInfoUpdate}
                        disabled={isUpdating}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isUpdating ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Full Name
                        </label>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {doctor.full_name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Email Address
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {doctor.email || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Phone Number
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {doctor.phone}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Date of Birth
                        </label>
                        <p className="text-lg text-gray-900 mt-1">
                          {doctor.date_of_birth
                            ? formatDate(doctor.date_of_birth)
                            : "Not provided"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Gender
                        </label>
                        <p className="text-lg text-gray-900 mt-1 capitalize">
                          {doctor.gender || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Medical License
                        </label>
                        <p className="text-lg text-gray-900 mt-1 font-mono text-sm">
                          {doctor.medical_license_number}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Professional Details */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                <CardTitle className="flex items-center justify-between text-blue-900">
                  <div className="flex items-center">
                    <GraduationCap className="h-5 w-5 mr-2" />
                    Professional Details
                  </div>
                  {editingSection !== "professional" && (
                    <Button
                      size="sm"
                      onClick={() => handleEditSection("professional")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {editingSection === "professional" ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Primary Specialization *
                      </label>
                      <Input
                        value={professionalFormData.primary_specialization}
                        onChange={(e) =>
                          setProfessionalFormData({
                            ...professionalFormData,
                            primary_specialization: e.target.value,
                          })
                        }
                        placeholder="Cardiology"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Secondary Specializations
                        </label>
                        <div className="space-y-2">
                          <Input
                            placeholder="Add specialization"
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addItem(
                                  "secondary_specializations",
                                  e.currentTarget.value
                                );
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            {professionalFormData.secondary_specializations.map(
                              (spec, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                                >
                                  {spec}
                                  <button
                                    onClick={() =>
                                      removeItem(
                                        "secondary_specializations",
                                        idx
                                      )
                                    }
                                    className="ml-2 text-blue-600 hover:text-blue-800"
                                  >
                                    ×
                                  </button>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Qualifications
                        </label>
                        <div className="space-y-2">
                          <Input
                            placeholder="Add qualification"
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addItem(
                                  "qualifications",
                                  e.currentTarget.value
                                );
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            {professionalFormData.qualifications.map(
                              (qual, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                                >
                                  {qual}
                                  <button
                                    onClick={() =>
                                      removeItem("qualifications", idx)
                                    }
                                    className="ml-2 text-red-600 hover:text-red-800"
                                  >
                                    ×
                                  </button>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Experience Years
                        </label>
                        <Input
                          type="number"
                          value={professionalFormData.experience_years}
                          onChange={(e) =>
                            setProfessionalFormData({
                              ...professionalFormData,
                              experience_years: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="10"
                          min="0"
                          max="50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Languages
                        </label>
                        <div className="space-y-2">
                          <Input
                            placeholder="Add language"
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addItem("languages", e.currentTarget.value);
                                e.currentTarget.value = "";
                              }
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            {professionalFormData.languages.map((lang, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                              >
                                {lang}
                                <button
                                  onClick={() => removeItem("languages", idx)}
                                  className="ml-2 text-green-600 hover:text-green-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bio
                      </label>
                      <textarea
                        value={professionalFormData.bio}
                        onChange={(e) =>
                          setProfessionalFormData({
                            ...professionalFormData,
                            bio: e.target.value,
                          })
                        }
                        placeholder="Brief description of the doctor's background and expertise..."
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={4}
                      />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleProfessionalInfoUpdate}
                        disabled={isUpdating}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isUpdating ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Primary Specialization */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Primary Specialization
                          </label>
                          <p className="text-lg font-semibold text-gray-900">
                            {doctor.primary_specialization}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Specializations & Qualifications Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Secondary Specializations */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Star className="h-4 w-4 text-gray-600" />
                          </div>
                          <label className="text-sm font-medium text-gray-500">
                            Secondary Specializations
                          </label>
                        </div>
                        {doctor.secondary_specializations &&
                          doctor.secondary_specializations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {doctor.secondary_specializations.map(
                              (spec: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 font-medium"
                                >
                                  {spec}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No secondary specializations added
                          </p>
                        )}
                      </div>

                      {/* Qualifications */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Award className="h-4 w-4 text-gray-600" />
                          </div>
                          <label className="text-sm font-medium text-gray-500">
                            Qualifications
                          </label>
                        </div>
                        {doctor.qualifications &&
                          doctor.qualifications.length > 0 ? (
                          <div className="space-y-2">
                            {doctor.qualifications.map(
                              (qual: string, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center space-x-2"
                                >
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  <span className="text-sm text-gray-900">
                                    {qual}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No qualifications added
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Experience & Languages Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Experience */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Clock className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">
                              Experience
                            </label>
                            <p className="text-lg font-semibold text-gray-900">
                              {doctor.experience_years || 0} years
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Languages */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Globe2 className="h-4 w-4 text-gray-600" />
                          </div>
                          <label className="text-sm font-medium text-gray-500">
                            Languages
                          </label>
                        </div>
                        {doctor.languages && doctor.languages.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {doctor.languages.map(
                              (lang: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 font-medium"
                                >
                                  {lang}
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No languages added
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bio */}
                    {doctor.bio && (
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mt-1">
                            <FileText className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <label className="text-sm font-medium text-gray-500 mb-2 block">
                              Bio
                            </label>
                            <p className="text-gray-700 leading-relaxed">
                              {doctor.bio}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Appointment Slots Section */}
        <div className="mt-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <CardTitle className="flex items-center justify-between text-blue-900">
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Appointment Slots
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-normal text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                    {doctor.upcoming_slots?.length || 0} slots
                  </span>
                  {editingSection !== "slots" && (
                    <Button
                      size="sm"
                      onClick={() => handleEditSection("slots")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Manage Slots
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {editingSection === "slots" ? (
                <div className="space-y-6">
                  {/* Create New Slots */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Create New Slots
                    </h3>
                    <SlotCreationForm
                      doctorId={id!}
                      onSlotsCreated={handleSlotsCreated}
                      onCancel={() => { }}
                    />
                  </div>

                  {/* Manage Existing Slots */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Manage Existing Slots
                    </h3>
                    <SlotsManagementTable
                      doctorId={id!}
                      onRefresh={fetchDoctor}
                    />
                  </div>

                  <div className="text-center pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setEditingSection(null)}
                      className="px-6 py-2"
                    >
                      Done Managing Slots
                    </Button>
                  </div>
                </div>
              ) : doctor.upcoming_slots && doctor.upcoming_slots.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Slot Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Capacity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Utilization
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {doctor.upcoming_slots.map((slot: any) => (
                          <tr key={slot.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(slot.slot_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {slot.slot_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(() => {
                                const formatTo12Hr = (t: string) => {
                                  const [h, m] = t.split(':').map(Number);
                                  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                                };
                                return `${formatTo12Hr(slot.start_time)} - ${formatTo12Hr(slot.end_time)}`;
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {slot.current_bookings}/{slot.max_capacity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{
                                      width: `${(slot.current_bookings /
                                          slot.max_capacity) *
                                        100
                                        }%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {Math.round(
                                    (slot.current_bookings /
                                      slot.max_capacity) *
                                    100
                                  )}
                                  %
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CalendarIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No appointment slots yet
                  </h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    This doctor doesn't have any appointment slots created yet.
                    Create slots to start accepting appointments.
                  </p>
                  <Button
                    onClick={() => handleEditSection("slots")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Slots
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Toggle Active Status Modal */}
        {showToggleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
              <div className="flex items-center space-x-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${doctor.clinic_doctor?.is_active
                      ? "bg-orange-100"
                      : "bg-green-100"
                    }`}
                >
                  <Power
                    className={`h-6 w-6 ${doctor.clinic_doctor?.is_active
                        ? "text-orange-600"
                        : "text-green-600"
                      }`}
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {doctor.clinic_doctor?.is_active
                      ? "Deactivate"
                      : "Activate"}{" "}
                    Doctor
                  </h3>
                  <p className="text-sm text-gray-500">
                    {doctor.clinic_doctor?.is_active
                      ? "Temporarily disable"
                      : "Re-enable"}{" "}
                    this doctor
                  </p>
                </div>
              </div>

              <div className="mb-6">
                {doctor.clinic_doctor?.is_active ? (
                  <>
                    <p className="text-gray-700 mb-3">
                      Deactivating{" "}
                      <span className="font-semibold">
                        Dr. {doctor.full_name}
                      </span>{" "}
                      will:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>
                          Cancel all future appointments (
                          {upcomingAppointmentsCount} appointments)
                        </span>
                      </li>
                      <li className="flex items-start">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>Deactivate all appointment slots</span>
                      </li>
                      <li className="flex items-start">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>
                          Patients won't be able to book new appointments
                        </span>
                      </li>
                    </ul>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> You can reactivate this doctor
                        anytime to restore their access.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 mb-3">
                      Activating{" "}
                      <span className="font-semibold">
                        Dr. {doctor.full_name}
                      </span>{" "}
                      will:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <div className="h-4 w-4 bg-green-500 rounded-full mr-2 mt-0.5 flex-shrink-0" />
                        <span>Re-enable the doctor in the system</span>
                      </li>
                      <li className="flex items-start">
                        <div className="h-4 w-4 bg-green-500 rounded-full mr-2 mt-0.5 flex-shrink-0" />
                        <span>
                          Allow patients to book appointments (after creating
                          new slots)
                        </span>
                      </li>
                    </ul>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> You'll need to create new
                        appointment slots for patients to book.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowToggleModal(false)}
                  className="flex-1"
                  disabled={isTogglingStatus}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleToggleActiveStatus}
                  disabled={isTogglingStatus}
                  className={`flex-1 ${doctor.clinic_doctor?.is_active
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "bg-green-600 hover:bg-green-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTogglingStatus ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Processing...
                    </>
                  ) : doctor.clinic_doctor?.is_active ? (
                    "Deactivate"
                  ) : (
                    "Activate"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Permanently Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Delete Doctor Permanently
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to permanently delete{" "}
                  <span className="font-semibold">Dr. {doctor.full_name}</span>{" "}
                  from your clinic?
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  <li className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>
                      All appointment history will be preserved but marked as
                      deleted
                    </span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>
                      All future appointments will be cancelled (
                      {upcomingAppointmentsCount} appointments)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>
                      All appointment slots will be permanently removed
                    </span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>
                      Doctor's profile will be removed from your clinic
                    </span>
                  </li>
                </ul>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-semibold mb-2">
                    ⚠️ This is a permanent action!
                  </p>
                  <p className="text-sm text-red-700">
                    Consider using <strong>"Deactivate"</strong> instead if you
                    might need to restore this doctor later.
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
                      Deleting...
                    </>
                  ) : (
                    "Delete Permanently"
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
