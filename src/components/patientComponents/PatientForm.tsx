import { useState } from "react";
import { z } from "zod";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Heart,
  AlertTriangle,
  Pill,
  FileText,
  Droplet,
  CreditCard,
  Users,
} from "lucide-react";
import type { CreatePatientProfileData } from "../../services/PatientProfileService";

const patientSchema = z.object({
  full_name: z.string().min(1, "Patient name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  blood_group: z.string().optional(),
  aadhar_number: z.string().optional(),

  // Address fields
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),

  // Medical fields - arrays
  allergies: z.array(z.string()).optional(),
  chronic_conditions: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  previous_surgeries: z.array(z.string()).optional(),

  // Other medical fields
  family_history: z.string().optional(),
  medical_notes: z.string().optional(),
  emergency_contact: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  initialData?: Partial<CreatePatientProfileData>;
  onSubmit: (data: CreatePatientProfileData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PatientForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: PatientFormProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    full_name: initialData?.full_name || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    date_of_birth: initialData?.date_of_birth || "",
    gender: (initialData?.gender as "male" | "female" | "other") || "",
    blood_group: initialData?.blood_group || "",
    aadhar_number: initialData?.aadhar_number || "",
    address_line1: initialData?.primary_address?.address_line1 || "",
    address_line2: initialData?.primary_address?.address_line2 || "",
    city: initialData?.primary_address?.city || "",
    state: initialData?.primary_address?.state || "",
    postal_code: initialData?.primary_address?.postal_code || "",
    allergies: initialData?.allergies || [],
    chronic_conditions: initialData?.chronic_conditions || [],
    medications: initialData?.medications || [],
    previous_surgeries: initialData?.previous_surgeries || [],
    family_history: initialData?.family_history || "",
    medical_notes: initialData?.medical_notes || "",
    emergency_contact: initialData?.emergency_contact || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Validation helper
  const validateField = (name: string, value: unknown) => {
    try {
      const fieldSchema =
        patientSchema.shape[name as keyof typeof patientSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setErrors((prev) => {
          const updated = { ...prev };
          delete updated[name];
          return updated;
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [name]: error.issues[0].message,
        }));
      }
    }
  };

  // Should show error helper
  const shouldShowError = (fieldName: string): boolean => {
    return (
      (touchedFields.has(fieldName) || hasSubmitted) && !!errors[fieldName]
    );
  };

  // Handle field blur
  const handleBlur = (fieldName: string) => {
    setTouchedFields((prev) => new Set(prev).add(fieldName));
    validateField(fieldName, formData[fieldName as keyof PatientFormData]);
  };

  // Handle input changes
  const handleChange = (field: keyof PatientFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle array field changes (Enter key to add)
  const handleArrayInput = (
    field: keyof Pick<
      PatientFormData,
      "allergies" | "chronic_conditions" | "medications" | "previous_surgeries"
    >,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.currentTarget;
      const value = input.value.trim();
      if (value && !formData[field]?.includes(value)) {
        setFormData((prev) => ({
          ...prev,
          [field]: [...(prev[field] || []), value],
        }));
        input.value = "";
      }
    }
  };

  // Remove item from array
  const removeArrayItem = (
    field: keyof Pick<
      PatientFormData,
      "allergies" | "chronic_conditions" | "medications" | "previous_surgeries"
    >,
    index: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index) || [],
    }));
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);

    // Validate all fields
    const validation = patientSchema.safeParse(formData);

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Prepare data for submission
    const submitData: CreatePatientProfileData = {
      full_name: formData.full_name,
      phone: formData.phone,
      email: formData.email || undefined,
      date_of_birth: formData.date_of_birth || undefined,
      gender: formData.gender || undefined,
      blood_group: formData.blood_group || undefined,
      aadhar_number: formData.aadhar_number || undefined,
      allergies: formData.allergies,
      chronic_conditions: formData.chronic_conditions,
      medications: formData.medications,
      previous_surgeries: formData.previous_surgeries,
      family_history: formData.family_history || undefined,
      medical_notes: formData.medical_notes || undefined,
      emergency_contact: formData.emergency_contact || undefined,
    };

    // Add address if any field is filled
    if (
      formData.address_line1 ||
      formData.city ||
      formData.state ||
      formData.postal_code
    ) {
      submitData.primary_address = {
        address_line1: formData.address_line1 || "",
        address_line2: formData.address_line2,
        city: formData.city || "",
        state: formData.state || "",
        postal_code: formData.postal_code || "",
      };
    }

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="h-5 w-5 mr-2 text-blue-600" />
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                onBlur={() => handleBlur("full_name")}
                placeholder="John Doe"
                className={`pl-10 ${
                  shouldShowError("full_name") ? "border-red-500" : ""
                }`}
              />
            </div>
            {shouldShowError("full_name") && (
              <p className="text-sm text-red-600 mt-1">{errors.full_name}</p>
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
                onChange={(e) => handleChange("phone", e.target.value)}
                onBlur={() => handleBlur("phone")}
                placeholder="+91 98765 43210"
                className={`pl-10 ${
                  shouldShowError("phone") ? "border-red-500" : ""
                }`}
              />
            </div>
            {shouldShowError("phone") && (
              <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
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
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="patient@example.com"
                className={`pl-10 ${
                  shouldShowError("email") ? "border-red-500" : ""
                }`}
              />
            </div>
            {shouldShowError("email") && (
              <p className="text-sm text-red-600 mt-1">{errors.email}</p>
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
                onChange={(e) => handleChange("date_of_birth", e.target.value)}
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
              onChange={(e) => handleChange("gender", e.target.value)}
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
            <div className="relative">
              <Droplet className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={formData.blood_group}
                onChange={(e) => handleChange("blood_group", e.target.value)}
                className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>

      {/* Identification */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
          Identification
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aadhar Number
            </label>
            <Input
              value={formData.aadhar_number}
              onChange={(e) => handleChange("aadhar_number", e.target.value)}
              placeholder="1234 5678 9012"
              maxLength={12}
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Address
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1
            </label>
            <Input
              value={formData.address_line1}
              onChange={(e) => handleChange("address_line1", e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <Input
              value={formData.address_line2}
              onChange={(e) => handleChange("address_line2", e.target.value)}
              placeholder="Apartment, suite, etc. (optional)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <Input
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <Input
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
                placeholder="State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code
              </label>
              <Input
                value={formData.postal_code}
                onChange={(e) => handleChange("postal_code", e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-600" />
          Emergency Contact
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Emergency Contact Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={formData.emergency_contact}
              onChange={(e) =>
                handleChange("emergency_contact", e.target.value)
              }
              placeholder="+91 98765 43210"
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Medical History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Heart className="h-5 w-5 mr-2 text-blue-600" />
          Medical History
        </h3>
        <div className="space-y-4">
          {/* Allergies */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allergies
            </label>
            <div className="relative">
              <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Type and press Enter to add"
                className="pl-10"
                onKeyDown={(e) => handleArrayInput("allergies", e)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.allergies?.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeArrayItem("allergies", idx)}
                    className="ml-2 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Chronic Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chronic Conditions
            </label>
            <div className="relative">
              <Heart className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Type and press Enter to add"
                className="pl-10"
                onKeyDown={(e) => handleArrayInput("chronic_conditions", e)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.chronic_conditions?.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeArrayItem("chronic_conditions", idx)}
                    className="ml-2 text-orange-600 hover:text-orange-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Current Medications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Medications
            </label>
            <div className="relative">
              <Pill className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Type and press Enter to add"
                className="pl-10"
                onKeyDown={(e) => handleArrayInput("medications", e)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.medications?.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeArrayItem("medications", idx)}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Previous Surgeries */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Previous Surgeries
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Type and press Enter to add"
                className="pl-10"
                onKeyDown={(e) => handleArrayInput("previous_surgeries", e)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.previous_surgeries?.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeArrayItem("previous_surgeries", idx)}
                    className="ml-2 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Family History */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family Medical History
            </label>
            <textarea
              value={formData.family_history}
              onChange={(e) => handleChange("family_history", e.target.value)}
              placeholder="Describe any relevant family medical history..."
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Medical Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Medical Notes
            </label>
            <textarea
              value={formData.medical_notes}
              onChange={(e) => handleChange("medical_notes", e.target.value)}
              placeholder="Any other relevant medical information..."
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Saving...
            </>
          ) : (
            "Save Patient"
          )}
        </Button>
      </div>
    </form>
  );
}
