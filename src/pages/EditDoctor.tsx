import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DoctorProfileService } from "../services/DoctorProfileService";
import { DoctorForm } from "../components/doctorComponents/DoctorForm";
import { SlotCreationForm } from "../components/doctorComponents/SlotCreationForm";
import { SlotsManagementTable } from "../components/doctorComponents/SlotsManagementTable";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Clock, 
  Users, 
  Plus,
  Settings,
  Briefcase,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  Star,
  Award,
  Globe
} from "lucide-react";

export function EditDoctor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"basic" | "slots">("basic");
  const [isSlotFormOpen, setIsSlotFormOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDoctor();
    }
  }, [id]);

  const fetchDoctor = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const result = await DoctorProfileService.getDoctorById(id);
      
      if (result.success && result.data) {
        setDoctor(result.data);
      } else {
        toast.error("Failed to load doctor details");
        navigate("/doctors");
      }
    } catch (error) {
      console.error("Error fetching doctor:", error);
      toast.error("Failed to load doctor details");
      navigate("/doctors");
    } finally {
      setLoading(false);
    }
  };

  const handleBasicInfoSubmit = async (formData: any) => {
    if (!id) return;

    setIsUpdating(true);
    try {
      // Update doctor profile
      const profileResult = await DoctorProfileService.updateDoctorProfile(id, {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        medical_license_number: formData.medical_license_number,
        primary_specialization: formData.primary_specialization,
        secondary_specializations: formData.secondary_specializations,
        qualifications: formData.qualifications,
        experience_years: formData.experience_years,
        bio: formData.bio,
        languages: formData.languages,
      });

      if (!profileResult.success) {
        toast.error(profileResult.error?.message || "Failed to update doctor profile");
        return;
      }

      toast.success("Doctor information updated successfully!");
      fetchDoctor(); // Refresh data
    } catch (error) {
      console.error("Error updating doctor:", error);
      toast.error("Failed to update doctor");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    navigate(`/admin/doctors/${id}/manage`);
  };

  const handleBack = () => {
    navigate(`/admin/doctors/${id}/manage`);
  };

  const handleSlotsCreated = (slots: any[]) => {
    toast.success(`Successfully created ${slots.length} slot(s)`);
    setIsSlotFormOpen(false);
    // The SlotsManagementTable will refresh automatically
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Doctor not found</h2>
          <p className="text-gray-600 mb-4">The requested doctor could not be found.</p>
          <Button onClick={handleBack}>
            Back to Doctors
          </Button>
        </div>
      </div>
    );
  }

  // Helper function to get initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <button
            onClick={() => navigate("/admin/doctors")}
            className="hover:text-blue-600 transition-colors duration-150"
          >
            Doctors
          </button>
          <span>/</span>
          <button
            onClick={handleBack}
            className="hover:text-blue-600 transition-colors duration-150"
          >
            Dr. {doctor.full_name}
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Edit</span>
        </nav>

        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl font-bold text-white">
                    {getInitials(doctor.full_name)}
                  </span>
                </div>
              </div>

              {/* Doctor Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    Edit Dr. {doctor.full_name}
                  </h1>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    doctor.clinic_doctor?.is_active 
                      ? 'bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {doctor.clinic_doctor?.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <p className="text-lg text-gray-600 mb-4">
                  {doctor.primary_specialization || 'General Practitioner'}
                </p>
                
                {/* Quick Stats */}
                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Briefcase className="h-4 w-4 mr-2 text-blue-500" />
                    {doctor.experience_years || 0} years experience
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-2 text-yellow-500" />
                    ₹{doctor.clinic_doctor?.consultation_fee || doctor.consultation_fee || 'Not set'}
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2 text-green-500" />
                    {doctor.clinic_doctor?.role_in_clinic || 'Consultant'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mt-6 lg:mt-0">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center px-4 py-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Manage
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
            <nav className="flex space-x-2">
              <button
                onClick={() => setActiveTab("basic")}
                className={`
                  flex items-center px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200
                  ${activeTab === "basic"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }
                `}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Basic Information
              </button>
              <button
                onClick={() => setActiveTab("slots")}
                className={`
                  flex items-center px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200
                  ${activeTab === "slots"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }
                `}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Appointment Slots
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            {/* Personal Information Card */}
            <Card className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                    <p className="text-gray-600">Update doctor's basic details and contact information</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-8">
                <DoctorForm
                  initialData={doctor}
                  onSubmit={handleBasicInfoSubmit}
                  onCancel={handleCancel}
                  submitLabel="Save Changes"
                  isLoading={isUpdating}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "slots" && (
          <div className="space-y-6">
            {/* Create Slots Section */}
            <Card className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Plus className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <h2 className="text-xl font-bold text-gray-900">Create New Slots</h2>
                      <p className="text-gray-600">Add appointment slots for Dr. {doctor.full_name}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsSlotFormOpen(!isSlotFormOpen)}
                    variant="outline"
                    className="flex items-center px-4 py-2"
                  >
                    {isSlotFormOpen ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Hide Form
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show Form
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {isSlotFormOpen && (
                <CardContent className="p-8">
                  <SlotCreationForm
                    doctorId={id!}
                    onSlotsCreated={handleSlotsCreated}
                    onCancel={() => setIsSlotFormOpen(false)}
                  />
                </CardContent>
              )}
            </Card>

            {/* Existing Slots Management */}
            <Card className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 px-8 py-6 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold text-gray-900">Manage Existing Slots</h2>
                    <p className="text-gray-600">Edit, activate, or delete appointment slots</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-8">
                <SlotsManagementTable
                  doctorId={id!}
                  onRefresh={fetchDoctor}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
