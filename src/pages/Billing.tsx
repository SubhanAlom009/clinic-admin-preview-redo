import { useState, useEffect } from "react";
import {
  Receipt,
  Search,
  Download,
  Eye,
  CreditCard,
  User,
  Calendar,
  Clock,
} from "lucide-react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card, CardContent } from "../components/ui/Card";
import { AddBillModal } from "../components/billComponents/AddBillModal";
import { BillViewModal } from "../components/billComponents/ViewBillModal"; // ADD THIS IMPORT
import { downloadBillAsHTML } from "../utils/downloadUtil"; // ADD THIS IMPORT
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import type { BillWithRelations } from "../types/database";
import { format } from "date-fns";

export function Billing() {
  const [bills, setBills] = useState<BillWithRelations[]>([]);
  const [filteredBills, setFilteredBills] = useState<BillWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<BillWithRelations | null>(
    null
  );
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const { user } = useAuth();
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchBills = async () => {
      // First get the clinic profile to get the clinic_id
      const { data: clinicProfile } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("id", user.id)
        .single() as { data: { id: string } | null, error: any };

      if (!clinicProfile) {
        console.error("No clinic profile found for user:", user.id);
        setLoading(false);
        return;
      }

      console.log("Fetching bills for clinic:", clinicProfile.id);

      const { data, error } = await supabase
        .from("bills")
        .select(
          `
          *,
          clinic_patient:clinic_patients!inner(
            id,
            clinic_id,
            patient_profile:patient_profiles(
              id,
              full_name,
              phone,
              email,
              primary_address
            )
          )
        `
        )
        .eq("clinic_patient.clinic_id", clinicProfile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching bills:", error);
      }

      if (data) {
        console.log("Bills fetched:", data.length);
        // ensure data conforms to BillWithRelations shape at runtime
        setBills(data as unknown as BillWithRelations[]);
        setFilteredBills(data as unknown as BillWithRelations[]);
      }
      setLoading(false);
    };

    fetchBills();

    // Real-time subscription
    const subscription = supabase
      .channel("bills")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Bills table changed, refetching...");
          fetchBills();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    let filtered = bills;

    if (searchTerm) {
      filtered = filtered.filter((bill) => {
        const profileName = bill.clinic_patient?.patient_profile?.full_name;
        return (
          profileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (statusFilter) {
      filtered = filtered.filter((bill) => bill.status === statusFilter);
    }

    setFilteredBills(filtered);
  }, [searchTerm, statusFilter, bills]);

  const handleViewBill = (bill: BillWithRelations) => {
    console.log("Viewing bill:", bill.bill_number);
    setSelectedBill(bill);
    setIsViewModalOpen(true);
  };

  const handleDownloadBill = (bill: BillWithRelations) => {
    downloadBillAsHTML(bill);
  };

  const updatePaymentStatus = async (
    id: string,
    status: string,
    paymentMode?: string
  ) => {
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...(status === "paid" && {
        payment_date: new Date().toISOString(),
        ...(paymentMode && { payment_mode: paymentMode }),
      }),
    };

    const { error } = await (supabase as any)
      .from("bills")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      alert("Error updating payment: " + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "partially_paid":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalRevenue = bills
    .filter((bill) => bill.status === "paid")
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  const pendingAmount = bills
    .filter((bill) => bill.status === "pending" || bill.status === "overdue")
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Billing & Payments
          </h1>
          <p className="text-gray-600 mt-1">
            Manage invoices and track payments
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="mt-4 sm:mt-0"
        >
          <Receipt className="h-5 w-5 mr-2" />
          Generate Bill
        </Button>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-green-600">
                  ₹{totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Receipt className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Amount</p>
                <p className="text-3xl font-bold text-red-600">
                  ₹{pendingAmount.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <Clock className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by patient name or bill number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              label=""
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "pending", label: "Pending" },
                { value: "paid", label: "Paid" },
                { value: "overdue", label: "Overdue" },
                { value: "partially_paid", label: "Partially Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      <div className="space-y-4">
        {filteredBills.map((bill) => (
          <Card
            key={bill.id}
            className="hover:shadow-md transition-shadow duration-200"
          >
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {bill.bill_number}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        bill.status || "pending"
                      )}`}
                    >
                      {(bill.status || "pending")
                        .replace("_", " ")
                        .toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      {bill.clinic_patient?.patient_profile?.full_name ||
                        "Unknown Patient"}
                    </div>
                    <div className="flex items-center">
                      <Receipt className="h-4 w-4 mr-1" />₹
                      {bill.total_amount.toFixed(2)}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(bill.created_at), "MMM d, yyyy")}
                    </div>
                    {bill.due_date && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Due: {format(new Date(bill.due_date), "MMM d, yyyy")}
                      </div>
                    )}
                  </div>

                  {bill.payment_mode && bill.payment_date && (
                    <div className="text-sm text-green-600">
                      Paid via {bill.payment_mode.toUpperCase()} on{" "}
                      {format(new Date(bill.payment_date), "MMM d, yyyy")}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 mt-4 lg:mt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewBill(bill)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {bill.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        updatePaymentStatus(bill.id, "paid", "cash")
                      }
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      Mark Paid
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadBill(bill)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Bills Found Section */}
      {filteredBills.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <Receipt className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No bills found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter
                ? "Try adjusting your search criteria"
                : "Get started by generating your first bill"}
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Receipt className="h-5 w-5 mr-2" />
              Generate Bill
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <AddBillModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* View Modal */}
      {isViewModalOpen && selectedBill && (
        <BillViewModal
          bill={selectedBill}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedBill(null);
          }}
          onDownload={handleDownloadBill}
        />
      )}
    </div>
  );
}
