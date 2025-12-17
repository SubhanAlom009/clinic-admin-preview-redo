import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  DoctorProfileService,
  type UpdateDoctorProfileData,
  type DoctorProfileWithClinic,
} from "../../services/DoctorProfileService";
import { useAuth } from "../../hooks/useAuth";
import { useFormValidation } from "../../hooks/useFormValidation";
import { doctorFormSchema, type DoctorFormData } from "../../validation/FormSchemas";
import { SlotCreator } from "./SlotCreator";
import { DoctorSlotService, AvailableSlot } from "../../services/DoctorSlotService";
import { Calendar, Clock, Users, Trash2 } from "lucide-react";

interface EditDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: DoctorProfileWithClinic | null;
}

export function EditDoctorModal({
  isOpen,
  onClose,
  doctor,
}: EditDoctorModalProps) {
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
    // Slot settings
    default_slot_duration: "180",
    max_patients_per_slot: "10",
    slot_creation_enabled: true,
  });

  const [loading, setLoading] = useState(false);
  const [showSlotCreator, setShowSlotCreator] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [existingSlots, setExistingSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const { user } = useAuth();

  // Use our new validation system
  const { errors, validate, validateField, clearErrors } = useFormValidation(doctorFormSchema);

  // Fetch existing slots when date changes
  useEffect(() => {
    if (selectedDate && doctor?.clinic_doctor) {
      fetchExistingSlots();
    } else {
      setExistingSlots([]);
    }
  }, [selectedDate, doctor?.clinic_doctor]);

  useEffect(() => {
    if (doctor) {
      setFormData({
        full_name: doctor.full_name || "", // ✅ Correct field name
        primary_specialization: doctor.primary_specialization || "",
        qualifications: Array.isArray(doctor.qualifications)
          ? doctor.qualifications.join(", ")
          : doctor.qualifications || "", // ✅ Handle array/string types
        medical_license_number: doctor.medical_license_number || "", // ✅ Required field
        phone: doctor.phone || "", // ✅ Correct field name
        email: doctor.email || "",
        consultation_fee: doctor.consultation_fee?.toString() || "", // ✅ Safe optional chaining
        experience_years: doctor.experience_years?.toString() || "", // ✅ Safe optional chaining
        secondary_specializations: Array.isArray(
          doctor.secondary_specializations
        )
          ? doctor.secondary_specializations.join(", ")
          : doctor.secondary_specializations || "",
        languages: Array.isArray(doctor.languages)
          ? doctor.languages.join(", ")
          : doctor.languages || "",
        bio: doctor.bio || "",
        // Slot settings from clinic_doctor relationship
        default_slot_duration: doctor.clinic_doctor?.default_slot_duration?.toString() || "180",
        max_patients_per_slot: doctor.clinic_doctor?.max_patients_per_slot?.toString() || "10",
        slot_creation_enabled: doctor.clinic_doctor?.slot_creation_enabled ?? true,
      });
    } else {
      // Reset form when no doctor (prevents controlled/uncontrolled warnings)
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
        default_slot_duration: "180",
        max_patients_per_slot: "10",
        slot_creation_enabled: true,
      });
    }
  }, [doctor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !doctor) return;

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

      const updateData: UpdateDoctorProfileData = {
        full_name: formData.full_name, // ✅ Correct field
        phone: formData.phone, // ✅ Correct field
        email: formData.email || undefined,
        primary_specialization: formData.primary_specialization,
        qualifications: formData.qualifications
          ? formData.qualifications.split(",").map((q) => q.trim())
          : undefined,
        medical_license_number: formData.medical_license_number || undefined,
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
      };

      // ✅ Use correct service method
      const result = await DoctorProfileService.updateDoctorProfile(
        doctor.id,
        updateData
      );

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update doctor");
      }

      // Update slot settings if clinic_doctor exists
      if (doctor.clinic_doctor?.id) {
        const slotSettings = {
          default_slot_duration: formData.default_slot_duration
            ? parseInt(formData.default_slot_duration)
            : undefined,
          max_patients_per_slot: formData.max_patients_per_slot
            ? parseInt(formData.max_patients_per_slot)
            : undefined,
          slot_creation_enabled: formData.slot_creation_enabled,
        };

        const slotResult = await DoctorProfileService.updateDoctorSlotSettings(
          doctor.clinic_doctor.id,
          slotSettings
        );

        if (!slotResult.success) {
          console.warn("Failed to update slot settings:", slotResult.error?.message);
          // Don't throw error here, just log it as slot settings are not critical
        }
      }

      toast.success("Doctor updated successfully!");
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotCreatorOpen = () => {
    if (!doctor?.clinic_doctor) {
      toast.error("Doctor must be linked to clinic first");
      return;
    }
    // Set default date to today if no date is selected
    if (!selectedDate) {
      setSelectedDate(new Date().toISOString().split('T')[0]);
    }
    setShowSlotCreator(true);
  };

  const handleSlotsCreated = (slots: any[]) => {
    toast.success(`Successfully created ${slots.length} slots!`);
    setShowSlotCreator(false);
    // Refresh existing slots for the selected date
    if (selectedDate && doctor?.clinic_doctor) {
      fetchExistingSlots();
    }
  };

  const fetchExistingSlots = async () => {
    if (!selectedDate || !doctor?.clinic_doctor) return;

    setLoadingSlots(true);
    try {
      const result = await DoctorSlotService.getAvailableSlots(
        doctor.clinic_doctor.id,
        selectedDate
      );

      if (result.success && result.data) {
        setExistingSlots(result.data);
      } else {
        setExistingSlots([]);
      }
    } catch (error) {
      console.error('Error fetching existing slots:', error);
      setExistingSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await DoctorSlotService.deleteSlot(slotId);
      if (result.success) {
        toast.success('Slot deleted successfully');
        fetchExistingSlots(); // Refresh the list
      } else {
        toast.error(result.error?.message || 'Failed to delete slot');
      }
    } catch (error) {
      toast.error('Failed to delete slot');
      console.error('Error deleting slot:', error);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Doctor" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("full_name")}
            error={errors.full_name}
            required
            placeholder="Enter doctor's full name"
          />
          <Input
            label="Primary Specialization"
            name="primary_specialization"
            value={formData.primary_specialization}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("primary_specialization")}
            error={errors.primary_specialization}
            required
            placeholder="e.g., Cardiologist, Dermatologist"
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
          />
          <Input
            label="Medical License Number"
            name="medical_license_number"
            value={formData.medical_license_number}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("medical_license_number")}
            error={errors.medical_license_number}
            required
            placeholder="Enter medical license number"
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("email")}
            error={errors.email}
            placeholder="Enter email address"
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
            placeholder="Enter consultation fee"
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
            placeholder="Enter years of experience"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Qualifications
          </label>
          <textarea
            name="qualifications"
            value={formData.qualifications}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("qualifications")}
            rows={3}
            className={`block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.qualifications ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
              }`}
            placeholder="Enter qualifications and certifications"
          />
          {errors.qualifications && (
            <p className="mt-1 text-sm text-red-600">{errors.qualifications}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Secondary Specializations (comma separated)"
            name="secondary_specializations"
            value={formData.secondary_specializations}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("secondary_specializations")}
            error={errors.secondary_specializations}
            placeholder="e.g., Pediatrics, Geriatrics"
          />
          <Input
            label="Languages (comma separated)"
            name="languages"
            value={formData.languages}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("languages")}
            error={errors.languages}
            placeholder="e.g., English, Hindi"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short Bio
          </label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur("bio")}
            rows={4}
            className={`block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.bio ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
              }`}
            placeholder="A short professional bio for the doctor's profile"
          />
          {errors.bio && (
            <p className="mt-1 text-sm text-red-600">{errors.bio}</p>
          )}
        </div>

        {/* Slot Settings Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Slot Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Default Slot Duration (minutes)"
              name="default_slot_duration"
              type="number"
              value={formData.default_slot_duration}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur("default_slot_duration")}
              error={errors.default_slot_duration}
              placeholder="180"
              min="60"
              max="480"
            />
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
            />
          </div>
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="slot_creation_enabled"
                checked={formData.slot_creation_enabled}
                onChange={(e) => setFormData({
                  ...formData,
                  slot_creation_enabled: e.target.checked
                })}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700">
                Enable slot creation for this doctor
              </span>
            </label>
          </div>
        </div>

        {/* Slot Management Section */}
        {doctor?.clinic_doctor && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                Slot Management
              </h3>
            </div>

            {/* Date Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date for Slot Creation
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSlotCreatorOpen}
                  className="flex items-center"
                  disabled={!selectedDate}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Create Slots
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Choose a date to create slots for this doctor
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <Users className="h-4 w-4 mr-2" />
                <span>Default Settings:</span>
              </div>
              <div className="text-sm text-gray-700">
                <p>• Duration: {formData.default_slot_duration} minutes</p>
                <p>• Max Patients: {formData.max_patients_per_slot}</p>
                <p>• Slot Creation: {formData.slot_creation_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Select a date above and click "Create Slots" to add specific time slots for this doctor.
              </p>
            </div>

            {/* Existing Slots Display */}
            {selectedDate && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Existing Slots for {new Date(selectedDate).toLocaleDateString()}
                </h4>

                {loadingSlots ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-gray-500">Loading slots...</div>
                  </div>
                ) : existingSlots.length > 0 ? (
                  <div className="space-y-2">
                    {existingSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900">
                              {slot.slot_name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {(() => {
                                const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
                                return `${fmt(slot.start_time)} - ${fmt(slot.end_time)}`;
                              })()}
                            </span>
                            <span className="text-sm text-blue-600">
                              {slot.current_bookings}/{slot.max_capacity} patients
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">
                    No slots created for this date yet.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Doctor"}
          </Button>
        </div>
      </form>

      {/* Slot Creator Modal */}
      {showSlotCreator && doctor?.clinic_doctor && (
        <SlotCreator
          doctorId={doctor.clinic_doctor.id}
          date={selectedDate}
          onSlotsCreated={handleSlotsCreated}
          onCancel={() => setShowSlotCreator(false)}
        />
      )}
    </Modal>
  );
}
