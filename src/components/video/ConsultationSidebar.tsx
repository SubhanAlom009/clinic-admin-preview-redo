import { useState, useEffect, useRef } from "react";
import { FileText, Pill, Stethoscope, CheckCircle, Loader2, Save, Upload, File, X } from "lucide-react";
import { AppointmentService } from "../../services/AppointmentService";
import { AppointmentStatus } from "../../constants";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

interface ConsultationSidebarProps {
    appointmentId?: string;
    patientName: string;
    patientSymptoms: string;
    callId?: string;
    onComplete?: () => void;
}

type TabType = "notes" | "prescription";

export function ConsultationSidebar({
    appointmentId,
    patientName,
    patientSymptoms,
    callId,
    onComplete
}: ConsultationSidebarProps) {
    const [activeTab, setActiveTab] = useState<TabType>("notes");
    const [notes, setNotes] = useState("");
    const [prescription, setPrescription] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [prescriptionFileUrl, setPrescriptionFileUrl] = useState<string | null>(null);
    const [prescriptionType, setPrescriptionType] = useState<"text" | "file">("text");
    const [saving, setSaving] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load existing data when appointmentId changes
    useEffect(() => {
        const loadAppointmentData = async () => {
            if (!appointmentId) return;

            try {
                const result = await AppointmentService.getAppointmentById(appointmentId);
                if (result.success && result.data) {
                    setNotes(result.data.notes || "");
                    setPrescription(result.data.prescription || "");
                    setDiagnosis(result.data.diagnosis || "");
                    // Load file prescription data if available
                    const data = result.data as any;
                    if (data.prescription_file_url) {
                        setPrescriptionFileUrl(data.prescription_file_url);
                        setPrescriptionType("file");
                    } else if (data.prescription) {
                        setPrescriptionType("text");
                    }
                }
            } catch (error) {
                console.error("Failed to load appointment data:", error);
            }
        };

        loadAppointmentData();
    }, [appointmentId]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !appointmentId) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Only PDF, JPG, and PNG files are allowed");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be less than 5MB");
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `prescription_${appointmentId}_${Date.now()}.${fileExt}`;
            const filePath = `prescriptions/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('prescriptions')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('prescriptions')
                .getPublicUrl(filePath);

            setPrescriptionFileUrl(publicUrl);
            setPrescriptionType("file");
            setHasUnsavedChanges(true);
            toast.success("Prescription file uploaded");
        } catch (error) {
            console.error("Upload failed:", error);
            toast.error("Failed to upload file");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = () => {
        setPrescriptionFileUrl(null);
        setPrescriptionType("text");
        setHasUnsavedChanges(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (!appointmentId) {
            toast.error("No appointment ID - cannot save");
            return;
        }

        setSaving(true);
        try {
            // Use raw supabase update to include new fields
            const updateData: any = {
                notes,
                diagnosis,
                prescription_type: prescriptionType,
                updated_at: new Date().toISOString()
            };

            if (prescriptionType === "file") {
                updateData.prescription_file_url = prescriptionFileUrl;
                updateData.prescription = null; // Clear text prescription
            } else {
                updateData.prescription = prescription;
                updateData.prescription_file_url = null; // Clear file prescription
            }

            const { error } = await (supabase as any)
                .from('appointments')
                .update(updateData)
                .eq('id', appointmentId);

            if (error) throw error;

            toast.success("Saved successfully");
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Save failed:", error);
            toast.error("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleComplete = async () => {
        if (!appointmentId) {
            toast.error("No appointment ID - cannot complete");
            return;
        }

        setCompleting(true);
        try {
            // Save all data and expire video link
            const updateData: any = {
                notes,
                diagnosis,
                status: AppointmentStatus.COMPLETED,
                actual_end_time: new Date().toISOString(),
                prescription_type: prescriptionType,
                // EXPIRE VIDEO LINK
                video_call_id: null,
                video_room_url: null,
                updated_at: new Date().toISOString()
            };

            if (prescriptionType === "file") {
                updateData.prescription_file_url = prescriptionFileUrl;
                updateData.prescription = null;
            } else {
                updateData.prescription = prescription;
                updateData.prescription_file_url = null;
            }

            const { error } = await (supabase as any)
                .from('appointments')
                .update(updateData)
                .eq('id', appointmentId);

            if (error) throw error;

            toast.success("Consultation completed!");
            onComplete?.();
        } catch (error) {
            console.error("Complete failed:", error);
            toast.error("Failed to complete consultation");
        } finally {
            setCompleting(false);
        }
    };

    const handleFieldChange = (field: "notes" | "prescription" | "diagnosis", value: string) => {
        setHasUnsavedChanges(true);
        switch (field) {
            case "notes":
                setNotes(value);
                break;
            case "prescription":
                setPrescription(value);
                setPrescriptionType("text");
                break;
            case "diagnosis":
                setDiagnosis(value);
                break;
        }
    };

    const tabs = [
        { id: "notes" as TabType, label: "Notes", icon: FileText },
        { id: "prescription" as TabType, label: "Rx", icon: Pill },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <h3 className="text-white font-semibold text-lg">Patient Information</h3>
                <p className="text-gray-400 text-sm">Session Details</p>
                {callId && (
                    <p className="text-gray-500 text-[10px] font-mono mt-1">ID: {callId.slice(-6)}</p>
                )}
            </div>

            {/* Patient Info */}
            <div className="p-4 border-b border-gray-700 space-y-3">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Name</label>
                    <p className="text-white text-lg font-medium">{patientName || "Unknown Patient"}</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Symptoms</label>
                    <p className="text-gray-300 text-sm">{patientSymptoms || "Not provided"}</p>
                </div>
            </div>

            {/* Diagnosis Field */}
            <div className="p-4 border-b border-gray-700">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Diagnosis
                </label>
                <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => handleFieldChange("diagnosis", e.target.value)}
                    placeholder="Enter diagnosis..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? "text-teal-400 border-b-2 border-teal-400 bg-gray-800/50"
                            : "text-gray-400 hover:text-gray-300"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-4 overflow-y-auto">
                {activeTab === "notes" && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                            Consultation Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => handleFieldChange("notes", e.target.value)}
                            placeholder="Document your consultation notes here..."
                            className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                    </div>
                )}

                {activeTab === "prescription" && (
                    <div className="space-y-4">
                        {/* Text Prescription */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                Write Prescription
                            </label>
                            <textarea
                                value={prescription}
                                onChange={(e) => handleFieldChange("prescription", e.target.value)}
                                placeholder="Write prescription here...&#10;&#10;Example:&#10;1. Paracetamol 500mg - 1 tablet, 3 times daily&#10;2. Vitamin C - 1 tablet daily"
                                className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono"
                                disabled={prescriptionType === "file" && prescriptionFileUrl !== null}
                            />
                        </div>

                        {/* OR Divider */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gray-700"></div>
                            <span className="text-xs text-gray-500 uppercase">or upload file</span>
                            <div className="flex-1 h-px bg-gray-700"></div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="prescription-file"
                            />

                            {prescriptionFileUrl ? (
                                <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                                    <File className="w-5 h-5 text-teal-400" />
                                    <span className="flex-1 text-sm text-gray-300 truncate">
                                        Prescription uploaded
                                    </span>
                                    <a
                                        href={prescriptionFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-teal-400 hover:underline"
                                    >
                                        View
                                    </a>
                                    <button
                                        onClick={handleRemoveFile}
                                        className="p-1 text-gray-400 hover:text-red-400"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor="prescription-file"
                                    className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-teal-500 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''
                                        }`}
                                >
                                    {uploading ? (
                                        <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                                    ) : (
                                        <Upload className="w-5 h-5 text-gray-400" />
                                    )}
                                    <span className="text-sm text-gray-400">
                                        {uploading ? "Uploading..." : "Upload PDF or Image"}
                                    </span>
                                </label>
                            )}
                            <p className="text-[10px] text-gray-500 text-center">
                                Max 5MB • PDF, JPG, PNG
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-700 space-y-2">
                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedChanges}
                    className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${hasUnsavedChanges && !saving
                        ? "bg-gray-700 hover:bg-gray-600 text-white"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        }`}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {saving ? "Saving..." : "Save Changes"}
                </button>

                {/* Complete Button */}
                <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                    {completing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <CheckCircle className="w-4 h-4" />
                    )}
                    {completing ? "Completing..." : "Complete Consultation"}
                </button>
            </div>
        </div>
    );
}
