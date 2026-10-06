import { useState, useRef, useEffect } from "react";
import * as uploadsApi from "@/api/uploads";
import { Send, Image as ImageIcon, Mic, X, Trash2, CornerUpLeft, Video, Smile, Keyboard, Paperclip, Camera, Lock, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import MentionTextarea, { MentionTextareaHandle } from "@/components/MentionTextarea";
import EmojiPanel from "@/components/EmojiPanel";

interface ReplyTarget {
  id: string;
  content: string | null;
  senderName: string;
  type: string;
}

const MAX_VOICE_SECONDS = 10 * 60;
const MIN_VOICE_MS = 1000;
const TAP_MAX_MS = 350; // a press shorter than this is a "tap" -> hands-free (locked) recording
const CANCEL_SLIDE_PX = 90; // slide left this far to cancel
const LOCK_SLIDE_PX = 70; // slide up this far to lock

// Drafts survive leaving and re-entering a chat (like WhatsApp), per room, for the session.
const drafts = new Map<string, string>();

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** Pick a recording format this browser supports. Safari records MP4/AAC, Chrome and Firefox record WebM/Opus. */
function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

interface PendingMedia {
  file: File;
  url: string; // object URL for the preview
  kind: "image" | "video";
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
  const [text, setText] = useState(() => drafts.get(roomId) ?? "");
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false); // hands-free recording (tap mic, or slide up)
  const [holding, setHolding] = useState(false); // finger/mouse is down on the mic
  const [slide, setSlide] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [pending, setPending] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false); // true = the user cancelled: throw the recording away
  const holdingRef = useRef(false);
  const pressRef = useRef({ x: 0, y: 0, at: 0 });
  const startingRef = useRef(false); // mic permission prompt / recorder spin-up in progress
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<MentionTextareaHandle>(null);
  const touch = isTouchDevice();

  // Switching to another room: load that room's draft, close panels.
  const lastRoomRef = useRef(roomId);
  useEffect(() => {
    if (lastRoomRef.current === roomId) return;
    lastRoomRef.current = roomId;
    setText(drafts.get(roomId) ?? "");
    setShowEmoji(false);
    setShowAttach(false);
  }, [roomId]);

  const updateText = (v: string) => {
    setText(v);
    if (v) drafts.set(roomId, v);
    else drafts.delete(roomId);
  };

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, "text", undefined, undefined, replyTarget?.id);
    updateText("");
    textareaRef.current?.reset();
    onCancelReply?.();
  };

  // ---------- Photos & videos: pick -> preview with caption -> send ----------

  const openPreview = (file: File, kind: "image" | "video") => {
    setPending((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { file, kind, url: URL.createObjectURL(file) };
    });
    setCaption("");
    setShowAttach(false);
    setShowEmoji(false);
  };

  const pendingUrlRef = useRef<string | null>(null);
  useEffect(() => { pendingUrlRef.current = pending?.url ?? null; }, [pending]);
  useEffect(() => () => { if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current); }, []);

  const closePreview = () => {
    setPending((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    setCaption("");
  };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    openPreview(file, "image");
  };

  const handleVideoFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    if (file.size > 200 * 1024 * 1024) { toast.error("Video must be under 200MB"); return; }
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
        v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Could not read video")); };
        v.src = URL.createObjectURL(file);
      });
      if (Number.isFinite(duration) && duration > 3600) { toast.error("Video must be under 1 hour"); return; }
    } catch { /* allow if metadata can't be read */ }
    openPreview(file, "video");
  };

  const sendPending = async () => {
    if (!pending || uploading) return;
    setUploading(true);
    try {
      const { url } = await uploadsApi.uploadFile(pending.file, `chat-media/${roomId}`, pending.file.name);
      onSend(caption.trim(), pending.kind, url, undefined, replyTarget?.id);
      onCancelReply?.();
      closePreview();
    } catch {
      toast.error(pending.kind === "video" ? "Video upload failed. Try a smaller file." : "Upload failed");
    }
    setUploading(false);
  };

  // Paste an image straight into the chat (desktop).
  const handlePaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); handleImageFile(file); }
  };

  // ---------- Emoji ----------

  const toggleEmoji = () => {
    setShowAttach(false);
    setShowEmoji((open) => {
      const next = !open;
      if (next && touch) (document.activeElement as HTMLElement | null)?.blur(); // drop the keyboard so the panel has room
      if (!next) requestAnimationFrame(() => textareaRef.current?.focus());
      return next;
    });
  };

  // ---------- Voice notes ----------

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
    setLocked(false);
    setHolding(false);
    setSlide({ x: 0, y: 0 });
    const measuredMs = Date.now() - startedAtRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (discardRef.current || chunks.length === 0) return;
    if (measuredMs < MIN_VOICE_MS) { toast.info("Voice note too short"); return; }
    const type = mime || chunks[0].type || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    await uploadVoiceNote(new Blob(chunks, { type }), ext, measuredMs);
  };

  /** discard = true cancels (nothing is sent); false stops and sends. */
  const stopRecording = (discard: boolean) => {
    discardRef.current = discard;
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    else { releaseMic(); setRecording(false); setLocked(false); setHolding(false); }
  };

  const startRecording = async () => {
    if (recording || uploading || startingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice notes aren't supported on this browser");
      holdingRef.current = false; setHolding(false);
      return;
    }
    startingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      startingRef.current = false;
      holdingRef.current = false; setHolding(false);
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
      setShowEmoji(false);
      setShowAttach(false);
      // The finger was lifted while the permission prompt / mic was spinning up -> carry on hands-free.
      if (!holdingRef.current) setLocked(true);
      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_VOICE_SECONDS) stopRecording(false); // at the limit it stops and sends what it has
      }, 250);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      toast.error("Couldn't start recording");
    } finally {
      startingRef.current = false;
    }
  };

  // Mic button: hold to record (release = send, slide left = cancel, slide up = lock); a quick tap records hands-free.
  const onMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (uploading || e.button > 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pressRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    holdingRef.current = true;
    setHolding(true);
    setSlide({ x: 0, y: 0 });
    void startRecording();
  };

  const onMicPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!holdingRef.current) return;
    const dx = Math.min(0, e.clientX - pressRef.current.x);
    const dy = Math.min(0, e.clientY - pressRef.current.y);
    setSlide({ x: dx, y: dy });
    if (dy < -LOCK_SLIDE_PX && dx > -CANCEL_SLIDE_PX) {
      holdingRef.current = false;
      setHolding(false);
      setLocked(true);
      setSlide({ x: 0, y: 0 });
      navigator.vibrate?.(10);
    }
  };

  const onMicPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    const dx = e.clientX - pressRef.current.x;
    const heldMs = Date.now() - pressRef.current.at;
    setSlide({ x: 0, y: 0 });
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return; // still starting: startRecording will go hands-free
    if (dx < -CANCEL_SLIDE_PX) stopRecording(true);
    else if (heldMs < TAP_MAX_MS) setLocked(true);
    else stopRecording(false);
  };

  const onMicPointerCancel = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    setSlide({ x: 0, y: 0 });
    stopRecording(true);
  };

  const cancelArmed = holding && slide.x < -CANCEL_SLIDE_PX * 0.7;
  const hasText = !!text.trim();
  const showMicButton = !hasText && !(recording && locked);

  const replyLabel = (t: ReplyTarget) =>
    t.type === "image" ? "📷 Photo" : t.type === "audio" ? "🎤 Voice note" : t.type === "video" ? "🎬 Video" : t.content || "";

  return (
    <div className="bg-muted/50 px-2 py-2 pb-safe border-t border-border/60" onPaste={handlePaste}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleImageFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleImageFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { void handleVideoFile(e.target.files?.[0]); e.target.value = ""; }} />

      {replyTarget && (
        <div className="flex items-center gap-2 mb-1.5 mr-12 px-2.5 py-1.5 rounded-xl bg-card border-l-4 border-primary shadow-sm">
          <CornerUpLeft className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-primary truncate">{replyTarget.senderName}</p>
            <p className="text-[12px] text-muted-foreground truncate">{replyLabel(replyTarget)}</p>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground p-1" aria-label="Cancel reply"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="relative flex-1 min-w-0 rounded-3xl bg-card shadow-sm border border-border/50">
          {recording ? (
            <div className="flex items-center gap-2 px-3 min-h-[44px]">
              {locked ? (
                <button onClick={() => stopRecording(true)} className="text-destructive p-1.5 -ml-1" aria-label="Cancel recording"><Trash2 className="w-5 h-5" /></button>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              )}
              {locked && <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />}
              <span className="text-[15px] text-foreground font-medium tabular-nums">{formatClock(elapsed)}</span>
              {locked ? (
                <span className="ml-auto text-xs text-muted-foreground">Recording…</span>
              ) : (
                <span
                  className={`ml-auto flex items-center gap-0.5 text-sm select-none transition-colors ${cancelArmed ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  style={{ transform: `translateX(${Math.max(slide.x, -CANCEL_SLIDE_PX)}px)`, opacity: Math.max(0.25, 1 + slide.x / (CANCEL_SLIDE_PX * 1.2)) }}
                >
                  <ChevronLeft className="w-4 h-4" />{cancelArmed ? "Release to cancel" : "Slide to cancel"}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-end">
              <button
                type="button"
                onClick={toggleEmoji}
                className="p-2.5 text-muted-foreground hover:text-foreground shrink-0"
                aria-label={showEmoji ? "Show keyboard" : "Emoji"}
                disabled={uploading}
              >
                {showEmoji ? <Keyboard className="w-6 h-6" /> : <Smile className="w-6 h-6" />}
              </button>

              <div className="flex-1 min-w-0 py-1">
                <MentionTextarea
                  ref={textareaRef}
                  value={text}
                  onChange={updateText}
                  onSubmit={handleSendText}
                  onTyping={onTyping}
                  placeholder="Message"
                  roomId={roomId}
                  // Desktop: Enter sends, Shift+Enter = new line. Phones/tablets: Enter = new line, use the send button.
                  shiftEnterToSubmit={touch}
                  disabled={uploading}
                  className="w-full resize-none bg-transparent px-1 py-1.5 text-[16px] sm:text-[15px] leading-[20px] text-foreground placeholder:text-muted-foreground focus:outline-none max-h-[120px] overflow-y-auto"
                />
              </div>

              <div className="relative shrink-0 flex">
                <button
                  type="button"
                  onClick={() => { setShowEmoji(false); setShowAttach((o) => !o); }}
                  className="p-2.5 text-muted-foreground hover:text-foreground -rotate-45"
                  aria-label="Attach"
                  disabled={uploading}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                {!hasText && touch && (
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="p-2.5 text-muted-foreground hover:text-foreground" aria-label="Camera" disabled={uploading}>
                    <Camera className="w-5 h-5" />
                  </button>
                )}

                {showAttach && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAttach(false)} />
                    <div className="absolute bottom-full right-0 mb-2 z-40 rounded-2xl bg-card border border-border shadow-xl p-3 flex gap-4 animate-fade-in">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-foreground">
                        <span className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center"><ImageIcon className="w-6 h-6" /></span>Photo
                      </button>
                      {canUploadVideo && (
                        <button type="button" onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-foreground">
                          <span className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center"><Video className="w-6 h-6" /></span>Video
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Send / mic */}
        <div className="relative shrink-0">
          {holding && !locked && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col items-center gap-1 rounded-full bg-card border border-border shadow-lg px-2 py-2 text-muted-foreground pointer-events-none animate-fade-in" style={{ transform: `translate(-50%, ${Math.max(slide.y, -LOCK_SLIDE_PX) * 0.5}px)` }}>
              <Lock className="w-4 h-4" />
              <span className="text-[10px] leading-none">▲</span>
            </div>
          )}
          {showMicButton ? (
            <button
              type="button"
              onPointerDown={onMicPointerDown}
              onPointerMove={onMicPointerMove}
              onPointerUp={onMicPointerUp}
              onPointerCancel={onMicPointerCancel}
              onContextMenu={(e) => e.preventDefault()}
              disabled={uploading}
              className={`w-11 h-11 rounded-full flex items-center justify-center shadow-elevated touch-none select-none transition-transform duration-150 [-webkit-touch-callout:none] ${cancelArmed ? "bg-destructive" : "gradient-primary"} ${holding ? "scale-150" : ""}`}
              aria-label="Hold to record voice note"
              title="Hold to record, release to send"
            >
              <Mic className="w-5 h-5 text-primary-foreground" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (hasText ? handleSendText() : stopRecording(false))}
              disabled={uploading && !hasText}
              className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center shadow-elevated active:scale-95 transition-transform"
              aria-label={hasText ? "Send message" : "Send voice note"}
            >
              <Send className="w-5 h-5 text-primary-foreground" />
            </button>
          )}
        </div>
      </div>

      {showEmoji && !recording && <EmojiPanel onPick={(emoji) => textareaRef.current?.insertText(emoji, { focus: !touch })} />}
      {uploading && !pending && <div className="mt-1 text-xs text-muted-foreground text-center">Sending…</div>}

      {/* Photo / video preview with caption */}
      {pending && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fade-in">
          <div className="flex items-center p-3">
            <button onClick={closePreview} disabled={uploading} className="p-2 text-white" aria-label="Discard"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-2">
            {pending.kind === "image" ? (
              <img src={pending.url} alt="Preview" className="max-w-full max-h-full object-contain rounded-md" />
            ) : (
              <video src={pending.url} controls playsInline className="max-w-full max-h-full rounded-md" />
            )}
          </div>
          <div className="p-3 pb-safe flex items-end gap-2">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendPending(); } }}
              placeholder="Add a caption…"
              maxLength={1000}
              autoFocus={!touch}
              className="flex-1 rounded-3xl bg-white/15 text-white placeholder:text-white/60 px-4 py-2.5 text-[16px] focus:outline-none"
            />
            <button
              onClick={() => void sendPending()}
              disabled={uploading}
              className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center shadow-elevated disabled:opacity-60"
              aria-label="Send"
            >
              {uploading ? <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5 text-primary-foreground" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
