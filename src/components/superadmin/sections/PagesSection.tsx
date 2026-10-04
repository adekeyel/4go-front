import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, Layers, Users } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel, type AdminRoleKey } from "../adminNav";

interface AdminPageRow {
  id: string;
  name: string;
  category: string | null;
  followers_count: number;
  owner_id: string;
  created_at: string;
  profile_image: string | null;
}

// Replaces the "Pages" tab of the retired /admin screen. GET /api/admin/pages, DELETE /api/pages/:id (super admin).
export default function PagesSection({ id, role }: { id: string; role: AdminRoleKey }) {
  const navigate = useNavigate();
  const [pages, setPages] = useState<AdminPageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<AdminPageRow[]>("/admin/pages");
      setPages(data);
    } catch {
      toast.error("Failed to load pages");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const remove = async (p: AdminPageRow) => {
    if (!window.confirm(`Delete page "${p.name}" and all its posts?`)) return;
    try {
      await apiClient.delete(`/pages/${p.id}`);
      toast.success("Page deleted");
      void load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete page");
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle={`${pages.length} pages`} />
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Pages" value={pages.length} icon={Layers} />
        <StatTile label="Total Followers" value={pages.reduce((s, p) => s + (p.followers_count || 0), 0).toLocaleString()} icon={Users} />
      </div>
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead>Followers</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && pages.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No pages yet.</TableCell></TableRow>
              )}
              {pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.profile_image
                        ? <img src={p.profile_image} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{p.name?.[0]}</div>}
                      <span className="truncate">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.category || "-"}</TableCell>
                  <TableCell>{p.followers_count}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/pages/${p.id}`)}>View</Button>
                      {role === "super_admin" && (
                        <Button size="sm" variant="destructive" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
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
