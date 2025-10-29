import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Bell,
  Check,
  CheckCheck,
  Trash2,
  CalendarDays,
  CreditCard,
  Cog,
  Info,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { Notification } from "../types";

interface NotificationCenterProps {
  onClose: () => void;
  onNotificationUpdate?: () => void;
}

export function NotificationCenter({
  onClose,
  onNotificationUpdate,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!error) setNotifications(data || []);
        else console.error("Error fetching notifications:", error);
      } catch (e) {
        console.error("Error in fetchNotifications:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read" } as any)
        .eq("id", id);
      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "read" as const } : n))
        );
        onNotificationUpdate?.();
      } else {
        console.error("Error marking notification as read:", error);
      }
    } catch (e) {
      console.error("Error in markAsRead:", e);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "read" } as any)
        .eq("user_id", user.id)
        .eq("status", "unread");
      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: "read" as const }))
        );
        onNotificationUpdate?.();
      } else {
        console.error("Error marking all as read:", error);
      }
    } catch (e) {
      console.error("Error in markAllAsRead:", e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (!error) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        onNotificationUpdate?.();
      } else {
        console.error("Error deleting notification:", error);
      }
    } catch (e) {
      console.error("Error in deleteNotification:", e);
    }
  };

  // Map type -> minimal color tokens (bg + icon + chip)
  const typeStyles = (type: string) => {
    switch (type) {
      case "payment":
        return {
          rowBg: "bg-emerald-50",
          iconColor: "text-emerald-700",
          chipBg: "bg-emerald-100 text-emerald-800",
          border: "border-emerald-100",
        };
      case "appointment":
        return {
          rowBg: "bg-blue-50",
          iconColor: "text-blue-700",
          chipBg: "bg-blue-100 text-blue-800",
          border: "border-blue-100",
        };
      case "system":
        return {
          rowBg: "bg-slate-50",
          iconColor: "text-slate-700",
          chipBg: "bg-slate-200 text-slate-800",
          border: "border-slate-200",
        };
      default:
        return {
          rowBg: "bg-indigo-50",
          iconColor: "text-indigo-700",
          chipBg: "bg-indigo-100 text-indigo-800",
          border: "border-indigo-100",
        };
    }
  };

  const TypeIcon = ({
    type,
    className,
  }: {
    type: string;
    className?: string;
  }) => {
    switch (type) {
      case "payment":
        return <CreditCard className={className} />;
      case "appointment":
        return <CalendarDays className={className} />;
      case "system":
        return <Cog className={className} />;
      default:
        return <Info className={className} />;
    }
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex md:items-start md:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      <div
        className="absolute inset-0 bg-black/30 md:bg-transparent"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="
          relative bg-white md:mt-6 md:mr-6 w-full md:w-[420px]
          h-[100dvh] md:h-[560px]
          rounded-none md:rounded-xl
          border-0 md:border md:border-slate-200
          shadow-none md:shadow-sm
          flex flex-col
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-2 text-xs font-medium rounded-full bg-blue-600 text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Mark all</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close notifications"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-slate-500">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Bell className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const created = new Date(n.created_at);
                const relative = formatDistanceToNow(created, {
                  addSuffix: true,
                });

                const style = typeStyles(n.type);
                return (
                  <li key={n.id} className="px-3 py-2 sm:px-4 sm:py-3">
                    <div
                      className={`rounded-lg border ${style.border} ${style.rowBg} px-3 py-2 sm:px-3.5 sm:py-3`}
                    >
                      <div className="flex items-start gap-3">
                        <TypeIcon
                          type={n.type}
                          className={`h-5 w-5 ${style.iconColor} shrink-0 mt-0.5`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-slate-900 truncate">
                              {n.title}
                            </h4>
                            <span
                              className={`hidden sm:inline px-1.5 py-0.5 text-[11px] rounded-md ${style.chipBg}`}
                            >
                              {n.type}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">
                            {n.message}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <time
                              title={format(created, "PPpp")}
                              dateTime={created.toISOString()}
                            >
                              {relative}
                            </time>
                            {n.status === "unread" && (
                              <span className="text-blue-700">• Unread</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-1">
                          {n.status === "unread" && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="p-1.5 rounded-md text-blue-700 hover:bg-blue-50"
                              aria-label="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(n.id)}
                            className="p-1.5 rounded-md text-rose-700 hover:bg-rose-50"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-end gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
