import { useState, useEffect, useRef } from "react";
import { Bell, X, AlertTriangle, AtSign, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useSocket } from "@/sockets/SocketContext";
import { useUnreadMentions } from "@/hooks/useUnreadMentions";
import {
  listNotifications,
  markNotificationRead,
  listMyEmployeeNotifications,
  markEmployeeNotificationsRead,
} from "@/api/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface GlobalNotification {
  id: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
}

interface EmployeeNotif {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const socket = useSocket();
  const { unreadMentions, setUnreadMentions } = useUnreadMentions();
  const [empNotifs, setEmpNotifs] = useState<EmployeeNotif[]>([]);
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<GlobalNotification | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<GlobalNotification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    // Fetch existing announcements (with per-user read state) and staff notifications.
    // The unread-mention count is kept by useUnreadMentions.
    const load = async () => {
      const [notifs, emp] = await Promise.all([
        listNotifications().catch(() => []),
        listMyEmployeeNotifications(30).catch(() => []),
      ]);
      if (!mounted) return;
      setNotifications(notifs as GlobalNotification[]);
      setReadIds(new Set(notifs.filter((n) => n.is_read).map((n) => n.id)));
      setEmpNotifs(emp as EmployeeNotif[]);
    };
    load();

    // Live: new announcements and staff notifications arrive on the backend socket.
    const onAnnouncement = (n: GlobalNotification) => {
      if (!mounted) return;
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      setPopup(n);
    };
    const onEmployee = (n: EmployeeNotif) => {
      if (!mounted) return;
      setEmpNotifs((prev) => [n, ...prev]);
      setPopup({ id: n.id, title: n.title, message: n.body, priority: "normal", created_at: n.created_at });
    };
    socket?.on("notification:new", onAnnouncement);
    socket?.on("employee:notification", onEmployee);

    return () => {
      mounted = false;
      socket?.off("notification:new", onAnnouncement);
      socket?.off("employee:notification", onEmployee);
    };
  }, [user, socket]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadGlobalCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const unreadEmployee = empNotifs.filter((n) => !n.read_at).length;
  const unreadCount = unreadGlobalCount + unreadMentions + unreadEmployee;

  const markAsRead = async (id: string) => {
    if (readIds.has(id) || !user) return;
    setReadIds((prev) => new Set(prev).add(id));
    markNotificationRead(id).catch(() => undefined);
  };

  const handleOpen = () => {
    setOpen((prev) => !prev);
    // Mark all as read when opening
    if (!open) {
      notifications.forEach((n) => markAsRead(n.id));
      if (unreadEmployee > 0 && user) {
        setEmpNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
        markEmployeeNotificationsRead().catch(() => undefined);
      }
    }
  };

  return (
    <>
      {/* Popup overlay */}
      {popup && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4">
          <div
            className="bg-card border border-border rounded-2xl shadow-lg p-4 w-full max-w-sm animate-in slide-in-from-top-4 fade-in duration-300"
            role="alert"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {popup.priority === "important" && (
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <h3 className="text-sm font-bold text-foreground">{popup.title}</h3>
              </div>
              <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{popup.message}</p>
            <button
              onClick={() => {
                setPopup(null);
                setOpen(true);
              }}
              className="text-xs text-primary font-semibold mt-2 hover:underline"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}

      {/* Bell + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleOpen}
          className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center relative"
        >
          <Bell className="w-5 h-5 text-primary-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-12 w-72 max-h-80 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              <Link
                to="/mentions"
                onClick={() => { setOpen(false); setUnreadMentions(0); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <AtSign className="w-3 h-3" />
                Mentions
                {unreadMentions > 0 && (
                  <span className="ml-1 min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMentions > 9 ? "9+" : unreadMentions}
                  </span>
                )}
              </Link>
            </div>
            <div className="overflow-y-auto max-h-64">
              {empNotifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNotif({ id: n.id, title: n.title, message: n.body, priority: "normal", created_at: n.created_at }); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-accent/50 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))}
              {notifications.length === 0 && empNotifs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No notifications yet</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { setSelectedNotif(n); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-accent/50 transition-colors ${
                      !readIds.has(n.id) ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {n.priority === "important" && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      )}
                      <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full notification dialog */}
      <Dialog open={!!selectedNotif} onOpenChange={(o) => !o && setSelectedNotif(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedNotif?.priority === "important" && (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              )}
              {selectedNotif?.title}
            </DialogTitle>
            {selectedNotif && (
              <p className="text-[11px] text-muted-foreground/60">
                {formatDistanceToNow(new Date(selectedNotif.created_at), { addSuffix: true })}
              </p>
            )}
          </DialogHeader>
          <DialogDescription className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm text-foreground">
            {selectedNotif?.message}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
