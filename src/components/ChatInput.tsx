import { useState, useRef, useEffect } from "react";
import * as uploadsApi from "@/api/uploads";
import { Send, Image, Mic, X, Trash2, CornerUpLeft, Video } from "lucide-react";
import { toast } from "sonner";
import MentionTextarea, { MentionTextareaHandle } from "@/components/MentionTextarea";

interface ReplyTarget {
  id: string;
  content: string | null;
  senderName: string;
  type: string;
}

const MAX_VOICE_SECONDS = 10 * 60;
const MIN_VOICE_MS = 1000;

/** Pick a recording format this browser supports. Safari records MP4/AAC, Chrome and Firefox record WebM/Opus. */
function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
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
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false); // true = the user cancelled: throw the recording away
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
    try {
      const { url } = await uploadsApi.uploadFile(file, `chat-media/${roomId}`, file.name);
      onSend("", "image", url, undefined, replyTarget?.id);
      onCancelReply?.();
    } catch {
      toast.error("Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    if (file.size > 200 * 1024 * 1024) { toast.error("Video must be under 200MB"); return; }
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
      const { url } = await uploadsApi.uploadFile(file, `chat-media/${roomId}`, file.name);
      onSend("", "video", url, undefined, replyTarget?.id);
      toast.success("Video sent!");
      onCancelReply?.();
    } catch {
      toast.error("Video upload failed. Try a smaller file.");
    }
    setUploading(false);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // Turns the microphone and the timer off.
  const releaseMic = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // If the chat is closed mid-recording, stop and discard it (otherwise the mic would stay on).
  useEffect(() => {
    return () => {
      discardRef.current = true;
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") { try { r.stop(); } catch { /* ignore */ } }
      releaseMic();
    };
  }, []);

  const uploadVoiceNote = async (blob: Blob, ext: string, measuredMs: number) => {
    setUploading(true);
    try {
      const result = await uploadsApi.uploadFile(blob, `chat-media/${roomId}`, `voice-${Date.now()}.${ext}`);
      // Prefer the length Cloudinary measured; fall back to our own stopwatch (never a guess from the file size).
      const duration = Math.max(1, Math.round(result.duration ?? measuredMs / 1000));
      onSend("", "audio", result.url, duration, replyTarget?.id);
      onCancelReply?.();
    } catch {
      // Keep the recording so a bad connection doesn't lose it.
      toast.error("Couldn't send the voice note", { action: { label: "Retry", onClick: () => void uploadVoiceNote(blob, ext, measuredMs) } });
    }
    setUploading(false);
  };

  const finishRecording = async (mime: string) => {
    releaseMic();
    setRecording(false);
    const measuredMs = Date.now() - startedAtRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (discardRef.current || chunks.length === 0) return;
    if (measuredMs < MIN_VOICE_MS) { toast.info("Voice note too short"); return; }
    const type = mime || chunks[0].type || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    await uploadVoiceNote(new Blob(chunks, { type }), ext, measuredMs);
  };

  const startRecording = async () => {
    if (recording || uploading) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice notes aren't supported on this browser");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      const name = (err as DOMException)?.name;
      toast.error(
        name === "NotAllowedError" ? "Microphone blocked. Allow it in your browser settings to record." :
        name === "NotFoundError" ? "No microphone found" : "Couldn't access the microphone"
      );
      return;
    }
    try {
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => void finishRecording(recorder.mimeType);
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_VOICE_SECONDS) stopRecording(false); // at the limit it stops and sends what it has
      }, 250);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      toast.error("Couldn't start recording");
    }
  };

  /** discard = true cancels (nothing is sent); false stops and sends. */
  const stopRecording = (discard: boolean) => {
    discardRef.current = discard;
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    else { releaseMic(); setRecording(false); }
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
        <button onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-primary p-2" disabled={uploading || recording}>
          <Image className="w-5 h-5" />
        </button>

        {canUploadVideo && (
          <button onClick={() => videoInputRef.current?.click()} className="text-muted-foreground hover:text-primary p-2" disabled={uploading || recording}>
            <Video className="w-5 h-5" />
          </button>
        )}

        {recording ? (
          <div className="flex-1 flex items-center gap-3 bg-destructive/10 rounded-xl px-3 py-2.5">
            <button onClick={() => stopRecording(true)} className="text-destructive p-1" aria-label="Cancel recording">
              <Trash2 className="w-5 h-5" />
            </button>
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm text-destructive font-medium tabular-nums">{formatClock(elapsed)}</span>
            <span className="ml-auto text-xs text-muted-foreground">Recording…</span>
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
          recording ? (
            <button
              onClick={() => stopRecording(false)}
              className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-elevated"
              aria-label="Send voice note"
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          ) : (
            <button
              onClick={() => void startRecording()}
              disabled={uploading}
              className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-elevated"
              aria-label="Record voice note"
            >
              <Mic className="w-4 h-4 text-primary-foreground" />
            </button>
          )
        )}
      </div>
      {uploading && <div className="mt-1 text-xs text-muted-foreground text-center">Sending…</div>}
    </div>
  );
}
