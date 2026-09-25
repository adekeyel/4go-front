import AdBanner from "@/components/AdBanner";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Trophy, Users, Clock, CheckCircle, Medal, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import { RankBadge } from "@/components/RankBadge";
import SponsorGateDialog from "@/components/monetization/SponsorGateDialog";
import { isContestUnlocked, unlockContest } from "@/lib/sponsor";

interface Contest {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  max_winners: number | null;
  created_at: string;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string;
  joined_at: string | null;
  online_minutes_since_join: number;
  score?: number;
  criteria?: string;
  rewarded: boolean;
  rewarded_at: string | null;
}

const CRITERIA_UNIT: Record<string, string> = {
  messages_sent: "msgs",
  referrals: "referrals",
  coins_earned: "coins",
};

export default function ContestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState<Contest[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [leaderboardContest, setLeaderboardContest] = useState<Contest | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);

  const loadContests = useCallback(async () => {
    const [{ data: contestData }, { data: myParticipation }] = await Promise.all([
      supabase.from("contests").select("*").in("status", ["active", "ended"]).order("created_at", { ascending: false }),
      supabase.from("contest_participants").select("contest_id").eq("user_id", user!.id),
    ]);

    const c = (contestData || []) as Contest[];
    setContests(c);
    setJoinedIds(new Set((myParticipation || []).map((p) => p.contest_id)));

    if (c.length > 0) {
      const counts = new Map<string, number>();
      for (const contest of c) {
        const { count } = await supabase
          .from("contest_participants")
          .select("id", { count: "exact", head: true })
          .eq("contest_id", contest.id);
        counts.set(contest.id, count || 0);
      }
      setParticipantCounts(counts);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadContests();
  }, [user, loadContests]);

  const performJoin = async (contestId: string) => {
    if (!user) return;
    setJoining(contestId);
    const { error } = await supabase.from("contest_participants").insert({
      contest_id: contestId,
      user_id: user.id,
    });
    setJoining(null);
    if (error) {
      if (error.code === "23505") toast.info("You already joined this contest");
      else toast.error("Failed to join contest");
      return;
    }
    setJoinedIds(prev => new Set([...prev, contestId]));
    setParticipantCounts(prev => {
      const n = new Map(prev);
      n.set(contestId, (n.get(contestId) || 0) + 1);
      return n;
    });
    toast.success("You joined the contest! 🎉");
  };

  const joinContest = (contestId: string) => {
    if (isContestUnlocked()) {
      performJoin(contestId);
      return;
    }
    setPendingJoinId(contestId);
  };

  const openLeaderboard = async (contest: Contest) => {
    setLeaderboardContest(contest);
    setLoadingLeaderboard(true);
    const { data } = await supabase.rpc("get_contest_leaderboard", {
      p_contest_id: contest.id,
    });
    const entries = (data || []) as LeaderboardEntry[];
    setLeaderboard(entries);
    setLoadingLeaderboard(false);
  };

  // Auto-refresh leaderboard every 30s when dialog is open
  useEffect(() => {
    if (!leaderboardContest) return;
    const interval = window.setInterval(async () => {
      const { data } = await supabase.rpc("get_contest_leaderboard", {
        p_contest_id: leaderboardContest.id,
      });
      if (data) setLeaderboard(data as LeaderboardEntry[]);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [leaderboardContest]);

  const activeContests = contests.filter(c => c.status === "active");
  const endedContests = contests.filter(c => c.status === "ended");

  const podiumColors = ["text-yellow-500", "text-gray-400", "text-amber-700"];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-foreground"><ArrowLeft className="w-6 h-6" /></button>
        <Trophy className="w-6 h-6 text-primary-foreground" />
        <h1 className="text-lg font-display font-bold text-primary-foreground">Contests & Events</h1>
      </div>
      <AdBanner />

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No contests available right now</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later!</p>
          </div>
        ) : (
          <>
            {activeContests.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-foreground mb-2">🔥 Active Contests</h2>
                <div className="space-y-3">
                  {activeContests.map(c => (
                    <div key={c.id} className="bg-card rounded-2xl p-4 shadow-card border border-primary/20">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                          {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                        </div>
                        <div className="bg-primary/10 rounded-xl px-2.5 py-1 shrink-0 ml-2">
                          <p className="text-xs font-bold text-primary">{c.reward_amount}</p>
                          <p className="text-[9px] text-primary/70">coins</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{participantCounts.get(c.id) || 0}{c.max_winners ? `/${c.max_winners}` : ""}</span>
                        {c.ends_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Ends {new Date(c.ends_at).toLocaleDateString()}</span>}
                      </div>

                      <div className="flex gap-2 mt-3">
                        <div className="flex-1">
                          {joinedIds.has(c.id) ? (
                            <div className="w-full h-9 rounded-xl bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Joined ✓
                            </div>
                          ) : (
                            <Button
                              onClick={() => joinContest(c.id)}
                              disabled={joining === c.id}
                              className="w-full h-9 rounded-xl text-xs"
                            >
                              {joining === c.id ? "Joining..." : "Join Contest 🏆"}
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs px-3"
                          onClick={() => openLeaderboard(c)}
                        >
                          <Medal className="w-3.5 h-3.5 mr-1" />Board
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endedContests.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-foreground mb-2">Past Contests</h2>
                <div className="space-y-2">
                  {endedContests.map(c => (
                    <div key={c.id} className="bg-card rounded-xl p-3 shadow-card opacity-75">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-semibold text-foreground truncate">{c.title}</h3>
                          <p className="text-[10px] text-muted-foreground">{c.reward_amount} coins • {participantCounts.get(c.id) || 0} participants</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => openLeaderboard(c)}
                          >
                            <Medal className="w-3 h-3 mr-1" />Leaderboard
                          </Button>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Ended</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Leaderboard Dialog */}
      <Dialog open={!!leaderboardContest} onOpenChange={(open) => !open && setLeaderboardContest(null)}>
        <DialogContent className="max-w-[360px] max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trophy className="w-5 h-5 text-primary" />
              {leaderboardContest?.title}
            </DialogTitle>
          </DialogHeader>
          {loadingLeaderboard ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 rounded-full border-3 border-primary border-t-transparent animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No participants yet</p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Participant</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Status</span>
              </div>
              {/* Rewarded first, then others */}
              {leaderboard.map((entry, idx) => {
                const rewarded = entry.rewarded;
                const rank = rewarded
                  ? leaderboard.filter(e => e.rewarded).indexOf(entry)
                  : -1;
                const hrs = Math.floor((entry.online_minutes_since_join || 0) / 60);
                const mins = (entry.online_minutes_since_join || 0) % 60;
                const usesTime = !entry.criteria || entry.criteria === "online_minutes";
                const scoreText = usesTime
                  ? (hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`)
                  : `${(entry.score ?? 0).toLocaleString()} ${CRITERIA_UNIT[entry.criteria || ""] || ""}`.trim();
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-2.5 rounded-xl p-2.5 ${
                      rewarded ? "bg-primary/5 border border-primary/10" : "bg-muted/50"
                    }`}
                  >
                    {/* Position */}
                    <div className="w-6 text-center shrink-0">
                      {rewarded && rank < 3 ? (
                        <Crown className={`w-4 h-4 mx-auto ${podiumColors[rank]}`} />
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                      )}
                    </div>
                    {/* Avatar */}
                    <UserAvatar
                      name={entry.display_name || entry.username}
                      url={entry.avatar_url}
                      size="sm"
                    />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {entry.display_name || entry.username || "User"}
                      </p>
                      <div className="flex items-center gap-1">
                        {entry.rank && <RankBadge rank={entry.rank} size="sm" />}
                        <span className="text-[9px] text-muted-foreground">
                          {scoreText}
                        </span>
                      </div>
                    </div>
                    {/* Status */}
                    <div className="shrink-0">
                      {rewarded ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" />
                          +{leaderboardContest?.reward_amount}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Joined</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
      <SponsorGateDialog
        open={!!pendingJoinId}
        title="Visit our sponsor to unlock contest"
        description="To keep contests fair and free, please visit our sponsor in a new tab. We'll then unlock contest entry for this session."
        onContinue={() => {
          unlockContest();
          const id = pendingJoinId;
          setPendingJoinId(null);
          if (id) performJoin(id);
        }}
        onCancel={() => setPendingJoinId(null)}
      />
    </div>
  );
}
