import { ArrowLeft, Mail, Clock, HelpCircle, MessageCircle, ShieldCheck, MessagesSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import PageFooter from "@/components/PageFooter";
import UserAvatar from "@/components/UserAvatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import SupportLiveChat from "@/components/support/SupportLiveChat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SUPPORT_AGENT_USERNAMES } from "@/lib/supportAgents";

const supportTopics = [
  "Account issues",
  "Withdrawal issues",
  "Ranking questions",
  "Monetization inquiries",
  "Technical errors",
  "Reporting abuse",
];

interface AgentProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
}

export default function SupportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, is_online")
        .in("username", SUPPORT_AGENT_USERNAMES as unknown as string[]);
      if (!cancelled && data) {
        // Preserve the requested order
        const ordered = SUPPORT_AGENT_USERNAMES
          .map((u) => data.find((a) => a.username === u))
          .filter(Boolean) as AgentProfile[];
        setAgents(ordered);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startChat = async (agentId: string) => {
    if (!user) {
      navigate("/login");
      return;
    }
    const { data, error } = await supabase.rpc("get_or_create_dm_room", {
      user1_id: user.id,
      user2_id: agentId,
    });
    if (!error && data) navigate(`/room/${data}`);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground" aria-label="Go back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Support / Help Center</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 text-foreground">
        <p className="text-muted-foreground text-sm leading-relaxed">
          4GO Support helps users with a variety of issues. We're here to assist you.
        </p>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-primary" />
            Live Chat
          </h2>
          <p className="text-xs text-muted-foreground">
            Chat with our support team in real time. Replies appear here instantly.
          </p>
          <SupportLiveChat />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            We Can Help With
          </h2>
          <ul className="space-y-2">
            {supportTopics.map((topic) => (
              <li
                key={topic}
                className="flex items-center gap-3 rounded-lg bg-card border border-border px-4 py-3 text-sm text-muted-foreground"
              >
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                {topic}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Customer Support Agents
          </h2>
          <p className="text-xs text-muted-foreground">
            Reach out to one of our verified agents directly inside 4GO.
          </p>
          <div className="space-y-2">
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading agents…</p>
            ) : (
              agents.map((a) => (
                <button
                  key={a.user_id}
                  onClick={() => startChat(a.user_id)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border text-left hover:border-primary/50 transition-colors"
                >
                  <UserAvatar
                    name={a.display_name || a.username}
                    url={a.avatar_url}
                    size="md"
                    online={a.is_online}
                    showOnline
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {a.display_name || a.username}
                      <VerifiedBadge />
                    </p>
                    <p className="text-xs text-muted-foreground truncate">@{a.username} · Support agent</p>
                  </div>
                  <MessageCircle className="w-4 h-4 text-primary shrink-0" />
                </button>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Contact Support
          </h2>
          <div className="rounded-lg bg-card border border-border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email Support</p>
                <a
                  href="mailto:harryp5873@gmail.com"
                  className="text-sm text-primary font-medium underline"
                >
                  harryp5873@gmail.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Response Time</p>
                <p className="text-sm font-medium">24–72 hours</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* JSON-LD: Organization + ContactPoints for richer Google indexing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "4GO Technology LTD",
            url: "https://4go.com.ng",
            logo: "https://4go.com.ng/icons/icon-192.png",
            sameAs: ["https://4go.com.ng"],
            contactPoint: [
              {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: "harryp5873@gmail.com",
                availableLanguage: ["English"],
                areaServed: "NG",
              },
            ],
          }),
        }}
      />

      <PageFooter showBackHome />
    </div>
  );
}
