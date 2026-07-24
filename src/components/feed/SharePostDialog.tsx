import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { Search, Share2, Send, Users } from "lucide-react";
import { toast } from "sonner";

interface ShareTarget {
  type: "dm" | "room";
  id: string; // friend user_id (for DM) or room_id
  name: string;
  avatar_url: string | null;
}

interface SharePostDialogProps {
  postId: string;
  postPreview: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, use the page-post forwarding RPC and link path. */
  pageMode?: boolean;
}

export default function SharePostDialog({ postId, postPreview, open, onOpenChange, pageMode }: SharePostDialogProps) {
  const { user } = useAuth();
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const shareUrl = pageMode
    ? `${window.location.origin}/page-post/${postId}`
    : `${window.location.origin}/feed?post=${postId}`;

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setSelected(new Set());
    setNote("");
    (async () => {
      // Friends
      const { data: friendRows } = await supabase
        .from("friends")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");
      const friendIds = (friendRows || []).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );
      const { data: friendProfiles } = friendIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .in("user_id", friendIds)
        : { data: [] as any[] };

      // Rooms (non-DM)
      const { data: memberRows } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", user.id);
      const roomIds = (memberRows || []).map((r: any) => r.room_id);
      const { data: rooms } = roomIds.length
        ? await supabase
            .from("rooms")
            .select("id, name, avatar_url, type")
            .in("id", roomIds)
            .neq("type", "dm")
        : { data: [] as any[] };

      const list: ShareTarget[] = [
        ...(friendProfiles || []).map((p: any) => ({
          type: "dm" as const,
          id: p.user_id,
          name: p.display_name || p.username || "User",
          avatar_url: p.avatar_url,
        })),
        ...(rooms || []).map((r: any) => ({
          type: "room" as const,
          id: r.id,
          name: r.name,
          avatar_url: r.avatar_url,
        })),
      ];
      setTargets(list);
      setLoading(false);
    })();
  }, [open, user?.id]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filtered = targets.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSend = async () => {
    if (!user || selected.size === 0 || sending) return;
    setSending(true);
    try {
      for (const key of selected) {
        const t = targets.find((x) => `${x.type}:${x.id}` === key);
        if (!t) continue;
        let roomId = t.id;
        if (t.type === "dm") {
          const { data, error } = await supabase.rpc("get_or_create_dm_room", {
            user1_id: user.id,
            user2_id: t.id,
          });
          if (error || !data) continue;
          roomId = data as string;
        }
        const rpcName = pageMode ? "forward_page_post_to_room" : "forward_post_to_room";
        await supabase.rpc(rpcName as any, {
          p_user_id: user.id,
          p_post_id: postId,
          p_room_id: roomId,
          p_note: note || null,
        });
      }
      toast.success(`Shared with ${selected.size} ${selected.size === 1 ? "chat" : "chats"}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed to share");
    } finally {
      setSending(false);
    }
  };

  const handleNativeShare = async () => {
    const data = {
      title: "Check out this post on 4GO",
      text: postPreview.slice(0, 200),
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // user dismissed
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base font-display">Share Post</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2">
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors text-sm font-medium text-foreground"
          >
            <Share2 className="w-4 h-4" /> Share to other apps
          </button>
        </div>

        <div className="px-4 pb-2 relative">
          <Search className="w-4 h-4 absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search friends or rooms..."
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto px-2">
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-6">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">No chats found</p>
          ) : (
            filtered.map((t) => {
              const key = `${t.type}:${t.id}`;
              const isSel = selected.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isSel ? "bg-primary/10" : "hover:bg-accent/50"
                  }`}
                >
                  {t.type === "room" && !t.avatar_url ? (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <UserAvatar url={t.avatar_url} name={t.name} size="sm" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{t.type === "dm" ? "Direct message" : "Room"}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSel ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {isSel && <div className="w-2 h-2 bg-primary-foreground rounded-full" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selected.size > 0 && (
          <div className="border-t border-border p-3 space-y-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              maxLength={200}
            />
            <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
              <Send className="w-4 h-4" />
              {sending ? "Sending..." : `Send to ${selected.size} ${selected.size === 1 ? "chat" : "chats"}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
