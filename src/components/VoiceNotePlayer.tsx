import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

// Only one voice note plays at a time: starting another pauses the first (like WhatsApp).
let activeAudio: HTMLAudioElement | null = null;

const SPEEDS = [1, 1.5, 2];

function formatTime(seconds: number) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * Chrome and Firefox record voice notes as .webm/.ogg, which older iPhone Safari can't play, so an Android user's
 * voice note would be silent on an iPhone. Cloudinary converts on the fly when the file extension is swapped, so
 * if THIS browser can't play the original, ask for an .mp3 instead. Browsers that can play it get the original
 * file untouched (no conversion cost).
 */
export function playableVoiceUrl(url: string): string {
  if (!/res\.cloudinary\.com/.test(url) || !/\/video\/upload\//.test(url)) return url;
  const match = url.match(/\.(webm|ogg|oga|opus)(\?.*)?$/i);
  if (!match) return url;
  const ext = match[1].toLowerCase();
  const probe = document.createElement("audio");
  const canPlayOriginal =
    ext === "webm" ? probe.canPlayType('audio/webm; codecs="opus"') !== "" : probe.canPlayType('audio/ogg; codecs="opus"') !== "";
  if (canPlayOriginal) return url;
  return url.replace(/\.(webm|ogg|oga|opus)(\?.*)?$/i, ".mp3$2");
}

interface VoiceNotePlayerProps {
  src: string;
  /** Length in seconds as stored with the message. Recorded .webm files often don't report their own length. */
  duration?: number | null;
}

export default function VoiceNotePlayer({ src, duration }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration && duration > 0 ? duration : 0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  const [canSeek, setCanSeek] = useState(false);
  const playSrc = useMemo(() => playableVoiceUrl(src), [src]);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        if (activeAudio === a) activeAudio = null;
      }
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    if (activeAudio && activeAudio !== a) activeAudio.pause();
    activeAudio = a;
    try {
      a.playbackRate = rate;
      await a.play();
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const syncDuration = () => {
    const a = audioRef.current;
    if (!a) return;
    const finite = Number.isFinite(a.duration) && a.duration > 0;
    setCanSeek(finite);
    if (finite) setTotal(a.duration);
  };

  return (
    <div className="flex items-center gap-2 min-w-[210px]">
      <audio
        ref={audioRef}
        src={playSrc}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={syncDuration}
        onDurationChange={syncDuration}
        onError={() => setFailed(true)}
      />
      <button
        onClick={() => void toggle()}
        className="w-9 h-9 shrink-0 rounded-full gradient-primary flex items-center justify-center shadow-card"
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={Math.min(current, total || current)}
          disabled={!canSeek}
          onChange={(e) => {
            const a = audioRef.current;
            if (a && canSeek) { a.currentTime = Number(e.target.value); setCurrent(a.currentTime); }
          }}
          className="w-full h-1 accent-primary disabled:opacity-100"
          aria-label="Voice note progress"
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
          {failed ? (
            <a href={src} target="_blank" rel="noreferrer" className="underline text-destructive">Couldn't play · open file</a>
          ) : (
            <span className="tabular-nums">{playing || current > 0 ? `${formatTime(current)} / ${formatTime(total)}` : formatTime(total)}</span>
          )}
        </div>
      </div>

      {(playing || current > 0) && (
        <button onClick={cycleSpeed} className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-foreground" aria-label="Playback speed">
          {rate}x
        </button>
      )}
    </div>
  );
}
