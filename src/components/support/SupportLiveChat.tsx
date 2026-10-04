import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyConversations, createConversation, listSupportMessages, sendSupportMessage, markSupportRead } from "@/api/support";
import { useSocket } from "@/sockets/SocketContext";
import { apiErrorMessage } from "@/lib/apiClient";
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
  const socket = useSocket();
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);

  const ensureConversation = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      // Your newest conversation, if any. A new one is only created with your first message.
      const [existing] = await listMyConversations();
      if (existing) {
        setConversationId(existing.id);
        setMessages(await listSupportMessages(existing.id));
        if (existing.unread_for_user > 0) void markSupportRead(existing.id).catch(() => undefined);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't load your chat"));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void ensureConversation(); }, [ensureConversation]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const reload = async () => {
      try {
        const msgs = await listSupportMessages(conversationId);
        if (cancelled) return;
        setMessages(msgs);
        if (msgs.some((m) => m.is_agent)) setAgentTyping(false);
        void markSupportRead(conversationId).catch(() => undefined);
      } catch {
        /* keep what we have */
      }
    };
    // The server notifies (without the text) when an agent replies; fetch the new messages.
    const onMessage = (ev: { conversationId: string }) => {
      if (ev.conversationId === conversationId) void reload();
    };
    const onTyping = (ev: { conversationId: string; userId: string; typing: boolean }) => {
      if (ev.conversationId !== conversationId || ev.userId === user?.id) return;
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      setAgentTyping(!!ev.typing);
      if (ev.typing) typingTimer.current = window.setTimeout(() => setAgentTyping(false), 3000);
    };
    socket?.emit("support:join", conversationId);
    socket?.on("support:message", onMessage);
    socket?.on("support:typing", onTyping);

    return () => {
      cancelled = true;
      socket?.emit("support:leave", conversationId);
      socket?.off("support:message", onMessage);
      socket?.off("support:typing", onTyping);
    };
  }, [conversationId, socket, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, agentTyping]);

  const broadcastTyping = () => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return; // don't spam the socket on every keystroke
    lastTypingSent.current = now;
    socket?.emit("support:typing", { conversationId, typing: true });
  };

  const send = async () => {
    if (!user || !conversationId || !text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    try {
      if (!conversationId) {
        // First message: the server creates the conversation together with it.
        const created = await createConversation(body, "Support chat");
        setConversationId(created.conversation.id);
        setMessages([created.message]);
      } else {
        const m = await sendSupportMessage(conversationId, body);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't send"));
      setText(body);
    }
    setSending(false);
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