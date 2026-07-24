import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import MentionTextarea from "@/components/MentionTextarea";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useMentionRecorder } from "@/hooks/useMentionRecorder";

interface Props {
  pageId: string;
  onPosted: (postId: string) => void;
}

export default function PagePostComposer({ pageId, onPosted }: Props) {
  const { user } = useAuth();
  const { recordFromText } = useMentionRecorder();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<"text" | "image" | "video">("text");
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const pickFile = async (kind: "image" | "video", f: File) => {
    if (kind === "image" && f.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB"); return;
    }
    if (kind === "video") {
      if (f.size > 1024 * 1024 * 1024) { toast.error("Video must be under 1 GB"); return; }
      try {
        const duration = await new Promise<number>((resolve, reject) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
          v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Could not read video")); };
          v.src = URL.createObjectURL(f);
        });
        if (Number.isFinite(duration) && duration > 3600) {
          toast.error("Video must be under 1 hour"); return;
        }
      } catch { /* ignore */ }
    }
    setFile(f); setType(kind); setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user) return;
    if (!content.trim() && !file) { toast.error("Add some content or media"); return; }
    setBusy(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: "text" | "image" | "video" = "text";
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `pages/${pageId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type, upsert: true });
        if (upErr) throw upErr;
        mediaUrl = supabase.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
        mediaType = type;
      }
      const { data, error } = await supabase
        .from("page_posts")
        .insert({ page_id: pageId, author_id: user.id, content: content.trim() || null, media_url: mediaUrl, media_type: mediaType })
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as any).id as string;
      if (content.trim()) {
        await recordFromText(content.trim(), {
          sourceType: "post",
          sourceId: newId,
          contextId: newId,
        });
      }
      setContent(""); setFile(null); setPreview(null); setType("text");
      toast.success("Post published!");
      onPosted(newId);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to publish");
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-3 space-y-3">
      <MentionTextarea
        value={content}
        onChange={setContent}
        placeholder="Share something with your followers…"
        rows={3}
        roomId={null}
      />
      {preview && (
        <div className="relative rounded-xl overflow-hidden border border-border">
          {type === "image"
            ? <img src={preview} alt="" className="w-full max-h-72 object-cover" />
            : <video src={preview} controls className="w-full max-h-72 bg-black" />}
          <button
            onClick={() => { setFile(null); setPreview(null); setType("text"); }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur"
          ><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => imgRef.current?.click()} className="p-2 rounded-full hover:bg-muted text-muted-foreground" title="Photo">
            <ImagePlus className="w-5 h-5" />
          </button>
          <button onClick={() => vidRef.current?.click()} className="p-2 rounded-full hover:bg-muted text-muted-foreground" title="Video">
            <Video className="w-5 h-5" />
          </button>
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile("image", f); }} />
          <input ref={vidRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile("video", f); }} />
        </div>
        <Button onClick={submit} disabled={busy} size="sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
        </Button>
      </div>
    </div>
  );
}