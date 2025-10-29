import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { AppointmentRequests } from "../components/AppointmentRequests";
import { RescheduleRequests } from "../components/RescheduleRequests";
import { ClipboardList, RotateCcw } from "lucide-react";

export default function AppointmentRequestsPage() {
  const [activeTab, setActiveTab] = useState("appointments");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Requests Management
        </h1>
        <p className="text-gray-600 mt-1">
          Manage appointment requests and reschedule requests
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Appointment Requests
          </TabsTrigger>
          <TabsTrigger value="reschedule" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Reschedule Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          <AppointmentRequests />
        </TabsContent>

        <TabsContent value="reschedule" className="space-y-4">
          <RescheduleRequests />
        </TabsContent>
      </Tabs>
    </div>
  );
}
