import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PatientForm } from "../components/patientComponents/PatientForm";
import { PatientProfileService } from "../services/PatientProfileService";
import type { CreatePatientProfileData } from "../services/PatientProfileService";
import { toast } from "sonner";

export function AddPatient() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: CreatePatientProfileData) => {
    console.log("=== PATIENT CREATION START ===");
    console.log("1. Form data received:", JSON.stringify(formData, null, 2));

    setIsSubmitting(true);

    try {
      // Validation
      console.log("2. Validating required fields...");
      if (!formData.full_name?.trim()) {
        toast.error("Patient name is required");
        return;
      }
      if (!formData.phone?.trim()) {
        toast.error("Phone number is required");
        return;
      }

      console.log("3. Validation passed, creating patient...");

      // Create patient
      const result = await PatientProfileService.createPatient(formData);

      console.log("4. Service response:", JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        console.log("5. ✅ Patient created successfully:", result.data.id);
        toast.success("Patient added successfully!");
        navigate("/admin/patients");
      } else {
        console.log("5. ❌ Failed to create patient:", result.error);
        const errorMessage =
          result.error?.message || "Failed to create patient";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("6. ❌ Error in handleSubmit:", error);
      toast.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
      console.log("=== PATIENT CREATION END ===");
    }
  };

  const handleBack = () => {
    navigate("/admin/patients");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <Card className="mb-6 border-0 shadow-sm overflow-hidden">
          <div className="bg-white px-6 py-8 relative border-b border-gray-200">
            <Button
              variant="outline"
              onClick={handleBack}
              className="absolute top-4 right-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
                <UserPlus className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Add New Patient
                </h1>
                <p className="text-gray-600 mt-1">
                  Register a new patient to your clinic
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Form Card */}
        <Card className="border-0 shadow-sm">
          <div className="p-6">
            <PatientForm
              onSubmit={handleSubmit}
              onCancel={handleBack}
              isSubmitting={isSubmitting}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
