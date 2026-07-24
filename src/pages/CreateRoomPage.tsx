import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";

const ROOM_CREATE_RANKS = ["Learner", "Professional", "Expert", "Master"];
const PRIVATE_ROOM_RANKS = ["Expert", "Master"];

export default function CreateRoomPage() {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [rules, setRules] = useState("");
  const [joinFee, setJoinFee] = useState(0);
  const [joinQuestions, setJoinQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const userRank = (profile as any)?.rank || "Amateur";
  const canCreate = ROOM_CREATE_RANKS.includes(userRank);
  const canCreatePrivate = PRIVATE_ROOM_RANKS.includes(userRank);

  if (!canCreate) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-primary-foreground"><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-lg font-display font-bold text-primary-foreground">Create Room</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Lock className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Rank Required: Learner</h2>
          <p className="text-sm text-muted-foreground">You need at least the Learner rank (15 hours online) to create rooms.</p>
          <Button onClick={() => navigate("/ranks")}>View Ranks</Button>
        </div>
      </div>
    );
  }

  const addQuestion = () => {
    const q = newQuestion.trim();
    if (!q || joinQuestions.length >= 5) return;
    setJoinQuestions([...joinQuestions, q]);
    setNewQuestion("");
  };

  const removeQuestion = (index: number) => {
    setJoinQuestions(joinQuestions.filter((_, i) => i !== index));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);

    const insertData: any = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      created_by: user.id,
    };
    if (type === "private") {
      insertData.rules = rules.trim() || null;
      insertData.join_fee = joinFee || 0;
      insertData.join_questions = joinQuestions.length > 0 ? joinQuestions : null;
    }

    const { data: room, error } = await supabase
      .from("rooms")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast.error("Couldn't create room");
      setLoading(false);
      return;
    }

    await supabase.from("room_members").insert({ room_id: room.id, user_id: user.id, role: "admin" });

    toast.success("Room created! 🎉");
    navigate(`/room/${room.id}`);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-display font-bold text-primary-foreground">Create Room</h1>
      </div>

      <form onSubmit={handleCreate} className="p-5 space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Room Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Naija Vibes 🇳🇬" required maxLength={50} className="h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this room about?" maxLength={200} className="rounded-xl resize-none" rows={3} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">Room Type</label>
          <div className="flex gap-3">
            {(["public", "private"] as const).map((t) => {
              const disabled = t === "private" && !canCreatePrivate;
              return (
                <button key={t} type="button" onClick={() => !disabled && setType(t)} disabled={disabled}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${type === t ? "gradient-primary text-primary-foreground shadow-elevated" : disabled ? "bg-muted text-muted-foreground/50 cursor-not-allowed" : "bg-muted text-muted-foreground"}`}>
                  {t === "public" ? "🌍 Public" : "🔒 Private"}
                  {disabled && <span className="block text-[9px]">Expert+</span>}
                </button>
              );
            })}
          </div>
        </div>

        {type === "private" && (
          <>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Room Rules</label>
              <Textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Set rules for joining this room (optional)" maxLength={500} className="rounded-xl resize-none" rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Joining Fee (coins)</label>
              <Input type="number" value={joinFee || ""} onChange={(e) => setJoinFee(Math.max(0, parseInt(e.target.value) || 0))} placeholder="0 = Free" min={0} className="h-12 rounded-xl" />
              <p className="text-xs text-muted-foreground mt-1">Fee is deducted when user sends request. Refunded if declined.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Screening Questions (max 5)</label>
              <p className="text-xs text-muted-foreground mb-2">Users must answer these before requesting to join.</p>
              {joinQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-foreground bg-muted rounded-lg px-3 py-2 flex-1">{q}</span>
                  <button type="button" onClick={() => removeQuestion(i)} className="text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {joinQuestions.length < 5 && (
                <div className="flex gap-2">
                  <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="e.g. Why do you want to join?" maxLength={200} className="h-10 rounded-xl text-sm" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } }} />
                  <Button type="button" size="sm" onClick={addQuestion} disabled={!newQuestion.trim()} className="rounded-lg"><Plus className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
          </>
        )}

        <Button type="submit" disabled={loading || !name.trim()} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-elevated">
          {loading ? "Creating..." : "Create Room 🚀"}
        </Button>
      </form>
    </div>
  );
}
