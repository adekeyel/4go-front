import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  conversation_id: string;
  sender_id: string;
  is_agent: boolean;
  content: string;
  created_at: string;
}

export default function SupportLiveChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);

  const ensureConversation = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data: existing } = await supabase
      .from("support_conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let convId = existing?.id ?? null;
    if (!convId) {
      const { data: created, error } = await supabase
        .from("support_conversations")
        .insert({ user_id: user.id, subject: "Support chat" })
        .select("id")
        .single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      convId = created.id;
    }
    setConversationId(convId);
    const { data: msgs } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((msgs || []) as Msg[]);
    setLoading(false);
    if (existing) {
      await supabase.from("support_conversations").update({ unread_for_user: 0 }).eq("id", convId);
    }
  }, [user]);

  useEffect(() => { void ensureConversation(); }, [ensureConversation]);

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`support-chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Msg;
          if (m.is_agent) setAgentTyping(false);
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    const typingCh = supabase
      .channel(`support-typing-${conversationId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (!payload.payload?.is_agent) return;
        setAgentTyping(true);
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setAgentTyping(false), 3000);
      })
      .subscribe();
    typingChannelRef.current = typingCh;

    return () => {
      void supabase.removeChannel(ch);
      void supabase.removeChannel(typingCh);
      typingChannelRef.current = null;
    };
  }, [conversationId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, agentTyping]);

  const broadcastTyping = () => {
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { is_agent: false } });
  };

  const send = async () => {
    if (!user || !conversationId || !text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: conversationId, sender_id: user.id, is_agent: false, content: body,
    });
    setSending(false);
    if (error) { toast.error(error.message); setText(body); }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <MessageCircle className="mx-auto mb-2 h-6 w-6 text-primary" />
        <p className="text-sm text-muted-foreground">Log in to start a live chat with our support team.</p>
        <Button className="mt-3" size="sm" onClick={() => navigate("/login")}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="flex h-[60vh] max-h-[480px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading chat…</p>}
        {!loading && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Send a message and our support team will reply here.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.is_agent ? "justify-start" : "justify-end")}>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
              m.is_agent ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
            )}>
              {m.is_agent && <span className="mb-0.5 block text-[10px] font-semibold text-primary">Support</span>}
              {m.content}
              <span className={cn("mt-0.5 block text-[10px]", m.is_agent ? "text-muted-foreground" : "text-primary-foreground/70")}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        {agentTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">Support is typing…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => { setText(e.target.value); broadcastTyping(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Type your message…"
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}