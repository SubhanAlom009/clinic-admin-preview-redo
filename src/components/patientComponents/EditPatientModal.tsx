/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { AlertTriangle, Heart, Pill, FileText } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "../ui/FormModal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { AddressForm } from "../shared/AddressForm";
import {
  PatientProfileService,
  type UpdatePatientProfileData,
  type PatientProfileWithClinic,
} from "../../services/PatientProfileService";
import { useAuth } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import { patientFormSchema, type PatientFormData } from "../../validation/FormSchemas";
import type { AddressFormData } from "../../validation/AddressValidation";

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientProfileWithClinic | null;
  onSuccess?: () => void;
}

export function EditPatientModal({
  isOpen,
  onClose,
  patient,
  onSuccess,
}: EditPatientModalProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    full_name: "",
    date_of_birth: "",
    gender: undefined,
    phone: "",
    email: "",
    aadhar_number: "",
    blood_group: undefined,
    emergency_contact: "",
    allergies: "",
    chronic_conditions: "",
    medications: "",
    previous_surgeries: "",
    family_history: "",
    medical_notes: "",
    primary_address: {},
  });
  
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  // Use our new validation system
  const { errors, validate, validateField, clearErrors } = useFormValidation(patientFormSchema);

  useEffect(() => {
    if (patient) {
      // Helper function to extract emergency contact as string
      const getEmergencyContact = () => {
        const emergencyContact = patient.emergency_contact;
        
        // Handle different types of emergency_contact data
        if (!emergencyContact) return "";
        
        // If it's a string, return it directly
        if (typeof emergencyContact === 'string') {
          return emergencyContact;
        }
        
        // If it's an object, try to extract phone number
        if (typeof emergencyContact === 'object') {
          const contactObj = emergencyContact as any;
          if (contactObj.phone) return contactObj.phone;
          if (contactObj.number) return contactObj.number;
          if (contactObj.contact) return contactObj.contact;
          return "";
        }
        
        return "";
      };

      // Convert arrays back to strings for editing
      const allergiesText = patient.allergies?.join("\n") || "";
      const conditionsText = patient.chronic_conditions?.join("\n") || "";
      const medicationsText = patient.medications?.join("\n") || "";
      const surgeriesText = patient.previous_surgeries?.join("\n") || "";

      setFormData({
        full_name: patient.full_name || "",
        date_of_birth: patient.date_of_birth || "",
        gender: (patient.gender as "male" | "female" | "other") || undefined,
        phone: patient.phone || "",
        email: patient.email || "",
        aadhar_number: patient.aadhar_number || "",
        blood_group: (patient.blood_group as "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-") || undefined,
        emergency_contact: getEmergencyContact(),
        allergies: allergiesText,
        chronic_conditions: conditionsText,
        medications: medicationsText,
        previous_surgeries: surgeriesText,
        family_history: patient.family_history || "",
        medical_notes: patient.medical_notes || "",
        primary_address: patient.primary_address || {},
      });
    } else {
      // Reset form when no patient (prevents controlled/uncontrolled warnings)
      setFormData({
        full_name: "",
        date_of_birth: "",
        gender: undefined,
        phone: "",
        email: "",
        aadhar_number: "",
        blood_group: undefined,
        emergency_contact: "",
        allergies: "",
        chronic_conditions: "",
        medications: "",
        previous_surgeries: "",
        family_history: "",
        medical_notes: "",
        primary_address: {},
      });
    }
  }, [patient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !patient) return;

    setLoading(true);
    clearErrors();

    try {
      // Validate form data using our new validation system
      const validationResult = validate(formData);
      
      if (!validationResult.isValid) {
        toast.error("Please fix the validation errors");
        setLoading(false);
        return;
      }

      const updateData: UpdatePatientProfileData = {
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        primary_address: formData.primary_address,
        emergency_contact: formData.emergency_contact || undefined,
        medical_notes: formData.medical_notes || undefined,
        allergies: formData.allergies ? formData.allergies.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
        chronic_conditions: formData.chronic_conditions ? formData.chronic_conditions.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
        medications: formData.medications ? formData.medications.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
        previous_surgeries: formData.previous_surgeries ? formData.previous_surgeries.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
        family_history: formData.family_history || undefined,
        blood_group: formData.blood_group || undefined,
        aadhar_number: formData.aadhar_number || undefined,
      };

      const result = await PatientProfileService.updatePatientProfile(patient.id, updateData);

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update patient");
      }

      toast.success("Patient updated successfully!");
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || "An error occurred while updating the patient";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
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
    validateField(fieldName, formData[fieldName as keyof PatientFormData]);
  };

  const handleAddressChange = (address: AddressFormData) => {
    setFormData({
      ...formData,
      primary_address: address,
    });
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Patient"
      description="Update patient information"
      onSubmit={handleSubmit}
      submitText={loading ? "Updating..." : "Update Patient"}
      isLoading={loading}
      maxWidth="3xl"
    >
      {/* Basic Information Section (two-column) */}
      <div className="space-y-4">
        <div className="flex items-center pb-2 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Basic Information
          </h3>
          <span className="ml-2 text-xs text-red-500">* Required</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleInputChange}
            required
            placeholder="Enter patient's full name"
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Date of Birth"
            name="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={handleInputChange}
            placeholder="Select date of birth"
            className="rounded-lg shadow-sm"
          />

          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            options={[
              { value: "", label: "Select gender" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            required
            placeholder="Enter phone number"
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            placeholder="Enter email address"
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Aadhar Number"
            name="aadhar_number"
            value={formData.aadhar_number}
            onChange={handleInputChange}
            placeholder="Enter Aadhar number (optional)"
            className="rounded-lg shadow-sm"
          />

          <Select
            label="Blood Group"
            name="blood_group"
            value={formData.blood_group}
            onChange={handleInputChange}
            options={[
              { value: "", label: "Select blood group" },
              { value: "A+", label: "A+" },
              { value: "A-", label: "A-" },
              { value: "B+", label: "B+" },
              { value: "B-", label: "B-" },
              { value: "AB+", label: "AB+" },
              { value: "AB-", label: "AB-" },
              { value: "O+", label: "O+" },
              { value: "O-", label: "O-" },
            ]}
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Emergency Contact"
            name="emergency_contact"
            value={formData.emergency_contact}
            onChange={handleInputChange}
            placeholder="Enter emergency contact number"
            className="rounded-lg shadow-sm"
          />
        </div>

        {/* Address Section */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
          <AddressForm
            value={formData.primary_address}
            onChange={handleAddressChange}
            errors={errors.primary_address ? { primary_address: errors.primary_address } : {}}
            disabled={loading}
          />
        </div>
      </div>

      {/* Medical History (accordion sections) */}
      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center pb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Medical History
          </h3>
          <span className="ml-2 text-sm text-gray-500">
            Optional — expand sections to edit
          </span>
        </div>

        <div className="space-y-2">
          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-gray-800">Allergies</span>
              </div>
              <span className="text-sm text-gray-500 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="allergies"
                value={formData.allergies}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List allergies, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-orange-500" />
                <span className="font-medium text-gray-800">
                  Chronic Conditions
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="chronic_conditions"
                value={formData.chronic_conditions}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List chronic conditions, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <Pill className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-gray-800">Medications</span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="medications"
                value={formData.medications}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List medications and dosages, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-500" />
                <span className="font-medium text-gray-800">
                  Previous Surgeries
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="previous_surgeries"
                value={formData.previous_surgeries}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="List surgeries and dates, one per line"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-800">
                  Family History
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="family_history"
                value={formData.family_history}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="Family medical history, one per line or short paragraph"
              />
            </div>
          </details>

          <details className="group bg-white border border-gray-100 rounded-lg shadow-sm">
            <summary className="flex items-center justify-between p-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-800">
                  Additional Notes
                </span>
              </div>
              <span className="text-sm text-gray-500">▾</span>
            </summary>
            <div className="p-3 pt-0">
              <textarea
                name="medical_notes"
                value={formData.medical_notes}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm text-gray-700"
                placeholder="Any other relevant medical details"
              />
            </div>
          </details>
        </div>
      </div>
    </FormModal>
  );
}
