import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import ProfileBadges from "@/components/ProfileBadges";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Camera, Type as TypeIcon, Video as VideoIcon, X, Send, Eye, Trash2, Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StatusRow = {
  id: string;
  user_id: string;
  type: "photo" | "video" | "text";
  media_url: string | null;
  caption: string | null;
  bg_color: string | null;
  text_content: string | null;
  created_at: string;
  expires_at: string;
};

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Group = { profile: ProfileLite; statuses: StatusRow[] };

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

const TEXT_BG_COLORS = [
  "hsl(145, 72%, 40%)",
  "hsl(220, 80%, 55%)",
  "hsl(340, 80%, 55%)",
  "hsl(20, 90%, 55%)",
  "hsl(280, 70%, 55%)",
  "hsl(0, 0%, 15%)",
];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function StatusPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myStatuses, setMyStatuses] = useState<StatusRow[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState<{ group: Group; index: number } | null>(null);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    // Get all viewable statuses (RLS filters to friends + self, non-expired)
    const { data: statuses } = await supabase
      .from("statuses")
      .select("*")
      .order("created_at", { ascending: true });

    const list = (statuses as StatusRow[] | null) || [];
    const userIds = Array.from(new Set(list.map((s) => s.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds)
      : { data: [] as ProfileLite[] };
    const profMap = new Map((profs || []).map((p) => [p.user_id, p as ProfileLite]));

    const grouped = new Map<string, Group>();
    for (const s of list) {
      const p = profMap.get(s.user_id) || { user_id: s.user_id, display_name: null, username: null, avatar_url: null };
      const g = grouped.get(s.user_id) || { profile: p, statuses: [] };
      g.statuses.push(s);
      grouped.set(s.user_id, g);
    }

    const mine = grouped.get(user.id)?.statuses || [];
    const others = Array.from(grouped.values()).filter((g) => g.profile.user_id !== user.id);
    // Newest activity first
    others.sort((a, b) => {
      const la = a.statuses[a.statuses.length - 1].created_at;
      const lb = b.statuses[b.statuses.length - 1].created_at;
      return lb.localeCompare(la);
    });

    setMyStatuses(mine);
    setGroups(others);
    setLoading(false);
  };

  useEffect(() => {
    void fetchAll();
  }, [user?.id]);

  // Realtime: reflect new posts and deletes immediately for everyone viewing.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("status-page-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "statuses" },
        () => void fetchAll()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myGroup: Group | null = useMemo(
    () =>
      profile && user
        ? {
            profile: {
              user_id: user.id,
              display_name: profile.display_name,
              username: profile.username,
              avatar_url: profile.avatar_url,
            },
            statuses: myStatuses,
          }
        : null,
    [profile, user, myStatuses]
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold flex-1">Status</h1>
        <Button size="sm" onClick={() => setComposerOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* My status row */}
        <section>
          <button
            onClick={() => (myStatuses.length ? setViewer({ group: myGroup!, index: 0 }) : setComposerOpen(true))}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card shadow-card hover:bg-muted/40 transition-colors text-left"
          >
            <div className="relative">
              <UserAvatar name={profile?.display_name} url={profile?.avatar_url} size="md" />
              {myStatuses.length === 0 && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-card">
                  <Plus className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">My status</p>
              <p className="text-xs text-muted-foreground truncate">
                {myStatuses.length
                  ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""} • ${timeAgo(myStatuses[myStatuses.length - 1].created_at)}`
                  : "Tap to share an update"}
              </p>
            </div>
          </button>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Friends' updates</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No status updates from your friends yet.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const last = g.statuses[g.statuses.length - 1];
                return (
                  <button
                    key={g.profile.user_id}
                    onClick={() => setViewer({ group: g, index: 0 })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-card shadow-card hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="p-[2px] rounded-full ring-2 ring-primary">
                      <UserAvatar name={g.profile.display_name || g.profile.username} url={g.profile.avatar_url} size="md" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1">
                        {g.profile.display_name || g.profile.username || "User"}
                        <ProfileBadges userId={g.profile.user_id} size="xs" />
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {g.statuses.length} update{g.statuses.length > 1 ? "s" : ""} • {timeAgo(last.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <StatusComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          setComposerOpen(false);
          void fetchAll();
        }}
      />

      {viewer && (
        <StatusViewer
          group={viewer.group}
          startIndex={viewer.index}
          isMine={viewer.group.profile.user_id === user?.id}
          onClose={() => setViewer(null)}
          onDeleted={() => {
            setViewer(null);
            void fetchAll();
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}

/* -------------- Composer -------------- */

function StatusComposer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"photo" | "video" | "text">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [textContent, setTextContent] = useState("");
  const [bgColor, setBgColor] = useState(TEXT_BG_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setCaption("");
      setTextContent("");
      setTab("photo");
    }
  }, [open]);

  const onPickFile = (f: File | null) => {
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Please choose an image or video");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25MB");
      return;
    }
    setTab(isVideo ? "video" : "photo");
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (tab === "text") {
        const text = textContent.trim();
        if (!text) { toast.error("Write something first"); setSubmitting(false); return; }
        const { error } = await supabase.from("statuses").insert({
          user_id: user.id,
          type: "text",
          text_content: text,
          bg_color: bgColor,
        });
        if (error) throw error;
      } else {
        if (!file) { toast.error("Select a file"); setSubmitting(false); return; }
        const ext = file.name.split(".").pop() || (tab === "video" ? "mp4" : "jpg");
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("statuses").upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("statuses").getPublicUrl(path);
        const { error } = await supabase.from("statuses").insert({
          user_id: user.id,
          type: tab,
          media_url: urlData.publicUrl,
          caption: caption.trim() || null,
        });
        if (error) throw error;
      }
      toast.success("Status posted");
      onCreated();
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "Couldn't post status");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New status</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border">
          {[
            { key: "photo" as const, icon: Camera, label: "Photo" },
            { key: "video" as const, icon: VideoIcon, label: "Video" },
            { key: "text" as const, icon: TypeIcon, label: "Text" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "text" ? (
          <div
            className="rounded-xl p-4 min-h-[200px] flex items-center justify-center"
            style={{ background: bgColor }}
          >
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Type your status…"
              maxLength={280}
              className="bg-transparent border-0 text-white text-center text-xl font-semibold focus-visible:ring-0 placeholder:text-white/70"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-muted">
                {tab === "video" ? (
                  <video src={previewUrl} controls playsInline className="w-full max-h-72 object-contain bg-black" />
                ) : (
                  <img src={previewUrl} alt="preview" className="w-full max-h-72 object-contain bg-black" />
                )}
                <button
                  onClick={() => { setFile(null); setPreviewUrl(null); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center"
                  aria-label="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInput.current?.click()}
                className="w-full py-12 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40"
              >
                Tap to choose a {tab}
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={tab === "video" ? "video/*" : "image/*"}
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              maxLength={200}
            />
          </div>
        )}

        {tab === "text" && (
          <div className="flex gap-2 flex-wrap">
            {TEXT_BG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`w-7 h-7 rounded-full border-2 ${bgColor === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }}
                aria-label="Select color"
              />
            ))}
          </div>
        )}

        <Button onClick={submit} disabled={submitting} className="w-full">
          <Send className="w-4 h-4 mr-2" />
          {submitting ? "Posting…" : "Post status"}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">
          Visible to your friends for 24 hours.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/* -------------- Viewer -------------- */

