import { useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { DoctorSlotService, CreateSlotData } from "../../services/DoctorSlotService";
import { toast } from "sonner";
import { Plus, Trash2, Clock } from "lucide-react";

interface SlotCreationFormProps {
  doctorId: string;
  onSlotsCreated: (slots: any[]) => void;
  onCancel: () => void;
}

interface SlotFormData {
  slot_name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
}

export function SlotCreationForm({
  doctorId,
  onSlotsCreated,
  onCancel,
}: SlotCreationFormProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slots, setSlots] = useState<SlotFormData[]>([
    {
      slot_name: "",
      start_time: "",
      end_time: "",
      max_capacity: 10,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate today's date for min date
  const today = new Date().toISOString().split('T')[0];

  const validateSlots = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!startDate) {
      newErrors.startDate = "Please select a start date";
    }

    if (!endDate) {
      newErrors.endDate = "Please select an end date";
    }

    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = "End date must be on or after start date";
    }

    slots.forEach((slot, index) => {
      const prefix = `slot_${index}`;
      
      if (!slot.slot_name.trim()) {
        newErrors[`${prefix}_name`] = "Slot name is required";
      }

      if (!slot.start_time) {
        newErrors[`${prefix}_start`] = "Start time is required";
      }

      if (!slot.end_time) {
        newErrors[`${prefix}_end`] = "End time is required";
      }

      if (slot.start_time && slot.end_time && slot.end_time <= slot.start_time) {
        newErrors[`${prefix}_end`] = "End time must be after start time";
      }

      if (slot.max_capacity < 1 || slot.max_capacity > 50) {
        newErrors[`${prefix}_capacity`] = "Capacity must be between 1 and 50";
      }
    });

    // Check for overlapping slots
    const sortedSlots = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const current = sortedSlots[i];
      const next = sortedSlots[i + 1];
      
      if (current.end_time > next.start_time) {
        const currentIndex = slots.findIndex(s => s === current);
        const nextIndex = slots.findIndex(s => s === next);
        newErrors[`slot_${currentIndex}_end`] = `Overlaps with "${next.slot_name}"`;
        newErrors[`slot_${nextIndex}_start`] = `Overlaps with "${current.slot_name}"`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSlotChange = (index: number, field: keyof SlotFormData, value: string | number) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
    
    // Clear errors for this field
    const prefix = `slot_${index}`;
    const newErrors = { ...errors };
    delete newErrors[`${prefix}_${field}`];
    setErrors(newErrors);
  };

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
      const newSlots = slots.filter((_, i) => i !== index);
      setSlots(newSlots);
      
      // Clear errors for removed slot
      const newErrors = { ...errors };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`slot_${index}_`)) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSlots()) {
      toast.error("Please fix validation errors before creating slots");
      return;
    }

    setIsLoading(true);
    try {
      // Generate slots for each date in the range
      const dateRange = generateDateRange(startDate, endDate);
      const allSlots: any[] = [];
      const skippedSlots: string[] = [];

      for (const date of dateRange) {
        const slotData: CreateSlotData[] = slots.map(slot => ({
          slot_name: slot.slot_name.trim(),
          start_time: slot.start_time,
          end_time: slot.end_time,
          max_capacity: slot.max_capacity,
        }));

        const result = await DoctorSlotService.createSlotsForDate(doctorId, date, slotData);
        
        if (result.success && result.data) {
          allSlots.push(...result.data);
        } else {
          // Check if it's a duplicate key error
          const errorMessage = result.error?.message || "";
          if ((result.error as any)?.code === "23505" || errorMessage.includes("duplicate key")) {
            // Extract slot names that already exist
            const existingSlots = slotData.map(slot => `${slot.slot_name} on ${date}`).join(", ");
            skippedSlots.push(existingSlots);
          } else {
            throw new Error(errorMessage || `Failed to create slots for ${date}`);
          }
        }
      }
      
      // Show success message with details about skipped slots
      if (skippedSlots.length > 0) {
        toast.success(
          `Created ${allSlots.length} new slot(s). Skipped ${skippedSlots.length} existing slot(s): ${skippedSlots.join(", ")}`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Successfully created ${allSlots.length} slot(s) from ${startDate} to ${endDate}`);
      }
      
      onSlotsCreated(allSlots);
      
      // Reset form
      setStartDate("");
      setEndDate("");
      setSlots([{
        slot_name: "",
        start_time: "",
        end_time: "",
        max_capacity: 10,
      }]);
      setErrors({});
    } catch (error) {
      console.error("Error creating slots:", error);
      toast.error("Failed to create slots");
    } finally {
      setIsLoading(false);
    }
  };

  const quickCapacitySelect = (value: number) => {
    // Set capacity for all slots
    const newSlots = slots.map(slot => ({ ...slot, max_capacity: value }));
    setSlots(newSlots);
  };

  // Generate array of dates between start and end date (inclusive)
  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Create New Slots
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date Range Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate) {
                    setErrors(prev => ({ ...prev, startDate: "" }));
                  }
                }}
                min={today}
                className={errors.startDate ? "border-red-500" : ""}
              />
              {errors.startDate && (
                <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (errors.endDate) {
                    setErrors(prev => ({ ...prev, endDate: "" }));
                  }
                }}
                min={startDate || today}
                className={errors.endDate ? "border-red-500" : ""}
              />
              {errors.endDate && (
                <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Date Range Preview */}
          {startDate && endDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Preview:</strong> Slots will be created for{" "}
                {generateDateRange(startDate, endDate).length} day(s) from{" "}
                {new Date(startDate).toLocaleDateString()} to{" "}
                {new Date(endDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                <strong>Note:</strong> If slots with the same name already exist for any date, they will be skipped.
              </p>
            </div>
          )}

          {/* Quick Capacity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Capacity Selection
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map(capacity => (
                <Button
                  key={capacity}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quickCapacitySelect(capacity)}
                  className="text-xs"
                >
                  {capacity}
                </Button>
              ))}
            </div>
          </div>

          {/* Slot Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Slot Configuration
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSlot}
                className="flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Slot
              </Button>
            </div>

            {slots.map((slot, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    Slot {index + 1}
                  </h4>
                  {slots.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSlot(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slot Name *
                    </label>
                    <select
                      value={slot.slot_name}
                      onChange={(e) => handleSlotChange(index, "slot_name", e.target.value)}
                      className={`w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors[`slot_${index}_name`] ? "border-red-500" : ""
                      }`}
                    >
                      <option value="">Select slot name</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                    </select>
                    {errors[`slot_${index}_name`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`slot_${index}_name`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => handleSlotChange(index, "start_time", e.target.value)}
                      className={errors[`slot_${index}_start`] ? "border-red-500" : ""}
                    />
                    {errors[`slot_${index}_start`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`slot_${index}_start`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time *
                    </label>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => handleSlotChange(index, "end_time", e.target.value)}
                      className={errors[`slot_${index}_end`] ? "border-red-500" : ""}
                    />
                    {errors[`slot_${index}_end`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`slot_${index}_end`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Capacity *
                    </label>
                    <Input
                      type="number"
                      value={slot.max_capacity}
                      onChange={(e) => handleSlotChange(index, "max_capacity", parseInt(e.target.value) || 0)}
                      min="1"
                      max="50"
                      className={errors[`slot_${index}_capacity`] ? "border-red-500" : ""}
                    />
                    {errors[`slot_${index}_capacity`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`slot_${index}_capacity`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
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
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Creating Slots..." : "Create Slots"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
