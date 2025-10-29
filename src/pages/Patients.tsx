import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import {
  Plus,
  Search,
  Users,
  Heart,
  Phone,
  AlertTriangle,
  Pill,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent } from "../components/ui/Card";
import { PatientProfileService } from "../services/PatientProfileService";
import { useAuth } from "../hooks/useAuth";
import type { PatientProfileWithClinic } from "../services/PatientProfileService";
import { capitalizeWords } from "../utils/textUtils";
import { format } from "date-fns";

export function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientProfileWithClinic[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<
    PatientProfileWithClinic[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Fetch patients when component mounts
    const fetchPatients = async () => {
      try {
        const response = await PatientProfileService.getClinicPatients();
        if (response.success && response.data) {
          setPatients(response.data);
          setFilteredPatients(response.data);
        }
      } catch (error) {
        console.error("Error fetching patients:", error);
      }
      setLoading(false);
    };

    fetchPatients();
  }, [user]);

  useEffect(() => {
    const filtered = patients.filter((patient) => {
      return (
        patient.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.phone.includes(searchTerm) ||
        (patient.email &&
          patient.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
    setFilteredPatients(filtered);
  }, [searchTerm, patients]);

  // Handle patient management
  const handleManagePatient = (patientId: string) => {
    navigate(`/admin/patients/${patientId}/manage`);
  };

  const handleAddPatient = () => {
    navigate("/admin/patients/new");
  };

  // Helper function to calculate age from date of birth
  const calculateAge = (dateOfBirth?: string): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  // Small inline component to render compact badges and a popover for full records
  function RecordBadges({ patient }: { patient: PatientProfileWithClinic }) {
    // Helper to extract an array of strings for a medical field. First check top-level column, then fallback to medical_history JSON.
    const getArrayFromPatient = (key: string, altKeys: string[] = []) => {
      const p = patient as unknown as Record<string, unknown>;

      const tryCast = (val: unknown): string[] | null => {
        if (!val) return null;
        if (Array.isArray(val))
          return (val as unknown[]).filter(Boolean).map(String);
        if (typeof val === "string") {
          const s = val.trim();
          if (!s) return null;
          // split on newlines or commas and trim
          return s
            .split(/[\r\n,]+/)
            .map((x) => x.trim())
            .filter(Boolean);
        }
        return null;
      };

      // try top-level
      const top = tryCast(p[key]);
      if (top && top.length > 0) return top;

      // try provided alternate keys
      for (const k of altKeys) {
        const v = tryCast(p[k]);
        if (v && v.length > 0) return v;
      }

      // try medical_history JSON
      const mh = p["medical_history"] as unknown;
      if (mh && typeof mh === "object") {
        try {
          const mhObj = mh as Record<string, unknown>;
          const v = tryCast(mhObj[key]);
          if (v && v.length > 0) return v;

          for (const k of altKeys) {
            const vv = tryCast(mhObj[k]);
            if (vv && vv.length > 0) return vv;
          }
        } catch {
          // ignore
        }
      }

      return [];
    };

    const items: {
      key: string;
      label: string;
      icon?: ComponentType<{ className?: string }>;
      values: string[];
    }[] = [];

    const allergies = getArrayFromPatient("allergies", ["allergy"]);
    if (allergies.length)
      items.push({
        key: "allergies",
        label: "Allergies",
        icon: AlertTriangle,
        values: allergies,
      });

    const conditions = getArrayFromPatient("chronic_conditions", [
      "conditions",
    ]);
    if (conditions.length)
      items.push({
        key: "chronic_conditions",
        label: "Conditions",
        icon: Heart,
        values: conditions,
      });

    const meds = getArrayFromPatient("medications", [
      "meds",
      "medications_list",
    ]);
    if (meds.length)
      items.push({
        key: "medications",
        label: "Medications",
        icon: Pill,
        values: meds,
      });

    const surgeries = getArrayFromPatient("previous_surgeries", [
      "surgeries",
      "previous_surgeries_list",
    ]);
    if (surgeries.length)
      items.push({
        key: "previous_surgeries",
        label: "Surgeries",
        icon: FileText,
        values: surgeries,
      });

    const [open, setOpen] = useState(false);

    const visible = items.slice(0, 2);
    const hiddenCount = Math.max(0, items.length - visible.length);

    return (
      <div className="relative inline-block">
        <div className="flex items-center gap-2">
          {visible.map((it) => (
            <span
              key={it.key}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full"
            >
              {it.icon ? <it.icon className="h-3 w-3" /> : null}
              {it.label}
            </span>
          ))}

          {hiddenCount > 0 && (
            <button
              onClick={() => setOpen((s) => !s)}
              className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 text-xs text-gray-700"
              title={`Show ${hiddenCount} more`}
            >
              +{hiddenCount}
            </button>
          )}
        </div>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded shadow-lg z-20 p-3">
            <div className="text-sm text-gray-700 space-y-2">
              {items.map((it) => (
                <div key={it.key} className="flex items-center gap-2">
                  {it.icon ? (
                    <it.icon className="h-4 w-4 text-gray-500" />
                  ) : null}
                  <div>
                    <div className="font-medium text-gray-900">{it.label}</div>
                    <div className="text-xs text-gray-600">
                      {it.values.slice(0, 5).join(", ") || "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Custom skeleton loader
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-64"></div>
            </div>
            <div className="h-10 w-36 bg-gray-200 rounded-md" />
          </div>
          <div>
            <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <th key={i} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, row) => (
                  <tr key={row} className="border-b">
                    <td className="px-4 py-4 align-top text-sm text-gray-600">
                      <div className="h-4 bg-gray-200 rounded w-4"></div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-28 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-blue-600">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-900">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-700">
                      <div className="h-4 bg-gray-200 rounded w-40"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-700">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-green-600">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-500">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>

                    <td className="px-4 py-4 align-top text-right space-x-1">
                      <div className="inline-block h-4 w-4 rounded bg-gray-200 ml-auto"></div>
                      <div className="inline-block h-4 w-4 rounded bg-gray-200 ml-2"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Main Content
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-1">Manage your patient records</p>
        </div>
        <Button onClick={handleAddPatient} className="mt-4 sm:mt-0">
          <Plus className="h-5 w-5 mr-2" />
          Add Patient
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search patients by name, contact, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-4">
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Age / Gender
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient, index) => {
                  const hasMedicalHistory = (p: PatientProfileWithClinic) =>
                    Boolean(
                      p.allergies?.length ||
                        p.chronic_conditions?.length ||
                        p.medical_notes
                    );

                  return (
                    <tr key={patient.id}>
                      <td className="px-4 py-3 align-top text-sm text-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {capitalizeWords(patient.full_name)}
                            </div>
                            {/* Has to update */}
                            {/* records shown in the dedicated Records column */}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        {(() => {
                          const age = calculateAge(patient.date_of_birth);
                          return age ? `${age} yrs` : "—";
                        })()}
                        {patient.gender ? (
                          <span className="ml-2">• {patient.gender}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{patient.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        {patient.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700 relative">
                        {hasMedicalHistory(patient) ? (
                          <RecordBadges patient={patient} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-500">
                        {format(new Date(patient.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          onClick={() => handleManagePatient(patient.id)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium transition-colors duration-150"
                          title="Manage Patient"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredPatients.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <Users className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No patients found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "Get started by adding your first patient"}
            </p>
            <Button onClick={handleAddPatient}>
              <Plus className="h-5 w-5 mr-2" />
              Add Patient
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
