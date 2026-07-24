import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { SectionHeader } from "./primitives";
import { navItemLabel } from "../adminNav";

interface Setting {
  key: string;
  value: unknown;
  label: string | null;
  category: string;
}

const CATEGORY_BY_ID: Record<string, string> = {
  "set-app": "app",
  "set-chat": "chat",
  "set-mod": "moderation",
  "set-storage": "storage",
  "set-api": "general",
};

export default function SettingsSection({ id }: { id: string }) {
  const category = CATEGORY_BY_ID[id] || "general";
  const [settings, setSettings] = useState<Setting[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key,value,label,category").eq("category", category).order("key");
    const rows = (data as Setting[]) || [];
    setSettings(rows);
    setDraft(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    setLoading(false);
  }, [category]);

  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(
    () => settings.some((s) => JSON.stringify(s.value) !== JSON.stringify(draft[s.key])),
    [settings, draft],
  );

  const save = async () => {
    setBusy(true);
    const { data: authData } = await supabase.auth.getUser();
    const updates = settings
      .filter((s) => JSON.stringify(s.value) !== JSON.stringify(draft[s.key]))
      .map((s) => supabase.from("app_settings").update({ value: draft[s.key] as never, updated_by: authData.user?.id } as never).eq("key", s.key));
    const results = await Promise.all(updates);
    setBusy(false);
    if (results.some((r) => r.error)) { toast.error("Failed to save some settings"); return; }
    toast.success("Settings saved");
    void load();
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={navItemLabel(id)}
        subtitle="Live platform configuration"
        action={<Button onClick={save} disabled={!dirty || busy}><Save className="mr-2 h-4 w-4" /> Save Changes</Button>}
      />
      <Card className="divide-y p-0 shadow-card">
        {loading && <p className="p-8 text-center text-muted-foreground">Loading…</p>}
        {!loading && settings.length === 0 && <p className="p-8 text-center text-muted-foreground">No settings in this category.</p>}
        {settings.map((s) => {
          const v = draft[s.key];
          const isBool = typeof s.value === "boolean";
          const isNum = typeof s.value === "number";
          return (
            <div key={s.key} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Label htmlFor={s.key} className="font-medium">{s.label || s.key}</Label>
                <p className="truncate text-xs text-muted-foreground">{s.key}</p>
              </div>
              {isBool ? (
                <Switch id={s.key} checked={!!v} onCheckedChange={(c) => setDraft((d) => ({ ...d, [s.key]: c }))} />
              ) : (
                <Input
                  id={s.key}
                  type={isNum ? "number" : "text"}
                  value={String(v ?? "")}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: isNum ? Number(e.target.value) : e.target.value }))}
                  className="max-w-[180px]"
                />
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}