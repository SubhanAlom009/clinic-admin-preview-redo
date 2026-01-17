import React, { useState } from "react";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Award,
  Briefcase,
  DollarSign,
  Globe,
  FileText,
  Stethoscope,
  Clock,
  Users,
  CheckCircle,
} from "lucide-react";
import { FormModal } from "../ui/FormModal";
import { Input } from "../ui/Input";
import { DoctorProfileService } from "../../services/DoctorProfileService";
import { useAuth } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import {
  doctorFormSchema,
  type DoctorFormData,
} from "../../validation/FormSchemas";
import type { CreateDoctorProfileData } from "../../services/DoctorProfileService";

interface AddDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDoctorModal({ isOpen, onClose }: AddDoctorModalProps) {
  const [formData, setFormData] = useState<DoctorFormData>({
    full_name: "",
    primary_specialization: "",
    qualifications: "",
    medical_license_number: "",
    phone: "",
    email: "",
    consultation_fee: "",
    experience_years: "",
    secondary_specializations: "",
    languages: "",
    bio: "",
    date_of_birth: "",
    gender: undefined,
    // Slot settings
    default_slot_duration: "180",
    max_patients_per_slot: "10",
    slot_creation_enabled: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  // Use our new validation system
  const { errors, validate, validateField, clearErrors } =
    useFormValidation(doctorFormSchema);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    clearErrors();

    try {
      // Validate form data using our new validation system
      const validationResult = validate(formData);

      if (!validationResult.isValid) {
        setError("Please fix the validation errors below");
        toast.error("Please fix the validation errors");
        setLoading(false);
        return;
      }

      const doctorData: CreateDoctorProfileData = {
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || undefined,
        primary_specialization: formData.primary_specialization,
        qualifications: formData.qualifications
          ? formData.qualifications.split(",").map((q) => q.trim())
          : ["General Practice"],
        medical_license_number: formData.medical_license_number,
        experience_years: formData.experience_years
          ? parseInt(formData.experience_years)
          : undefined,
        consultation_fee: formData.consultation_fee
          ? parseFloat(formData.consultation_fee)
          : undefined,
        secondary_specializations: formData.secondary_specializations
          ? formData.secondary_specializations.split(",").map((s) => s.trim())
          : undefined,
        languages: formData.languages
          ? formData.languages.split(",").map((l) => l.trim())
          : undefined,
        bio: formData.bio || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        // Slot settings
        default_slot_duration: formData.default_slot_duration
          ? parseInt(formData.default_slot_duration)
          : undefined,
        max_patients_per_slot: formData.max_patients_per_slot
          ? parseInt(formData.max_patients_per_slot)
          : undefined,
        slot_creation_enabled: formData.slot_creation_enabled,
      };

      const result = await DoctorProfileService.createDoctor(
        doctorData,
        "consultant"
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to add doctor");
      }

      toast.success("Doctor added successfully!");
      onClose();

      // Reset form
      setFormData({
        full_name: "",
        primary_specialization: "",
        qualifications: "",
        medical_license_number: "",
        phone: "",
        email: "",
        consultation_fee: "",
        experience_years: "",
        secondary_specializations: "",
        languages: "",
        bio: "",
        date_of_birth: "",
        gender: undefined,
        default_slot_duration: "180",
        max_patients_per_slot: "10",
        slot_creation_enabled: true,
      });
      clearErrors();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear field error when user starts typing
    if (errors[name]) {
      validateField(name, value);
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    validateField(fieldName, formData[fieldName as keyof DoctorFormData]);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Doctor"
      onSubmit={handleSubmit}
      isLoading={loading}
      error={error}
      submitText={loading ? "Adding..." : "Add Doctor"}
      maxWidth="4xl"
    >
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Complete all required fields marked with *
          </span>
          <span className="text-blue-600 font-medium">
            {Object.keys(errors).length === 0 ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Ready to submit
              </span>
            ) : (
              `${Object.keys(errors).length} field${Object.keys(errors).length > 1 ? "s" : ""
              } need attention`
            )}
          </span>
        </div>
      </div>

      {/* Basic Information Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
          <User className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Basic Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Full Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("full_name")}
              error={errors.full_name}
              required
              placeholder="Dr. John Smith"
              icon={<User className="h-4 w-4 text-gray-400" />}
            />
          </div>

          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("phone")}
            error={errors.phone}
            required
            placeholder="+91 98765 43210"
            icon={<Phone className="h-4 w-4 text-gray-400" />}
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("email")}
            error={errors.email}
            placeholder="doctor@example.com"
            icon={<Mail className="h-4 w-4 text-gray-400" />}
          />

          <Input
            label="Date of Birth"
            name="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("date_of_birth")}
            error={errors.date_of_birth}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gender
            </label>
            <select
              name="gender"
              value={formData.gender || ""}
              onChange={(e) => {
                const value = e.target.value as "male" | "female" | "other" | "";
                setFormData({
                  ...formData,
                  gender: value || undefined,
                });
              }}
              className="block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Professional Credentials Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
          <Award className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Professional Credentials
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Medical License Number"
            name="medical_license_number"
            value={formData.medical_license_number}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("medical_license_number")}
            error={errors.medical_license_number}
            required
            placeholder="MCI-12345678"
            icon={<Award className="h-4 w-4 text-gray-400" />}
          />

          <Input
            label="Primary Specialization"
            name="primary_specialization"
            value={formData.primary_specialization}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("primary_specialization")}
            error={errors.primary_specialization}
            required
            placeholder="Cardiologist, Pediatrician, etc."
            icon={<Stethoscope className="h-4 w-4 text-gray-400" />}
          />

          <Input
            label="Years of Experience"
            name="experience_years"
            type="number"
            value={formData.experience_years}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("experience_years")}
            error={errors.experience_years}
            required
            placeholder="10"
            min="0"
            max="60"
            icon={<Briefcase className="h-4 w-4 text-gray-400" />}
          />

          <Input
            label="Consultation Fee (₹)"
            name="consultation_fee"
            type="number"
            step="0.01"
            value={formData.consultation_fee}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("consultation_fee")}
            error={errors.consultation_fee}
            required
            placeholder="500.00"
            min="0"
            icon={<DollarSign className="h-4 w-4 text-gray-400" />}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Qualifications & Certifications *
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <textarea
              name="qualifications"
              value={formData.qualifications}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("qualifications")}
              rows={3}
              className={`block w-full pl-10 pr-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.qualifications
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300"
                }`}
              placeholder="MBBS, MD, MRCP - List all qualifications separated by commas"
            />
          </div>
          {errors.qualifications && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <span>⚠</span> {errors.qualifications}
            </p>
          )}
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
          <Globe className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Additional Details
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Secondary Specializations"
            name="secondary_specializations"
            value={formData.secondary_specializations}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("secondary_specializations")}
            error={errors.secondary_specializations}
            placeholder="Pediatrics, Geriatrics (comma separated)"
            icon={<Stethoscope className="h-4 w-4 text-gray-400" />}
          />

          <Input
            label="Languages Spoken"
            name="languages"
            value={formData.languages}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("languages")}
            error={errors.languages}
            placeholder="English, Hindi, Bengali (comma separated)"
            icon={<Globe className="h-4 w-4 text-gray-400" />}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Professional Bio
          </label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("bio")}
            rows={4}
            className={`block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${errors.bio
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300"
              }`}
            placeholder="A brief professional summary highlighting expertise, approach to patient care, and notable achievements..."
          />
          <p className="mt-1 text-xs text-gray-500">
            This will be displayed on the doctor's profile
          </p>
          {errors.bio && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <span>⚠</span> {errors.bio}
            </p>
          )}
        </div>
      </div>

      {/* Appointment Slot Configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Appointment Slot Settings
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Input
              label="Default Slot Duration"
              name="default_slot_duration"
              type="number"
              value={formData.default_slot_duration}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("default_slot_duration")}
              error={errors.default_slot_duration}
              placeholder="180"
              min="60"
              max="480"
              icon={<Clock className="h-4 w-4 text-gray-400" />}
            />
            <p className="mt-1 text-xs text-gray-600">
              Duration in minutes (60-480)
            </p>
          </div>

          <div>
            <Input
              label="Max Patients per Slot"
              name="max_patients_per_slot"
              type="number"
              value={formData.max_patients_per_slot}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("max_patients_per_slot")}
              error={errors.max_patients_per_slot}
              placeholder="10"
              min="1"
              max="50"
              icon={<Users className="h-4 w-4 text-gray-400" />}
            />
            <p className="mt-1 text-xs text-gray-600">
              Number of patients (1-50)
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-100">
          <input
            type="checkbox"
            name="slot_creation_enabled"
            id="slot_creation_enabled"
            checked={formData.slot_creation_enabled}
            onChange={(e) =>
              setFormData({
                ...formData,
                slot_creation_enabled: e.target.checked,
              })
            }
            className="mt-1 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
          <label
            htmlFor="slot_creation_enabled"
            className="flex-1 cursor-pointer"
          >
            <span className="block text-sm font-medium text-gray-900">
              Enable slot creation for this doctor
            </span>
            <span className="block text-xs text-gray-600 mt-1">
              Allows creating appointment slots in the schedule. Can be changed
              later.
            </span>
          </label>
        </div>
      </div>

      {/* Info note at bottom */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">Note:</strong> After adding the
          doctor, you can manage their schedule, availability, and additional
          settings from the doctor management page.
        </p>
      </div>
    </FormModal>
  );
}
