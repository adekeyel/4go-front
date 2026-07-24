import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Construction, type LucideIcon } from "lucide-react";
import { navItemLabel } from "../adminNav";

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon?: LucideIcon }) {
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

export function PlaceholderSection({ id }: { id: string }) {
  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} />
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center shadow-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Construction className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">{navItemLabel(id)}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This module is scaffolded and ready. Connect it to live data or let me know what you'd like it to do next.
          </p>
        </div>
      </Card>
    </div>
  );
}