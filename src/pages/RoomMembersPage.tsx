import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, ShieldBan, UserPlus, Check, X, Settings, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blockUser } from "@/lib/safety";
import { toast } from "sonner";

interface Member {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_online?: boolean | null;
}

interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  fee_paid: number;
  answers: string[] | null;
  created_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

export default function RoomMembersPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [room, setRoom] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editRules, setEditRules] = useState("");
  const [editFee, setEditFee] = useState(0);
  const [editQuestions, setEditQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    fetchMembers();
    fetchRoomData();
  }, [roomId]);

  const fetchRoomData = async () => {
    if (!roomId || !user) return;
    const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    setRoom(r);
    setEditRules((r as any)?.rules || "");
    setEditFee((r as any)?.join_fee || 0);
    setEditQuestions((r as any)?.join_questions || []);

    const { data: membership } = await supabase.from("room_members").select("role").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
    const admin = membership?.role === "admin";
    setIsAdmin(admin);

    if (admin) {
      const { data: requests } = await supabase.from("room_join_requests").select("*").eq("room_id", roomId).eq("status", "pending").order("created_at", { ascending: true }) as any;
      if (requests && requests.length > 0) {
        const userIds = requests.map((r: any) => r.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds);
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
        setJoinRequests(requests.map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) })));
      }
    }
  };

  const fetchMembers = async () => {
    const { data: rm } = await supabase.from("room_members").select("user_id").eq("room_id", roomId!);
    if (rm && rm.length > 0) {
      const ids = rm.map((m) => m.user_id).filter((id) => id !== user?.id);
      if (ids.length === 0) { setMembers([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url, is_online").in("user_id", ids);
      setMembers(profiles || []);
    }
  };

  const handleApproveRequest = async (request: JoinRequest) => {
    if (!roomId || !user) return;
    const { error } = await supabase.rpc("approve_join_request", {
      p_admin_id: user.id,
      p_request_id: request.id,
    } as any);
    if (error) {
      toast.error(error.message || "Couldn't approve request");
      return;
    }
    setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
    toast.success(`${request.profile?.display_name || "User"} approved!`);
    fetchMembers();
  };

  const handleRejectRequest = async (request: JoinRequest) => {
    if (!user) return;
    const { error } = await supabase.rpc("reject_join_request", {
      p_admin_id: user.id,
      p_request_id: request.id,
    } as any);
    if (error) {
      toast.error(error.message || "Couldn't decline request");
      return;
    }
    setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
    toast.success("Request declined. Fee refunded.");
  };

  const addQuestion = () => {
    const q = newQuestion.trim();
    if (!q || editQuestions.length >= 5) return;
    setEditQuestions([...editQuestions, q]);
    setNewQuestion("");
  };

  const removeQuestion = (index: number) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== index));
  };

  const saveRoomSettings = async () => {
    if (!roomId) return;
    setSavingSettings(true);
    const { error } = await supabase.from("rooms").update({
      rules: editRules.trim() || null,
      join_fee: editFee,
      join_questions: editQuestions.length > 0 ? editQuestions : null,
    } as any).eq("id", roomId);
    if (error) toast.error("Couldn't save settings");
    else { toast.success("Room settings saved!"); setShowSettings(false); }
    setSavingSettings(false);
  };

  const addFriend = async (addresseeId: string) => {
    if (!user) return;
    setSending(addresseeId);
    const { data: existing } = await supabase.from("friends").select("id, status").or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`).maybeSingle();
    if (existing) { toast.info(existing.status === "accepted" ? "Already friends!" : "Request already sent!"); setSending(null); return; }
    const { error } = await supabase.from("friends").insert({ requester_id: user.id, addressee_id: addresseeId });
    if (error) toast.error("Failed to send request"); else toast.success("Friend request sent! 🤝");
    setSending(null);
  };

  const handleBlock = async (member: Member) => {
    if (!user) return;
    const confirmed = window.confirm(`Block ${member.display_name || member.username || "this user"}?`);
    if (!confirmed) return;
    const { error } = await blockUser({ blockerId: user.id, blockedId: member.user_id, reason: "Blocked from room members" });
    if (error) { toast.error("Couldn't block user"); return; }
    setMembers((current) => current.filter((entry) => entry.user_id !== member.user_id));
    toast.success("User blocked");
  };

  const roomQuestions: string[] = (room as any)?.join_questions || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-display font-bold text-primary-foreground flex-1">Room Members</h1>
        {isAdmin && (
          <button
            onClick={() => {
              const link = `${window.location.origin}/room/${roomId}`;
              navigator.clipboard.writeText(link).then(() => toast.success("Room link copied! Share it to invite users 🔗")).catch(() => toast.error("Failed to copy link"));
            }}
            className="text-primary-foreground/80 hover:text-primary-foreground mr-1"
            title="Share room link"
          >
            <Share2 className="w-5 h-5" />
          </button>
        )}
        {isAdmin && room?.type === "private" && (
          <button onClick={() => setShowSettings(!showSettings)} className="text-primary-foreground/80 hover:text-primary-foreground">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Room Settings */}
      {showSettings && isAdmin && room?.type === "private" && (
        <div className="px-4 pt-4 space-y-3 border-b border-border pb-4">
          <h2 className="text-sm font-semibold text-foreground">⚙️ Room Settings</h2>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Room Rules</label>
            <Textarea value={editRules} onChange={(e) => setEditRules(e.target.value)} placeholder="Rules for joining..." maxLength={500} className="rounded-xl resize-none text-sm" rows={3} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Joining Fee (coins)</label>
            <Input type="number" value={editFee || ""} onChange={(e) => setEditFee(Math.max(0, parseInt(e.target.value) || 0))} min={0} className="h-10 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Screening Questions (max 5)</label>
            {editQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-foreground bg-muted rounded-lg px-3 py-2 flex-1">{q}</span>
                <button onClick={() => removeQuestion(i)} className="text-destructive"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {editQuestions.length < 5 && (
              <div className="flex gap-2">
                <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Add a question..." maxLength={200} className="h-9 rounded-xl text-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } }} />
                <Button type="button" size="sm" onClick={addQuestion} disabled={!newQuestion.trim()} className="rounded-lg">+</Button>
              </div>
            )}
          </div>
          <Button onClick={saveRoomSettings} disabled={savingSettings} size="sm" className="rounded-lg gradient-primary text-primary-foreground">
            {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}

      {/* Pending Join Requests */}
      {isAdmin && joinRequests.length > 0 && (
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">📩 Join Requests ({joinRequests.length})</h2>
          <div className="space-y-2 mb-4">
            {joinRequests.map((req) => (
              <div key={req.id} className="p-3 bg-card rounded-xl shadow-card">
                <div className="flex items-center gap-3">
                  <UserAvatar name={req.profile?.display_name || req.profile?.username} url={req.profile?.avatar_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{req.profile?.display_name || req.profile?.username || "User"}</p>
                    {req.fee_paid > 0 && <p className="text-[10px] text-primary">Paid {req.fee_paid} coins</p>}
                    {req.answers && req.answers.length > 0 && (
                      <button onClick={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)} className="text-[10px] text-primary underline">
                        {expandedRequest === req.id ? "Hide answers" : "View answers"}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="icon" className="rounded-lg w-8 h-8 gradient-primary text-primary-foreground" onClick={() => handleApproveRequest(req)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="rounded-lg w-8 h-8" onClick={() => handleRejectRequest(req)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {expandedRequest === req.id && req.answers && roomQuestions.length > 0 && (
                  <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-primary/30">
                    {roomQuestions.map((q, i) => (
                      <div key={i}>
                        <p className="text-[10px] font-semibold text-muted-foreground">{q}</p>
                        <p className="text-xs text-foreground">{req.answers?.[i] || "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-2">
        {members.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No other members</p>
        )}
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-card">
            <UserAvatar name={m.display_name || m.username} url={m.avatar_url} size="md" online={m.is_online} showOnline />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{m.display_name}</p>
              <p className="text-xs text-muted-foreground">{m.username ? `@${m.username}` : "Room member"}{m.is_online ? " • online" : " • offline"}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addFriend(m.user_id)} disabled={sending === m.user_id} className="rounded-lg gradient-primary text-primary-foreground">
                <UserPlus className="w-4 h-4 mr-1" />{sending === m.user_id ? "..." : "Add"}
              </Button>
              <Button size="icon" variant="outline" className="rounded-lg" onClick={() => void handleBlock(m)}>
                <ShieldBan className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
