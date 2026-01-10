import { useState, useEffect, useRef } from "react";
import { FileText, Pill, Stethoscope, CheckCircle, Loader2, Save, Upload, File, X, Plus, Trash2, User, AlertTriangle, Activity, FileDown } from "lucide-react";
import { AppointmentStatus } from "../../constants";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { downloadPrescriptionPDF, generatePrescriptionPDF } from "../../utils/generatePrescriptionPDF";

interface ConsultationSidebarProps {
    appointmentId?: string;
    patientName: string;
    patientSymptoms: string;
    onComplete?: () => void;
}

interface PatientInfo {
    fullName: string;
    dateOfBirth: string | null;
    gender: "male" | "female" | "other" | null;
    bloodGroup: string | null;
    allergies: string[] | null;
    chronicConditions: string[] | null;
    currentMedications: string[] | null;
    medicalNotes: string | null;
    phone: string | null;
    heightCm: number | null;
    weightKg: number | null;
    maritalStatus: string | null;
}

interface Medicine {
    id: string;
    name: string;
    dosage: string;
}

interface ClinicInfo {
    clinicName: string;
    address: string;
    phone: string;
}

interface DoctorInfo {
    fullName: string;
    qualification: string;
    registrationNumber: string;
    signatureUrl: string | null;
}

type TabType = "clinical" | "notes";

// Removed AccordionHeader - using tabs now

