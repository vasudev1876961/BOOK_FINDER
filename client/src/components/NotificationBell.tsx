import React, { useState, useEffect, useRef } from "react";
import ApiClient from "../services/api";
import { Bell, CheckCheck, Trash2, Sparkles, Target, Info, Check } from "lucide-react";

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const data = await ApiClient.get("/notifications/");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await ApiClient.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await ApiClient.post("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ApiClient.delete(`/notifications/${id}`);
      const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "Recent";
    }
  };

  const getIcon = (title: string) => {
    if (title.toLowerCase().includes("goal") || title.toLowerCase().includes("streak")) {
      return <Target className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (title.toLowerCase().includes("recommend") || title.toLowerCase().includes("ai")) {
      return <Sparkles className="w-4 h-4 text-primary shrink-0" />;
    }
    return <Info className="w-4 h-4 text-zinc-400 shrink-0" />;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2.5 rounded-xl bg-white/3 hover:bg-white/7 border border-white/8 hover:border-white/15 text-zinc-400 hover:text-white transition cursor-pointer"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-black font-extrabold text-[10px] rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/30">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-84 sm:w-96 bg-[#09090b]/95 backdrop-blur-2xl border border-white/12 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[460px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between bg-white/2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-[11px] font-semibold text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/5 scrollbar-thin">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                  className={`p-3.5 flex items-start gap-3 transition cursor-pointer group hover:bg-white/4 ${
                    item.is_read ? "opacity-60 bg-transparent" : "bg-emerald-500/3"
                  }`}
                >
                  <div className="mt-0.5">{getIcon(item.title)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-white truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed break-words">
                      {item.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    {!item.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(item.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-emerald-400 transition"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1 text-zinc-500 hover:text-rose-400 transition"
                      title="Dismiss"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 px-4 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <Bell className="w-8 h-8 text-zinc-700 stroke-1" />
                <p className="text-xs font-medium text-zinc-400">All caught up!</p>
                <p className="text-[11px] text-zinc-600 max-w-xs">
                  Reading streak achievements and recommendations will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
