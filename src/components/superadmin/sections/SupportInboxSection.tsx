import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import UserAvatar from "@/components/UserAvatar";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";
import { Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvStatus = "open" | "escalated" | "closed" | "resolved";

interface Conversation {
  id: string;
  user_id: string;
  subject: string | null;
  status: ConvStatus;
  last_message: string | null;
  last_message_at: string;
  unread_for_agent: number;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface Msg {
  id: string;
  conversation_id: string;
  sender_id: string;
  is_agent: boolean;
  content: string;
  created_at: string;
}

const STATUS_META: Record<ConvStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-admin-success text-white hover:bg-admin-success" },
  escalated: { label: "Escalated", className: "bg-admin-warning text-white hover:bg-admin-warning" },
  closed: { label: "Closed", className: "" },
  resolved: { label: "Resolved", className: "bg-primary text-primary-foreground" },
};

const FILTERS: Array<{ id: "all" | ConvStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "escalated", label: "Escalated" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export default function SupportInboxSection({ id }: { id: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | ConvStatus>("all");
  const [customerTyping, setCustomerTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);

  const rpc = (n: string, a: object) =>
    (supabase.rpc as never as (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>).call(supabase, n, a);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("support_conversations")
      .select("id,user_id,subject,status,last_message,last_message_at,unread_for_agent")
      .order("last_message_at", { ascending: false })
      .limit(300);
    const convs = (data || []) as Conversation[];
    const ids = [...new Set(convs.map((c) => c.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,avatar_url")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p) => [p.user_id, p]));
      convs.forEach((c) => {
        const p = map.get(c.user_id);
        c.display_name = p?.display_name ?? null;
        c.username = p?.username ?? null;
        c.avatar_url = p?.avatar_url ?? null;
      });
    }
    setConversations(convs);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const ch = supabase
      .channel("support-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => void loadConversations())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [loadConversations]);

  const openConversation = useCallback(async (c: Conversation) => {
    setActive(c);
    setCustomerTyping(false);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true });
    setMessages((data || []) as Msg[]);
    if (c.unread_for_agent > 0) {
      await supabase.from("support_conversations").update({ unread_for_agent: 0 }).eq("id", c.id);
    }
  }, []);

  // Realtime messages + typing for the open conversation
  useEffect(() => {
    if (!active) return;
    const ch = supabase
      .channel(`support-msgs-${active.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${active.id}` },
        (payload) => {
          const m = payload.new as Msg;
          if (!m.is_agent) setCustomerTyping(false);
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    const typingCh = supabase
      .channel(`support-typing-${active.id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.is_agent) return;
        setCustomerTyping(true);
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setCustomerTyping(false), 3000);
      })
      .subscribe();
    typingChannelRef.current = typingCh;

    return () => {
      void supabase.removeChannel(ch);
      void supabase.removeChannel(typingCh);
      typingChannelRef.current = null;
    };
  }, [active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, customerTyping]);

  const broadcastTyping = () => {
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { is_agent: true } });
  };

  const send = async () => {
    if (!active || !me || !text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: active.id, sender_id: me, is_agent: true, content: body,
    });
    setSending(false);
    if (error) { toast.error(error.message); setText(body); return; }
  };

  const changeStatus = async (status: ConvStatus) => {
    if (!active || !me) return;
    const { error } = await rpc("set_support_status", { p_agent_id: me, p_conv: active.id, p_status: status });
    if (error) { toast.error(error.message); return; }
    setActive({ ...active, status });
    toast.success(`Marked as ${STATUS_META[status].label}`);
    void loadConversations();
  };

  const visible = conversations.filter((c) => filter === "all" || c.status === filter);
  const totalUnread = conversations.reduce((n, c) => n + (c.unread_for_agent || 0), 0);

  return (
    <div className="space-y-4">
      <SectionHeader
        title={navItemLabel(id)}
        subtitle={`${conversations.length} conversation${conversations.length === 1 ? "" : "s"}${totalUnread ? ` • ${totalUnread} unread` : ""}`}
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium",
              filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-0 shadow-card">
          {loading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No conversations.</p>
          )}
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              className={cn(
                "flex w-full items-center gap-3 border-b p-3 text-left hover:bg-muted",
                active?.id === c.id && "bg-muted",
              )}
            >
              <UserAvatar url={c.avatar_url} name={c.display_name || c.username} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.display_name || c.username || "User"}</p>
                  {c.unread_for_agent > 0 && <Badge className="h-5 px-1.5">{c.unread_for_agent}</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.last_message || c.subject || "New conversation"}</p>
              </div>
              <Badge variant={c.status === "closed" ? "secondary" : "default"} className={cn("shrink-0 text-[10px]", STATUS_META[c.status]?.className)}>
                {STATUS_META[c.status]?.label ?? c.status}
              </Badge>
            </button>
          ))}
        </Card>

        <Card className="flex max-h-[70vh] min-h-[420px] flex-col shadow-card">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">Select a conversation to reply.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b p-3">
                <div className="flex items-center gap-2">
                  <UserAvatar url={active.avatar_url} name={active.display_name || active.username} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{active.display_name || active.username || "User"}</p>
                    <p className="text-xs text-muted-foreground">@{active.username || "—"}</p>
                  </div>
                </div>
                <Select value={active.status} onValueChange={(v) => changeStatus(v as ConvStatus)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.is_agent ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                      m.is_agent ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}>
                      {m.content}
                      <span className={cn("mt-0.5 block text-[10px]", m.is_agent ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
                {customerTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">typing…</div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="flex items-center gap-2 border-t p-3">
                <Input
                  value={text}
                  onChange={(e) => { setText(e.target.value); broadcastTyping(); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Type your reply…"
                />
                <Button onClick={send} disabled={sending || !text.trim()} size="icon"><Send className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