export function ConsultationSidebar({
    appointmentId,
    patientName,
    patientSymptoms,
    onComplete
}: ConsultationSidebarProps) {
    const [activeTab, setActiveTab] = useState<TabType>("clinical");

    const [notes, setNotes] = useState("");
    const [prescription, setPrescription] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [symptoms, setSymptoms] = useState("");
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [prescriptionFileUrl, setPrescriptionFileUrl] = useState<string | null>(null);
    const [prescriptionType, setPrescriptionType] = useState<"text" | "file">("text");
    const [saving, setSaving] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
    const [loadingPatient, setLoadingPatient] = useState(true);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [clinicInfo, setClinicInfo] = useState<ClinicInfo | null>(null);
    const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const calculateAge = (dob: string | null): string => {
        if (!dob) return "N/A";
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return `${age} years`;
    };


    // Medicine update handlers - using functional updates to prevent stale closures
    const updateMedicineName = (index: number, value: string) => {
        setMedicines(prev => {
            const newMeds = [...prev];
            newMeds[index] = { ...newMeds[index], name: value };
            return newMeds;
        });
        setHasUnsavedChanges(true);
    };

    const updateMedicineDosage = (index: number, value: string) => {
        setMedicines(prev => {
            const newMeds = [...prev];
            newMeds[index] = { ...newMeds[index], dosage: value };
            return newMeds;
        });
        setHasUnsavedChanges(true);
    };

    const removeMedicine = (index: number) => {
        setMedicines(prev => prev.filter((_, i) => i !== index));
        setHasUnsavedChanges(true);
    };

    const addMedicine = () => {
        setMedicines(prev => [...prev, { id: `med-${Date.now()}`, name: "", dosage: "" }]);
        setHasUnsavedChanges(true);
    };

    useEffect(() => {
        const loadAppointmentData = async () => {
            if (!appointmentId) {
                setLoadingPatient(false);
                return;
            }

            setLoadingPatient(true);
            try {
                const { data: appointmentData, error } = await (supabase as any)
                    .from('appointments')
                    .select(`
                        *,
                        clinic_patient:clinic_patients(
                            *,
                            patient_profile:patient_profiles(
                                id, full_name, phone, email, date_of_birth, gender, 
                                blood_group, allergies, chronic_conditions, medications, medical_notes,
                                height_cm, weight_kg, marital_status
                            ),
                            clinic:clinic_profiles(
                                id, clinic_name, primary_address, contact_phone
                            )
                        ),
                        clinic_doctor:clinic_doctors(
                            *,
                            doctor_profiles(
                                id, full_name, primary_specialization, qualifications, medical_license_number, license_number, signature_url
                            )
                        )
                    `)
                    .eq('id', appointmentId)
                    .single();

                if (error) throw error;

                if (appointmentData) {
                    setNotes(appointmentData.notes || "");
                    setPrescription(appointmentData.prescription || "");
                    setDiagnosis(appointmentData.diagnosis || "");
                    setSymptoms(appointmentData.symptoms_documented || "");

                    if (appointmentData.medicines) {
                        try {
                            const parsedMedicines = typeof appointmentData.medicines === 'string'
                                ? JSON.parse(appointmentData.medicines)
                                : appointmentData.medicines;
                            setMedicines(parsedMedicines || []);
                        } catch {
                            setMedicines([]);
                        }
                    }

                    if (appointmentData.prescription_file_url) {
                        setPrescriptionFileUrl(appointmentData.prescription_file_url);
                        setPrescriptionType("file");
                    } else if (appointmentData.prescription) {
                        setPrescriptionType("text");
                    }

                    const pp = appointmentData.clinic_patient?.patient_profile;
                    if (pp) {
                        setPatientInfo({
                            fullName: pp.full_name || patientName,
                            dateOfBirth: pp.date_of_birth,
                            gender: pp.gender,
                            bloodGroup: pp.blood_group,
                            allergies: pp.allergies,
                            chronicConditions: pp.chronic_conditions,
                            currentMedications: pp.medications,
                            medicalNotes: pp.medical_notes,
                            phone: pp.phone,
                            heightCm: pp.height_cm,
                            weightKg: pp.weight_kg,
                            maritalStatus: pp.marital_status,
                        });
                    }

                    // Extract clinic info
                    const clinic = appointmentData.clinic_patient?.clinic;
                    if (clinic) {
                        const addr = clinic.primary_address;
                        const addressStr = addr ? [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ') : '';
                        setClinicInfo({
                            clinicName: clinic.clinic_name || 'Clinic',
                            address: addressStr,
                            phone: clinic.contact_phone || '',
                        });
                    }

                    // Extract doctor info
                    console.log('Appointment data:', appointmentData);
                    console.log('clinic_doctor:', appointmentData.clinic_doctor);
                    const docProfile = appointmentData.clinic_doctor?.doctor_profiles;
                    console.log('doctor_profiles:', docProfile);
                    if (docProfile) {
                        // qualifications is an array, join it
                        const qualStr = Array.isArray(docProfile.qualifications)
                            ? docProfile.qualifications.join(', ')
                            : docProfile.qualifications || '';
                        setDoctorInfo({
                            fullName: `Dr. ${docProfile.full_name || 'Doctor'}`,
                            qualification: docProfile.primary_specialization || qualStr || 'General Physician',
                            registrationNumber: docProfile.medical_license_number || docProfile.license_number || '',
                            signatureUrl: docProfile.signature_url || null,
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to load appointment data:", error);
            } finally {
                setLoadingPatient(false);
            }
        };

        loadAppointmentData();
    }, [appointmentId, patientName]);

    const handleGeneratePDF = async () => {
        if (!appointmentId) {
            toast.error("No appointment ID");
            return;
        }

        if (!diagnosis && medicines.length === 0) {
            toast.error("Please add diagnosis or medicines before generating PDF");
            return;
        }

        setGeneratingPDF(true);
        try {
            // Prepare prescription data
            const prescriptionData = {
                patientName: patientInfo?.fullName || patientName || 'Patient',
                patientAge: patientInfo?.dateOfBirth ? calculateAge(patientInfo.dateOfBirth) : 'N/A',
                patientGender: patientInfo?.gender ? patientInfo.gender.charAt(0).toUpperCase() + patientInfo.gender.slice(1) : 'N/A',
                patientHeight: patientInfo?.heightCm ? String(patientInfo.heightCm) : undefined,
                patientWeight: patientInfo?.weightKg ? String(patientInfo.weightKg) : undefined,
                symptoms: symptoms,
                diagnosis: diagnosis,
                medicines: medicines,
                prescriptionNotes: prescription,
                doctorName: doctorInfo?.fullName || 'Doctor',
                doctorQualification: doctorInfo?.qualification || '',
                doctorRegistration: doctorInfo?.registrationNumber || '',
                doctorSignatureUrl: doctorInfo?.signatureUrl || null,
                clinicName: clinicInfo?.clinicName || 'Clinic',
                clinicAddress: clinicInfo?.address || '',
                clinicPhone: clinicInfo?.phone || '',
                appointmentDate: new Date().toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                appointmentId: appointmentId,
            };

            // Download locally for preview
            await downloadPrescriptionPDF(prescriptionData, `prescription-${appointmentId.slice(0, 8)}.pdf`);

            toast.success("PDF downloaded! Will be uploaded when you complete the consultation.");
        } catch (error) {
            console.error("PDF generation failed:", error);
            toast.error("Failed to generate PDF");
        } finally {
            setGeneratingPDF(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !appointmentId) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Only PDF, JPG, and PNG files are allowed");
            return;
        }

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
            const updateData: any = {
                notes,
                diagnosis,
                symptoms_documented: symptoms,
                medicines: JSON.stringify(medicines),
                prescription_type: prescriptionType,
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
            const updateData: any = {
                notes,
                diagnosis,
                symptoms_documented: symptoms,
                medicines: JSON.stringify(medicines),
                status: AppointmentStatus.COMPLETED,
                actual_end_time: new Date().toISOString(),
                prescription_type: prescriptionType,
                video_call_id: null,
                video_room_url: null,
                updated_at: new Date().toISOString()
            };

            // If we have diagnosis or medicines, generate and upload PDF
            if (diagnosis || medicines.length > 0) {
                const prescriptionData = {
                    patientName: patientInfo?.fullName || patientName || 'Patient',
                    patientAge: patientInfo?.dateOfBirth ? calculateAge(patientInfo.dateOfBirth) : 'N/A',
                    patientGender: patientInfo?.gender ? patientInfo.gender.charAt(0).toUpperCase() + patientInfo.gender.slice(1) : 'N/A',
                    patientHeight: patientInfo?.heightCm ? String(patientInfo.heightCm) : undefined,
                    patientWeight: patientInfo?.weightKg ? String(patientInfo.weightKg) : undefined,
                    symptoms: symptoms,
                    diagnosis: diagnosis,
                    medicines: medicines,
                    prescriptionNotes: prescription,
                    doctorName: doctorInfo?.fullName || 'Doctor',
                    doctorQualification: doctorInfo?.qualification || '',
                    doctorRegistration: doctorInfo?.registrationNumber || '',
                    doctorSignatureUrl: doctorInfo?.signatureUrl || null,
                    clinicName: clinicInfo?.clinicName || 'Clinic',
                    clinicAddress: clinicInfo?.address || '',
                    clinicPhone: clinicInfo?.phone || '',
                    appointmentDate: new Date().toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }),
                    appointmentId: appointmentId,
                };

                // Generate PDF blob
                const pdfBlob = await generatePrescriptionPDF(prescriptionData);

                // Upload to Supabase
                const fileName = `rx-${appointmentId}.pdf`;
                const filePath = `prescriptions/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('prescriptions')
                    .upload(filePath, pdfBlob, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                if (!uploadError) {
                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('prescriptions')
                        .getPublicUrl(filePath);

                    updateData.prescription_file_url = publicUrl;
                    updateData.prescription_type = 'file';
                } else {
                    console.error("PDF upload error:", uploadError);
                    // Continue with completion even if PDF upload fails
                }
            } else if (prescriptionType === "file") {
                updateData.prescription_file_url = prescriptionFileUrl;
                updateData.prescription = null;
            } else {
                updateData.prescription = prescription;
            }

            const { error } = await (supabase as any)
                .from('appointments')
                .update(updateData)
                .eq('id', appointmentId);

            if (error) throw error;

            toast.success("Consultation completed! Prescription uploaded.");
            onComplete?.();
        } catch (error) {
            console.error("Complete failed:", error);
            toast.error("Failed to complete consultation");
        } finally {
            setCompleting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Fixed Patient Info Section */}
            <div className="p-4 bg-gray-900 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold text-lg">{patientInfo?.fullName || patientName || "Patient"}</span>
                    {loadingPatient && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
                </div>

                {/* Basic info row */}
                <div className="text-base text-gray-300 space-y-1">
                    <div className="flex flex-wrap gap-x-4">
                        {patientInfo?.dateOfBirth && <span>{calculateAge(patientInfo.dateOfBirth)}</span>}
                        {patientInfo?.gender && <span className="capitalize">{patientInfo.gender}</span>}
                        {patientInfo?.bloodGroup && <span>{patientInfo.bloodGroup}</span>}
                        {patientInfo?.maritalStatus && <span className="capitalize">{patientInfo.maritalStatus}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4">
                        <span>Height: {patientInfo?.heightCm ? `${patientInfo.heightCm} cm` : 'N/A'}</span>
                        <span>Weight: {patientInfo?.weightKg ? `${patientInfo.weightKg} kg` : 'N/A'}</span>
                    </div>
                    {patientSymptoms && (
                        <div className="mt-1">
                            <span className="text-gray-500">Symptoms:</span> {patientSymptoms}
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-700 bg-gray-900">
                <button
                    onClick={() => setActiveTab("clinical")}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${activeTab === "clinical"
                        ? "text-teal-400 border-b-2 border-teal-400 bg-gray-800/50"
                        : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Stethoscope className="w-4 h-4" />
                        Clinical
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab("notes")}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${activeTab === "notes"
                        ? "text-teal-400 border-b-2 border-teal-400 bg-gray-800/50"
                        : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4" />
                        Notes
                    </div>
                </button>
            </div>

            {/* Tab Content - Scrollable */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {activeTab === "clinical" ? (
                    <div className="p-4 space-y-4">
                        {/* Symptoms Section */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Symptoms Found</label>
                            <textarea
                                value={symptoms}
                                onChange={(e) => { setSymptoms(e.target.value); setHasUnsavedChanges(true); }}
                                placeholder="Document symptoms observed during consultation..."
                                className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        {/* Diagnosis Section */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Diagnosis</label>
                            <input
                                type="text"
                                value={diagnosis}
                                onChange={(e) => { setDiagnosis(e.target.value); setHasUnsavedChanges(true); }}
                                placeholder="Enter diagnosis..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        {/* Prescription / Medicines Section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Medicines</label>
                                <button
                                    onClick={addMedicine}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors duration-200"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Medicine
                                </button>
                            </div>
                            {medicines.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed border-gray-700 rounded-lg">
                                    No medicines added yet
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {medicines.map((med, index) => (
                                        <div key={med.id} className="flex gap-2 items-center bg-gray-800 p-3 rounded-lg border border-gray-700">
                                            <span className="text-xs text-gray-500 w-5 font-medium flex-shrink-0">{index + 1}.</span>
                                            <input
                                                type="text"
                                                value={med.name}
                                                onChange={(e) => updateMedicineName(index, e.target.value)}
                                                placeholder="Medicine + strength"
                                                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                                            />
                                            <input
                                                type="text"
                                                value={med.dosage}
                                                onChange={(e) => updateMedicineDosage(index, e.target.value)}
                                                placeholder="Dosage"
                                                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                                            />
                                            <button
                                                onClick={() => removeMedicine(index)}
                                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* PDF Actions - Only in Clinical Tab */}
                        <div className="pt-3 border-t border-gray-700 space-y-2">
                            {/* Upload PDF */}
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".pdf"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                {prescriptionFileUrl ? (
                                    <div className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <File className="w-4 h-4 text-teal-400" />
                                            <span className="text-sm text-gray-300 truncate">PDF Uploaded</span>
                                        </div>
                                        <button
                                            onClick={handleRemoveFile}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading || !!(diagnosis || medicines.length > 0)}
                                        className={`w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${(diagnosis || medicines.length > 0) ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                Upload PDF Prescription
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Generate PDF */}
                            <button
                                onClick={handleGeneratePDF}
                                disabled={generatingPDF || (!diagnosis && medicines.length === 0) || !!prescriptionFileUrl}
                                className={`w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${((!diagnosis && medicines.length === 0) || prescriptionFileUrl)
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                    : generatingPDF
                                        ? "bg-purple-700 text-white"
                                        : "bg-purple-600 hover:bg-purple-700 text-white"
                                    }`}
                            >
                                {generatingPDF ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <FileDown className="w-4 h-4" />
                                        Generate PDF Prescription
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4">
                        {/* Notes Tab Content */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Notes / Instructions</label>
                            <textarea
                                value={notes}
                                onChange={(e) => { setNotes(e.target.value); setHasUnsavedChanges(true); }}
                                placeholder="Add consultation notes, follow-up instructions, or any other relevant information..."
                                className="w-full h-64 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons - Fixed at bottom (Global - visible on both tabs) */}
            <div className="p-4 border-t border-gray-700 space-y-3 bg-gray-900">
                <button
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedChanges}
                    className={`w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 ${hasUnsavedChanges && !saving
                        ? "bg-gray-700 hover:bg-gray-600 text-white"
                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                        }`}
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200"
                >
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {completing ? "Completing..." : "Complete Consultation"}
                </button>
            </div>
        </div>
    );
}


