import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Image, Mic, X, Square, CornerUpLeft, Video } from "lucide-react";
import { toast } from "sonner";
import MentionTextarea, { MentionTextareaHandle } from "@/components/MentionTextarea";

interface ReplyTarget {
  id: string;
  content: string | null;
  senderName: string;
  type: string;
}

interface ChatInputProps {
  onSend: (content: string, type: "text" | "image" | "audio" | "video", mediaUrl?: string, duration?: number, replyTo?: string) => void;
  roomId: string;
  onTyping?: () => void;
  replyTarget?: ReplyTarget | null;
  onCancelReply?: () => void;
  canUploadVideo?: boolean;
}

export default function ChatInput({ onSend, roomId, onTyping, replyTarget, onCancelReply, canUploadVideo }: ChatInputProps) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<MentionTextareaHandle>(null);

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, "text", undefined, undefined, replyTarget?.id);
    setText("");
    textareaRef.current?.reset();
    onCancelReply?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${roomId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("chat-media").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(data.path);
    onSend("", "image", urlData.publicUrl, undefined, replyTarget?.id);
    setUploading(false);
    onCancelReply?.();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    if (file.size > 1024 * 1024 * 1024) { toast.error("Video must be under 1 GB"); return; }
    // Check duration ≤ 1 hour
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
        v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Could not read video")); };
        v.src = URL.createObjectURL(file);
      });
      if (Number.isFinite(duration) && duration > 3600) {
        toast.error("Video must be under 1 hour");
        return;
      }
    } catch { /* allow if metadata can't be read */ }
    setUploading(true);
    toast.info("Uploading video...");
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${roomId}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from("chat-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(data.path);
      console.log("Video uploaded, public URL:", urlData.publicUrl);
      onSend("", "video", urlData.publicUrl, undefined, replyTarget?.id);
      toast.success("Video sent!");
      onCancelReply?.();
    } catch (err: any) {
      toast.error("Video upload failed. Try a smaller file.");
    }
    setUploading(false);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setUploading(true);
        const path = `${roomId}/${Date.now()}.webm`;
        const { data, error } = await supabase.storage.from("chat-media").upload(path, blob);
        if (error) { toast.error("Upload failed"); setUploading(false); return; }
        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(data.path);
        const duration = Math.round(blob.size / 16000);
        onSend("", "audio", urlData.publicUrl, duration, replyTarget?.id);
        setUploading(false);
        onCancelReply?.();
      };
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="border-t border-border bg-card px-3 py-2 pb-safe">
      {replyTarget && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-primary/10 border-l-2 border-primary">
          <CornerUpLeft className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-primary">{replyTarget.senderName}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {replyTarget.type === "image" ? "📷 Photo" : replyTarget.type === "audio" ? "🎤 Voice note" : replyTarget.type === "video" ? "🎬 Video" : replyTarget.content || ""}
            </p>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
      
      <div className="flex items-end gap-2">
        <button onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-primary p-2" disabled={uploading}>
          <Image className="w-5 h-5" />
        </button>

        {canUploadVideo && (
          <button onClick={() => videoInputRef.current?.click()} className="text-muted-foreground hover:text-primary p-2" disabled={uploading}>
            <Video className="w-5 h-5" />
          </button>
        )}

        {recording ? (
          <div className="flex-1 flex items-center gap-3 bg-destructive/10 rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm text-destructive font-medium">Recording...</span>
            <button onClick={stopRecording} className="ml-auto text-destructive"><Square className="w-5 h-5" /></button>
          </div>
        ) : (
          <div className="flex-1 relative">
            <MentionTextarea
              ref={textareaRef}
              value={text}
              onChange={setText}
              onSubmit={handleSendText}
              onTyping={onTyping}
              placeholder="Type a message... (Shift+Enter to send)"
              roomId={roomId}
              shiftEnterToSubmit={true}
              disabled={uploading}
            />
          </div>
        )}

        {text.trim() ? (
          <button onClick={handleSendText} className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-elevated">
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        ) : (
          <button
            onMouseDown={!recording ? startRecording : stopRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${recording ? "bg-destructive" : "gradient-primary"} shadow-elevated`}
          >
            <Mic className="w-4 h-4 text-primary-foreground" />
          </button>
        )}
      </div>
      {uploading && <div className="mt-1 text-xs text-muted-foreground text-center">Uploading...</div>}
    </div>
  );
}
