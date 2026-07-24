import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, ShieldOff, Trash2, Image as ImageIcon, Video, Mic, ExternalLink } from "lucide-react";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

type Variant = "image" | "video" | "audio";

interface ReportedMessage {
  report_id: string;
  reason: string;
  details: string | null;
  status: string;
  reported_at: string;
  reporter_name: string | null;
  message_id: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  sender_id: string;
  sender_name: string | null;
  sender_username: string | null;
  room_id: string | null;
}

const META: Record<Variant, { icon: typeof ImageIcon; types: string[] }> = {
  image: { icon: ImageIcon, types: ["image"] },
  video: { icon: Video, types: ["video"] },
  audio: { icon: Mic, types: ["audio", "voice"] },
};

export default function ReportedMediaSection({ id, variant }: { id: string; variant: Variant }) {
  const [rows, setRows] = useState<ReportedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const Icon = META[variant].icon;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id;
    if (!adminId) { setLoading(false); return; }
    const { data } = await (supabase.rpc as never as (n: string, a: object) => Promise<{ data: ReportedMessage[] | null }>)(
      "admin_reported_messages", { p_admin_id: adminId, p_types: META[variant].types },
    );
    setRows(data || []);
    setLoading(false);
  }, [variant]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (r: ReportedMessage, status: string, msg: string) => {
    setBusy(true);
    const { error } = await supabase.from("moderation_reports").update({ status } as never).eq("id", r.report_id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    void load();
  };

  const removeMessage = async (r: ReportedMessage) => {
    if (!window.confirm("Permanently remove this content?")) return;
    setBusy(true);
    const { error } = await supabase.from("messages").delete().eq("id", r.message_id);
    if (!error) await supabase.from("moderation_reports").update({ status: "resolved" } as never).eq("id", r.report_id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Content removed");
    void load();
  };

  const suspendSender = async (r: ReportedMessage) => {
    const reason = window.prompt("Reason for suspension?", "Reported media violation");
    if (reason === null) return;
    setBusy(true);
    const { error } = await supabase.from("profiles")
      .update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: reason } as never)
      .eq("user_id", r.sender_id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sender suspended");
  };

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={`${rows.length} reported ${variant === "audio" ? "voice note" : variant}${rows.length === 1 ? "" : "s"}`} />
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead className="hidden lg:table-cell">Reported</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No reported {variant === "audio" ? "voice notes" : `${variant}s`}.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.report_id}>
                  <TableCell>
                    {variant === "image" && r.media_url
                      ? <a href={r.media_url} target="_blank" rel="noreferrer"><img src={r.media_url} alt="reported" className="h-12 w-12 rounded object-cover" /></a>
                      : r.media_url
                        ? <a href={r.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary"><Icon className="h-4 w-4" /> Open <ExternalLink className="h-3 w-3" /></a>
                        : <span className="flex h-12 w-12 items-center justify-center rounded bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></span>}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{r.sender_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">@{r.sender_username || "—"}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{r.reason}{r.details ? <span className="block text-xs text-muted-foreground">{r.details}</span> : null}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(r.reported_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {r.status === "pending"
                      ? <Badge className="bg-admin-warning text-white hover:bg-admin-warning">Pending</Badge>
                      : r.status === "dismissed"
                        ? <Badge variant="secondary">Dismissed</Badge>
                        : <Badge className="bg-admin-success text-white hover:bg-admin-success">Resolved</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" disabled={busy} title="Dismiss" onClick={() => setStatus(r, "dismissed", "Report dismissed")}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={busy} title="Suspend sender" className="text-admin-warning" onClick={() => suspendSender(r)}><ShieldOff className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={busy} title="Remove content" className="text-destructive" onClick={() => removeMessage(r)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}