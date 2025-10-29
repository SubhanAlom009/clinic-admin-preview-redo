import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  UserCheck,
  Calendar,
  Receipt,
  BarChart3,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronLeft,
  ChevronRight,
  HomeIcon,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { NotificationCenter } from "./NotificationCenter";
import { AppointmentRequestsBadge } from "./AppointmentRequestsBadge";
import { ClinicProfileService } from "../services";
import { supabase } from "../lib/supabase";

const navigationItems = [
  { to: "/admin/dashboard", icon: Home, label: "Dashboard" },
  { to: "/admin/patients", icon: Users, label: "Patients" },
  { to: "/admin/doctors", icon: UserCheck, label: "Doctors" },
  { to: "/admin/appointments", icon: Calendar, label: "Appointments" },
  { to: "/admin/appointment-requests", icon: ClipboardList, label: "Requests" },
  { to: "/admin/billing", icon: Receipt, label: "Billing" },
  { to: "/admin/reports", icon: BarChart3, label: "Reports" },
  { to: "/admin/history", icon: History, label: "History" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [clinicLogoUrl, setClinicLogoUrl] = useState<string | null>(null);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  // ADDED: Fetch unread notification count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "unread");

        if (error) {
          console.error("Error fetching unread count:", error);
        } else {
          console.log("Unread notifications count:", count);
          setUnreadCount(count || 0);
        }
      } catch (error) {
        console.error("Error in fetchUnreadCount:", error);
      }
    };

    fetchUnreadCount();

    // ADDED: Real-time subscription for notifications
    const subscription = supabase
      .channel("notification-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Notifications updated, refetching unread count...");
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Fetch clinic name and logo for display in sidebar header
  useEffect(() => {
    if (!user) return;

    const fetchClinic = async () => {
      try {
        const response = await ClinicProfileService.getClinicProfile(user.id);

        if (!response.success) {
          console.warn(
            "Could not fetch clinic profile:",
            response.error || "Unknown error"
          );
          setClinicName(null);
          setClinicLogoUrl(null);
          return;
        }

        const profile = response.data;
        if (!profile) {
          setClinicName(null);
          setClinicLogoUrl(null);
          return;
        }

        setClinicName(profile.clinic_name || null);

        if (profile.logo_url) {
          const cleanUrl = profile.logo_url.split("?")[0];
          setClinicLogoUrl(cleanUrl);
        } else if (profile.clinic_logo) {
          // Fallback: derive public URL from storage path
          try {
            const { data: urlData } = supabase.storage
              .from("clinic-logos")
              .getPublicUrl(profile.clinic_logo);
            setClinicLogoUrl(urlData.publicUrl.split("?")[0]);
          } catch (e) {
            console.warn("Error deriving public URL from clinic_logo:", e);
            setClinicLogoUrl(null);
          }
        } else {
          setClinicLogoUrl(null);
        }
      } catch (e) {
        console.warn("Error fetching clinic profile", e);
        setClinicName(null);
        setClinicLogoUrl(null);
      }
    };

    fetchClinic();

    // Listen for profile updates from Settings
    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clinic_name, logo_url, clinic_logo } = customEvent.detail || {};

      if (clinic_name) setClinicName(clinic_name);
      if (logo_url) {
        setClinicLogoUrl((logo_url as string).split("?")[0]);
      } else if (clinic_logo) {
        try {
          const { data: urlData } = supabase.storage
            .from("clinic-logos")
            .getPublicUrl(clinic_logo);
          setClinicLogoUrl(urlData.publicUrl.split("?")[0]);
        } catch (e) {
          console.warn("Error deriving URL from updated clinic_logo:", e);
        }
      }
    };

    window.addEventListener("profile-updated", handleProfileUpdate);

    // Real-time subscription for profile changes
    const profileSubscription = supabase
      .channel("profile-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as {
            clinic_name?: string;
            clinic_logo?: string;
            logo_url?: string;
          };
          if (newData.clinic_name) setClinicName(newData.clinic_name);
          if (newData.logo_url) {
            setClinicLogoUrl(newData.logo_url);
          } else if (newData.clinic_logo) {
            const { data: urlData } = supabase.storage
              .from("clinic-logos")
              .getPublicUrl(newData.clinic_logo);
            setClinicLogoUrl(urlData.publicUrl);
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
      profileSubscription.unsubscribe();
    };
  }, [user]);

  // ADDED: Function to handle notification updates
  const handleNotificationUpdate = () => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "unread");

        if (error) {
          console.error("Error fetching unread count:", error);
        } else {
          console.log("Updated unread notifications count:", count);
          setUnreadCount(count || 0);
        }
      } catch (error) {
        console.error("Error in handleNotificationUpdate:", error);
      }
    };

    fetchUnreadCount();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarCollapsed ? "w-20" : "w-64"}
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div
            className={`flex items-center ${
              sidebarCollapsed ? "justify-center" : "space-x-2"
            }`}
          >
            <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
              {clinicLogoUrl ? (
                <img
                  src={clinicLogoUrl}
                  alt="Clinic Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-700">
                  {(clinicName || "C").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-800 truncate max-w-[160px]">
                {clinicName ?? "ClinicAdmin"}
              </h1>
            )}
          </div>

          <div className="flex items-center">
            {/* Desktop collapse button - only show when not collapsed */}
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="hidden lg:block p-1 rounded-md hover:bg-gray-100 transition-colors duration-200"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}

            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Floating expand button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="hidden lg:block absolute top-4 -right-3 p-1 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors duration-200 shadow-sm z-10"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        )}

        <nav className="mt-6">
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 mx-3 ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`h-5 w-5 flex-shrink-0 ${
                      sidebarCollapsed ? "" : "mr-3"
                    }`}
                  />
                  {!sidebarCollapsed && item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full border-t border-gray-200">
          <button
            onClick={handleSignOut}
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className="flex items-center w-full px-4 py-4 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200"
          >
            <div
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center w-full" : ""
              }`}
            >
              <LogOut
                className={`h-5 w-5 flex-shrink-0 ${
                  sidebarCollapsed ? "" : "mr-3"
                }`}
              />
              {!sidebarCollapsed && "Sign Out"}
            </div>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-3">
                <div>
                  <img
                    src="/abhicure_logo_nobg.png"
                    alt="AbhiCure Logo"
                    className="h-14 w-auto object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              
              <AppointmentRequestsBadge
                onBadgeClick={() => navigate("/admin/appointment-requests")}
                className="mr-2"
              />
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <Bell className="h-6 w-6 text-gray-600" />
                {/* FIXED: Only show red dot when there are unread notifications */}
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
                {/* OPTIONAL: Show unread count badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="relative">
            <Outlet />
            {notificationOpen && (
              <NotificationCenter
                onClose={() => setNotificationOpen(false)}
                onNotificationUpdate={handleNotificationUpdate}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
