import { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { DoctorProfileWithClinic } from "../../services/DoctorProfileService";
import { z } from "zod";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Award,
  Briefcase,
  Globe,
  FileText,
  Stethoscope,
  CheckCircle,
  DollarSign,
  Calendar,
  X,
} from "lucide-react"; // Validation schema
const doctorFormSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  medical_license_number: z
    .string()
    .min(1, "Medical license number is required"),
  primary_specialization: z
    .string()
    .min(1, "Primary specialization is required"),
  secondary_specializations: z.array(z.string()).optional(),
  qualifications: z
    .array(z.string())
    .min(1, "At least one qualification is required"),
  experience_years: z.number().min(0).max(50).optional(),
  consultation_fee: z
    .number()
    .min(0, "Consultation fee must be positive")
    .optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  bio: z.string().optional(),
  languages: z.array(z.string()).optional(),
});

type DoctorFormData = z.infer<typeof doctorFormSchema>;

interface DoctorFormProps {
  initialData?: DoctorProfileWithClinic;
  onSubmit: (data: DoctorFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export function DoctorForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isLoading = false,
}: DoctorFormProps) {
  const [formData, setFormData] = useState<DoctorFormData>({
    full_name: "",
    email: "",
    phone: "",
    medical_license_number: "",
    primary_specialization: "",
    secondary_specializations: [],
    qualifications: [],
    experience_years: 0,
    consultation_fee: 0,
    date_of_birth: "",
    gender: "",
    bio: "",
    languages: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setFormData({
        full_name: initialData.full_name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        medical_license_number: initialData.medical_license_number || "",
        primary_specialization: initialData.primary_specialization || "",
        secondary_specializations: initialData.secondary_specializations || [],
        qualifications: initialData.qualifications || [],
        experience_years: initialData.experience_years || 0,
        bio: initialData.bio || "",
        languages: initialData.languages || [],
      });
    }
  }, [initialData]);

  // Validate form on change
  useEffect(() => {
    try {
      doctorFormSchema.parse(formData);
      setErrors({});
      setIsValid(true);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path.length > 0) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        setIsValid(false);
      }
    }
  }, [formData]);

  const handleInputChange = (
    field: keyof DoctorFormData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields((prev) => new Set(prev).add(field));
  };

  const handleArrayChange = (field: keyof DoctorFormData, value: string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addArrayItem = (field: keyof DoctorFormData, value: string) => {
    if (!value.trim()) return;
    const currentArray = (formData[field] as string[]) || [];
    if (!currentArray.includes(value.trim())) {
      handleArrayChange(field, [...currentArray, value.trim()]);
    }
  };

  const removeArrayItem = (field: keyof DoctorFormData, index: number) => {
    const currentArray = (formData[field] as string[]) || [];
    handleArrayChange(
      field,
      currentArray.filter((_, i) => i !== index)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);

    // Validate form
    if (!isValid) {
      const errorFields = Object.keys(errors).join(", ");
      toast.error(`Please fix errors in: ${errorFields}`);
      console.error("Form validation errors:", errors);
      return;
    }

    // Additional validation for required arrays
    if (!formData.qualifications || formData.qualifications.length === 0) {
      toast.error("At least one qualification is required");
      setErrors((prev) => ({
        ...prev,
        qualifications: "At least one qualification is required",
      }));
      return;
    }

    try {
      console.log("Submitting form data:", formData);
      await onSubmit(formData);
    } catch (error) {
      console.error("Form submission error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit form";
      toast.error(errorMessage);
      throw error; // Re-throw to let parent handle it
    }
  };

  // Helper to determine if error should be shown
  const shouldShowError = (field: string) => {
    return (hasSubmitted || touchedFields.has(field)) && errors[field];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      {/* Progress indicator */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Complete all required fields marked with *
          </span>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.full_name}
                  onChange={(e) =>
                    handleInputChange("full_name", e.target.value)
                  }
                  onBlur={() => handleFieldBlur("full_name")}
                  placeholder="Dr. John Smith"
                  className={`pl-10 ${
                    shouldShowError("full_name") ? "border-red-500" : ""
                  }`}
                />
              </div>
              {shouldShowError("full_name") && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <span>⚠</span> {errors.full_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  onBlur={() => handleFieldBlur("phone")}
                  placeholder="+91 98765 43210"
                  className={`pl-10 ${
                    shouldShowError("phone") ? "border-red-500" : ""
                  }`}
                />
              </div>
              {shouldShowError("phone") && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <span>⚠</span> {errors.phone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  onBlur={() => handleFieldBlur("email")}
                  placeholder="doctor@example.com"
                  className={`pl-10 ${
                    shouldShowError("email") ? "border-red-500" : ""
                  }`}
                />
              </div>
              {shouldShowError("email") && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <span>⚠</span> {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    handleInputChange("date_of_birth", e.target.value)
                  }
                  onBlur={() => handleFieldBlur("date_of_birth")}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange("gender", e.target.value)}
                onBlur={() => handleFieldBlur("gender")}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-600" />
            Professional Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical License Number *
              </label>
              <div className="relative">
                <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.medical_license_number}
                  onChange={(e) =>
                    handleInputChange("medical_license_number", e.target.value)
                  }
                  onBlur={() => handleFieldBlur("medical_license_number")}
                  placeholder="MCI-12345678"
                  className={`pl-10 ${
                    shouldShowError("medical_license_number")
                      ? "border-red-500"
                      : ""
                  }`}
                />
              </div>
              {shouldShowError("medical_license_number") && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <span>⚠</span> {errors.medical_license_number}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Specialization *
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={formData.primary_specialization}
                  onChange={(e) =>
                    handleInputChange("primary_specialization", e.target.value)
                  }
                  onBlur={() => handleFieldBlur("primary_specialization")}
                  placeholder="Cardiologist, Pediatrician, etc."
                  className={`pl-10 ${
                    shouldShowError("primary_specialization")
                      ? "border-red-500"
                      : ""
                  }`}
                />
              </div>
              {shouldShowError("primary_specialization") && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <span>⚠</span> {errors.primary_specialization}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Years of Experience
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  value={formData.experience_years}
                  onChange={(e) =>
                    handleInputChange(
                      "experience_years",
                      parseInt(e.target.value) || 0
                    )
                  }
                  placeholder="10"
                  min="0"
                  max="50"
                  className="pl-10"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Years in practice (0-50)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consultation Fee (₹)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  value={formData.consultation_fee}
                  onChange={(e) =>
                    handleInputChange(
                      "consultation_fee",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  onBlur={() => handleFieldBlur("consultation_fee")}
                  placeholder="500.00"
                  min="0"
                  step="0.01"
                  className={`pl-10 ${
                    shouldShowError("consultation_fee") ? "border-red-500" : ""
                  }`}
                />
              </div>
              {shouldShowError("consultation_fee") && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <span>⚠</span> {errors.consultation_fee}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Fee charged per consultation
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Qualifications & Certifications *
            </label>
            <div className="space-y-2">
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="MBBS, MD, MRCP - Press Enter to add"
                  className={`pl-10 ${
                    shouldShowError("qualifications") ? "border-red-500" : ""
                  }`}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem("qualifications", e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
              {formData.qualifications &&
                formData.qualifications.length === 0 &&
                hasSubmitted && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <span>⚠</span> At least one qualification is required
                  </p>
                )}
              <div className="space-y-2">
                {formData.qualifications?.map((qual, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">{qual}</span>
                    <button
                      type="button"
                      onClick={() => removeArrayItem("qualifications", index)}
                      className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {formData.qualifications &&
                formData.qualifications.length > 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {formData.qualifications.length} qualification
                    {formData.qualifications.length > 1 ? "s" : ""} added
                  </p>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Additional Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Specializations
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Pediatrics, Geriatrics - Press Enter to add"
                  className="pl-10"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem(
                        "secondary_specializations",
                        e.currentTarget.value
                      );
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.secondary_specializations?.map((spec, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-purple-100 text-purple-800 border border-purple-200"
                  >
                    {spec}
                    <button
                      type="button"
                      onClick={() =>
                        removeArrayItem("secondary_specializations", index)
                      }
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Languages Spoken
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="English, Hindi, Bengali - Press Enter to add"
                  className="pl-10"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArrayItem("languages", e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.languages?.map((lang, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-green-100 text-green-800 border border-green-200"
                  >
                    {lang}
                    <button
                      type="button"
                      onClick={() => removeArrayItem("languages", index)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Professional Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              placeholder="A brief professional summary highlighting expertise, approach to patient care, and notable achievements..."
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              rows={4}
            />
            <p className="mt-1 text-xs text-gray-500">
              This will be displayed on the doctor's profile
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isLoading}
          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="animate-spin">⏳</span>
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
