import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Megaphone, Send, Mail } from "lucide-react";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

const MAX_LEN = 4000;

function CharCount({ value }: { value: string }) {
  return <p className="text-right text-[11px] text-muted-foreground">{value.length}/{MAX_LEN}</p>;
}

export default function BroadcastSection({ id }: { id: string }) {
  const { user } = useAuth();
  const [inTitle, setInTitle] = useState("");
  const [inMsg, setInMsg] = useState("");
  const [priority, setPriority] = useState("normal");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const sendInApp = async () => {
    if (!inTitle.trim() || !inMsg.trim()) { toast.error("Title and message required"); return; }
    setBusy("announce");
    const { data, error } = await supabase.functions.invoke("admin-broadcast", {
      body: { mode: "announce", title: inTitle.trim(), message: inMsg.trim(), priority },
    });
    setBusy(null);
    if (error) { toast.error(error.message || "Failed to send"); return; }
    toast.success(`Announcement delivered to ${(data as { recipients?: number })?.recipients ?? "all"} users`);
    setInTitle(""); setInMsg("");
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) { toast.error("Title and message required"); return; }
    setBusy("push");
    const { data: subs } = await supabase.from("push_subscriptions").select("user_id");
    const ids = Array.from(new Set((subs || []).map((s: { user_id: string }) => s.user_id)));
    // Also store in the notification center so it shows in the bell.
    await supabase.from("global_notifications").insert({
      title: pushTitle.trim(), message: pushBody.trim(), priority: "normal", sent_by: user!.id,
    } as never);
    if (ids.length) {
      const { data: res } = await supabase.functions.invoke("send-push", { body: { user_ids: ids, title: pushTitle.trim(), body: pushBody.trim() } });
      const sent = (res as { sent?: number })?.sent ?? 0;
      const total = (res as { total?: number })?.total ?? ids.length;
      await supabase.from("broadcast_deliveries").insert({
        channel: "push", title: pushTitle.trim(), body: pushBody.trim(), sent_by: user!.id,
        target_count: total, success_count: sent, failure_count: Math.max(0, total - sent),
      } as never);
      setBusy(null);
      toast.success(`Push sent to ${sent}/${total} subscribers`);
    } else {
      setBusy(null);
      toast.error("No push subscribers found");
    }
    setPushTitle(""); setPushBody("");
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) { toast.error("Subject and message required"); return; }
    if (!window.confirm("Send this email to every registered user?")) return;
    setBusy("email");
    const { data, error } = await supabase.functions.invoke("admin-broadcast", {
      body: { mode: "email", subject: emailSubject.trim(), message: emailBody.trim() },
    });
    setBusy(null);
    if (error) { toast.error(error.message || "Failed to send"); return; }
    toast.success(`Email queued for ${(data as { recipients?: number })?.recipients ?? "all"} users`);
    setEmailSubject(""); setEmailBody("");
  };

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="Reach your entire user base instantly" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5 shadow-card">
          <div className="flex items-center gap-2 font-semibold"><Megaphone className="h-5 w-5 text-primary" /> In-App Announcement</div>
          <p className="text-xs text-muted-foreground">Posts to the notification center and a broadcast channel every user can read.</p>
          <Input placeholder="Title" value={inTitle} onChange={(e) => setInTitle(e.target.value)} maxLength={200} />
          <Textarea placeholder="Message" value={inMsg} onChange={(e) => setInMsg(e.target.value.slice(0, MAX_LEN))} rows={6} maxLength={MAX_LEN} className="max-h-72 overflow-y-auto" />
          <CharCount value={inMsg} />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="normal">Normal priority</option>
            <option value="important">Important</option>
          </select>
          <Button className="w-full" onClick={sendInApp} disabled={busy === "announce"}><Send className="mr-2 h-4 w-4" /> Send to All Users</Button>
        </Card>

        <Card className="space-y-3 p-5 shadow-card">
          <div className="flex items-center gap-2 font-semibold"><Bell className="h-5 w-5 text-primary" /> Push Notification</div>
          <p className="text-xs text-muted-foreground">Delivered to every device with push enabled and saved to the notification center.</p>
          <Input placeholder="Title" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} maxLength={200} />
          <Textarea placeholder="Message" value={pushBody} onChange={(e) => setPushBody(e.target.value.slice(0, MAX_LEN))} rows={6} maxLength={MAX_LEN} className="max-h-72 overflow-y-auto" />
          <CharCount value={pushBody} />
          <Button className="w-full" onClick={sendPush} disabled={busy === "push"}><Send className="mr-2 h-4 w-4" /> Send Push to All</Button>
        </Card>

        <Card className="space-y-3 p-5 shadow-card lg:col-span-2">
          <div className="flex items-center gap-2 font-semibold"><Mail className="h-5 w-5 text-primary" /> Email Campaign</div>
          <p className="text-xs text-muted-foreground">Sends an email to every registered user's inbox.</p>
          <Input placeholder="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} maxLength={200} />
          <Textarea placeholder="Message" value={emailBody} onChange={(e) => setEmailBody(e.target.value.slice(0, MAX_LEN))} rows={8} maxLength={MAX_LEN} className="max-h-96 overflow-y-auto" />
          <CharCount value={emailBody} />
          <Button className="w-full" onClick={sendEmail} disabled={busy === "email"}><Send className="mr-2 h-4 w-4" /> Send Email to All</Button>
        </Card>
      </div>
    </div>
  );
}
