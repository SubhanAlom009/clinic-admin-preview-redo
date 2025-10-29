import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoctorForm } from "../components/doctorComponents/DoctorForm";
import {
  DoctorProfileService,
  CreateDoctorProfileData,
} from "../services/DoctorProfileService";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";

export function AddDoctor() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: any) => {
    console.log("=== DOCTOR CREATION START ===");
    console.log(
      "1. Form submitted with data:",
      JSON.stringify(formData, null, 2)
    );
    setIsLoading(true);

    try {
      // Validate required fields
      console.log("2. Validating required fields...");
      if (
        !formData.full_name ||
        !formData.phone ||
        !formData.medical_license_number ||
        !formData.primary_specialization
      ) {
        console.error("❌ Missing required fields:", {
          full_name: formData.full_name,
          phone: formData.phone,
          medical_license_number: formData.medical_license_number,
          primary_specialization: formData.primary_specialization,
        });
        toast.error("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      // Validate qualifications
      console.log("3. Validating qualifications...", formData.qualifications);
      if (!formData.qualifications || formData.qualifications.length === 0) {
        console.error("❌ No qualifications provided");
        toast.error("At least one qualification is required");
        setIsLoading(false);
        return;
      }

      // Map form data to service interface
      const profileData: CreateDoctorProfileData = {
        full_name: formData.full_name,
        email: formData.email || undefined,
        phone: formData.phone,
        medical_license_number: formData.medical_license_number,
        primary_specialization: formData.primary_specialization,
        secondary_specializations: formData.secondary_specializations || [],
        qualifications: formData.qualifications || [],
        experience_years: formData.experience_years || 0,
        bio: formData.bio || undefined,
        languages: formData.languages || [],
        consultation_fee: formData.consultation_fee || undefined,
        // Slot settings (defaults)
        default_slot_duration: 180, // 3 hours
        max_patients_per_slot: 10,
        slot_creation_enabled: true,
      };

      console.log(
        "4. Profile data prepared:",
        JSON.stringify(profileData, null, 2)
      );
      console.log("5. Calling DoctorProfileService.createDoctor...");

      // Create doctor with clinic relationship
      const result = await DoctorProfileService.createDoctor(
        profileData,
        "primary", // Default role
        formData.consultation_fee || undefined,
        undefined // No availability schedule
      );

      console.log("6. Service result:", JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        console.log("✅ SUCCESS! Doctor created with ID:", result.data.id);
        console.log("Doctor data:", JSON.stringify(result.data, null, 2));
        toast.success("Doctor created successfully!");
        // Navigate to manage page
        navigate(`/admin/doctors/${result.data.id}/manage`);
      } else {
        console.error("❌ FAILED! Service returned error:", result.error);
        console.error("Error details:", JSON.stringify(result.error, null, 2));
        toast.error(result.error?.message || "Failed to create doctor");
      }
    } catch (error) {
      console.error("❌ EXCEPTION caught:", error);
      console.error("Error type:", typeof error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error(`Failed to create doctor: ${errorMessage}`);
    } finally {
      console.log("=== DOCTOR CREATION END ===");
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin/doctors");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Add New Doctor
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Create a new doctor profile and link them to your clinic
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex items-center gap-2 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <DoctorForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel="Create Doctor"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
