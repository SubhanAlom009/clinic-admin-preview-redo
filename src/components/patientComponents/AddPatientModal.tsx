/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { AlertTriangle, Heart, Pill, FileText } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "../ui/FormModal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { AddressForm } from "../shared/AddressForm";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import { patientFormSchema, type PatientFormData } from "../../validation/FormSchemas";
import { PatientProfileService } from "../../services/PatientProfileService";
import type { AddressFormData } from "../../validation/AddressValidation";

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPatientModal({ isOpen, onClose, onSuccess }: AddPatientModalProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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

      console.log("Form data before conversion:", formData);

      // Check auth state first
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      console.log("Current auth user:", authUser?.id, "Auth error:", authError);

      if (!authUser) {
        toast.error("You must be logged in to create a patient");
        setLoading(false);
        return;
      }

      // Convert form data to service format
      const patientData = {
        full_name: formData.full_name.trim(),
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        phone: formData.phone.trim(),
        email: formData.email || undefined,
        aadhar_number: formData.aadhar_number?.trim() || undefined,
        blood_group: formData.blood_group?.trim() || undefined,
        primary_address: formData.primary_address,
        emergency_contact: formData.emergency_contact?.trim() || undefined,
        allergies: formData.allergies
          ? formData.allergies.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        chronic_conditions: formData.chronic_conditions
          ? formData.chronic_conditions.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        medications: formData.medications
          ? formData.medications.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        previous_surgeries: formData.previous_surgeries
          ? formData.previous_surgeries.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        family_history: formData.family_history?.trim() || undefined,
        medical_notes: formData.medical_notes?.trim() || undefined,
      };

      console.log("Patient data being sent to service:", patientData);

      // Create patient using the service
      const result = await PatientProfileService.createPatient(
        patientData,
        "clinic_admin"
      );

      if (!result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to create patient"
        );
      }

      // Create success notification
      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        type: "system",
        title: "Patient Added",
        message: `New patient ${formData.full_name} has been added successfully.`,
        priority: "normal",
      } as any);

      toast.success(`Patient ${formData.full_name} added successfully!`);
      onSuccess?.(); // Call the success callback to refresh the patient list
      onClose();
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
      clearErrors();
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage =
        error.message || "An error occurred while adding the patient";
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
      title="Add New Patient"
      onSubmit={handleSubmit}
      submitText={loading ? "Adding..." : "Add Patient"}
      submitVariant="primary"
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
            onBlur={() => handleFieldBlur("full_name")}
            error={errors.full_name}
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
            onBlur={() => handleFieldBlur("date_of_birth")}
            error={errors.date_of_birth}
            placeholder="Select date of birth"
            className="rounded-lg shadow-sm"
          />

          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("gender")}
            error={errors.gender}
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
            onBlur={() => handleFieldBlur("phone")}
            error={errors.phone}
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
            onBlur={() => handleFieldBlur("email")}
            error={errors.email}
            required
            placeholder="Enter email address"
            className="rounded-lg shadow-sm"
          />

          <Input
            label="Aadhar Number"
            name="aadhar_number"
            value={formData.aadhar_number}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("aadhar_number")}
            error={errors.aadhar_number}
            placeholder="Enter Aadhar number (optional)"
            className="rounded-lg shadow-sm"
          />

          <Select
            label="Blood Group"
            name="blood_group"
            value={formData.blood_group}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("blood_group")}
            error={errors.blood_group}
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
            onBlur={() => handleFieldBlur("emergency_contact")}
            error={errors.emergency_contact}
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
