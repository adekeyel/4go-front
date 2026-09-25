import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Treasure {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string | null;
}

interface GiftPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  receiverId: string;
  receiverName: string;
  roomId: string;
}

export default function GiftPostDialog({
  open,
  onOpenChange,
  messageId,
  receiverId,
  receiverName,
  roomId,
}: GiftPostDialogProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [sending, setSending] = useState(false);

  const coins = profile?.coins || 0;

  useEffect(() => {
    if (open) {
      supabase
        .from("treasures")
        .select("*")
        .order("sort_order", { ascending: true })
        .then(({ data }) => setTreasures((data as Treasure[]) || []));
    }
  }, [open]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}K`;
    return price.toString();
  };

  const handleSend = async (treasure: Treasure) => {
    if (!user) return;
    if (coins < treasure.price) {
      toast.error("Not enough coins!");
      return;
    }
    setSending(true);

    const { error } = await supabase.rpc("send_gift_to_post", {
      p_sender_id: user.id,
      p_receiver_id: receiverId,
      p_treasure_id: treasure.id,
      p_message_id: messageId,
      p_room_id: roomId,
    });

    if (error) {
      toast.error(error.message || "Failed to send gift");
    } else {
      toast.success(`Sent ${treasure.icon} ${treasure.name} to ${receiverName}!`);
      await refreshProfile();
      onOpenChange(false);
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Send Gift to {receiverName}</DialogTitle>
          <DialogDescription className="text-xs">
            Choose a treasure to gift for this post
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Coins className="w-3.5 h-3.5 text-yellow-500" />
          <span className="font-bold text-foreground">{coins.toLocaleString()}</span> coins
        </div>
        <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
          {treasures.map((t) => (
            <button
              key={t.id}
              disabled={sending || coins < t.price}
              onClick={() => handleSend(t)}
              className="p-2 rounded-lg border border-border hover:border-primary/50 transition-all flex flex-col items-center gap-1 disabled:opacity-40"
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="text-[10px] font-semibold text-foreground leading-tight text-center">{t.name}</span>
              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                <Coins className="w-2.5 h-2.5 text-yellow-500" />
                {formatPrice(t.price)}
              </span>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full text-xs">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