function StatusViewer({
  group,
  startIndex,
  isMine,
  onClose,
  onDeleted,
}: {
  group: Group;
  startIndex: number;
  isMine: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<(ProfileLite & { viewed_at: string })[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactions, setReactions] = useState<{ user_id: string; emoji: string }[]>([]);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [reactors, setReactors] = useState<(ProfileLite & { emoji: string })[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [paused, setPaused] = useState(false);
  const current = group.statuses[index];

  // Record view
  useEffect(() => {
    if (!current || !user || isMine) return;
    void supabase.from("status_views").insert({ status_id: current.id, viewer_id: user.id });
  }, [current?.id, user?.id, isMine]);

  // Load reactions for current status + realtime
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("status_reactions")
        .select("user_id, emoji")
        .eq("status_id", current.id);
      if (!cancelled) setReactions((data as { user_id: string; emoji: string }[]) || []);
    };
    void load();
    const ch = supabase
      .channel(`status-reactions-${current.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_reactions", filter: `status_id=eq.${current.id}` },
        () => void load()
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [current?.id]);

  // Auto-advance
  useEffect(() => {
    setProgress(0);
    if (!current) return;
    if (current.type === "video") return; // video drives its own duration via onEnded
    const start = Date.now();
    let elapsed = 0;
    let lastTick = Date.now();
    const dur = 5000;
    const id = setInterval(() => {
      const now = Date.now();
      if (!paused) elapsed += now - lastTick;
      lastTick = now;
      const p = Math.min(1, elapsed / dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        next();
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id, paused]);

  const next = () => {
    if (index >= group.statuses.length - 1) onClose();
    else setIndex((i) => i + 1);
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  const loadViewers = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("status_views")
      .select("viewer_id, viewed_at")
      .eq("status_id", current.id)
      .order("viewed_at", { ascending: false });
    const ids = (data || []).map((d) => d.viewer_id);
    if (ids.length === 0) { setViewers([]); setViewersOpen(true); return; }
    const { data: profs } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids);
    const map = new Map((profs || []).map((p) => [p.user_id, p as ProfileLite]));
    setViewers(
      (data || []).map((d) => ({
        ...(map.get(d.viewer_id) || { user_id: d.viewer_id, display_name: null, username: null, avatar_url: null }),
        viewed_at: d.viewed_at,
      }))
    );
    setViewersOpen(true);
  };

  const deleteStatus = async () => {
    if (!current) return;
    setDeleting(true);
    const { error } = await supabase.from("statuses").delete().eq("id", current.id);
    setDeleting(false);
    if (error) {
      toast.error("Couldn't delete");
      return;
    }
    toast.success("Status deleted");
    setConfirmDelete(false);
    onDeleted();
  };

  const myReaction = reactions.find((r) => r.user_id === user?.id)?.emoji || null;

  const toggleReaction = async (emoji: string) => {
    if (!current || !user || isMine) return;
    if (myReaction === emoji) {
      await supabase.from("status_reactions").delete().eq("status_id", current.id).eq("user_id", user.id);
    } else {
      await supabase
        .from("status_reactions")
        .upsert({ status_id: current.id, user_id: user.id, emoji }, { onConflict: "status_id,user_id" });
    }
  };

  const loadReactors = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("status_reactions")
      .select("user_id, emoji")
      .eq("status_id", current.id);
    const list = (data as { user_id: string; emoji: string }[]) || [];
    if (list.length === 0) { setReactors([]); setReactionsOpen(true); return; }
    const ids = list.map((r) => r.user_id);
    const { data: profs } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids);
    const map = new Map((profs || []).map((p) => [p.user_id, p as ProfileLite]));
    setReactors(
      list.map((r) => ({
        ...(map.get(r.user_id) || { user_id: r.user_id, display_name: null, username: null, avatar_url: null }),
        emoji: r.emoji,
      }))
    );
    setReactionsOpen(true);
  };

  const sendReply = async () => {
    if (!current || !user || !replyText.trim() || isMine) return;
    setSendingReply(true);
    try {
      const { data: roomId, error: rErr } = await supabase.rpc("get_or_create_dm_room", {
        user1_id: user.id,
        user2_id: group.profile.user_id,
      });
      if (rErr || !roomId) throw rErr || new Error("Couldn't open chat");
      const quote =
        current.type === "text"
          ? `"${(current.text_content || "").slice(0, 120)}"`
          : current.caption
          ? `"${current.caption.slice(0, 120)}"`
          : `[${current.type} status]`;
      const body = `↩️ Replying to status ${quote}\n\n${replyText.trim()}`;
      const { error: mErr } = await supabase.from("messages").insert({
        room_id: roomId,
        sender_id: user.id,
        type: "text",
        content: body,
      });
      if (mErr) throw mErr;
      toast.success("Reply sent");
      setReplyText("");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't send reply");
    } finally {
      setSendingReply(false);
    }
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {group.statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2">
        <UserAvatar name={group.profile.display_name || group.profile.username} url={group.profile.avatar_url} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate inline-flex items-center gap-1">
            {group.profile.display_name || group.profile.username || "User"}
            <ProfileBadges userId={group.profile.user_id} size="xs" />
          </p>
          <p className="text-white/70 text-[11px]">{timeAgo(current.created_at)}</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center" onClick={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width / 3) prev(); else next();
      }}>
        {current.type === "text" ? (
          <div className="w-full h-full flex items-center justify-center p-8 text-center text-white text-2xl font-semibold" style={{ background: current.bg_color || "hsl(145, 72%, 40%)" }}>
            {current.text_content}
          </div>
        ) : current.type === "video" ? (
          <video
            key={current.id}
            src={current.media_url || undefined}
            autoPlay
            playsInline
            controls={false}
            onEnded={next}
            className="max-h-full max-w-full"
          />
        ) : (
          <img src={current.media_url || ""} alt="status" className="max-h-full max-w-full object-contain" />
        )}

        {current.caption && (
          <div className="absolute bottom-20 left-4 right-4 bg-black/50 backdrop-blur text-white text-sm rounded-lg px-3 py-2 text-center">
            {current.caption}
          </div>
        )}
      </div>

      {isMine && (
        <div className="flex items-center justify-around px-4 py-3 border-t border-white/10">
          <button onClick={(e) => { e.stopPropagation(); void loadViewers(); }} className="flex items-center gap-2 text-white text-sm">
            <Eye className="w-5 h-5" /> Viewers
          </button>
          <button onClick={(e) => { e.stopPropagation(); void loadReactors(); }} className="flex items-center gap-2 text-white text-sm">
            <Heart className="w-5 h-5" /> Reactions {reactions.length > 0 && <span>({reactions.length})</span>}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="flex items-center gap-2 text-destructive text-sm">
            <Trash2 className="w-5 h-5" /> Delete
          </button>
        </div>
      )}

      {!isMine && (
        <div
          className="px-3 py-2 border-t border-white/10 space-y-2"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        >
          <div className="flex items-center justify-around">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => void toggleReaction(e)}
                className={`text-2xl transition-transform active:scale-125 ${myReaction === e ? "scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" : "opacity-80 hover:opacity-100"}`}
                aria-label={`React ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <form
            onSubmit={(ev) => { ev.preventDefault(); void sendReply(); }}
            className="flex items-center gap-2"
          >
            <Input
              value={replyText}
              onChange={(ev) => setReplyText(ev.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              placeholder={`Reply to ${group.profile.display_name || group.profile.username || "user"}…`}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white/40"
              maxLength={500}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!replyText.trim() || sendingReply}
              aria-label="Send reply"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this status?</AlertDialogTitle>
            <AlertDialogDescription>
              This update will disappear immediately for you and your friends. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void deleteStatus(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={viewersOpen} onOpenChange={setViewersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Viewed by {viewers.length}</DialogTitle>
          </DialogHeader>
          {viewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No views yet.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {viewers.map((v) => (
                <div key={v.user_id} className="flex items-center gap-3">
                  <UserAvatar name={v.display_name || v.username} url={v.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.display_name || v.username || "User"}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(v.viewed_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reactionsOpen} onOpenChange={setReactionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactions ({reactors.length})</DialogTitle>
          </DialogHeader>
          {reactors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reactions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {reactors.map((r) => (
                <div key={r.user_id} className="flex items-center gap-3">
                  <UserAvatar name={r.display_name || r.username} url={r.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.display_name || r.username || "User"}</p>
                  </div>
                  <span className="text-xl">{r.emoji}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}