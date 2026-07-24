import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Coins, Gift, TrendingUp, Wallet } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";

import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Treasure {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string | null;
  sort_order: number;
}

export default function TreasuresPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { isPremium } = usePremium();
  const minCoins = isPremium ? 20000 : 40000;
  const maxCoins = isPremium ? 1000000 : 100000;
  const minNgn = minCoins / 2;
  const maxNgn = maxCoins / 2;
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTreasure, setSelectedTreasure] = useState<Treasure | null>(null);
  const [sendMode, setSendMode] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [buyCoinsOpen, setBuyCoinsOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState("");
  const [levelingUp, setLevelingUp] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpAmount, setLevelUpAmount] = useState("10000");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);

  const coins = (profile as any)?.coins || 0;
  const isMonetized = (profile as any)?.is_monetized || false;
  const isMaster = (profile as any)?.rank === "Master";

  useEffect(() => {
    fetchTreasures();
  }, []);

  const fetchTreasures = async () => {
    const { data } = await supabase
      .from("treasures")
      .select("*")
      .order("sort_order", { ascending: true });
    setTreasures((data as Treasure[]) || []);
    setLoading(false);
  };

  const handleBuyCoins = async () => {
    const amount = parseInt(buyAmount);
    if (!amount || amount <= 0 || !user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          amount,
          email: user.email,
          userId: user.id,
          redirectUrl: `${window.location.origin}/treasures?verify=true`,
        },
      });
      
      if (error || !data?.link) {
        toast.error("Failed to initiate payment");
        return;
      }
      
      // Store txRef for verification
      localStorage.setItem("4go-pending-tx", JSON.stringify({ txRef: data.txRef, userId: user.id }));
      // Redirect to Flutterwave
      window.location.href = data.link;
    } catch {
      toast.error("Payment service unavailable");
    }
  };

  // Verify payment on redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const transactionId = params.get("transaction_id");
    const status = params.get("status");
    
    if (transactionId && status === "successful" && user) {
      const verifyPayment = async () => {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { transactionId, userId: user.id },
        });
        
        if (data?.success) {
          toast.success(`${data.coins.toLocaleString()} coins added to your balance!`);
          await refreshProfile();
        } else {
          toast.error("Payment verification failed");
        }
        
        // Clean URL
        window.history.replaceState({}, "", "/treasures");
        localStorage.removeItem("4go-pending-tx");
      };
      verifyPayment();
    }
  }, [user]);

  const handleSendGift = async () => {
    if (!user || !selectedTreasure || !recipientUsername.trim()) return;
    setSending(true);

    const { data: recipient } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", recipientUsername.trim())
      .single();

    if (!recipient) {
      toast.error("User not found");
      setSending(false);
      return;
    }

    if (recipient.user_id === user.id) {
      toast.error("You can't send a gift to yourself");
      setSending(false);
      return;
    }

    const { error } = await supabase.rpc("send_gift", {
      p_sender_id: user.id,
      p_receiver_id: recipient.user_id,
      p_treasure_id: selectedTreasure.id,
    });

    if (error) {
      toast.error(error.message || "Failed to send gift");
      setSending(false);
      return;
    }

    await refreshProfile();
    toast.success(`Sent ${selectedTreasure.name} to @${recipientUsername}!`);
    setSelectedTreasure(null);
    setSendMode(false);
    setRecipientUsername("");
    setSending(false);
  };

  const handleLevelUp = async () => {
    const amount = parseInt(levelUpAmount);
    if (!user || !amount || amount < 5000) {
      toast.error("Minimum is 5,000 coins");
      return;
    }
    if (amount % 5000 !== 0) {
      toast.error("Amount must be in multiples of 5,000");
      return;
    }
    if (coins < amount) {
      toast.error("Not enough coins!");
      return;
    }
    setLevelingUp(true);
    const { data, error } = await supabase.rpc("spend_coins_for_progress", { p_user_id: user.id, p_amount: amount });
    if (error) {
      toast.error(error.message || "Failed to level up");
    } else {
      const result = data as any;
      const hrs = Math.floor(result.minutes_added / 60);
      const mins = result.minutes_added % 60;
      toast.success(`🎉 +${hrs}h ${mins}m progress! New rank: ${result.new_rank}`);
      await refreshProfile();
      setLevelUpOpen(false);
    }
    setLevelingUp(false);
  };

  const getLevelUpPreview = (amount: number) => {
    const minutes = Math.floor((amount / 10000) * 300);
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const handleVerifyAccount = async () => {
    if (!bankCode || !accountNumber || accountNumber.length !== 10) {
      toast.error("Select a bank and enter a 10-digit account number");
      return;
    }
    setVerifying(true);
    setAccountName("");
    setAccountVerified(false);

    const { data, error } = await supabase.functions.invoke("resolve-account", {
      body: { account_number: accountNumber, account_bank: bankCode },
    });

    if (error || !data?.success) {
      toast.error(data?.error || "Could not verify account. Check details and try again.");
      setVerifying(false);
      return;
    }

    setAccountName(data.account_name);
    setAccountVerified(true);
    toast.success(`Account verified: ${data.account_name}`);
    setVerifying(false);
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!user || !amount || amount < minCoins) {
      toast.error(`Minimum withdrawal is ₦${minNgn.toLocaleString()} (${minCoins.toLocaleString()} coins)`);
      return;
    }
    if (amount > maxCoins) {
      toast.error(`Maximum withdrawal is ₦${maxNgn.toLocaleString()} (${maxCoins.toLocaleString()} coins)`);
      return;
    }
    if (coins < amount) {
      toast.error("Not enough coins!");
      return;
    }
    if (!accountVerified || !accountName.trim()) {
      toast.error("Please verify your bank account first");
      return;
    }
    setWithdrawing(true);

    const { data, error } = await supabase.rpc("request_withdrawal", {
      p_user_id: user.id,
      p_amount: amount,
      p_bank_code: bankCode.trim(),
      p_account_number: accountNumber.trim(),
      p_account_name: accountName.trim(),
    });

    if (error) {
      toast.error(error.message || "Withdrawal request failed");
      setWithdrawing(false);
      return;
    }

    toast.success(`Withdrawal request of ₦${(amount / 2).toLocaleString()} submitted! Awaiting admin approval.`);
    await refreshProfile();
    setWithdrawOpen(false);
    setWithdrawAmount("");
    setBankCode("");
    setAccountNumber("");
    setAccountName("");
    setWithdrawing(false);
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}K`;
    return price.toString();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      
      <div className="gradient-hero px-5 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="text-primary-foreground/80">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary-foreground" />
            <h1 className="text-xl font-display font-bold text-primary-foreground">Treasures</h1>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 bg-primary-foreground/20 rounded-full px-3 py-1.5">
            <Coins className="w-4 h-4 text-yellow-300" />
            <span className="text-sm font-bold text-primary-foreground">{coins.toLocaleString()}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isMaster && (
              <button
                onClick={() => setWithdrawOpen(true)}
                className="text-xs bg-primary-foreground/20 text-primary-foreground rounded-full px-3 py-1.5 font-semibold flex items-center gap-1"
              >
                <Wallet className="w-3 h-3" />
                Withdraw
              </button>
            )}
            <button
              onClick={() => setLevelUpOpen(true)}
              className="text-xs bg-primary-foreground/20 text-primary-foreground rounded-full px-3 py-1.5 font-semibold flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3" />
              Level Up
            </button>
            <button
              onClick={() => setBuyCoinsOpen(true)}
              className="text-xs bg-primary-foreground/20 text-primary-foreground rounded-full px-3 py-1.5 font-semibold"
            >
              + Buy Coins
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-card rounded-xl animate-pulse" />
            ))
          : treasures.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTreasure(t); setSendMode(false); }}
                className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-all"
              >
                <span className="text-3xl">{t.icon}</span>
                <span className="text-xs font-semibold text-foreground text-center leading-tight">{t.name}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Coins className="w-3 h-3 text-yellow-500" />
                  #{formatPrice(t.price)}
                </span>
              </button>
            ))}
      </div>

      {/* Treasure detail dialog */}
      <Dialog open={!!selectedTreasure} onOpenChange={(o) => { if (!o) { setSelectedTreasure(null); setSendMode(false); } }}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="text-3xl">{selectedTreasure?.icon}</span>
              {selectedTreasure?.name}
            </DialogTitle>
            <DialogDescription>{selectedTreasure?.description}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-bold text-foreground">#{selectedTreasure?.price.toLocaleString()}</span>
          </div>

          {!sendMode ? (
            <Button
              onClick={() => {
                if (coins < (selectedTreasure?.price || 0)) {
                  toast.error("Not enough coins!");
                  return;
                }
                setSendMode(true);
              }}
              className="w-full"
            >
              <Gift className="w-4 h-4 mr-2" /> Send as Gift
            </Button>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="Recipient @username"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value)}
              />
              <Button onClick={handleSendGift} disabled={sending || !recipientUsername.trim()} className="w-full">
                {sending ? "Sending..." : "Confirm Send"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Buy coins dialog */}
      <Dialog open={buyCoinsOpen} onOpenChange={setBuyCoinsOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Buy Coins</DialogTitle>
            <DialogDescription>Add coins to your balance</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {[1000, 5000, 10000, 50000, 100000, 500000].map((amt) => (
              <button
                key={amt}
                onClick={() => setBuyAmount(String(amt))}
                className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                  buyAmount === String(amt) ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
                }`}
              >
                {formatPrice(amt)}
              </button>
            ))}
          </div>
          <Input
            type="number"
            placeholder="Custom amount"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
          />
          <Button onClick={handleBuyCoins} disabled={!buyAmount || parseInt(buyAmount) <= 0} className="w-full">
            <Coins className="w-4 h-4 mr-2" /> Add Coins
          </Button>
        </DialogContent>
      </Dialog>

      {/* Level Up dialog */}
      <Dialog open={levelUpOpen} onOpenChange={setLevelUpOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Level Up
            </DialogTitle>
            <DialogDescription>
              Spend coins to boost your rank progress. 5,000 coins = 2h 30m of active time.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {[5000, 10000, 15000, 20000, 50000, 100000].map((amt) => (
              <button
                key={amt}
                onClick={() => setLevelUpAmount(String(amt))}
                className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                  levelUpAmount === String(amt) ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
                }`}
              >
                <div>{formatPrice(amt)}</div>
                <div className="text-[10px] text-muted-foreground">{getLevelUpPreview(amt)}</div>
              </button>
            ))}
          </div>
          <Input
            type="number"
            placeholder="Custom amount (multiples of 5,000)"
            value={levelUpAmount}
            onChange={(e) => setLevelUpAmount(e.target.value)}
          />
          {parseInt(levelUpAmount) >= 5000 && (
            <p className="text-xs text-muted-foreground text-center">
              You'll gain <span className="font-bold text-foreground">{getLevelUpPreview(parseInt(levelUpAmount))}</span> of progress
            </p>
          )}
          <Button
            onClick={handleLevelUp}
            disabled={levelingUp || !levelUpAmount || parseInt(levelUpAmount) < 5000 || coins < parseInt(levelUpAmount)}
            className="w-full"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {levelingUp ? "Processing..." : `Spend ${formatPrice(parseInt(levelUpAmount) || 0)} Coins`}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Withdrawal dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Withdraw Funds
            </DialogTitle>
            <DialogDescription>
              Convert coins to Naira. 2 coins = ₦1.{" "}
              {isPremium ? "Premium" : "Regular"} limit: ₦{minNgn.toLocaleString()} – ₦{maxNgn.toLocaleString()} per request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Amount (coins)</label>
              <Input
                type="number"
                placeholder={`Min ${minCoins.toLocaleString()} coins`}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              {parseInt(withdrawAmount) >= minCoins && (
                <p className="text-xs text-muted-foreground mt-1">
                  You'll receive <span className="font-bold text-foreground">₦{(parseInt(withdrawAmount) / 2).toLocaleString()}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Bank</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={bankCode}
                onChange={(e) => { setBankCode(e.target.value); setAccountVerified(false); setAccountName(""); }}
              >
                <option value="">Select your bank</option>
                <option value="044">Access Bank</option>
                <option value="023">Citibank Nigeria</option>
                <option value="063">Diamond Bank (Access)</option>
                <option value="050">Ecobank Nigeria</option>
                <option value="084">Enterprise Bank</option>
                <option value="070">Fidelity Bank</option>
                <option value="011">First Bank of Nigeria</option>
                <option value="214">First City Monument Bank</option>
                <option value="058">Guaranty Trust Bank</option>
                <option value="030">Heritage Bank</option>
                <option value="301">Jaiz Bank</option>
                <option value="082">Keystone Bank</option>
                <option value="526">Kuda Microfinance Bank</option>
                <option value="100">Moniepoint MFB</option>
                <option value="999992">Opay</option>
                <option value="999991">PalmPay</option>
                <option value="076">Polaris Bank</option>
                <option value="101">Providus Bank</option>
                <option value="221">Stanbic IBTC Bank</option>
                <option value="068">Standard Chartered</option>
                <option value="232">Sterling Bank</option>
                <option value="100004">Suntrust Bank</option>
                <option value="032">Union Bank of Nigeria</option>
                <option value="033">United Bank for Africa</option>
                <option value="215">Unity Bank</option>
                <option value="035">Wema Bank</option>
                <option value="057">Zenith Bank</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Account Number</label>
              <div className="flex gap-2">
                <Input
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => { setAccountNumber(e.target.value); setAccountVerified(false); setAccountName(""); }}
                  maxLength={10}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={accountVerified ? "outline" : "default"}
                  onClick={handleVerifyAccount}
                  disabled={verifying || !bankCode || accountNumber.length !== 10}
                  className="shrink-0"
                >
                  {verifying ? "Verifying..." : accountVerified ? "✓ Verified" : "Verify"}
                </Button>
              </div>
            </div>
            {accountVerified && accountName && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground">Account Name</p>
                <p className="text-sm font-semibold text-foreground">{accountName}</p>
              </div>
            )}
          </div>
          <Button
            onClick={handleWithdraw}
            disabled={withdrawing || !withdrawAmount || parseInt(withdrawAmount) < minCoins || parseInt(withdrawAmount) > maxCoins || coins < parseInt(withdrawAmount) || !accountVerified}
            className="w-full"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {withdrawing ? "Processing..." : "Request Withdrawal"}
          </Button>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
