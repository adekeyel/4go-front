import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, Flag, Banknote, MessageSquare, Shield, Trash2, CheckCircle, XCircle, Search, Send, Trophy, Plus, Play, Square, Gift, Activity, Ban, UserCheck, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import UserAvatar from "@/components/UserAvatar";
import { RankBadge } from "@/components/RankBadge";
import { getBankName } from "@/lib/banks";
import type { Tables } from "@/integrations/supabase/types";

type VerificationApplication = Tables<"verification_applications">;

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string;
  coins: number;
  is_monetized: boolean;
  total_online_minutes: number;
  is_online: boolean | null;
  created_at: string;
  is_suspended?: boolean | null;
}

interface ChatActivityRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string;
  message_count: number;
  total_online_minutes: number;
  is_online: boolean | null;
  is_suspended: boolean | null;
}

interface Report {
  id: string;
  reporter_id: string;
  target_user_id: string | null;
  target_room_id: string | null;
  target_message_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  naira_amount: number;
  bank_code: string;
  account_number: string;
  account_name: string;
  status: string;
  created_at: string;
}

interface RoomInfo {
  id: string;
  name: string;
  type: string;
  created_at: string;
  is_active: boolean | null;
}

interface PageRow {
  id: string;
  name: string;
  category: string | null;
  followers_count: number;
  owner_id: string;
  created_at: string;
  profile_image: string | null;
}

interface Contest {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_winners: number | null;
  created_by: string;
  created_at: string;
}

