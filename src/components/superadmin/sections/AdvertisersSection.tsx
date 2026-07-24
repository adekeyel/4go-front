import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2, Mail, Phone, Search } from "lucide-react";
import { SectionHeader } from "./primitives";

interface Advertiser {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

const blank = { name: "", contact_email: "", contact_phone: "", notes: "" };

export default function AdvertisersSection({ id }: { id: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("advertisers").select("*").order("created_at", { ascending: false });
    setRows((data || []) as Advertiser[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setEditId(null); setForm({ ...blank }); setOpen(true); };
  const openEdit = (a: Advertiser) => {
    setEditId(a.id);
    setForm({ name: a.name, contact_email: a.contact_email || "", contact_phone: a.contact_phone || "", notes: a.notes || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Advertiser name required"); return; }
    if (!user) return;
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = editId
      ? await supabase.from("advertisers").update(payload as never).eq("id", editId)
      : await supabase.from("advertisers").insert({ ...payload, created_by: user.id } as never);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editId ? "Advertiser updated" : "Advertiser registered");
    setOpen(false);
    void load();
  };

  const remove = async (a: Advertiser) => {
    if (!window.confirm(`Delete advertiser "${a.name}"? Their banners will be kept but unlinked.`)) return;
    const { error } = await supabase.from("advertisers").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Advertiser deleted");
    void load();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((a) => [a.name, a.contact_email, a.contact_phone].some((f) => f?.toLowerCase().includes(q)));
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Advertisers"
        subtitle={`${rows.length} registered advertiser${rows.length === 1 ? "" : "s"}`}
        action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Register Advertiser</Button>}
      />
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search advertisers…" className="pl-9" />
      </div>
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground shadow-card">No advertisers yet. Register one to start creating banners.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Card key={a.id} className="space-y-2 p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="font-semibold">{a.name}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {a.contact_email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {a.contact_email}</p>}
                {a.contact_phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {a.contact_phone}</p>}
                {a.notes && <p className="line-clamp-2">{a.notes}</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(a)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Advertiser" : "Register Advertiser"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Advertiser / business name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Contact email (optional)" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            <Input placeholder="Contact phone (optional)" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            <Textarea placeholder="Notes (optional)" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{editId ? "Save changes" : "Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
