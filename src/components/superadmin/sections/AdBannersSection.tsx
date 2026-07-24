import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Plus, Pencil, Trash2, Upload, ExternalLink, MousePointerClick, Eye } from "lucide-react";
import { SectionHeader, StatTile } from "./primitives";
import { AD_PLACEMENTS, placementLabel } from "@/lib/adPlacements";
import { cn } from "@/lib/utils";

interface Advertiser { id: string; name: string; }
interface Banner {
  id: string;
  advertiser_id: string | null;
  image_url: string;
  target_url: string;
  placements: string[];
  position: string;
  budget: number;
  status: string;
  impressions: number;
  clicks: number;
  created_at: string;
}

const STATUSES = ["active", "paused", "ended"];
const POSITIONS = ["top", "middle", "bottom"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // ~5 years

const blank = {
  advertiser_id: "",
  image_url: "",
  target_url: "",
  budget: 0,
  status: "active",
  position: "middle",
  placements: [] as string[],
};

export default function AdBannersSection({ id }: { id: string }) {
  const { user } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });

  const load = useCallback(async () => {
    setLoading(true);
    const [b, a] = await Promise.all([
      supabase.from("ad_banners").select("*").order("created_at", { ascending: false }),
      supabase.from("advertisers").select("id, name").order("name"),
    ]);
    setBanners((b.data || []) as Banner[]);
    setAdvertisers((a.data || []) as Advertiser[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const advertiserName = useMemo(() => {
    const m = new Map(advertisers.map((a) => [a.id, a.name]));
    return (aid: string | null) => (aid ? m.get(aid) ?? "Unknown" : "—");
  }, [advertisers]);

  const openNew = () => {
    if (advertisers.length === 0) { toast.error("Register an advertiser first."); return; }
    setEditId(null); setForm({ ...blank }); setOpen(true);
  };
  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setForm({
      advertiser_id: b.advertiser_id || "",
      image_url: b.image_url,
      target_url: b.target_url,
      budget: b.budget,
      status: b.status,
      position: b.position || "middle",
      placements: b.placements || [],
    });
    setOpen(true);
  };

  const togglePlacement = (pid: string) => {
    setForm((f) => ({
      ...f,
      placements: f.placements.includes(pid) ? f.placements.filter((x) => x !== pid) : [...f.placements, pid],
    }));
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("ad-banners").upload(path, file, { upsert: false });
      if (up.error) { toast.error(up.error.message); return; }
      const { data, error } = await supabase.storage.from("ad-banners").createSignedUrl(path, SIGNED_URL_TTL);
      if (error || !data) { toast.error(error?.message || "Could not generate image URL"); return; }
      setForm((f) => ({ ...f, image_url: data.signedUrl }));
      toast.success("Image uploaded");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!form.advertiser_id) { toast.error("Select an advertiser"); return; }
    if (!form.image_url.trim()) { toast.error("Upload an image or paste an image URL"); return; }
    if (!form.target_url.trim()) { toast.error("Target URL required"); return; }
    if (form.placements.length === 0) { toast.error("Pick at least one placement"); return; }
    setBusy(true);
    const payload = {
      advertiser_id: form.advertiser_id,
      image_url: form.image_url.trim(),
      target_url: form.target_url.trim(),
      budget: Number(form.budget) || 0,
      status: form.status,
      position: form.position,
      placements: form.placements,
    };
    const res = editId
      ? await supabase.from("ad_banners").update(payload as never).eq("id", editId)
      : await supabase.from("ad_banners").insert({ ...payload, created_by: user.id } as never);
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editId ? "Banner updated" : "Banner created");
    setOpen(false);
    void load();
  };

  const remove = async (b: Banner) => {
    if (!window.confirm("Delete this banner?")) return;
    const { error } = await supabase.from("ad_banners").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Banner deleted");
    void load();
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Banner Management"
        subtitle={`${banners.length} banner${banners.length === 1 ? "" : "s"} · displayed at 320 × 100 px`}
        action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Banner</Button>}
      />
      {!loading && banners.length > 0 && (() => {
        const impressions = banners.reduce((s, b) => s + (b.impressions || 0), 0);
        const clicks = banners.reduce((s, b) => s + (b.clicks || 0), 0);
        const budget = banners.reduce((s, b) => s + Number(b.budget || 0), 0);
        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
        return (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Total Impressions" value={impressions.toLocaleString()} icon={Eye} />
            <StatTile label="Total Clicks" value={clicks.toLocaleString()} icon={MousePointerClick} />
            <StatTile label="Click-through Rate" value={`${ctr}%`} icon={ExternalLink} />
            <StatTile label="Ad Revenue (budget)" value={`₦${budget.toLocaleString()}`} icon={ImageIcon} />
          </div>
        );
      })()}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : banners.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground shadow-card">No banners yet. Create one to start displaying ads.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {banners.map((b) => (
            <Card key={b.id} className="space-y-3 p-4 shadow-card">
              <div className="flex items-start gap-3">
                <img src={b.image_url} alt="Banner" width={160} height={50}
                  className="h-[50px] w-[160px] shrink-0 rounded-md border border-border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{advertiserName(b.advertiser_id)}</p>
                  <a href={b.target_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3 shrink-0" /> {b.target_url}
                  </a>
                  <Badge variant={b.status === "active" ? "default" : "secondary"} className="mt-1 capitalize">{b.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {b.placements.map((p) => <Badge key={p} variant="outline">{placementLabel(p)}</Badge>)}
                <Badge variant="secondary" className="capitalize">{b.position || "middle"}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {b.impressions.toLocaleString()} views</span>
                <span className="flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5" /> {b.clicks.toLocaleString()} clicks</span>
                <span>Budget: ₦{Number(b.budget).toLocaleString()}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(b)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Banner" : "New Banner"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium">Advertiser</p>
              <Select value={form.advertiser_id} onValueChange={(v) => setForm({ ...form, advertiser_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select advertiser" /></SelectTrigger>
                <SelectContent>
                  {advertisers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Banner image (320 × 100 px)</p>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="mr-1.5 h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }} />
                  </label>
                </Button>
                <span className="text-xs text-muted-foreground">or paste a URL below</span>
              </div>
              <Input className="mt-2" placeholder="https://image-url…" value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              {form.image_url && (
                <img src={form.image_url} alt="Preview" width={320} height={100}
                  className="mt-2 h-[100px] w-[320px] max-w-full rounded-md border border-border object-cover" />
              )}
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Target URL</p>
              <Input placeholder="https://advertiser-website…" value={form.target_url}
                onChange={(e) => setForm({ ...form, target_url: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Budget (₦)</p>
                <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
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

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Position on page</p>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Multiple ads sharing the same page & position rotate every 5 minutes.
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">Display placements</p>
              <div className="flex flex-wrap gap-2">
                {AD_PLACEMENTS.map((p) => (
                  <button key={p.id} type="button" onClick={() => togglePlacement(p.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      form.placements.includes(p.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || uploading}>{editId ? "Save changes" : "Create banner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
