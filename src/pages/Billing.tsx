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
  Video,
  Building,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Banknote,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { AddBillModal } from "../components/billComponents/AddBillModal";
import { BillViewModal } from "../components/billComponents/ViewBillModal";
import { downloadBillAsHTML } from "../utils/downloadUtil";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import type { BillWithRelations } from "../types/database";
import { format } from "date-fns";

type TabType = "all" | "video" | "in-clinic";

export function Billing() {
  const [bills, setBills] = useState<BillWithRelations[]>([]);
  const [filteredBills, setFilteredBills] = useState<BillWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<BillWithRelations | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const { user } = useAuth();

  const fetchBills = async () => {
    if (!user) return;

    const { data: clinicProfile } = await supabase
      .from("clinic_profiles")
      .select("id")
      .eq("id", user.id)
      .single() as { data: { id: string } | null; error: any };

    if (!clinicProfile) {
      console.error("No clinic profile found for user:", user.id);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bills")
      .select(`
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
        ),
        appointment:appointments(
          id,
          appointment_type,
          video_call_id,
          clinic_doctor:clinic_doctors(
            doctor_profile:doctor_profiles(full_name)
          )
        )
      `)
      .eq("clinic_patient.clinic_id", clinicProfile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bills:", error);
    }

    if (data) {
      setBills(data as unknown as BillWithRelations[]);
      setFilteredBills(data as unknown as BillWithRelations[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchBills();

    const subscription = supabase
      .channel("bills")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "bills",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchBills())
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    let filtered = bills;

    // Filter by tab (appointment type)
    if (activeTab === "video") {
      filtered = filtered.filter((bill) => {
        const apt = (bill as any).appointment;
        return apt?.appointment_type?.toLowerCase().includes("video") ||
          bill.bill_number?.startsWith("VC-");
      });
    } else if (activeTab === "in-clinic") {
      filtered = filtered.filter((bill) => {
        const apt = (bill as any).appointment;
        const isVideo = apt?.appointment_type?.toLowerCase().includes("video") ||
          bill.bill_number?.startsWith("VC-");
        return !isVideo;
      });
    }

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter((bill) => {
        const profileName = bill.clinic_patient?.patient_profile?.full_name;
        return (
          profileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bill.bill_number.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter((bill) => bill.status === statusFilter);
    }

    setFilteredBills(filtered);
  }, [searchTerm, statusFilter, bills, activeTab]);

  const handleViewBill = (bill: BillWithRelations) => {
    setSelectedBill(bill);
    setIsViewModalOpen(true);
  };

  const handleDownloadBill = (bill: BillWithRelations) => {
    downloadBillAsHTML(bill);
  };

  const updatePaymentStatus = async (id: string, status: string, paymentMode?: string) => {
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

  // Helper to determine if bill is video consultation
  const isVideoBill = (bill: BillWithRelations) => {
    const apt = (bill as any).appointment;
    return apt?.appointment_type?.toLowerCase().includes("video") ||
      bill.bill_number?.startsWith("VC-");
  };

  // Stats calculations
  const totalRevenue = bills
    .filter((bill) => bill.status === "paid")
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  const pendingAmount = bills
    .filter((bill) => bill.status === "pending" || bill.status === "overdue")
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  const videoRevenue = bills
    .filter((bill) => bill.status === "paid" && isVideoBill(bill))
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  const inClinicRevenue = bills
    .filter((bill) => bill.status === "paid" && !isVideoBill(bill))
    .reduce((sum, bill) => sum + bill.total_amount, 0);

  const videoBillsCount = bills.filter(isVideoBill).length;
  const inClinicBillsCount = bills.filter((b) => !isVideoBill(b)).length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing & Payments</h1>
          <p className="text-slate-500 mt-1">Manage invoices and track revenue</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <Button variant="outline" onClick={fetchBills} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Receipt className="h-4 w-4" />
            Generate Bill
          </Button>
        </div>
      </div>

      {/* Revenue Stats - 4 Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
              <p className="text-3xl font-bold mt-1">₹{totalRevenue.toLocaleString()}</p>
              <p className="text-emerald-200 text-xs mt-1">{bills.filter(b => b.status === "paid").length} paid bills</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Pending Amount */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold mt-1">₹{pendingAmount.toLocaleString()}</p>
              <p className="text-amber-200 text-xs mt-1">{bills.filter(b => b.status === "pending").length} awaiting</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Video Consultations Revenue */}
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-100 text-sm font-medium">Video Consults</p>
              <p className="text-3xl font-bold mt-1">₹{videoRevenue.toLocaleString()}</p>
              <p className="text-violet-200 text-xs mt-1">{videoBillsCount} consultations</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Video className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* In-Clinic Revenue */}
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">In-Clinic Visits</p>
              <p className="text-3xl font-bold mt-1">₹{inClinicRevenue.toLocaleString()}</p>
              <p className="text-blue-200 text-xs mt-1">{inClinicBillsCount} visits</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Building className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {[
              { id: "all", label: "All Bills", count: bills.length },
              { id: "video", label: "Video", count: videoBillsCount, icon: Video },
              { id: "in-clinic", label: "In-Clinic", count: inClinicBillsCount, icon: Building },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                  }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex-1 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search patient or bill number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200"
              />
            </div>
            <Select
              label=""
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Status" },
                { value: "pending", label: "⏳ Pending" },
                { value: "paid", label: "✅ Paid" },
                { value: "overdue", label: "⚠️ Overdue" },
                { value: "cancelled", label: "❌ Cancelled" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="space-y-3">
        {filteredBills.map((bill) => {
          const isVideo = isVideoBill(bill);
          const apt = (bill as any).appointment;
          const doctorName = apt?.clinic_doctor?.doctor_profile?.full_name;
          const isPaid = bill.status === "paid";
          const isPending = bill.status === "pending";

          return (
            <div
              key={bill.id}
              className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isVideo ? "border-l-4 border-l-violet-500" : "border-l-4 border-l-blue-500"
                }`}
            >
              <div className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Bill Info */}
                  <div className="flex-1 space-y-3">
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Bill Type Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isVideo
                        ? "bg-violet-100 text-violet-700"
                        : "bg-blue-100 text-blue-700"
                        }`}>
                        {isVideo ? <Video className="h-3 w-3" /> : <Building className="h-3 w-3" />}
                        {isVideo ? "Video Consultation" : "In-Clinic Visit"}
                      </span>

                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${isPaid ? "bg-emerald-100 text-emerald-700" :
                        isPending ? "bg-amber-100 text-amber-700" :
                          bill.status === "overdue" ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-600"
                        }`}>
                        {isPaid ? <CheckCircle className="h-3 w-3" /> :
                          isPending ? <Clock className="h-3 w-3" /> :
                            <AlertCircle className="h-3 w-3" />}
                        {(bill.status || "pending").replace("_", " ").toUpperCase()}
                      </span>

                      {/* Bill Number */}
                      <span className="text-sm font-mono text-slate-500">{bill.bill_number}</span>
                    </div>

                    {/* Details Row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">
                          {bill.clinic_patient?.patient_profile?.full_name || "Unknown Patient"}
                        </span>
                      </div>

                      {doctorName && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span>with Dr. {doctorName}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(bill.created_at), "MMM d, yyyy")}
                      </div>

                      {bill.payment_mode && isPaid && (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Banknote className="h-4 w-4" />
                          Paid via {bill.payment_mode.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Notes (if contains payment ID) */}
                    {bill.notes && bill.notes.includes("Payment ID") && (
                      <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                        {bill.notes}
                      </p>
                    )}
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center gap-4">
                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Amount</p>
                      <p className={`text-2xl font-bold ${isPaid ? "text-emerald-600" : "text-slate-900"}`}>
                        ₹{bill.total_amount.toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewBill(bill)}
                        className="gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>

                      {isPending && (
                        <Button
                          size="sm"
                          onClick={() => updatePaymentStatus(bill.id, "paid", "cash")}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CreditCard className="h-4 w-4" />
                          Mark Paid
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadBill(bill)}
                        className="gap-1.5"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredBills.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Receipt className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No bills found</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            {searchTerm || statusFilter || activeTab !== "all"
              ? "Try adjusting your filters"
              : "Get started by generating your first bill"}
          </p>
          <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Receipt className="h-4 w-4" />
            Generate Bill
          </Button>
        </div>
      )}

      {/* Modals */}
      <AddBillModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

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
