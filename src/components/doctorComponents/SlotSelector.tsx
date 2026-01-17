/**
 * Slot Selector Component
 * Displays available slots for selection
 */
import { useState, useEffect } from "react";
import { Calendar, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import {
  DoctorSlotService,
  AvailableSlot,
} from "../../services/DoctorSlotService";
import { toast } from "sonner";

interface SlotSelectorProps {
  doctorId: string;
  date: string;
  onSlotSelect: (slot: AvailableSlot) => void;
  selectedSlot?: string;
  disabled?: boolean;
}

export function SlotSelector({
  doctorId,
  date,
  onSlotSelect,
  selectedSlot,
  disabled = false,
}: SlotSelectorProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await DoctorSlotService.getAvailableSlots(doctorId, date);
      if (result.success) {
        setSlots(result.data || []);
      } else {
        setError(result.error?.message || "Failed to load slots");
        toast.error("Failed to load available slots");
      }
    } catch (error) {
      setError("An error occurred while loading slots");
      toast.error("An error occurred while loading slots");
      console.error("Error fetching slots:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (doctorId && date) {
      fetchSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date]);

  const handleSlotSelect = (slot: AvailableSlot) => {
    console.log("🎯 Slot clicked:", slot.slot_name, slot.id);
    console.log("  - Disabled:", disabled);
    console.log("  - Slot is full:", slot.is_full);

    if (!disabled && !slot.is_full) {
      console.log("✅ Calling onSlotSelect with slot:", slot);
      onSlotSelect(slot);
    } else {
      console.log("❌ Slot selection blocked");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading available slots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Error Loading Slots
        </h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={fetchSlots} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Slots Available
        </h3>
        <p className="text-gray-500">
          No time slots are available for{" "}
          <strong>{new Date(date).toLocaleDateString()}</strong>.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Contact the clinic administrator to create slots for this date.
        </p>
      </div>
    );
  }

  // Group slots by time of day
  const groupSlotsByTimeOfDay = () => {
    const morning: AvailableSlot[] = [];
    const afternoon: AvailableSlot[] = [];
    const evening: AvailableSlot[] = [];

    slots.forEach((slot) => {
      const hour = parseInt(slot.start_time.split(":")[0]);
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    });

    return { morning, afternoon, evening };
  };

  const groupedSlots = groupSlotsByTimeOfDay();

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const renderSlotGroup = (title: string, slotsGroup: AvailableSlot[]) => {
    if (slotsGroup.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h4>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slotsGroup.map((slot) => {
            const isSelected = selectedSlot === slot.id;
            const isDisabled = disabled || slot.is_full;
            const isNearlyFull = slot.available_capacity <= 2 && !slot.is_full;

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => !isDisabled && handleSlotSelect(slot)}
                disabled={isDisabled}
                className={`py-2.5 px-2 rounded-lg text-sm font-medium transition-all border ${isSelected
                  ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-100"
                  : isDisabled
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : isNearlyFull
                      ? "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
              >
                {formatTime(slot.start_time)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        {renderSlotGroup("Morning", groupedSlots.morning)}
        {renderSlotGroup("Afternoon", groupedSlots.afternoon)}
        {renderSlotGroup("Evening", groupedSlots.evening)}

        {selectedSlot && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-green-600 font-medium flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Slot selected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
