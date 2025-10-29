import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "./ui/Badge";

import { AppointmentRequestService } from "../services/AppointmentRequestService";

interface AppointmentRequestsBadgeProps {
  onBadgeClick?: () => void;
  className?: string;
}

export function AppointmentRequestsBadge({
  onBadgeClick,
  className = "",
}: AppointmentRequestsBadgeProps) {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchPendingCount = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      const count = await AppointmentRequestService.getPendingRequestsCount();
      setPendingCount(count);
    } catch (error) {
      console.error("Error fetching pending requests count:", error);
      setPendingCount(0);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPendingCount(true); // Initial load with loading state

    // Set up polling to check for new requests every 30 seconds (without loading animation)
    const interval = setInterval(() => fetchPendingCount(false), 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <ClipboardList className="h-5 w-5 text-gray-400" />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center cursor-pointer hover:bg-gray-100 p-2 rounded-md transition-colors ${className}`}
      onClick={onBadgeClick}
      title={`${pendingCount} pending appointment requests`}
    >
      <ClipboardList className="h-5 w-5 text-gray-600" />
      {pendingCount > 0 && (
        <Badge
          variant="default"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white"
        >
          {pendingCount > 99 ? "99+" : pendingCount}
        </Badge>
      )}
    </div>
  );
}
