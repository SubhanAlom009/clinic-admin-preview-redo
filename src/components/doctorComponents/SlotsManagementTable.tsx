import { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { DoctorSlotService } from "../../services/DoctorSlotService";
import { toast } from "sonner";
import {
  Calendar,
  Filter,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  Clock,
  Users
} from "lucide-react";
import { format } from "date-fns";

// Helper function to format time to 12-hour format
const formatTimeWithoutSeconds = (timeString: string): string => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

interface SlotsManagementTableProps {
  doctorId: string;
  onRefresh?: () => void;
}

interface SlotFilters {
  startDate: string;
  endDate: string;
  slotName: string;
  status: 'active' | 'inactive' | 'all';
}

export function SlotsManagementTable({
  doctorId,
  onRefresh,
}: SlotsManagementTableProps) {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    slot_name: "",
    max_capacity: 0,
  });

  const [filters, setFilters] = useState<SlotFilters>({
    startDate: "",
    endDate: "",
    slotName: "",
    status: "active",
  });

  const itemsPerPage = 1000; // Show all slots without pagination

  // Calculate date range for default filter (today to +4 weeks)
  useEffect(() => {
    const today = new Date();
    const fourWeeksFromNow = new Date();
    fourWeeksFromNow.setDate(today.getDate() + 28);

    setFilters(prev => ({
      ...prev,
      startDate: today.toISOString().split('T')[0],
      endDate: fourWeeksFromNow.toISOString().split('T')[0],
    }));
  }, []);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const result = await DoctorSlotService.getSlotsWithFilters(
        doctorId,
        {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          slotName: filters.slotName || undefined,
          status: filters.status,
        },
        {
          page: 1,
          limit: itemsPerPage,
        }
      );

      if (result.success && result.data) {
        setSlots(result.data.slots);
        setTotal(result.data.total);
      } else {
        toast.error("Failed to load slots");
        setSlots([]);
        setTotal(0);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast.error("Failed to load slots");
      setSlots([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [doctorId, filters]);

  const handleFilterChange = (field: keyof SlotFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    fetchSlots();
  };

  const handleSelectSlot = (slotId: string) => {
    setSelectedSlots(prev =>
      prev.includes(slotId)
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSlots.length === slots.length) {
      setSelectedSlots([]);
    } else {
      setSelectedSlots(slots.map(slot => slot.id));
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedSlots.length === 0) {
      toast.error("Please select slots first");
      return;
    }

    try {
      if (action === 'delete') {
        const result = await DoctorSlotService.bulkDeleteSlots(selectedSlots);
        if (result.success && result.data) {
          const { deleted, failed } = result.data;
          if (deleted > 0) {
            toast.success(`Successfully deleted ${deleted} slot(s)`);
          }
          if (failed.length > 0) {
            toast.warning(`${failed.length} slot(s) could not be deleted (have bookings)`);
          }
        } else {
          toast.error("Failed to delete slots");
        }
      } else {
        const isActive = action === 'activate';
        const result = await DoctorSlotService.bulkUpdateSlotStatus(selectedSlots, isActive);
        if (result.success && result.data) {
          toast.success(`Successfully ${action}d ${result.data} slot(s)`);
        } else {
          toast.error(`Failed to ${action} slots`);
        }
      }

      setSelectedSlots([]);
      fetchSlots();
      onRefresh?.();
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      toast.error(`Failed to ${action} slots`);
    }
  };

  const handleEditSlot = (slot: any) => {
    setEditingSlot(slot.id);
    setEditForm({
      slot_name: slot.slot_name,
      max_capacity: slot.max_capacity,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSlot) return;

    try {
      const result = await DoctorSlotService.updateSlot(editingSlot, editForm);
      if (result.success) {
        toast.success("Slot updated successfully");
        setEditingSlot(null);
        fetchSlots();
        onRefresh?.();
      } else {
        toast.error(result.error?.message || "Failed to update slot");
      }
    } catch (error) {
      console.error("Error updating slot:", error);
      toast.error("Failed to update slot");
    }
  };

  const handleCancelEdit = () => {
    setEditingSlot(null);
    setEditForm({ slot_name: "", max_capacity: 0 });
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;

    try {
      const result = await DoctorSlotService.deleteSlot(slotId);
      if (result.success) {
        toast.success("Slot deleted successfully");
        fetchSlots();
        onRefresh?.();
      } else {
        toast.error(result.error?.message || "Failed to delete slot");
      }
    } catch (error) {
      console.error("Error deleting slot:", error);
      toast.error("Failed to delete slot");
    }
  };

  const handleToggleStatus = async (slotId: string, currentStatus: boolean) => {
    try {
      const result = await DoctorSlotService.bulkUpdateSlotStatus([slotId], !currentStatus);
      if (result.success) {
        toast.success(`Slot ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        fetchSlots();
        onRefresh?.();
      } else {
        toast.error("Failed to update slot status");
      }
    } catch (error) {
      console.error("Error updating slot status:", error);
      toast.error("Failed to update slot status");
    }
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading slots...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Appointment Slots ({total})
          </div>
          {selectedSlots.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedSlots.length} selected
              </span>
              <Button
                onClick={() => handleBulkAction('delete')}
                className="bg-red-600 hover:bg-red-700 text-sm"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slot Name
              </label>
              <select
                value={filters.slotName}
                onChange={(e) => handleFilterChange("slotName", e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Slots</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="h-10"
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
            <div>
              <Button
                onClick={applyFilters}
                className="w-full h-10 bg-blue-600 hover:bg-blue-700"
              >
                <Filter className="h-4 w-4 mr-2" />
                Apply
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        {slots.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No appointment slots
            </h3>
            <p className="text-gray-500">
              {filters.status === "active"
                ? "No active slots found for the selected criteria."
                : "No slots found for the selected criteria."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center"
                    >
                      {selectedSlots.length === slots.length ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slot Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {slots.map((slot) => (
                  <tr key={slot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-2 whitespace-nowrap">
                      <button
                        onClick={() => handleSelectSlot(slot.id)}
                        className="flex items-center"
                      >
                        {selectedSlots.includes(slot.id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(slot.slot_date), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingSlot === slot.id ? (
                        <Input
                          value={editForm.slot_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, slot_name: e.target.value }))}
                          className="w-32"
                        />
                      ) : (
                        slot.slot_name
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-gray-400" />
                        {formatTimeWithoutSeconds(slot.start_time)} - {formatTimeWithoutSeconds(slot.end_time)}
                      </div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                      {editingSlot === slot.id ? (
                        <Input
                          type="number"
                          value={editForm.max_capacity}
                          onChange={(e) => setEditForm(prev => ({ ...prev, max_capacity: parseInt(e.target.value) || 0 }))}
                          className="w-20"
                          min="1"
                          max="50"
                        />
                      ) : (
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1 text-gray-400" />
                          <div className="flex items-center space-x-2">
                            <span>{slot.current_bookings}/{slot.max_capacity}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${(slot.current_bookings / slot.max_capacity) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${slot.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                          }`}
                      >
                        {slot.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium">
                      {editingSlot === slot.id ? (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditSlot(slot)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(slot.id, slot.is_active)}
                            className={slot.is_active ? "text-orange-600" : "text-green-600"}
                          >
                            {slot.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-800"
                            disabled={slot.current_bookings > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Results Summary */}
        {slots.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              Showing {slots.length} of {total} slots
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
