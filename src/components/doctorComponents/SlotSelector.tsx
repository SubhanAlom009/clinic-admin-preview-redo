/**
 * Slot Selector Component
 * Displays available slots for selection
 */
import React, { useState, useEffect } from "react";
import { Calendar, Clock, Users, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
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

  const getSlotStatus = (slot: AvailableSlot) => {
    if (slot.is_full) {
      return { status: "full", color: "destructive" as const, text: "Full" };
    } else if (slot.available_capacity <= 2) {
      return {
        status: "nearly-full",
        color: "warning" as const,
        text: "Nearly Full",
      };
    } else {
      return {
        status: "available",
        color: "success" as const,
        text: "Available",
      };
    }
  };

  const formatTimeRange = (startTime: string, endTime: string) => {
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Available Time Slots
        </h3>
        <p className="text-sm text-gray-600">
          {new Date(date).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.map((slot) => {
          const slotStatus = getSlotStatus(slot);
          const isSelected = selectedSlot === slot.id;
          const isDisabled = disabled || slot.is_full;

          return (
            <Card
              key={slot.id}
              className={`cursor-pointer transition-all duration-200 ${isSelected
                ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200"
                : isDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-md hover:border-gray-300"
                }`}
              onClick={() => {
                console.log("🎯 Card clicked for slot:", slot.slot_name);
                handleSlotSelect(slot);
              }}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-gray-900">
                    {slot.slot_name}
                  </h4>
                  <Badge variant={slotStatus.color} className="text-xs">
                    {slotStatus.text}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      {formatTimeRange(slot.start_time, slot.end_time)}
                    </span>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      {slot.available_capacity} / {slot.max_capacity} available
                    </span>
                  </div>
                </div>

                {!isDisabled && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      variant={isSelected ? "primary" : "outline"}
                      disabled={isDisabled}
                      onClick={() => {
                        console.log(
                          "🔘 Button clicked for slot:",
                          slot.slot_name
                        );
                        handleSlotSelect(slot);
                      }}
                    >
                      {isSelected ? "Selected" : "Select Slot"}
                    </Button>
                  </div>
                )}

                {slot.available_capacity > 0 &&
                  slot.available_capacity <= 2 &&
                  !slot.is_full && (
                    <div className="mt-2">
                      <p className="text-xs text-amber-600 font-medium">
                        ⚠️ Only {slot.available_capacity} spot
                        {slot.available_capacity !== 1 ? "s" : ""} left
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {slots.length > 0 && (
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-gray-500">
            Showing {slots.length} slot{slots.length !== 1 ? "s" : ""} for{" "}
            {new Date(date).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
