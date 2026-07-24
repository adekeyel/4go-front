import { Bell, AlertTriangle, Search, Zap, LogOut, ArrowLeft, Megaphone, UserPlus, Flag, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: string) => void;
  alerts: { id: string; label: string; count: number; section: string }[];
}

export default function AdminTopbar({ search, onSearch, onSelect, alerts }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const totalAlerts = alerts.reduce((s, a) => s + a.count, 0);
  const initials = (profile?.display_name || profile?.username || "A").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-2 backdrop-blur sm:px-4">
      <SidebarTrigger />

      <div className="relative ml-1 hidden max-w-sm flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search users, chats, reports..."
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="sm" className="gap-1.5">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelect("mkt-push")}><Megaphone className="mr-2 h-4 w-4" /> Send Broadcast</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect("users-all")}><UserPlus className="mr-2 h-4 w-4" /> Manage Users</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect("mod-messages")}><Flag className="mr-2 h-4 w-4" /> Review Reports</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect("verify-user")}><ShieldCheck className="mr-2 h-4 w-4" /> Verifications</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* System Alerts */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <AlertTriangle className="h-5 w-5" />
              {totalAlerts > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-admin-danger px-1 text-[10px] font-bold text-white">
                  {totalAlerts > 99 ? "99+" : totalAlerts}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>System Alerts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.filter((a) => a.count > 0).length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">No active alerts</p>
            )}
            {alerts.filter((a) => a.count > 0).map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => onSelect(a.section)} className="justify-between">
                <span>{a.label}</span>
                <span className="rounded-full bg-admin-warning/10 px-2 text-xs font-semibold text-admin-warning">{a.count}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" onClick={() => onSelect("live-activity")} className="relative">
          <Bell className="h-5 w-5" />
        </Button>

        {/* Admin profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-full outline-none">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col">
              <span>{profile?.display_name || "Super Admin"}</span>
              <span className="text-xs font-normal text-muted-foreground">@{profile?.username || "admin"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to App</DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}