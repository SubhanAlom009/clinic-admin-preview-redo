/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { X, Receipt } from "lucide-react";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddBillModal({
  isOpen,
  onClose,
  onSuccess,
}: AddBillModalProps) {
  const [formData, setFormData] = useState({
    clinic_patient_id: "",
    amount: "",
    tax_amount: "",
    due_date: "",
    notes: "", // REMOVED service_description, only use notes
  });
  const [clinicPatients, setClinicPatients] = useState<
    Array<{ id: string; patient_profile?: any }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchPatients = async () => {
      console.log("Fetching clinic_patients for user:", user.id);

      // Get clinic profile for the current user (clinic owner)
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        console.error("No clinic profile found for user:", user.id);
        return;
      }

      console.log("Found clinic profile:", clinicProfile.id);

      const res = await (supabase as unknown as any)
        .from("clinic_patients")
        .select(
          `id, patient_profile:patient_profiles(id, full_name, phone, email)`
        )
        .eq("clinic_id", clinicProfile.id)
        .order("created_at", { ascending: false });

      const data = res.data;
      const error = res.error;

      if (error) {
        console.error("Error fetching clinic patients:", error);
      } else {
        console.log("Clinic patients fetched:", data);
        setClinicPatients((data as unknown as Array<any>) || []);
      }
    };

    fetchPatients();
  }, [user, isOpen]);

  const generateBillNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `INV-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const amount = parseFloat(formData.amount);
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const totalAmount = amount + taxAmount;

      // FIXED: Only use columns that actually exist in the database
      const billData = {
        user_id: user.id,
        clinic_patient_id: formData.clinic_patient_id || null,
        bill_number: generateBillNumber(),
        amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        due_date: formData.due_date || null,
        notes: formData.notes || null, // Only use notes field
        status: "pending",
      };

      console.log("Creating bill with data:", billData);

      const res = await (supabase as unknown as any)
        .from("bills")
        .insert(billData)
        .select()
        .single();

      const billResult = res.data;
      const error = res.error;

      if (error) {
        console.error("Bill creation error:", error);
        throw error;
      }

      console.log("Bill created successfully:", billResult);

      // Create notification
      const patient = clinicPatients.find(
        (p) => p.id === formData.clinic_patient_id
      );
      await (supabase as unknown as any).from("notifications").insert({
        user_id: user.id,
        type: "payment",
        title: "Bill Generated",
        message: `Bill generated for ${
          patient?.patient_profile?.full_name
        } - ₹${totalAmount.toFixed(2)}`,
        priority: "normal",
      });

      onSuccess?.();
      onClose();
      setFormData({
        clinic_patient_id: "",
        amount: "",
        tax_amount: "",
        due_date: "",
        notes: "",
      });
    } catch (err: unknown) {
      console.error("Error in handleSubmit:", err);
      setError((err as any)?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const totalAmount =
    (parseFloat(formData.amount) || 0) + (parseFloat(formData.tax_amount) || 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center">
            <Receipt className="h-6 w-6 mr-2 text-blue-600" />
            Generate New Bill
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient *
              </label>
              <select
                name="clinic_patient_id"
                value={formData.clinic_patient_id}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a patient</option>
                {clinicPatients.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.patient_profile?.full_name} -{" "}
                    {cp.patient_profile?.phone}
                  </option>
                ))}
              </select>
              {clinicPatients.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No patients found. Make sure you have added patients first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter bill amount"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount
              </label>
              <input
                type="number"
                name="tax_amount"
                step="0.01"
                min="0"
                value={formData.tax_amount}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter tax amount (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                min={new Date().toISOString().split("T")[0]}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {totalAmount > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-blue-700">
                    Amount: ₹{parseFloat(formData.amount || "0").toFixed(2)}
                  </p>
                  {parseFloat(formData.tax_amount || "0") > 0 && (
                    <p className="text-sm text-blue-700">
                      Tax: ₹{parseFloat(formData.tax_amount || "0").toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-lg font-semibold text-blue-900">
                  Total: ₹{totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Service Description
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes or service description (e.g., Consultation, X-Ray, Blood Test)"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading || !formData.clinic_patient_id || !formData.amount
              }
            >
              {loading ? "Generating..." : "Generate Bill"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
