import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, ShieldX, Trash2 } from "lucide-react";
import { AdminReport } from "../useAdminData";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

export default function ReportsSection({ id, reports, refresh }: { id: string; reports: AdminReport[]; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const pending = reports.filter((r) => r.status === "pending");
  const others = reports.filter((r) => r.status !== "pending");
  const list = [...pending, ...others].slice(0, 200);

  const setStatus = async (r: AdminReport, status: string) => {
    setBusy(true);
    const { error } = await supabase.from("moderation_reports").update({ status }).eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Report ${status}`);
    refresh();
  };

  const suspendReported = async (r: AdminReport) => {
    if (!r.target_user_id) { toast.error("No target user on this report"); return; }
    setBusy(true);
    await supabase.from("profiles").update({ is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: `Report: ${r.reason}` } as never).eq("user_id", r.target_user_id);
    setBusy(false);
    toast.success("Reported user suspended");
    void setStatus(r, "actioned");
  };

  const removeContent = async (r: AdminReport) => {
    if (!r.target_message_id) { toast.error("No message attached"); return; }
    setBusy(true);
    await supabase.from("messages").delete().eq("id", r.target_message_id);
    setBusy(false);
    toast.success("Content removed");
    void setStatus(r, "actioned");
  };

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={`${pending.length} pending of ${reports.length} total`} />
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No reports.</TableCell></TableRow>
              )}
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.reason}</p>
                    {r.details && <p className="max-w-xs truncate text-xs text-muted-foreground">{r.details}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {r.target_message_id ? "Message" : r.target_room_id ? "Room" : r.target_user_id ? "User" : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {r.status === "pending"
                      ? <Badge className="bg-admin-warning text-white hover:bg-admin-warning">Pending</Badge>
                      : <Badge variant="secondary" className="capitalize">{r.status}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" disabled={busy} title="Remove content" onClick={() => removeContent(r)}><Trash2 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={busy} title="Suspend user" onClick={() => suspendReported(r)} className="text-admin-danger"><ShieldX className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={busy} title="Dismiss" onClick={() => setStatus(r, "dismissed")}><X className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={busy} title="Resolve" onClick={() => setStatus(r, "resolved")} className="text-admin-success"><Check className="h-4 w-4" /></Button>
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