import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSub } from "../useAdminData";
import { SectionHeader, StatTile } from "./primitives";
import { navItemLabel } from "../adminNav";
import { Banknote, Tag, Users, Undo2, Repeat, Check, X, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Withdrawal {
  id: string; user_id: string; amount: number; naira_amount: number;
  status: string; account_name: string; bank_code: string; created_at: string;
}

type Variant = "payments" | "plans" | "refunds";

export default function PaymentsSection({ id, variant, subscriptions }: { id: string; variant: Variant; subscriptions: AdminSub[] }) {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(variant === "refunds");
  const [actingId, setActingId] = useState<string | null>(null);

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("withdrawals").select("id,user_id,amount,naira_amount,status,account_name,bank_code,created_at").order("created_at", { ascending: false }).limit(200);
    setWithdrawals((data || []) as Withdrawal[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (variant === "refunds") void loadWithdrawals(); }, [variant, loadWithdrawals]);

  const approveAndPay = async (w: Withdrawal) => {
    setActingId(w.id);
    const { data, error } = await supabase.functions.invoke("process-withdrawal", { body: { withdrawalId: w.id } });
    setActingId(null);
    if (error || (data && (data as { success?: boolean }).success === false)) {
      toast.error((data as { error?: string })?.error || error?.message || "Payout failed");
      void loadWithdrawals();
      return;
    }
    toast.success("Payout initiated");
    void loadWithdrawals();
  };

  const markPaid = async (w: Withdrawal) => {
    if (!user) return;
    if (!window.confirm(`Mark ₦${Number(w.naira_amount).toLocaleString()} to ${w.account_name} as paid?`)) return;
    setActingId(w.id);
    const { error } = await supabase.rpc("admin_complete_withdrawal", { p_admin_id: user.id, p_withdrawal_id: w.id });
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    void loadWithdrawals();
  };

  const rejectWithdrawal = async (w: Withdrawal) => {
    if (!user) return;
    if (!window.confirm("Reject this withdrawal and refund the member's coins?")) return;
    setActingId(w.id);
    const { error } = await supabase.rpc("admin_reject_withdrawal", { p_admin_id: user.id, p_withdrawal_id: w.id });
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal rejected & coins refunded");
    void loadWithdrawals();
  };

  const plans = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; active: number }>();
    subscriptions.forEach((s) => {
      const cur = map.get(s.plan) || { count: 0, revenue: 0, active: 0 };
      cur.count += 1;
      cur.revenue += Number(s.amount_ngn || 0);
      if (s.status === "active") cur.active += 1;
      map.set(s.plan, cur);
    });
    return Array.from(map.entries()).map(([plan, v]) => ({ plan, ...v }));
  }, [subscriptions]);

  const totalRevenue = subscriptions.reduce((s, x) => s + Number(x.amount_ngn || 0), 0);
  const active = subscriptions.filter((s) => s.status === "active");

  if (variant === "plans") {
    return (
      <div className="space-y-4">
        <SectionHeader title={navItemLabel(id)} subtitle="Subscription plan performance" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile label="Plans Offered" value={plans.length} icon={Tag} />
          <StatTile label="Active Subscribers" value={active.length} icon={Users} />
          <StatTile label="Total Revenue" value={`₦${totalRevenue.toLocaleString()}`} icon={Banknote} />
        </div>
        <Card className="overflow-hidden shadow-card">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Plan</TableHead><TableHead>Total Sold</TableHead><TableHead>Active</TableHead><TableHead>Revenue</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No subscription plans sold yet.</TableCell></TableRow>}
              {plans.map((p) => (
                <TableRow key={p.plan}>
                  <TableCell className="font-medium capitalize">{p.plan}</TableCell>
                  <TableCell className="tabular-nums">{p.count}</TableCell>
                  <TableCell className="tabular-nums">{p.active}</TableCell>
                  <TableCell className="tabular-nums">₦{p.revenue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  if (variant === "refunds") {
    const totalOut = withdrawals.filter((w) => w.status === "completed").reduce((s, w) => s + Number(w.naira_amount || 0), 0);
    return (
      <div className="space-y-4">
        <SectionHeader title={navItemLabel(id)} subtitle="Withdrawal payouts & refund tracking" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile label="Total Withdrawals" value={withdrawals.length} icon={Undo2} />
          <StatTile label="Pending" value={withdrawals.filter((w) => w.status === "pending").length} icon={Repeat} />
          <StatTile label="Paid Out" value={`₦${totalOut.toLocaleString()}`} icon={Banknote} />
        </div>
        <Card className="overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead>Amount</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!loading && withdrawals.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No withdrawals yet.</TableCell></TableRow>}
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell><p className="font-medium">{w.account_name}</p><p className="text-xs text-muted-foreground">{w.bank_code}</p></TableCell>
                    <TableCell className="tabular-nums">₦{Number(w.naira_amount).toLocaleString()}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={w.status === "completed" ? "default" : w.status === "pending" ? "secondary" : "destructive"} className="capitalize">{w.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {["pending", "approved", "processing"].includes(w.status) ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="default" disabled={actingId === w.id} onClick={() => approveAndPay(w)}>
                            <Send className="mr-1 h-3.5 w-3.5" /> Approve & Pay
                          </Button>
                          <Button size="sm" variant="outline" disabled={actingId === w.id} onClick={() => markPaid(w)}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Mark Paid
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" disabled={actingId === w.id} onClick={() => rejectWithdrawal(w)}>
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

  // payments history
  return (
    <div className="space-y-4">
      <SectionHeader title={navItemLabel(id)} subtitle="All subscription payments" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Total Payments" value={subscriptions.length} icon={Banknote} />
        <StatTile label="Active" value={active.length} icon={Users} />
        <StatTile label="Total Revenue" value={`₦${totalRevenue.toLocaleString()}`} icon={Banknote} />
      </div>
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No payments yet.</TableCell></TableRow>}
              {subscriptions.slice(0, 200).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium capitalize">{s.plan}</TableCell>
                  <TableCell className="tabular-nums">₦{Number(s.amount_ngn || 0).toLocaleString()}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
