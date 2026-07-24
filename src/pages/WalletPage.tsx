import { useEffect, useState } from "react";
import { getBankName } from "@/lib/banks";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { usePremium } from "@/hooks/usePremium";
import PremiumBadge from "@/components/PremiumBadge";
import {
  ArrowLeft, Wallet, Gift, Trophy, TrendingUp, ShoppingCart,
  ArrowDownLeft, ArrowUpRight, Coins, Filter, Clock, CheckCircle2,
  XCircle, Loader2
} from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  naira_amount: number;
  status: string;
  account_name: string;
  bank_code: string;
  created_at: string;
}

const SOURCE_CONFIG: Record<string, { icon: typeof Gift; label: string; color: string; bg: string }> = {
  gift: { icon: Gift, label: "Gifts", color: "text-pink-500", bg: "bg-pink-500/10" },
  reward: { icon: Trophy, label: "Rewards", color: "text-amber-500", bg: "bg-amber-500/10" },
  earning: { icon: TrendingUp, label: "Earnings", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  purchase: { icon: ShoppingCart, label: "Purchases", color: "text-blue-500", bg: "bg-blue-500/10" },
  spend: { icon: ArrowUpRight, label: "Spent", color: "text-red-500", bg: "bg-red-500/10" },
  withdrawal: { icon: Wallet, label: "Withdrawals", color: "text-purple-500", bg: "bg-purple-500/10" },
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500", label: "Pending" },
  approved: { icon: CheckCircle2, color: "text-blue-500", label: "Approved" },
  processing: { icon: Loader2, color: "text-blue-500", label: "Processing" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Completed" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

type TabType = "overview" | "transactions" | "withdrawals";

export default function WalletPage() {
  const { user, profile } = useAuth();
  const { isPremium, plan, currentPeriodEnd } = usePremium();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const coins = profile?.coins ?? 0;
  const purchased = (profile as any)?.purchased_coins ?? 0;
  const earned = (profile as any)?.earned_coins ?? 0;
  const rewards = (profile as any)?.reward_coins ?? 0;
  const isMaster = (profile as any)?.rank === "Master";
  // Withdrawable = earned (post views, post gifts, contests) + purchased (Flutterwave).
  // Locked for non-Master users until they reach Master rank.
  const withdrawable = earned + purchased;

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [txRes, wdRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const txData = (txRes.data || []) as Transaction[];
    setTransactions(txData);
    setWithdrawals((wdRes.data || []) as Withdrawal[]);

    // Calculate balances per source (only credits)
    const bal: Record<string, number> = { gift: 0, reward: 0, earning: 0, purchase: 0 };
    txData.forEach((tx) => {
      if (tx.amount > 0 && bal.hasOwnProperty(tx.source)) {
        bal[tx.source] += tx.amount;
      }
    });
    setBalances(bal);
    setLoading(false);
  };

  const filteredTransactions = sourceFilter
    ? transactions.filter((tx) => tx.source === sourceFilter)
    : transactions;

  const balanceCards = [
    { source: "gift", label: "Gifts", icon: Gift, color: "text-pink-500", bg: "bg-pink-500/10" },
    { source: "reward", label: "Rewards", icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10" },
    { source: "earning", label: "Earnings", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { source: "purchase", label: "Purchases", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-primary/80 px-4 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-bold text-primary-foreground">Wallet</h1>
        </div>
        <div className="text-center">
          <p className="text-primary-foreground/70 text-xs uppercase tracking-wider mb-1">Total Balance</p>
          <div className="flex items-center justify-center gap-2">
            <Coins className="w-6 h-6 text-yellow-300" />
            <span className="text-3xl font-bold text-primary-foreground">
              {coins.toLocaleString()}
            </span>
          </div>
          <p className="text-primary-foreground/60 text-xs mt-1">≈ ₦{(coins / 2).toLocaleString()}</p>
          {isPremium && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full">
              <PremiumBadge size="xs" />
              <span className="text-[11px] font-semibold text-primary-foreground capitalize">
                Premium · {plan}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bucket split */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Withdrawable</p>
          <p className="text-sm font-bold text-emerald-600 mt-0.5">{withdrawable.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">
            {isMaster ? "Earnings + purchased" : "Locked until Master"}
          </p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rewards</p>
          <p className="text-sm font-bold text-amber-500 mt-0.5">{rewards.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Claims & referrals</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Purchased</p>
          <p className="text-sm font-bold text-blue-500 mt-0.5">{purchased.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">For boosts</p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        {balanceCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.source} className="bg-card rounded-xl p-3 shadow-sm border border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-full ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {loading ? "..." : (balances[card.source] || 0).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex px-4 mt-4 gap-1 bg-muted rounded-xl mx-4 p-1">
        {(["overview", "transactions", "withdrawals"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {activeTab === "overview" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-card rounded-xl animate-pulse" />
              ))
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No transactions yet</p>
            ) : (
              transactions.slice(0, 10).map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))
            )}
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="space-y-3">
            {/* Source Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
              <button
                onClick={() => setSourceFilter(null)}
                className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                  !sourceFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                All
              </button>
              {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setSourceFilter(key)}
                  className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
                    sourceFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-card rounded-xl animate-pulse" />
              ))
            ) : filteredTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No transactions found</p>
            ) : (
              filteredTransactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))
            )}
          </div>
        )}

        {activeTab === "withdrawals" && (
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
              ))
            ) : withdrawals.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No withdrawals yet</p>
            ) : (
              withdrawals.map((wd) => <WithdrawalRow key={wd.id} wd={wd} />)
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const cfg = SOURCE_CONFIG[tx.source] || SOURCE_CONFIG.spend;
  const Icon = cfg.icon;
  const isCredit = tx.amount > 0;

  return (
    <div className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
      <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {tx.description || cfg.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(tx.created_at), "MMM d, h:mm a")}
        </p>
      </div>
      <div className={`text-sm font-bold ${isCredit ? "text-emerald-500" : "text-destructive"}`}>
        {isCredit ? "+" : ""}{tx.amount.toLocaleString()}
      </div>
    </div>
  );
}

function WithdrawalRow({ wd }: { wd: Withdrawal }) {
  const statusCfg = STATUS_CONFIG[wd.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="bg-card rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              ₦{Number(wd.naira_amount).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{wd.account_name} • {getBankName(wd.bank_code)}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${statusCfg.color}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${wd.status === "processing" ? "animate-spin" : ""}`} />
          {statusCfg.label}
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{wd.amount.toLocaleString()} coins</span>
        <span>{format(new Date(wd.created_at), "MMM d, yyyy")}</span>
      </div>
    </div>
  );
}
