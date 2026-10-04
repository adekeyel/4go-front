import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Trash2, UserCheck, MessageSquare, Activity } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import UserAvatar from "@/components/UserAvatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./primitives";
import { navItemLabel, type AdminRoleKey } from "../adminNav";

interface Row {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  message_count: number;
  total_online_minutes: number | null;
  is_online: boolean | null;
  is_suspended: boolean | null;
}

// Replaces the "Activity" tab of the retired /admin screen (most chatty in 7 days / most online).
// GET /api/admin/stats/chat-activity, suspend/unsuspend (moderator+), delete account (super admin only).
export default function ChatActivitySection({ id, role }: { id: string; role: AdminRoleKey }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"chatty" | "online">("chatty");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Row[]>("/admin/stats/chat-activity", { params: { days: 7, limit: 100 } });
      setRows(data);
    } catch {
      toast.error("Failed to load activity");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const fail = (e: any, fallback: string) => toast.error(e?.response?.data?.error || fallback);

  const toggleSuspend = async (u: Row) => {
    try {
      if (u.is_suspended) {
        await apiClient.post(`/admin/users/${u.user_id}/unsuspend`);
      } else {
        const reason = window.prompt("Reason for suspension?");
        if (!reason?.trim()) return;
        await apiClient.post(`/admin/users/${u.user_id}/suspend`, { reason: reason.trim() });
      }
      void load();
    } catch (e) { fail(e, "Action failed"); }
  };

  const remove = async (u: Row) => {
    if (!window.confirm(`Permanently delete ${u.display_name || u.username || "this user"}'s account?`)) return;
    try {
      await apiClient.delete(`/admin/users/${u.user_id}`);
      toast.success("Account deleted");
      void load();
    } catch (e) { fail(e, "Failed to delete account"); }
  };

  const sorted = [...rows]
    .sort((a, b) => sort === "chatty"
      ? b.message_count - a.message_count
      : (b.total_online_minutes || 0) - (a.total_online_minutes || 0))
    .slice(0, 50);

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Last 7 days" />
      <div className="flex gap-2">
        <Button size="sm" variant={sort === "chatty" ? "default" : "outline"} onClick={() => setSort("chatty")}><MessageSquare className="mr-1 h-3.5 w-3.5" /> Most chatty</Button>
        <Button size="sm" variant={sort === "online" ? "default" : "outline"} onClick={() => setSort("online")}><Activity className="mr-1 h-3.5 w-3.5" /> Most online</Button>
      </div>
      <div className="space-y-2">
        {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
        {!loading && sorted.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No activity data yet.</p>}
        {sorted.map((u, i) => (
          <Card key={u.user_id} className="flex items-center gap-3 p-3 shadow-card">
            <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
            <UserAvatar name={u.display_name || u.username} url={u.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                {u.display_name || u.username || "User"}
                {u.is_online && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                {u.is_suspended && <span className="rounded-full bg-destructive/15 px-1 py-0.5 text-[9px] font-bold text-destructive">SUSP</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {sort === "chatty"
                  ? `${u.message_count} msgs · ${u.total_online_minutes ?? 0} min online`
                  : `${u.total_online_minutes ?? 0} min online · ${u.message_count} msgs`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={u.is_suspended ? "outline" : "destructive"} onClick={() => toggleSuspend(u)}>
                {u.is_suspended ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
              </Button>
              {role === "super_admin" && (
                <Button size="sm" variant="destructive" onClick={() => remove(u)}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
