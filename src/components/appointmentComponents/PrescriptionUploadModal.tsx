import React, { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Upload, FileText, X, CheckCircle, AlertCircle, Image, File, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { AppointmentService } from "../../services/AppointmentService";
import { AppointmentStatus } from "../../constants";
import type { AppointmentWithRelations } from "../../services/AppointmentService";

interface PrescriptionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithRelations | null;
  onSuccess: () => void;
}

interface PrescriptionFile {
  file: File;
  url?: string;
  type: 'image' | 'pdf';
  name: string;
}

interface PrescriptionData {
  files: PrescriptionFile[];
  diagnosis?: string;
  notes?: string;
  followUpDate?: string;
}

export function PrescriptionUploadModal({
  isOpen,
  onClose,
  appointment,
  onSuccess,
}: PrescriptionUploadModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prescriptionData, setPrescriptionData] = useState<PrescriptionData>({
    files: [],
    diagnosis: "",
    notes: "",
    followUpDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (prescriptionData.files.length === 0) {
      newErrors.files = "At least one prescription file is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles: PrescriptionFile[] = [];

    files.forEach((file) => {
      // Check file type
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      
      if (!isImage && !isPDF) {
        toast.error(`File ${file.name} is not supported. Please upload images or PDFs only.`);
        return;
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      validFiles.push({
        file,
        type: isImage ? 'image' : 'pdf',
        name: file.name,
      });
    });

    if (validFiles.length > 0) {
      setPrescriptionData(prev => ({
        ...prev,
        files: [...prev.files, ...validFiles]
      }));
      toast.success(`${validFiles.length} file(s) added successfully`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setPrescriptionData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const uploadFiles = async (): Promise<string[]> => {
    const uploadPromises = prescriptionData.files.map(async (prescriptionFile) => {
      const fileExt = prescriptionFile.file.name.split('.').pop();
      const fileName = `${appointment?.id}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `prescriptions/${fileName}`;

      const { data, error } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, prescriptionFile.file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('prescriptions')
        .getPublicUrl(filePath);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async () => {
    if (!appointment || !validateForm()) {
      return;
    }

    setLoading(true);
    setUploading(true);
    try {
      // Upload prescription files first
      const uploadedUrls = await uploadFiles();
      
      // Create prescription data as JSON string with file URLs
      const prescriptionDataJson = JSON.stringify({
        files: uploadedUrls.map((url, index) => ({
          url,
          name: prescriptionData.files[index].name,
          type: prescriptionData.files[index].type,
        })),
        diagnosis: prescriptionData.diagnosis,
        notes: prescriptionData.notes,
        followUpDate: prescriptionData.followUpDate,
        uploadedAt: new Date().toISOString(),
      });

      // Update appointment with prescription files and mark as completed
      const { error } = await AppointmentService.updateAppointment(
        appointment.id,
        {
          status: AppointmentStatus.COMPLETED,
          actual_end_time: new Date().toISOString(),
          prescription: prescriptionDataJson,
          diagnosis: prescriptionData.diagnosis || undefined,
          notes: prescriptionData.notes || undefined,
        }
      );

      if (error) throw error;

      toast.success("Appointment completed successfully with prescription files!");
      onSuccess();
      onClose();
      
      // Reset form
      setPrescriptionData({
        files: [],
        diagnosis: "",
        notes: "",
        followUpDate: "",
      });
      setErrors({});
    } catch (error) {
      console.error("Error completing appointment:", error);
      toast.error("Failed to complete appointment. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setPrescriptionData({
        files: [],
        diagnosis: "",
        notes: "",
        followUpDate: "",
      });
      setErrors({});
    }
  };

  if (!appointment) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Complete Appointment" size="lg">
      <div className="p-6">
        {/* Header with appointment info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Complete Appointment
          </h3>
          <div className="text-blue-700 space-y-1">
            <p>
              <strong>Patient:</strong> {appointment.clinic_patient?.patient_profile?.full_name}
            </p>
            <p>
              <strong>Doctor:</strong> Dr. {appointment.clinic_doctor?.doctor_profile?.full_name}
            </p>
            <p>
              <strong>Time:</strong> {new Date(appointment.appointment_datetime).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Prescription Upload Section */}
        <div className="space-y-6">
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
              <h4 className="font-medium text-yellow-800">
                Prescription Files Required
              </h4>
            </div>
            <p className="text-sm text-yellow-700">
              You must upload prescription files (images or PDFs) before completing this appointment.
            </p>
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prescription Files <span className="text-red-500">*</span>
            </label>
            
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <div className="p-3 bg-purple-50 rounded-full mb-4">
                    <Upload className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Upload Prescription Files
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Drag and drop files here, or click to select
                </p>
                <Button
                  type="button"

                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
                <p className="text-xs text-gray-400 mt-2">
                  Supported: Images (JPG, PNG, GIF) and PDFs. Max 10MB per file.
                </p>
              </div>
            </div>

            {/* Uploaded Files List */}
            {prescriptionData.files.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Uploaded Files ({prescriptionData.files.length})
                </h4>
                <div className="space-y-2">
                  {prescriptionData.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        {file.type === 'image' ? (
                          <Image className="h-5 w-5 text-blue-500 mr-2" />
                        ) : (
                          <File className="h-5 w-5 text-red-500 mr-2" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({Math.round(file.file.size / 1024)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.files && (
              <p className="mt-2 text-sm text-red-600">{errors.files}</p>
            )}
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diagnosis
            </label>
            <textarea
              value={prescriptionData.diagnosis}
              onChange={(e) =>
                setPrescriptionData({
                  ...prescriptionData,
                  diagnosis: e.target.value,
                })
              }
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter diagnosis or medical findings..."
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={prescriptionData.notes}
              onChange={(e) =>
                setPrescriptionData({
                  ...prescriptionData,
                  notes: e.target.value,
                })
              }
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any additional notes or recommendations..."
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Follow-up Date (Optional)
            </label>
            <input
              type="date"
              value={prescriptionData.followUpDate}
              onChange={(e) =>
                setPrescriptionData({
                  ...prescriptionData,
                  followUpDate: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || prescriptionData.files.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {uploading ? "Uploading files..." : "Completing..."}
              </div>
            ) : (
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Appointment
              </div>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
