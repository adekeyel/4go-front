import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { AdminRoom } from "../useAdminData";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import { MessagesSquare, Users, Activity } from "lucide-react";

export default function ChatsSection({ id, variant, rooms, refresh }: { id: string; variant: "private" | "group"; rooms: AdminRoom[]; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const list = rooms.filter((r) => (variant === "private" ? r.type === "dm" : r.type !== "dm"));
  const activeCount = list.filter((r) => r.is_active !== false).length;

  const remove = async (r: AdminRoom) => {
    if (!window.confirm(`Delete "${r.name || "chat"}" permanently?`)) return;
    setBusy(true);
    const { error } = await supabase.from("rooms").delete().eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Chat deleted");
    refresh();
  };

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={`${list.length} ${variant === "private" ? "private chats" : "group chats"}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Total Chats" value={list.length} icon={MessagesSquare} />
        <StatTile label="Active Chats" value={activeCount} icon={Activity} />
        <StatTile label="Inactive" value={list.length - activeCount} icon={Users} />
      </div>
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{variant === "private" ? "Chat" : "Group Name"}</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No chats found.</TableCell></TableRow>
              )}
              {list.slice(0, 200).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name || "Untitled"}</TableCell>
                  <TableCell className="hidden sm:table-cell capitalize text-sm text-muted-foreground">{r.type}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {r.is_active !== false ? <Badge className="bg-admin-success text-white hover:bg-admin-success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" disabled={busy} onClick={() => remove(r)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
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