interface ContestParticipant {
  id: string;
  contest_id: string;
  user_id: string;
  rewarded: boolean;
  joined_at: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ totalUsers: 0, onlineUsers: 0, totalRooms: 0, pendingReports: 0, pendingWithdrawals: 0 });
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifPriority, setNotifPriority] = useState("normal");
  const [sendingNotif, setSendingNotif] = useState(false);

  // Contest form
  const [showContestForm, setShowContestForm] = useState(false);
  const [contestForm, setContestForm] = useState({ title: "", description: "", reward_amount: 1000, max_winners: 10, starts_at: "", ends_at: "" });
  const [savingContest, setSavingContest] = useState(false);

  // Contest detail
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [participants, setParticipants] = useState<(ContestParticipant & { profile?: UserProfile })[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Activity tab
  const [chatActivity, setChatActivity] = useState<ChatActivityRow[]>([]);
  const [activitySubTab, setActivitySubTab] = useState<"chatty" | "online">("chatty");
  const [activityLoading, setActivityLoading] = useState(false);

  // Verifications tab
  const [verifications, setVerifications] = useState<(VerificationApplication & { profile?: UserProfile })[]>([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifNotes, setVerifNotes] = useState<Record<string, string>>({});

  const loadVerifications = async () => {
    setVerifLoading(true);
    const { data: apps } = await supabase
      .from("verification_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = Array.from(new Set((apps || []).map((a) => a.user_id)));
    const profMap = new Map<string, UserProfile>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, rank")
        .in("user_id", ids);
      (profs || []).forEach((p) => profMap.set(p.user_id, p as UserProfile));
    }
    setVerifications((apps || []).map((a) => ({ ...a, profile: profMap.get(a.user_id) })));
    setVerifLoading(false);
  };

  const reviewVerification = async (id: string, action: "approve" | "reject") => {
    const notes = verifNotes[id]?.trim() || null;
    const { error } = await supabase.rpc(
      action === "approve" ? "approve_verification" : "reject_verification",
      {
        p_admin_id: user!.id,
        p_application_id: id,
        p_notes: notes,
      }
    );
    if (error) { toast.error(error.message || "Failed"); return; }
    toast.success(action === "approve" ? "Verified" : "Rejected & refunded");
    void loadVerifications();
  };

  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) { toast.error("Title and message are required"); return; }
    setSendingNotif(true);
    const { error } = await supabase.from("global_notifications").insert({
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      priority: notifPriority,
      sent_by: user!.id,
    });
    setSendingNotif(false);
    if (error) { toast.error("Failed to send notification"); return; }
    setNotifTitle("");
    setNotifMessage("");
    setNotifPriority("normal");
    toast.success("Notification sent to all users!");
  };

  const checkAdmin = useCallback(async () => {
    const { data } = await supabase.rpc("is_super_admin", { p_user_id: user!.id });
    if (!data) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
    loadAllData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkAdmin();
  }, [user, checkAdmin]);

  const loadAllData = async () => {
    const [usersRes, reportsRes, withdrawalsRes, roomsRes, contestsRes, pagesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("moderation_reports").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("rooms").select("id, name, type, created_at, is_active").neq("type", "dm").order("created_at", { ascending: false }).limit(200),
      supabase.from("contests").select("*").order("created_at", { ascending: false }),
      supabase.from("pages").select("id, name, category, followers_count, owner_id, created_at, profile_image").order("created_at", { ascending: false }).limit(200),
    ]);

    const u = (usersRes.data || []) as UserProfile[];
    const r = (reportsRes.data || []) as Report[];
    const w = (withdrawalsRes.data || []) as Withdrawal[];
    const rm = (roomsRes.data || []) as RoomInfo[];
    const c = (contestsRes.data || []) as Contest[];

    setUsers(u);
    setReports(r);
    setWithdrawals(w);
    setRooms(rm);
    setPages((pagesRes.data || []) as PageRow[]);
    setContests(c);
    setStats({
      totalUsers: u.length,
      onlineUsers: u.filter(p => p.is_online).length,
      totalRooms: rm.length,
      pendingReports: r.filter(rep => rep.status === "pending").length,
      pendingWithdrawals: w.filter(wd => wd.status === "pending").length,
    });
  };

  const updateReportStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("moderation_reports").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update report"); return; }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    toast.success(`Report ${status}`);
  };

  const processWithdrawal = async (id: string, action: "approved" | "rejected") => {
    if (action === "approved") {
      await supabase.from("withdrawals").update({ status: "approved" }).eq("id", id);
      const { data: processResult, error } = await supabase.functions.invoke("process-withdrawal", { body: { withdrawalId: id } });
      if (error || !processResult?.success) {
        toast.error(processResult?.error || "Failed to process withdrawal via payment provider");
        return;
      }
      toast.success(`Withdrawal approved & transfer initiated! Ref: ${processResult.ref}`);
    } else {
      const wd = withdrawals.find(w => w.id === id);
      if (wd) {
        await supabase.rpc("refund_earned_coins", {
          p_user_id: wd.user_id,
          p_amount: wd.amount,
          p_description: "Withdrawal rejected by admin",
        });
      }
      await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id);
      toast.success("Withdrawal rejected & coins refunded");
    }
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: action } : w));
  };

  const deleteRoom = async (roomId: string) => {
    if (!window.confirm("Delete this room permanently?")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) { toast.error("Failed to delete room"); return; }
    setRooms(prev => prev.filter(r => r.id !== roomId));
    toast.success("Room deleted");
  };

  const deletePage = async (pageId: string) => {
    if (!window.confirm("Delete this page permanently? All its posts will be hidden.")) return;
    const { error } = await supabase.from("pages").delete().eq("id", pageId);
    if (error) { toast.error("Failed to delete page"); return; }
    setPages(prev => prev.filter(p => p.id !== pageId));
    toast.success("Page deleted");
  };

  const toggleMonetization = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_monetized: !current }).eq("user_id", userId);
    if (error) { toast.error("Failed"); return; }
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_monetized: !current } : u));
    toast.success(!current ? "User monetized" : "Monetization removed");
  };

  const loadActivity = async () => {
    setActivityLoading(true);
    const { data, error } = await supabase.rpc("admin_get_chat_activity", {
      p_admin_id: user!.id, p_days: 7, p_limit: 100,
    });
    setActivityLoading(false);
    if (error) { toast.error("Failed to load activity"); return; }
    setChatActivity((data || []) as ChatActivityRow[]);
  };

  const suspendUser = async (userId: string, currentlySuspended: boolean) => {
    if (currentlySuspended) {
      const { error } = await supabase.rpc("admin_unsuspend_user", { p_admin_id: user!.id, p_user_id: userId });
      if (error) { toast.error(error.message); return; }
      toast.success("Account unsuspended");
    } else {
      const reason = window.prompt("Reason for suspension (optional):") || "";
      const { error } = await supabase.rpc("admin_suspend_user", { p_admin_id: user!.id, p_user_id: userId, p_reason: reason });
      if (error) { toast.error(error.message); return; }
      toast.success("Account suspended");
    }
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_suspended: !currentlySuspended } : u));
    setChatActivity(prev => prev.map(u => u.user_id === userId ? { ...u, is_suspended: !currentlySuspended } : u));
  };

  const deleteUserAccount = async (userId: string) => {
    if (!window.confirm("Permanently delete this account? This cannot be undone.")) return;
    const { data, error } = await supabase.functions.invoke<{ error?: string }>("admin-delete-user", {
      body: { target_user_id: userId },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message || "Failed"); return; }
    setUsers(prev => prev.filter(u => u.user_id !== userId));
    setChatActivity(prev => prev.filter(u => u.user_id !== userId));
    toast.success("Account deleted");
  };

  // Contest functions
  const createContest = async () => {
    if (!contestForm.title.trim()) { toast.error("Title is required"); return; }
    setSavingContest(true);
    const { data, error } = await supabase.from("contests").insert({
      title: contestForm.title.trim(),
      description: contestForm.description.trim() || null,
      reward_amount: contestForm.reward_amount,
      max_winners: contestForm.max_winners,
      starts_at: contestForm.starts_at || null,
      ends_at: contestForm.ends_at || null,
      created_by: user!.id,
      status: "draft",
    }).select().single();
    setSavingContest(false);
    if (error) { toast.error("Failed to create contest"); return; }
    setContests(prev => [data as Contest, ...prev]);
    setShowContestForm(false);
    setContestForm({ title: "", description: "", reward_amount: 1000, max_winners: 10, starts_at: "", ends_at: "" });
    toast.success("Contest created!");
  };

  const updateContestStatus = async (contestId: string, status: string) => {
    const contest = contests.find(c => c.id === contestId);
    const { error } = await supabase.from("contests").update({ status }).eq("id", contestId);
    if (error) { toast.error("Failed to update contest"); return; }
    setContests(prev => prev.map(c => c.id === contestId ? { ...c, status } : c));
    if (selectedContest?.id === contestId) setSelectedContest(prev => prev ? { ...prev, status } : null);
    toast.success(`Contest ${status === "active" ? "started" : "ended"}!`);

    // Auto-announce when contest starts
    if (status === "active" && contest && user) {
      await supabase.from("global_notifications").insert({
        title: `🏆 New Contest: ${contest.title}`,
        message: `${contest.description || contest.title}\n\nReward: ${contest.reward_amount} coins per winner${contest.ends_at ? `\nEnds: ${new Date(contest.ends_at).toLocaleDateString()}` : ""}\n\nJoin now from the Contests page!`,
        sent_by: user.id,
        priority: "important",
      });
    }
  };

  const deleteContest = async (contestId: string) => {
    if (!window.confirm("Delete this contest?")) return;
    const { error } = await supabase.from("contests").delete().eq("id", contestId);
    if (error) { toast.error("Failed to delete"); return; }
    setContests(prev => prev.filter(c => c.id !== contestId));
    if (selectedContest?.id === contestId) setSelectedContest(null);
    toast.success("Contest deleted");
  };

  const openContestDetail = async (contest: Contest) => {
    setSelectedContest(contest);
    setLoadingParticipants(true);
    const { data: parts } = await supabase.from("contest_participants").select("*").eq("contest_id", contest.id).order("joined_at", { ascending: false });
    const participantList = (parts || []) as ContestParticipant[];
    if (participantList.length > 0) {
      const userIds = participantList.map(p => p.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url, rank, coins, is_monetized, total_online_minutes, is_online, created_at").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p as UserProfile]));
      setParticipants(participantList.map(p => ({ ...p, profile: profileMap.get(p.user_id) })));
    } else {
      setParticipants([]);
    }
    setLoadingParticipants(false);
  };

  const rewardParticipant = async (contestId: string, userId: string) => {
    const { error } = await supabase.rpc("reward_contest_participant", {
      p_admin_id: user!.id,
      p_contest_id: contestId,
      p_user_id: userId,
    });
    if (error) { toast.error(error.message); return; }
    setParticipants(prev => prev.map(p => p.user_id === userId ? { ...p, rewarded: true } : p));
    toast.success("User rewarded!");
  };

  const rewardAllParticipants = async (contestId: string) => {
    const unrewarded = participants.filter(p => !p.rewarded);
    if (unrewarded.length === 0) { toast.info("All participants already rewarded"); return; }
    if (!window.confirm(`Reward ${unrewarded.length} participants?`)) return;
    let success = 0;
    for (const p of unrewarded) {
      const { error } = await supabase.rpc("reward_contest_participant", {
        p_admin_id: user!.id,
        p_contest_id: contestId,
        p_user_id: p.user_id,
      });
      if (!error) success++;
    }
    setParticipants(prev => prev.map(p => ({ ...p, rewarded: true })));
    toast.success(`${success} participants rewarded!`);
  };

  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  if (isAdmin === false) return <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4"><Shield className="w-16 h-16 text-muted-foreground" /><p className="text-lg font-semibold text-foreground">Access Denied</p><Button onClick={() => navigate("/")}>Go Home</Button></div>;

  const filteredUsers = searchQuery
    ? users.filter(u => (u.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (u.username || "").toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  const statusColor = (s: string) => s === "draft" ? "bg-muted text-muted-foreground" : s === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700";

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-primary-foreground"><ArrowLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-display font-bold text-primary-foreground">Admin Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        {[
          { label: "Users", value: stats.totalUsers, icon: Users },
          { label: "Online", value: stats.onlineUsers, icon: Users },
          { label: "Rooms", value: stats.totalRooms, icon: MessageSquare },
          { label: "Pending Reports", value: stats.pendingReports, icon: Flag },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-3 shadow-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><s.icon className="w-5 h-5 text-primary" /></div>
            <div><p className="text-lg font-bold text-foreground">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="users" className="px-4">
        <TabsList className="w-full grid grid-cols-9 mb-4">
          <TabsTrigger value="users" className="text-[10px] px-1">Users</TabsTrigger>
          <TabsTrigger value="activity" className="text-[10px] px-1" onClick={() => loadActivity()}>Activity</TabsTrigger>
          <TabsTrigger value="reports" className="text-[10px] px-1">Reports</TabsTrigger>
          <TabsTrigger value="withdrawals" className="text-[10px] px-1">Withdraw</TabsTrigger>
          <TabsTrigger value="verify" className="text-[10px] px-1" onClick={() => loadVerifications()}>Verify</TabsTrigger>
          <TabsTrigger value="rooms" className="text-[10px] px-1">Rooms</TabsTrigger>
          <TabsTrigger value="pages" className="text-[10px] px-1">Pages</TabsTrigger>
          <TabsTrigger value="contests" className="text-[10px] px-1">Contests</TabsTrigger>
          <TabsTrigger value="notify" className="text-[10px] px-1">Notify</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users..." className="pl-9 h-10 rounded-xl" />
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filteredUsers.map(u => (
              <div key={u.user_id} className="bg-card rounded-xl p-3 shadow-card flex items-center gap-3">
                <UserAvatar name={u.display_name || u.username} url={u.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                    {u.display_name || "No name"}
                    {u.is_suspended && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">SUSPENDED</span>}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <RankBadge rank={u.rank} size="sm" showLabel={false} />
                    <span className="text-[10px] text-muted-foreground">{u.coins} coins</span>
                    {u.is_monetized && <span className="text-[10px] text-primary font-semibold">💰</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant={u.is_monetized ? "destructive" : "outline"} onClick={() => toggleMonetization(u.user_id, u.is_monetized)} className="text-[10px] h-6 px-2">
                    {u.is_monetized ? "Unmonetize" : "Monetize"}
                  </Button>
                  <div className="flex gap-1">
                    <Button size="sm" variant={u.is_suspended ? "outline" : "destructive"} onClick={() => suspendUser(u.user_id, !!u.is_suspended)} className="h-6 px-2 text-[10px] flex-1">
                      {u.is_suspended ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteUserAccount(u.user_id)} className="h-6 px-2 text-[10px]">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant={activitySubTab === "chatty" ? "default" : "outline"} className="flex-1 h-8 text-xs" onClick={() => setActivitySubTab("chatty")}>
              <MessageSquare className="w-3 h-3 mr-1" /> Most Chatty (7d)
            </Button>
            <Button size="sm" variant={activitySubTab === "online" ? "default" : "outline"} className="flex-1 h-8 text-xs" onClick={() => setActivitySubTab("online")}>
              <Activity className="w-3 h-3 mr-1" /> Most Online
            </Button>
          </div>
          {activityLoading && <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {[...chatActivity]
              .sort((a, b) => activitySubTab === "chatty"
                ? Number(b.message_count) - Number(a.message_count)
                : (b.total_online_minutes || 0) - (a.total_online_minutes || 0))
              .slice(0, 50)
              .map((u, idx) => (
                <div key={u.user_id} className="bg-card rounded-xl p-3 shadow-card flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <UserAvatar name={u.display_name || u.username} url={u.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                      {u.display_name || u.username || "User"}
                      {u.is_online && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                      {u.is_suspended && <span className="text-[9px] px-1 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">SUSP</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {activitySubTab === "chatty"
                        ? `${u.message_count} msgs · ${u.total_online_minutes}min`
                        : `${u.total_online_minutes} min · ${u.message_count} msgs`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant={u.is_suspended ? "outline" : "destructive"} onClick={() => suspendUser(u.user_id, !!u.is_suspended)} className="h-7 px-2 text-[10px]">
                      {u.is_suspended ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteUserAccount(u.user_id)} className="h-7 px-2 text-[10px]">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            {!activityLoading && chatActivity.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No activity data yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {reports.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No reports</p>}
            {reports.map(r => (
              <div key={r.id} className="bg-card rounded-xl p-3 shadow-card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.reason}</p>
                    {r.details && <p className="text-xs text-muted-foreground mt-0.5">{r.details}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === "pending" ? "bg-yellow-100 text-yellow-700" : r.status === "resolved" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {r.status}
                  </span>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => updateReportStatus(r.id, "resolved")}><CheckCircle className="w-3 h-3 mr-1" />Resolve</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateReportStatus(r.id, "dismissed")}><XCircle className="w-3 h-3 mr-1" />Dismiss</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="withdrawals">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {withdrawals.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No withdrawals</p>}
            {withdrawals.map(w => (
              <div key={w.id} className="bg-card rounded-xl p-3 shadow-card">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-foreground">₦{w.naira_amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{w.account_name} • {getBankName(w.bank_code)} • {w.account_number}</p>
                    <p className="text-[10px] text-muted-foreground">{w.amount.toLocaleString()} coins • {new Date(w.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${w.status === "pending" ? "bg-yellow-100 text-yellow-700" : w.status === "approved" || w.status === "completed" ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                    {w.status}
                  </span>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => processWithdrawal(w.id, "approved")}><Banknote className="w-3 h-3 mr-1" />Approve</Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={() => processWithdrawal(w.id, "rejected")}><XCircle className="w-3 h-3 mr-1" />Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="verify">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {verifLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!verifLoading && verifications.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No verification applications</p>
            )}
            {verifications.map((v) => (
              <div key={v.id} className="bg-card rounded-xl p-3 shadow-card">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={v.profile?.display_name || v.profile?.username}
                    url={v.profile?.avatar_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {v.profile?.display_name || "Unknown"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      @{v.profile?.username || "—"} • {v.profile?.rank || "—"} • ₦{Number(v.amount_ngn).toLocaleString()} • {new Date(v.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.status === "pending" ? "bg-yellow-100 text-yellow-700" : v.status === "approved" ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"}`}>
                    {v.status}
                  </span>
                </div>
                {v.status === "pending" && (
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="Optional reviewer note"
                      value={verifNotes[v.id] || ""}
                      onChange={(e) => setVerifNotes((p) => ({ ...p, [v.id]: e.target.value }))}
                      className="h-8 text-xs rounded-lg"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => reviewVerification(v.id, "approve")}>
                        <BadgeCheck className="w-3 h-3 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={() => reviewVerification(v.id, "reject")}>
                        <XCircle className="w-3 h-3 mr-1" />Reject & refund
                      </Button>
                    </div>
                  </div>
                )}
                {v.review_notes && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Note: {v.review_notes}</p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rooms">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {rooms.map(r => (
              <div key={r.id} className="bg-card rounded-xl p-3 shadow-card flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground">{r.type} • {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Button size="sm" variant="destructive" className="h-7" onClick={() => deleteRoom(r.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pages">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {pages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No pages yet.</p>
            ) : pages.map(p => (
              <div key={p.id} className="bg-card rounded-xl p-3 shadow-card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                  {p.profile_image ? <img src={p.profile_image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">{p.name[0]}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.category} • {p.followers_count} followers</p>
                </div>
                <Button size="sm" variant="outline" className="h-7" onClick={() => navigate(`/pages/${p.id}`)}>View</Button>
                <Button size="sm" variant="destructive" className="h-7" onClick={() => deletePage(p.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Contests Tab */}
        <TabsContent value="contests">
          <div className="space-y-3">
            <Button onClick={() => setShowContestForm(true)} className="w-full rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Create Contest
            </Button>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {contests.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No contests yet</p>}
              {contests.map(c => (
                <div key={c.id} className="bg-card rounded-xl p-3 shadow-card">
                  <div className="flex justify-between items-start">
                    <button onClick={() => openContestDetail(c)} className="text-left flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-primary font-semibold">{c.reward_amount} coins/winner</span>
                        {c.starts_at && <span className="text-[10px] text-muted-foreground">Start: {new Date(c.starts_at).toLocaleDateString()}</span>}
                        {c.ends_at && <span className="text-[10px] text-muted-foreground">End: {new Date(c.ends_at).toLocaleDateString()}</span>}
                      </div>
                    </button>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${statusColor(c.status)}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {c.status === "draft" && (
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => updateContestStatus(c.id, "active")}>
                        <Play className="w-3 h-3 mr-1" />Start
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateContestStatus(c.id, "ended")}>
                        <Square className="w-3 h-3 mr-1" />End
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openContestDetail(c)}>
                      <Trophy className="w-3 h-3 mr-1" />Manage
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteContest(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notify">
          <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
            <h3 className="text-sm font-bold text-foreground">Send Global Notification</h3>
            <Input placeholder="Notification Title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="rounded-xl" />
            <textarea placeholder="Notification Message" value={notifMessage} onChange={(e) => setNotifMessage(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Priority:</span>
              <button onClick={() => setNotifPriority("normal")} className={`text-xs px-3 py-1 rounded-full transition-colors ${notifPriority === "normal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Normal</button>
              <button onClick={() => setNotifPriority("important")} className={`text-xs px-3 py-1 rounded-full transition-colors ${notifPriority === "important" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>Important</button>
            </div>
            <Button onClick={sendNotification} disabled={sendingNotif} className="w-full rounded-xl">
              <Send className="w-4 h-4 mr-1" />{sendingNotif ? "Sending..." : "Send to All Users"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Contest Dialog */}
      <Dialog open={showContestForm} onOpenChange={setShowContestForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Contest</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Contest Title" value={contestForm.title} onChange={e => setContestForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            <textarea placeholder="Description (optional)" value={contestForm.description} onChange={e => setContestForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px] resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Reward (coins)</label>
                <Input type="number" value={contestForm.reward_amount} onChange={e => setContestForm(p => ({ ...p, reward_amount: Number(e.target.value) }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max Winners</label>
                <Input type="number" value={contestForm.max_winners} onChange={e => setContestForm(p => ({ ...p, max_winners: Number(e.target.value) }))} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="datetime-local" value={contestForm.starts_at} onChange={e => setContestForm(p => ({ ...p, starts_at: e.target.value }))} className="rounded-xl text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="datetime-local" value={contestForm.ends_at} onChange={e => setContestForm(p => ({ ...p, ends_at: e.target.value }))} className="rounded-xl text-xs" />
              </div>
            </div>
            <Button onClick={createContest} disabled={savingContest} className="w-full rounded-xl">
              {savingContest ? "Creating..." : "Create Contest"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contest Detail / Participants Dialog */}
      <Dialog open={!!selectedContest} onOpenChange={(open) => !open && setSelectedContest(null)}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              {selectedContest?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedContest && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(selectedContest.status)}`}>{selectedContest.status}</span>
                <span className="text-xs text-primary font-semibold">{selectedContest.reward_amount} coins/winner</span>
              </div>
              {selectedContest.description && <p className="text-xs text-muted-foreground">{selectedContest.description}</p>}

              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-foreground">Participants ({participants.length})</h4>
                {participants.some(p => !p.rewarded) && (
                  <Button size="sm" className="h-7 text-xs" onClick={() => rewardAllParticipants(selectedContest.id)}>
                    <Gift className="w-3 h-3 mr-1" />Reward All
                  </Button>
                )}
              </div>

              {loadingParticipants ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              ) : participants.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No participants yet</p>
              ) : (
                <div className="space-y-2">
                  {participants.map(p => (
                    <div key={p.id} className="bg-muted rounded-xl p-2.5 flex items-center gap-2">
                      <UserAvatar name={p.profile?.display_name || p.profile?.username} url={p.profile?.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{p.profile?.display_name || p.profile?.username || "User"}</p>
                        <p className="text-[10px] text-muted-foreground">Joined {new Date(p.joined_at).toLocaleDateString()}</p>
                      </div>
                      {p.rewarded ? (
                        <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Rewarded ✓</span>
                      ) : (
                        <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => rewardParticipant(selectedContest.id, p.user_id)}>
                          <Gift className="w-3 h-3 mr-0.5" />Reward
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
