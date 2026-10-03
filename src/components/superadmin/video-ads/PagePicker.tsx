import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";
import { getPagesByIds, searchPages, type PageOption } from "@/api/videoAds";

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Search pages by name and pick any number of them. Shows names for pages already selected. */
export default function PagePicker({ value, onChange }: Props) {
  const [known, setKnown] = useState<Record<string, PageOption>>({});
  const requested = useRef<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PageOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Look up names for ids we haven't seen yet (e.g. when editing an existing ad). Each id is only
  // requested once, so a deleted page can't cause a request loop.
  useEffect(() => {
    const missing = value.filter((id) => !known[id] && !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    let cancelled = false;
    getPagesByIds(missing)
      .then((rows) => {
        if (!cancelled) setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((r) => [r.id, r])) }));
      })
      .catch(() => { /* names are cosmetic; the ids still work */ });
    return () => { cancelled = true; };
  }, [value, known]);

  // Debounced search; an empty box lists the biggest pages.
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchPages(q.trim())
        .then((rows) => { if (!cancelled) setResults(rows); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const add = (p: PageOption) => {
    setKnown((k) => ({ ...k, [p.id]: p }));
    if (!value.includes(p.id)) onChange([...value, p.id]);
  };
  const remove = (id: string) => onChange(value.filter((x) => x !== id));
  const available = results.filter((r) => !value.includes(r.id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              {known[id]?.name ?? "Loading…"}
              <button type="button" onClick={() => remove(id)} aria-label="Remove page" className="rounded-full p-0.5 hover:bg-background/60">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input placeholder="Search pages by name…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-40 overflow-y-auto rounded-md border border-border">
        {searching ? (
          <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</p>
        ) : available.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">{q.trim() ? "No matching pages." : "No more pages to add."}</p>
        ) : (
          available.map((p) => (
            <button key={p.id} type="button" onClick={() => add(p)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="truncate">{p.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {p.followers_count.toLocaleString()} followers <Plus className="h-3.5 w-3.5" />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
