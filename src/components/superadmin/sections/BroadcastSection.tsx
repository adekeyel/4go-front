import { useState } from "react";
import * as adminApi from "@/api/admin";
import { apiErrorMessage } from "@/lib/apiError";
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
    let recipients: number | undefined;
    try {
      // The backend's priority levels are low / normal / high / urgent; the "Important" option maps to high.
      const res = await adminApi.sendAnnouncement(inTitle.trim(), inMsg.trim(), priority === "important" ? "high" : "normal");
      recipients = res.recipients;
    } catch (e) {
      setBusy(null);
      toast.error(apiErrorMessage(e, "Failed to send"));
      return;
    }
    setBusy(null);
    toast.success(`Announcement delivered to ${recipients ?? "all"} users`);
    setInTitle(""); setInMsg("");
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) { toast.error("Title and message required"); return; }
    setBusy("push");
    try {
      // The server collects the subscribers, sends in the background and records the delivery.
      const { recipients } = await adminApi.sendPushBroadcast(pushTitle.trim(), pushBody.trim());
      setBusy(null);
      if (recipients > 0) toast.success(`Push on its way to ${recipients} subscribers`);
      else toast.error("No push subscribers found");
      setPushTitle(""); setPushBody("");
    } catch (e) {
      setBusy(null);
      toast.error(apiErrorMessage(e, "Failed to send"));
    }
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) { toast.error("Subject and message required"); return; }
    if (!window.confirm("Send this email to every registered user?")) return;
    setBusy("email");
    let recipients: number | undefined;
    try {
      recipients = (await adminApi.sendEmailBroadcast(emailSubject.trim(), emailBody.trim())).recipients;
    } catch (e) {
      setBusy(null);
      toast.error(apiErrorMessage(e, "Failed to send"));
      return;
    }
    setBusy(null);
    toast.success(`Email queued for ${recipients ?? "all"} users`);
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
