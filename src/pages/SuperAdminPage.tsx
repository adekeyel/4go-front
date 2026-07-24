import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldX, LayoutDashboard, Users, Flag, Banknote, Megaphone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import AdminSidebar from "@/components/superadmin/AdminSidebar";
import AdminTopbar from "@/components/superadmin/AdminTopbar";
import { useAdminData } from "@/components/superadmin/useAdminData";
import OverviewSection from "@/components/superadmin/sections/OverviewSection";
import UsersSection from "@/components/superadmin/sections/UsersSection";
import ReportsSection from "@/components/superadmin/sections/ReportsSection";
import RevenueSection from "@/components/superadmin/sections/RevenueSection";
import VerificationSection from "@/components/superadmin/sections/VerificationSection";
import BroadcastSection from "@/components/superadmin/sections/BroadcastSection";
import LiveActivitySection from "@/components/superadmin/sections/LiveActivitySection";
import ChatsSection from "@/components/superadmin/sections/ChatsSection";
import AnalyticsSection from "@/components/superadmin/sections/AnalyticsSection";
import MessageAnalyticsSection from "@/components/superadmin/sections/MessageAnalyticsSection";
import PaymentsSection from "@/components/superadmin/sections/PaymentsSection";
import SystemHealthSection from "@/components/superadmin/sections/SystemHealthSection";
import ReportedMediaSection from "@/components/superadmin/sections/ReportedMediaSection";
import SecuritySection from "@/components/superadmin/sections/SecuritySection";
import AdminsSection from "@/components/superadmin/sections/AdminsSection";
import SettingsSection from "@/components/superadmin/sections/SettingsSection";
import SupportInboxSection from "@/components/superadmin/sections/SupportInboxSection";
import AuditLogSection from "@/components/superadmin/sections/AuditLogSection";
import ContestsAdminSection from "@/components/superadmin/sections/ContestsAdminSection";
import DeliveryStatusSection from "@/components/superadmin/sections/DeliveryStatusSection";
import EmployeeDashboardSection from "@/components/superadmin/sections/EmployeeDashboardSection";
import EmployeesAdminSection from "@/components/superadmin/sections/EmployeesAdminSection";
import ActiveUsersSection from "@/components/superadmin/sections/ActiveUsersSection";
import EmployeeActivityLogSection from "@/components/superadmin/sections/EmployeeActivityLogSection";
import AdvertisersSection from "@/components/superadmin/sections/AdvertisersSection";
import AdBannersSection from "@/components/superadmin/sections/AdBannersSection";
import { PlaceholderSection } from "@/components/superadmin/sections/primitives";
import { allowedIdsForRole, type AdminRoleKey } from "@/components/superadmin/adminNav";
import { cn } from "@/lib/utils";

const mobileNav = [
  { id: "overview", label: "Home", icon: LayoutDashboard },
  { id: "users-all", label: "Users", icon: Users },
  { id: "mod-messages", label: "Reports", icon: Flag },
  { id: "mon-revenue", label: "Revenue", icon: Banknote },
  { id: "mkt-push", label: "Broadcast", icon: Megaphone },
  { id: "sup-tickets", label: "Support", icon: MessageSquare },
];

