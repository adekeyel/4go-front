import { Users, Lock, Coins } from "lucide-react";

interface RoomCardProps {
  room: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    member_count: number;
    join_fee?: number;
  };
  onClick: () => void;
  unreadCount?: number;
}

export default function RoomCard({ room, onClick, unreadCount = 0 }: RoomCardProps) {
  const colors = [
    "from-primary/20 to-primary/5",
    "from-accent/20 to-accent/5",
    "from-secondary to-secondary/50",
  ];
  const colorClass = colors[room.name.length % colors.length];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-card rounded-xl shadow-card hover:shadow-elevated transition-all text-left"
    >
      <div className="relative">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shrink-0`}
        >
          <span className="text-lg font-display font-bold text-foreground">
            {room.name.charAt(0).toUpperCase()}
          </span>
        </div>
        {room.type === "private" && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-3 h-3 text-muted-foreground" />
          </span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold text-foreground text-sm truncate ${unreadCount > 0 ? "font-bold" : ""}`}>{room.name}</h3>
        {room.description && (
          <p className="text-xs text-muted-foreground truncate">{room.description}</p>
        )}
        {room.type === "private" && (room.join_fee || 0) > 0 && (
          <p className="text-[10px] text-primary flex items-center gap-0.5 mt-0.5">
            <Coins className="w-3 h-3" /> {room.join_fee} coins to join
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <Users className="w-3.5 h-3.5" />
        <span className="text-xs">{room.member_count}</span>
        <span className="w-2 h-2 rounded-full bg-primary ml-1" aria-hidden />
      </div>
    </button>
  );
}
