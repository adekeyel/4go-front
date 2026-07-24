import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Plus, Trash2, Pencil } from "lucide-react";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

interface Contest {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_winners: number | null;
  criteria: string;
  criteria_label: string | null;
  created_at: string;
}

const CRITERIA: Array<{ id: string; label: string; help: string }> = [
  { id: "online_minutes", label: "Most time online", help: "Ranked by online minutes during the contest" },
  { id: "messages_sent", label: "Most messages sent", help: "Ranked by messages sent during the contest" },
  { id: "referrals", label: "Most referrals", help: "Ranked by people invited during the contest" },
  { id: "coins_earned", label: "Most coins earned", help: "Ranked by earned coins" },
];

const STATUSES = ["draft", "active", "ended"];

const blank = {
  title: "", description: "", reward_amount: 1000, status: "draft",
  starts_at: "", ends_at: "", max_winners: 10, criteria: "online_minutes", criteria_label: "",
};

export default function ContestsAdminSection({ id }: { id: string }) {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("contests").select("*").order("created_at", { ascending: false });
    setContests((data || []) as Contest[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setEditId(null); setForm({ ...blank }); setOpen(true); };
  const openEdit = (c: Contest) => {
    setEditId(c.id);
    setForm({
      title: c.title, description: c.description || "", reward_amount: c.reward_amount,
      status: c.status, starts_at: c.starts_at ? c.starts_at.slice(0, 16) : "",
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : "", max_winners: c.max_winners || 10,
      criteria: c.criteria || "online_minutes", criteria_label: c.criteria_label || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    if (!user) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      reward_amount: Number(form.reward_amount) || 0,
      status: form.status,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      max_winners: Number(form.max_winners) || null,
      criteria: form.criteria,
      criteria_label: form.criteria_label.trim() || CRITERIA.find((c) => c.id === form.criteria)?.label || null,
    };
    const res = editId
      ? await supabase.from("contests").update(payload as never).eq("id", editId)
      : await supabase.from("contests").insert({ ...payload, created_by: user.id } as never);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editId ? "Contest updated" : "Contest created");
    setOpen(false);
    void load();
  };

  const remove = async (c: Contest) => {
    if (!window.confirm(`Delete contest "${c.title}"?`)) return;
    const { error } = await supabase.from("contests").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contest deleted");
    void load();
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={navItemLabel(id)}
        subtitle={`${contests.length} contest${contests.length === 1 ? "" : "s"}`}
        action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Contest</Button>}
      />
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : contests.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground shadow-card">No contests yet. Create one to get started.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {contests.map((c) => (
            <Card key={c.id} className="space-y-2 p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <p className="font-semibold">{c.title}</p>
                </div>
                <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              <div className="flex flex-wrap gap-1 text-xs">
                <Badge variant="outline">{c.reward_amount} coins</Badge>
                <Badge variant="outline">{c.criteria_label || CRITERIA.find((x) => x.id === c.criteria)?.label || c.criteria}</Badge>
                {c.max_winners && <Badge variant="outline">{c.max_winners} winners</Badge>}
                {c.ends_at && <Badge variant="outline">Ends {new Date(c.ends_at).toLocaleDateString()}</Badge>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Contest" : "New Contest"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Contest title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div>
              <p className="mb-1 text-sm font-medium">Judging criteria</p>
              <Select value={form.criteria} onValueChange={(v) => setForm({ ...form, criteria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRITERIA.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{CRITERIA.find((c) => c.id === form.criteria)?.help}</p>
            </div>
            <Input placeholder="Custom criteria label (optional)" value={form.criteria_label} onChange={(e) => setForm({ ...form, criteria_label: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Reward (coins)</p>
                <Input type="number" value={form.reward_amount} onChange={(e) => setForm({ ...form, reward_amount: Number(e.target.value) })} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Max winners</p>
                <Input type="number" value={form.max_winners} onChange={(e) => setForm({ ...form, max_winners: Number(e.target.value) })} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Starts at</p>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Ends at</p>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Status</p>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{editId ? "Save changes" : "Create contest"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