export default function SuperAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<AdminRoleKey | null | undefined>(undefined);
  const [active, setActive] = useState("overview");
  const [search, setSearch] = useState("");
  const data = useAdminData();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); return; }
    supabase.rpc("get_admin_role", { p_user_id: user.id }).then(({ data }) => setRole((data as AdminRoleKey) ?? null));
  }, [user, authLoading]);

  // Keep the active section within what this role may access.
  useEffect(() => {
    if (!role) return;
    const allowed = allowedIdsForRole(role);
    if (!allowed.has(active)) {
      setActive(role === "support" ? "sup-tickets" : role === "employee" ? "employee-home" : "overview");
    }
  }, [role, active]);

  if (role === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <ShieldX className="h-12 w-12 text-destructive" />
        <div>
          <h1 className="font-display text-xl font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">You don't have super admin privileges.</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to App</Button>
      </div>
    );
  }

  const alerts = [
    { id: "reports", label: "Pending reports", count: data.reports.filter((r) => r.status === "pending").length, section: "mod-messages" },
    { id: "banned", label: "Suspended users", count: data.kpis.bannedUsers, section: "users-suspended" },
  ];

  const allowedIds = allowedIdsForRole(role);
  const visibleMobileNav = mobileNav.filter((m) => allowedIds.has(m.id));

  const renderSection = () => {
    switch (active) {
      case "employee-home":
        return <EmployeeDashboardSection employeeId={user!.id} title="My Pipeline" subtitle="Your invited users and their activity" />;
      case "team-employees":
        return <EmployeesAdminSection id={active} />;
      case "team-activity":
        return <EmployeeActivityLogSection id={active} />;
      case "team-active-users":
        return <ActiveUsersSection id={active} />;
      case "overview":
        return <OverviewSection kpis={data.kpis} loading={data.loading} users={data.users} reports={data.reports} subscriptions={data.subscriptions} />;
      case "live-activity":
        return <LiveActivitySection id={active} users={data.users} reports={data.reports} subscriptions={data.subscriptions} />;
      case "system-health":
        return <SystemHealthSection id={active} stats={data.stats} loading={data.loading} />;
      case "users-all": return <UsersSection id={active} variant="all" users={data.users} globalSearch={search} refresh={data.refresh} role={role} />;
      case "users-verified": return <UsersSection id={active} variant="verified" users={data.users} globalSearch={search} refresh={data.refresh} role={role} />;
      case "users-online": return <UsersSection id={active} variant="online" users={data.users} globalSearch={search} refresh={data.refresh} role={role} />;
      case "users-premium":
      case "mon-premium": return <UsersSection id={active} variant="premium" users={data.users} globalSearch={search} refresh={data.refresh} role={role} />;
      case "users-suspended": return <UsersSection id={active} variant="suspended" users={data.users} globalSearch={search} refresh={data.refresh} role={role} />;
      case "users-deleted": return <UsersSection id={active} variant="deleted" users={data.users} globalSearch={search} refresh={data.refresh} role={role} />;
      case "chats-private": return <ChatsSection id={active} variant="private" rooms={data.rooms} refresh={data.refresh} />;
      case "chats-group":
      case "comm-groups": return <ChatsSection id={active} variant="group" rooms={data.rooms} refresh={data.refresh} />;
      case "chats-analytics": return <MessageAnalyticsSection id={active} stats={data.stats} />;
      case "mod-messages":
      case "comm-reports":
      case "sup-complaints": return <ReportsSection id={active} reports={data.reports} refresh={data.refresh} />;
      case "mod-images": return <ReportedMediaSection id={active} variant="image" />;
      case "mod-videos": return <ReportedMediaSection id={active} variant="video" />;
      case "mod-voice": return <ReportedMediaSection id={active} variant="audio" />;
      case "sec-login": return <SecuritySection id={active} variant="login" />;
      case "sec-suspicious": return <SecuritySection id={active} variant="suspicious" />;
      case "sec-devices": return <SecuritySection id={active} variant="devices" />;
      case "sec-ip": return <SecuritySection id={active} variant="ip" />;
      case "sec-fraud": return <SecuritySection id={active} variant="fraud" />;
      case "set-admins": return <AdminsSection id={active} users={data.users} />;
      case "set-audit": return <AuditLogSection id={active} />;
      case "mkt-contests": return <ContestsAdminSection id={active} />;
      case "mkt-delivery": return <DeliveryStatusSection id={active} />;
      case "ads-advertisers": return <AdvertisersSection id={active} />;
      case "ads-banners": return <AdBannersSection id={active} />;
      case "sup-tickets":
      case "sup-live": return <SupportInboxSection id={active} />;
      case "set-app":
      case "set-chat":
      case "set-mod":
      case "set-storage":
      case "set-api": return <SettingsSection id={active} />;
      case "verify-user":
      case "verify-creator":
      case "verify-business": return <VerificationSection id={active} />;
      case "mon-revenue":
      case "an-revenue": return <RevenueSection id={active} subscriptions={data.subscriptions} totalUsers={data.kpis.totalUsers} />;
      case "mon-payments": return <PaymentsSection id={active} variant="payments" subscriptions={data.subscriptions} />;
      case "mon-plans": return <PaymentsSection id={active} variant="plans" subscriptions={data.subscriptions} />;
      case "mon-refunds": return <PaymentsSection id={active} variant="refunds" subscriptions={data.subscriptions} />;
      case "an-growth": return <AnalyticsSection id={active} variant="growth" users={data.users} />;
      case "an-chat": return <AnalyticsSection id={active} variant="chat" users={data.users} />;
      case "an-engagement": return <AnalyticsSection id={active} variant="engagement" users={data.users} />;
      case "an-retention": return <AnalyticsSection id={active} variant="retention" users={data.users} />;
      case "mkt-push":
      case "mkt-announce":
      case "mkt-email":
      case "comm-broadcast": return <BroadcastSection id={active} />;
      default: return <PlaceholderSection id={active} />;
    }
  };

  return (
    <div className="admin-shell">
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <AdminSidebar active={active} onSelect={setActive} role={role} />
          <div className="flex min-w-0 flex-1 flex-col">
            <AdminTopbar search={search} onSearch={setSearch} onSelect={setActive} alerts={alerts} />
            <main className="flex-1 overflow-x-hidden p-3 pb-24 sm:p-5 lg:pb-5">{renderSection()}</main>
            {/* Mobile bottom nav */}
            <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 backdrop-blur lg:hidden">
              {visibleMobileNav.map((m) => (
                <button key={m.id} onClick={() => setActive(m.id)}
                  className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                    active === m.id ? "text-primary" : "text-muted-foreground")}>
                  <m.icon className="h-5 w-5" />
                  {m.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}