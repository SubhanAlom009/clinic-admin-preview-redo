import { useState, useEffect } from "react";
import { Save, Building, Lock, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { AddressForm } from "../components/shared/AddressForm";
import { validateAddress } from "../validation/AddressValidation";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { ClinicProfileService } from "../services";
import type { ClinicProfile } from "../services";
import type { AddressFormData } from "../validation/AddressValidation";

export function Settings() {
  const [activeTab, setActiveTab] = useState("clinic");
  const [profileData, setProfileData] = useState<Partial<ClinicProfile>>({
    clinic_name: "",
    admin_name: "",
    contact_email: "",
    contact_phone: "",
    primary_address: {} as AddressFormData,
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>(
    {}
  );
  const [clinicImageFile, setClinicImageFile] = useState<File | null>(null);
  const [clinicImageUrl, setClinicImageUrl] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const response = await ClinicProfileService.getClinicProfile(user.id);

        if (response.success && response.data) {
          setProfileData({
            clinic_name: response.data.clinic_name || "",
            admin_name: response.data.admin_name || "",
            contact_email: response.data.contact_email || "",
            contact_phone: response.data.contact_phone || "",
            primary_address: response.data.primary_address || {},
          });

          // Set clinic logo URL if available
          if (response.data.logo_url) {
            setClinicImageUrl(response.data.logo_url);
          }
        } else {
          console.warn(
            "Could not fetch clinic profile:",
            response.error?.message
          );
        }
      } catch (e) {
        console.warn("Error fetching profile:", e);
      }
    };

    fetchProfile();
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setAddressErrors({});

    // Validate address before proceeding
    const { isValid, errors: addrErrors } = validateAddress(
      profileData.primary_address || {}
    );

    console.log("Address validation result:", {
      isValid,
      errors: addrErrors,
      address: profileData.primary_address,
      missingFields: Object.keys(addrErrors),
    });

    if (!isValid) {
      setAddressErrors(addrErrors);
      const errorList = Object.values(addrErrors).join(", ");
      toast.error(`Please fix address errors: ${errorList}`);
      setSaving(false);
      return;
    }

    try {
      let logoUrl: string | null = null;

      // Handle image upload if a new file is selected
      if (clinicImageFile && user) {
        const fileExt = clinicImageFile.name.split(".").pop();
        const timestamp = Date.now();
        const fileName = `clinic_${user.id}_logo_${timestamp}.${fileExt}`;

        try {
          // upload to clinic-logos bucket
          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from("clinic-logos")
              .upload(fileName, clinicImageFile, { upsert: true });

          if (uploadError) throw uploadError;

          const clinicLogoPath = uploadData?.path || null;

          // Get public URL and append cache-busting query param
          if (clinicLogoPath) {
            const { data: urlData } = supabase.storage
              .from("clinic-logos")
              .getPublicUrl(clinicLogoPath);

            logoUrl = urlData.publicUrl + `?t=${timestamp}`;
          }

          console.log("Upload successful:", {
            clinicLogoPath,
            logoUrl,
          });
        } catch (uploadErr: unknown) {
          // If bucket not found, warn the user and continue saving profile without logo
          const maybe = uploadErr as { message?: string } | undefined;
          const msg = maybe?.message ?? String(uploadErr);
          console.error("Clinic logo upload failed:", uploadErr);

          if (
            msg?.toLowerCase?.().includes("bucket not found") ||
            msg?.toLowerCase?.().includes("no such bucket")
          ) {
            toast.warning(
              "Profile saved but image upload failed: The 'clinic-logos' storage bucket doesn't exist."
            );
          } else {
            toast.warning("Profile saved but image upload failed: " + msg);
          }
          logoUrl = null;
        }
      }

      // Prepare update data for clinic_profiles table
      const updateData = {
        clinic_name: profileData.clinic_name || "",
        admin_name: profileData.admin_name || "",
        contact_email: profileData.contact_email || "",
        contact_phone: profileData.contact_phone || null,
        primary_address: profileData.primary_address,
        ...(logoUrl && { logo_url: logoUrl }),
      };

      // Update clinic_profiles table using ClinicProfileService
      const response = await ClinicProfileService.updateClinicProfile(
        user.id,
        updateData
      );

      if (!response.success || response.error) {
        throw response.error || new Error("Failed to update clinic profile");
      }

      toast.success("Profile updated successfully!");
      if (logoUrl) {
        setClinicImageUrl(logoUrl);
        setClinicImageFile(null);
      }

      // Dispatch event to update sidebar immediately
      window.dispatchEvent(
        new CustomEvent("profile-updated", {
          detail: {
            clinic_name: profileData.clinic_name,
            logo_url: logoUrl,
          },
        })
      );
    } catch (err: unknown) {
      const maybeErr = err as { message?: string } | undefined;
      const msg = maybeErr?.message ?? String(err);
      toast.error("Error updating profile: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClinicImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setClinicImageFile(file);
    if (file) {
      setClinicImageUrl(URL.createObjectURL(file));
    } else {
      setClinicImageUrl(null);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: unknown) {
      const maybe = err as { message?: string } | undefined;
      toast.error("Error updating password: " + (maybe?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (activeTab === "clinic") {
      setProfileData({
        ...profileData,
        [e.target.name]: e.target.value,
      });
    } else if (activeTab === "security") {
      setPasswordData({
        ...passwordData,
        [e.target.name]: e.target.value,
      });
    }
  };

  const tabs = [
    { id: "clinic", label: "Clinic Profile", icon: Building },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your clinic settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "clinic" && (
        <Card>
          <CardHeader>
            <CardTitle>Clinic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clinic Logo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
                      {clinicImageUrl ? (
                        // preview local or uploaded image
                        <img
                          src={clinicImageUrl}
                          alt="Clinic Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-500 font-semibold">
                          {(profileData.clinic_name || "").charAt(0) || "C"}
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleClinicImageChange}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        PNG/JPG up to 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <Input
                  label="Clinic Name"
                  name="clinic_name"
                  value={profileData.clinic_name || ""}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter clinic name"
                />
                <Input
                  label="Admin Name"
                  name="admin_name"
                  value={profileData.admin_name || ""}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter admin name"
                />
                <Input
                  label="Contact Email"
                  name="contact_email"
                  type="email"
                  value={profileData.contact_email || ""}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter contact email"
                />
                <Input
                  label="Contact Phone"
                  name="contact_phone"
                  value={profileData.contact_phone || ""}
                  onChange={handleInputChange}
                  placeholder="Enter contact phone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clinic Address
                </label>
                {Object.keys(addressErrors).length > 0 && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-700 font-medium mb-1">
                      Please fix the following errors:
                    </p>
                    <ul className="text-sm text-red-600 list-disc list-inside">
                      {Object.entries(addressErrors).map(([field, error]) => (
                        <li key={field}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <AddressForm
                  value={profileData.primary_address || {}}
                  onChange={(addr) => {
                    console.log("Settings: Address updated", addr);
                    setProfileData({ ...profileData, primary_address: addr });
                    setAddressErrors({});
                  }}
                  errors={addressErrors}
                  disabled={saving}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save className="h-5 w-5 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "security" && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <Input
                label="Current Password"
                name="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={handleInputChange}
                placeholder="Enter current password"
              />
              <Input
                label="New Password"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handleInputChange}
                required
                placeholder="Enter new password"
              />
              <Input
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm new password"
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Lock className="h-5 w-5 mr-2" />
                  {saving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Email Notifications
                  </h4>
                  <p className="text-sm text-gray-500">
                    Receive notifications via email
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  defaultChecked
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Appointment Reminders
                  </h4>
                  <p className="text-sm text-gray-500">
                    Send reminders before appointments
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  defaultChecked
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Payment Notifications
                  </h4>
                  <p className="text-sm text-gray-500">
                    Get notified about payments and bills
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  defaultChecked
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
