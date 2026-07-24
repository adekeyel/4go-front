import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trophy, Clock, Crown } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import BottomNav from "@/components/BottomNav";

interface LeaderboardUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rank: string;
  total_online_minutes: number;
  is_monetized: boolean;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, rank, total_online_minutes, is_monetized")
        .order("total_online_minutes", { ascending: false })
        .limit(50);
      setUsers(data || []);
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const podiumColors = [
    "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
    "from-slate-300/20 to-slate-400/5 border-slate-400/30",
    "from-amber-700/20 to-amber-800/5 border-amber-700/30",
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="gradient-hero px-5 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-primary-foreground/80">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary-foreground" />
            <h1 className="text-xl font-display font-bold text-primary-foreground">Leaderboard</h1>
          </div>
        </div>
        <p className="text-primary-foreground/60 text-xs">Top users ranked by online time</p>
      </div>

      <div className="px-4 -mt-4 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
          ))
        ) : users.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No users yet</div>
        ) : (
          users.map((user, index) => (
            <div
              key={user.user_id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                index < 3
                  ? `bg-gradient-to-r ${podiumColors[index]}`
                  : "bg-card border-border"
              }`}
            >
              {/* Position */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                {index === 0 ? (
                  <Crown className="w-5 h-5 text-yellow-500" />
                ) : (
                  <span className={`text-sm font-bold ${index < 3 ? "text-foreground" : "text-muted-foreground"}`}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-sm shrink-0 border-2 border-primary-foreground/20">
                {(user.display_name || "?").charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {user.display_name || "Anonymous"}
                  </span>
                  {user.is_monetized && <span className="text-[10px]">💰</span>}
                </div>
                {user.username && (
                  <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                )}
              </div>

              {/* Rank + Time */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <RankBadge rank={user.rank} size="sm" />
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(user.total_online_minutes)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
