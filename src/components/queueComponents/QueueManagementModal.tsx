/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Clock, UserPlus, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { Doctor, Patient } from "../../types";
import { AppointmentStatus } from "../../constants";
import { format } from "date-fns";
import { WhatsAppService } from "../../services/WhatsAppService";


interface QueueManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDoctor: string;
  selectedDate: string;
  doctors: Doctor[];
  onRefreshQueue: () => void;
}

export function QueueManagementModal({
  isOpen,
  onClose,
  selectedDoctor,
  selectedDate,
  doctors,
  onRefreshQueue,
}: QueueManagementModalProps) {
  const [activeTab, setActiveTab] = useState<"delay" | "emergency">("delay");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Delay form
  const [delayMinutes, setDelayMinutes] = useState("");
  const [delayReason, setDelayReason] = useState("");

  // Emergency form
  const [selectedPatient, setSelectedPatient] = useState("");
  const [emergencyTime, setEmergencyTime] = useState("");
  const [emergencySymptoms, setEmergencySymptoms] = useState("");

  const { user } = useAuth();

  const selectedDoctorName =
    doctors.find((d) => d.id === selectedDoctor)?.name || "Unknown";

  // Fetch all patients who belong to the current user (for emergency appointments)
  const fetchPatients = async () => {
    if (!user?.id) return;

    setLoadingPatients(true);
    try {
      // Get ALL patients for the current user - they can create emergency appointments for any patient
      const { data: patientsData, error: patientsError } = await supabase
        .from("clinic_patients")
        .select(
          `
          id,
          patient_profile:patient_profiles(
            id, full_name, phone, email
          )
        `
        )
        .eq("clinic_id", user.id)
        .order("patient_profile(full_name)");

      if (patientsError) throw patientsError;

      // Transform the data to match the expected Patient interface
      const transformedPatients = (patientsData || []).map(
        (clinicPatient: any) => ({
          id: clinicPatient.id,
          name: clinicPatient.patient_profile?.full_name || "Unknown",
          contact: clinicPatient.patient_profile?.phone || "",
          email: clinicPatient.patient_profile?.email || "",
        })
      );

      setPatients(transformedPatients as unknown as Patient[]);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleTabChange = (tab: "delay" | "emergency") => {
    setActiveTab(tab);
    if (tab === "emergency") {
      fetchPatients();
    }
  };

  const handleAddDelay = async () => {
    if (!delayMinutes || isNaN(Number(delayMinutes))) {
      alert("Please enter valid delay minutes");
      return;
    }

    const delay = Number(delayMinutes);
    if (delay <= 0) {
      alert("Please enter a positive number");
      return;
    }

    setLoading(true);
    try {
      console.log("Adding delay:", {
        delay,
        selectedDoctor,
        selectedDate,
        delayReason,
      });

      // Get all appointments for the entire day WITH patient info for WhatsApp
      const startTime = new Date(`${selectedDate}T00:00:00`);
      const endTime = new Date(`${selectedDate}T23:59:59`);

      // Get doctor info for notification
      const selectedDoctorData = doctors.find((d) => d.id === selectedDoctor);
      const doctorName = selectedDoctorData?.name || "your doctor";

      console.log("Searching for appointments between:", {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      // Updated query to include patient info for WhatsApp notifications
      const { data: appointments, error: fetchError } = await (supabase as any)
        .from("appointments")
        .select(`
          *,
          clinic_patient:clinic_patients(
            id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email
            )
          )
        `)
        .eq("clinic_doctor_id", selectedDoctor)
        .gte("appointment_datetime", startTime.toISOString())
        .lt("appointment_datetime", endTime.toISOString())
        .neq("status", AppointmentStatus.COMPLETED) // Exclude completed appointments
        .order("appointment_datetime");

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      console.log(
        "Found appointments:",
        appointments?.length || 0,
        appointments?.map((a: any) => ({
          id: a.id,
          status: a.status,
          patientName: a.clinic_patient?.patient_profile?.full_name,
          patientPhone: a.clinic_patient?.patient_profile?.phone,
        }))
      );

      if (!appointments || appointments.length === 0) {
        alert("No active appointments found for this doctor on this date");
        return;
      }

      // Update each appointment by adding delay
      console.log("Updating appointments with delay...");
      const updates = appointments.map(async (appointment: any) => {
        const newDateTime = new Date(appointment.appointment_datetime);
        newDateTime.setMinutes(newDateTime.getMinutes() + delay);

        console.log(`Updating appointment ${appointment.id}:`, {
          oldTime: appointment.appointment_datetime,
          newTime: newDateTime.toISOString(),
        });

        const { error } = await (supabase as any)
          .from("appointments")
          .update({
            appointment_datetime: newDateTime.toISOString(),
            delay_minutes: (appointment.delay_minutes || 0) + delay,
            delay_reason: delayReason || "Doctor running late",
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);

        if (error) {
          console.error(`Error updating appointment ${appointment.id}:`, error);
          throw error;
        }

        return { ...appointment, newDateTime };
      });

      const updatedAppointments = await Promise.all(updates);
      console.log("All appointments updated successfully");

      // Send WhatsApp notifications to all affected patients
      console.log("📱 Sending WhatsApp delay notifications...");
      let notificationsSent = 0;
      let notificationsFailed = 0;

      for (const appointment of updatedAppointments) {
        const patientPhone = appointment.clinic_patient?.patient_profile?.phone;
        const patientName = appointment.clinic_patient?.patient_profile?.full_name || "Patient";

        if (patientPhone) {
          try {
            // Format the new expected time nicely (e.g., "3:30 PM")
            const newTime = new Date(appointment.newDateTime);
            const hours = newTime.getHours();
            const minutes = newTime.getMinutes();
            const period = hours >= 12 ? "PM" : "AM";
            const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
            const newExpectedTime = `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;

            // Fetch actual clinic name from clinic_profiles
            const { data: clinicProfile } = await (supabase as any)
              .from("clinic_profiles")
              .select("clinic_name")
              .eq("id", user?.id)
              .single();

            const clinicName = clinicProfile?.clinic_name || "Our Clinic";

            console.log(`📤 Sending delay notification to ${patientName} (${patientPhone})`);

            const result = await WhatsAppService.sendAppointmentDelay({
              phone: patientPhone,
              patientName: patientName,
              doctorName: `Dr. ${doctorName}`,
              delayMinutes: String(delay),
              newExpectedTime: newExpectedTime,
              clinicName: clinicName,
            });

            if (result.success) {
              notificationsSent++;
              console.log(`✅ Delay notification sent to ${patientName}`);
            } else {
              notificationsFailed++;
              console.error(`❌ Failed to send notification to ${patientName}:`, result.error);
            }
          } catch (whatsappError) {
            notificationsFailed++;
            console.error(`❌ WhatsApp error for ${patientName}:`, whatsappError);
          }
        } else {
          console.warn(`⚠️ No phone number for patient: ${patientName}`);
        }
      }

      console.log(`📊 WhatsApp results: ${notificationsSent} sent, ${notificationsFailed} failed`);

      alert(
        `Successfully added ${delay} minute delay to ${appointments.length} appointments.\n` +
        `WhatsApp notifications: ${notificationsSent} sent, ${notificationsFailed} failed.`
      );

      // Queue recalculation is now handled automatically by PGMQ

      onRefreshQueue();
      onClose();
    } catch (error) {
      console.error("Error adding delay:", error);
      alert("Failed to add delay. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  const handleEmergencyAppointment = async () => {
    if (!selectedPatient) {
      alert("Please select a patient");
      return;
    }

    if (!emergencyTime) {
      alert("Please select emergency appointment time");
      return;
    }

    setLoading(true);
    try {
      const emergencyDateTime = new Date(`${selectedDate}T${emergencyTime}:00`);

      // First, check if patient already has an ACTIVE appointment for this doctor/date
      const { data: existingAppointments, error: checkError } = await (
        supabase as any
      )
        .from("appointments")
        .select("*")
        .eq("clinic_patient_id", selectedPatient)
        .eq("clinic_doctor_id", selectedDoctor)
        .gte("appointment_datetime", `${selectedDate}T00:00:00`)
        .lt("appointment_datetime", `${selectedDate}T23:59:59`)
        .neq("status", AppointmentStatus.COMPLETED); // Exclude completed appointments

      if (checkError) throw checkError;

      if (existingAppointments && existingAppointments.length > 0) {
        // Update existing appointment to emergency
        const existingAppointment = existingAppointments[0];

        const { error: updateError } = await (supabase as any)
          .from("appointments")
          .update({
            appointment_datetime: emergencyDateTime.toISOString(),
            emergency_status: true,
            emergency_reason: emergencySymptoms || "Urgent attention required",
            queue_position: 1, // Move to front
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAppointment.id);

        if (updateError) throw updateError;

        alert(
          "Existing appointment converted to emergency and moved to front of queue"
        );
      } else {
        // Create new emergency appointment
        const { error: insertError } = await (supabase as any)
          .from("appointments")
          .insert({
            user_id: user?.id,
            clinic_patient_id: selectedPatient,
            clinic_doctor_id: selectedDoctor,
            appointment_datetime: emergencyDateTime.toISOString(),
            duration_minutes: 30,
            status: "scheduled",
            emergency_status: true,
            emergency_reason: emergencySymptoms || "Urgent attention required",
            queue_position: 1,
          });

        if (insertError) throw insertError;

        alert("Emergency appointment created successfully");
      }

      // Queue recalculation is now handled automatically by PGMQ

      onRefreshQueue();
      onClose();
    } catch (error) {
      console.error("Error handling emergency appointment:", error);
      alert("Failed to handle emergency appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  // Set default emergency time to current time + 15 minutes
  React.useEffect(() => {
    if (activeTab === "emergency" && !emergencyTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      setEmergencyTime(format(now, "HH:mm"));
    }
  }, [activeTab, emergencyTime]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Queue Management" size="lg">
      <div className="p-6">
        {/* Header with doctor and date info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Managing Queue for Dr. {selectedDoctorName}
          </h3>
          <p className="text-blue-700">
            Date: {format(new Date(selectedDate), "MMMM dd, yyyy")}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => handleTabChange("delay")}
            className={`px-4 py-2 text-sm font-medium border-b-2 mr-4 ${activeTab === "delay"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            <Clock className="h-4 w-4 inline mr-2" />
            Add Delay
          </button>
          <button
            onClick={() => handleTabChange("emergency")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === "emergency"
              ? "border-red-500 text-red-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Emergency
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "delay" && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                <h4 className="font-medium text-yellow-800">
                  Add Doctor Delay
                </h4>
              </div>
              <p className="text-sm text-yellow-700">
                This will delay all appointments for this doctor on the selected
                date by the specified amount.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Delay Minutes *"
                type="number"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                placeholder="e.g. 15, 30, 45"
                min="1"
                max="120"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Delay
                </label>
                <select
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason</option>
                  <option value="Doctor running late">
                    Doctor running late
                  </option>
                  <option value="Previous appointment overtime">
                    Previous appointment overtime
                  </option>
                  <option value="Emergency case handled">
                    Emergency case handled
                  </option>
                  <option value="Technical issues">Technical issues</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleAddDelay}
                disabled={loading || !delayMinutes}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                Apply Delay
              </Button>
            </div>
          </div>
        )}

        {activeTab === "emergency" && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <h4 className="font-medium text-red-800">
                  Emergency Appointment
                </h4>
              </div>
              <p className="text-sm text-red-700">
                This will create an urgent appointment that will be placed at
                the front of the queue.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Patient *
                </label>
                {loadingPatients ? (
                  <div className="p-2 text-center">
                    <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                    Loading patients...
                  </div>
                ) : (
                  <select
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Choose a patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} - {patient.contact}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <Input
                label="Emergency Time *"
                type="time"
                value={emergencyTime}
                onChange={(e) => setEmergencyTime(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symptoms/Reason *
                </label>
                <textarea
                  value={emergencySymptoms}
                  onChange={(e) => setEmergencySymptoms(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Describe the emergency situation or symptoms"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleEmergencyAppointment}
                disabled={loading || !selectedPatient || !emergencyTime}
                className="bg-red-600 hover:bg-red-700"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create Emergency Appointment
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
