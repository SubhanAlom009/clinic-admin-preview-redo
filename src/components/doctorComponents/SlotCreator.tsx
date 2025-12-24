/**
 * Slot Creator Component
 * Form to create multiple slots for a doctor on selected date
 */
import React, { useState } from "react";
import { Plus, X, Clock, Users, Calendar, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardContent } from "../ui/Card";
import { useFormValidation } from "../../hooks/useFormValidation";
import { createMultipleSlotsSchema, COMMON_SLOT_NAMES, COMMON_SLOT_CAPACITIES } from "../../validation/SlotSchemas";
import { DoctorSlotService, CreateSlotData } from "../../services/DoctorSlotService";
import { toast } from "sonner";

interface SlotCreatorProps {
  doctorId: string;
  date: string;
  onSlotsCreated: (slots: any[]) => void;
  onCancel: () => void;
}

export function SlotCreator({ doctorId, date, onSlotsCreated, onCancel }: SlotCreatorProps) {
  const [slots, setSlots] = useState<CreateSlotData[]>([
    {
      slot_name: "",
      start_time: "",
      end_time: "",
      max_capacity: 10,
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { errors, validate, validateField, clearErrors } = useFormValidation(createMultipleSlotsSchema);

  const addSlot = () => {
    setSlots([...slots, {
      slot_name: "",
      start_time: "",
      end_time: "",
      max_capacity: 10,
    }]);
  };

  const removeSlot = (index: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const updateSlot = (index: number, field: keyof CreateSlotData, value: string | number) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);

    // Clear field-specific errors when user starts typing
    const fieldKey = `${index}.${field}`;
    if (errors[fieldKey]) {
      validateField(fieldKey, value);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    clearErrors();

    const validationResult = validate(slots);
    if (!validationResult.isValid) {
      setError("Please fix validation errors before creating slots");
      toast.error("Please fix validation errors before creating slots");
      return;
    }

    setLoading(true);
    try {
      const result = await DoctorSlotService.createSlots(doctorId, date, slots);
      if (result.success && result.data) {
        setSuccess(true);
        toast.success(`Successfully created ${result.data.length} slot(s)!`);
        onSlotsCreated(result.data);

        // Auto-close after success
        setTimeout(() => {
          onCancel();
        }, 1500);
      } else {
        const errorMessage = result.error?.message || "Failed to create slots";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || "An error occurred while creating slots";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Slot creation error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFieldError = (index: number, field: keyof CreateSlotData): string | undefined => {
    return errors[`${index}.${field}`];
  };

  const getOverallErrors = (): string[] => {
    const overallErrors: string[] = [];

    // Check for duplicate slot names
    const names = slots.map(slot => slot.slot_name.toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      overallErrors.push("Slot names must be unique");
    }

    // Check for overlapping times
    const sortedSlots = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const current = sortedSlots[i];
      const next = sortedSlots[i + 1];

      if (current.end_time && next.start_time && current.end_time > next.start_time) {
        overallErrors.push(`Slot "${current.slot_name}" overlaps with "${next.slot_name}"`);
      }
    }

    return overallErrors;
  };

  const overallErrors = getOverallErrors();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Create Time Slots</h3>
          <p className="text-sm text-gray-600">
            Create slots for <strong>{new Date(date).toLocaleDateString()}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={addSlot} size="sm" disabled={loading || slots.length >= 10}>
            <Plus className="h-4 w-4 mr-2" />
            Add Slot
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h4 className="text-sm font-medium text-red-800">Error</h4>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h4 className="text-sm font-medium text-green-800">Success!</h4>
          </div>
          <p className="text-sm text-green-700 mt-1">Slots created successfully. Closing in a moment...</p>
        </div>
      )}

      {/* Validation Errors */}
      {overallErrors.length > 0 && !error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h4 className="text-sm font-medium text-red-800">Please fix these issues:</h4>
          </div>
          <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
            {overallErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {slots.map((slot, index) => (
          <Card key={index} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-gray-900">Slot {index + 1}</h4>
              {slots.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeSlot(index)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Input
                  label="Slot Name"
                  value={slot.slot_name}
                  onChange={(e) => updateSlot(index, 'slot_name', e.target.value)}
                  error={getFieldError(index, 'slot_name')}
                  placeholder="e.g., Morning Slot"
                  disabled={loading}
                />
                <div className="mt-1">
                  <p className="text-xs text-gray-500">Suggestions:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COMMON_SLOT_NAMES.slice(0, 3).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => updateSlot(index, 'slot_name', name)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                        disabled={loading}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Input
                  label="Start Time"
                  type="time"
                  value={slot.start_time}
                  onChange={(e) => updateSlot(index, 'start_time', e.target.value)}
                  error={getFieldError(index, 'start_time')}
                  disabled={loading}
                />
              </div>

              <div>
                <Input
                  label="End Time"
                  type="time"
                  value={slot.end_time}
                  onChange={(e) => updateSlot(index, 'end_time', e.target.value)}
                  error={getFieldError(index, 'end_time')}
                  disabled={loading}
                />
              </div>

              <div>
                <Input
                  label="Max Capacity"
                  type="number"
                  value={slot.max_capacity}
                  onChange={(e) => updateSlot(index, 'max_capacity', parseInt(e.target.value) || 1)}
                  error={getFieldError(index, 'max_capacity')}
                  min="1"
                  max="50"
                  disabled={loading}
                />
                <div className="mt-1">
                  <p className="text-xs text-gray-500">Quick select:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COMMON_SLOT_CAPACITIES.slice(0, 3).map((capacity) => (
                      <button
                        key={capacity.value}
                        type="button"
                        onClick={() => updateSlot(index, 'max_capacity', capacity.value)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                        disabled={loading}
                      >
                        {capacity.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Slot preview */}
            {slot.start_time && slot.end_time && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{(() => { const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }; return `${fmt(slot.start_time)} - ${fmt(slot.end_time)}`; })()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>Up to {slot.max_capacity} patients</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setSlots([{
            slot_name: "",
            start_time: "",
            end_time: "",
            max_capacity: 10,
          }])}
          disabled={loading}
        >
          Clear All
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || slots.length === 0 || success}
          className="min-w-[120px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : success ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Created!
            </>
          ) : (
            `Create ${slots.length} Slot${slots.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}
