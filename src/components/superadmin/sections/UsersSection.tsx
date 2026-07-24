import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, BadgeCheck, Ban, ShieldOff, Trash2, Bell, Copy, Crown, Search, DollarSign } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { AdminUser } from "../useAdminData";
import { SectionHeader } from "./primitives";
import { navItemLabel, type AdminRoleKey } from "../adminNav";

type Variant = "all" | "verified" | "online" | "premium" | "suspended" | "deleted";

interface UserDetail {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  created_at: string;
  rank: string;
  coins: number;
  earned_coins: number;
  purchased_coins: number;
  reward_coins: number;
  withdrawable_coins: number;
  total_online_minutes: number;
  is_premium: boolean;
  is_verified: boolean;
  is_monetized: boolean;
  is_suspended: boolean;
  is_online: boolean;
  last_seen: string | null;
  referral_code: string | null;
  referrals: Array<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; joined_at: string }>;
}

export default function UsersSection({
  id, variant, users, globalSearch, refresh, role,
}: { id: string; variant: Variant; users: AdminUser[]; globalSearch: string; refresh: () => void; role?: AdminRoleKey | null }) {
  const [localSearch, setLocalSearch] = useState("");
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notifyUser, setNotifyUser] = useState<AdminUser | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const search = (globalSearch || localSearch).toLowerCase().trim();
  const isSuper = role === "super_admin" || role == null;

  const rpc = (n: string, a: object) =>
    (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

  useEffect(() => {
    if (!profileUser) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const adminId = authData.user?.id;
      if (!adminId) return;
      const { data } = await rpc("admin_user_detail", { p_admin_id: adminId, p_user: profileUser.user_id });
      if (!cancelled) { setDetail((data as UserDetail) ?? null); setDetailLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [profileUser]);

  const filtered = useMemo(() => {
    let list = users;
    if (variant === "verified") list = list.filter((u) => u.is_verified);
    else if (variant === "online") list = list.filter((u) => u.is_online);
    else if (variant === "premium") list = list.filter((u) => u.is_premium);
    else if (variant === "suspended") list = list.filter((u) => u.is_suspended);
    else if (variant === "deleted") list = [];
    if (search) {
      list = list.filter((u) =>
        [u.display_name, u.username, u.phone_number, u.user_id].some((f) => f?.toLowerCase().includes(search)),
      );
    }
    return list;
  }, [users, variant, search]);

  const update = async (u: AdminUser, patch: Record<string, unknown>, msg: string) => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update(patch as never).eq("user_id", u.user_id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    refresh();
  };

  const suspend = (u: AdminUser) => {
    if (u.is_suspended) return update(u, { is_suspended: false, suspended_at: null, suspended_reason: null }, "User reinstated");
    const reason = window.prompt("Reason for suspension / ban?", "Violation of community guidelines");
    if (reason === null) return;
    return update(u, { is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason }, "User suspended");
  };

  const removeUser = async (u: AdminUser) => {
    if (!window.confirm(`Permanently delete ${u.display_name || u.username}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { target_user_id: u.user_id } });
    setBusy(false);
    if (error) { toast.error(error.message || "Failed to delete user"); return; }
    toast.success("User deleted");
    refresh();
  };

  const sendNotify = async () => {
    if (!notifyUser || !notifyTitle.trim() || !notifyBody.trim()) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("send-push", {
      body: { user_ids: [notifyUser.user_id], title: notifyTitle.trim(), body: notifyBody.trim() },
    });
    setBusy(false);
    if (error) { toast.error("Failed to send"); return; }
    toast.success("Notification sent");
    setNotifyUser(null); setNotifyTitle(""); setNotifyBody("");
  };

  const toggleMonetize = async (u: AdminUser) => {
    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id;
    if (!adminId) return;
    setBusy(true);
    const next = !u.is_monetized;
    const { error } = await rpc("admin_set_monetized", { p_admin_id: adminId, p_user: u.user_id, p_value: next });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "User monetized" : "User unmonetized");
    refresh();
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={navItemLabel(id)}
        subtitle={`${filtered.length} ${filtered.length === 1 ? "user" : "users"}`}
        action={
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} placeholder="Search users..." className="pl-9" />
          </div>
        }
      />

      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Registered</TableHead>
                <TableHead className="hidden sm:table-cell">Last Active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {variant === "deleted" ? "No deleted-account records are tracked yet." : "No users found."}
                </TableCell></TableRow>
              )}
              {filtered.slice(0, 200).map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <button className="flex items-center gap-2 text-left" onClick={() => setProfileUser(u)}>
                      <UserAvatar url={u.avatar_url} name={u.display_name || u.username} size="sm" online={!!u.is_online} showOnline />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate font-medium">
                          {u.display_name || "Unnamed"}
                          {u.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
                          {u.is_premium && <Crown className="h-3.5 w-3.5 text-admin-warning" />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">@{u.username || "—"}</p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{u.phone_number || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.last_seen ? new Date(u.last_seen).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {u.is_suspended
                      ? <Badge variant="destructive">Suspended</Badge>
                      : u.is_online
                        ? <Badge className="bg-admin-success text-white hover:bg-admin-success">Online</Badge>
                        : <Badge variant="secondary">Active</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={busy}><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setProfileUser(u)}>View Profile</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => update(u, { is_verified: !u.is_verified }, u.is_verified ? "Verification removed" : "User verified")}>
                          <BadgeCheck className="mr-2 h-4 w-4" /> {u.is_verified ? "Unverify" : "Verify"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => update(u, { is_premium: !u.is_premium }, u.is_premium ? "Premium removed" : "Premium granted")}>
                          <Crown className="mr-2 h-4 w-4" /> {u.is_premium ? "Remove Premium" : "Grant Premium"}
                        </DropdownMenuItem>
                        {isSuper && (
                          <DropdownMenuItem onClick={() => toggleMonetize(u)}>
                            <DollarSign className="mr-2 h-4 w-4" /> {u.is_monetized ? "Unmonetize" : "Monetize"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setNotifyUser(u)}><Bell className="mr-2 h-4 w-4" /> Send Notification</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(u.user_id); toast.success("User ID copied"); }}>
                          <Copy className="mr-2 h-4 w-4" /> Copy User ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => suspend(u)} className={u.is_suspended ? "" : "text-admin-warning focus:text-admin-warning"}>
                          {u.is_suspended ? <><ShieldOff className="mr-2 h-4 w-4" /> Reinstate</> : <><Ban className="mr-2 h-4 w-4" /> Suspend / Ban</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removeUser(u)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Profile dialog */}
      <Dialog open={!!profileUser} onOpenChange={(o) => !o && setProfileUser(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>User Profile</DialogTitle></DialogHeader>
          {profileUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <UserAvatar url={profileUser.avatar_url} name={profileUser.display_name || profileUser.username} size="lg" online={!!profileUser.is_online} showOnline />
                <div>
                  <p className="flex items-center gap-1 font-semibold">
                    {profileUser.display_name || "Unnamed"}
                    {detail?.is_monetized && <Badge className="bg-admin-success text-white hover:bg-admin-success">Monetized</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">@{profileUser.username || "—"}</p>
                </div>
              </div>
              {detailLoading && <p className="text-sm text-muted-foreground">Loading full profile…</p>}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-muted-foreground">Full name</dt><dd>{detail?.display_name || profileUser.display_name || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Email</dt><dd className="truncate">{detail?.email || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Phone</dt><dd>{detail?.phone_number || profileUser.phone_number || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Rank</dt><dd className="capitalize">{detail?.rank || profileUser.rank}</dd></div>
                <div><dt className="text-muted-foreground">Joined app</dt><dd>{new Date(detail?.created_at || profileUser.created_at).toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Last active</dt><dd>{detail?.last_seen ? new Date(detail.last_seen).toLocaleString() : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Available coins</dt><dd>{(detail?.coins ?? profileUser.coins ?? 0).toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Withdrawable coins</dt><dd>{(detail?.withdrawable_coins ?? 0).toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Verified</dt><dd>{(detail?.is_verified ?? profileUser.is_verified) ? "Yes" : "No"}</dd></div>
                <div><dt className="text-muted-foreground">Premium</dt><dd>{(detail?.is_premium ?? profileUser.is_premium) ? "Yes" : "No"}</dd></div>
                <div><dt className="text-muted-foreground">Monetized</dt><dd>{detail?.is_monetized ? "Yes" : "No"}</dd></div>
                <div><dt className="text-muted-foreground">Referral code</dt><dd className="font-mono text-xs">{detail?.referral_code || "—"}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">User ID</dt><dd className="truncate font-mono text-xs">{profileUser.user_id}</dd></div>
              </dl>
              <div>
                <p className="mb-1 text-sm font-semibold">Invited / referred users {detail?.referrals?.length ? `(${detail.referrals.length})` : ""}</p>
                {!detail?.referrals?.length ? (
                  <p className="text-xs text-muted-foreground">No referrals yet.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {detail.referrals.map((r) => (
                      <div key={r.user_id} className="flex items-center gap-2 text-sm">
                        <UserAvatar url={r.avatar_url} name={r.display_name || r.username} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{r.display_name || r.username || "User"}</p>
                          <p className="text-xs text-muted-foreground">@{r.username || "—"}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{new Date(r.joined_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isSuper && (
                <Button variant="outline" className="w-full" disabled={busy}
                  onClick={() => { toggleMonetize(profileUser); setDetail(detail ? { ...detail, is_monetized: !detail.is_monetized } : detail); }}>
                  <DollarSign className="mr-2 h-4 w-4" /> {detail?.is_monetized ? "Unmonetize user" : "Monetize user"}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notify dialog */}
      <Dialog open={!!notifyUser} onOpenChange={(o) => !o && setNotifyUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
            <Input placeholder="Message" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={sendNotify} disabled={busy || !notifyTitle.trim() || !notifyBody.trim()}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}