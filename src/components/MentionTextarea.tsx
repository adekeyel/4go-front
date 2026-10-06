import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useAuth } from "@/contexts/AuthContext";
import * as roomsApi from "@/api/rooms";
import * as profilesApi from "@/api/profiles";
import UserAvatar from "@/components/UserAvatar";

interface Suggestion {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  roomId?: string | null;
  disabled?: boolean;
  className?: string;
  onTyping?: () => void;
  autoResize?: boolean;
  /** If true, only Shift+Enter submits (chat behavior). */
  shiftEnterToSubmit?: boolean;
}

export interface MentionTextareaHandle {
  focus: () => void;
  reset: () => void;
  /** Insert text (e.g. an emoji) at the caret / over the selection. */
  insertText: (text: string, opts?: { focus?: boolean }) => void;
}

const MentionTextarea = forwardRef<MentionTextareaHandle, MentionTextareaProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder,
      rows = 1,
      maxLength,
      roomId,
      disabled,
      className = "",
      onTyping,
      autoResize = true,
      shiftEnterToSubmit = false,
    },
    ref
  ) => {
    const { user } = useAuth();
    const taRef = useRef<HTMLTextAreaElement>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [query, setQuery] = useState("");

    useImperativeHandle(ref, () => ({
      focus: () => taRef.current?.focus(),
      insertText: (text, opts) => {
        const ta = taRef.current;
        const start = ta?.selectionStart ?? value.length;
        const end = ta?.selectionEnd ?? start;
        const next = value.slice(0, start) + text + value.slice(end);
        if (maxLength && next.length > maxLength) return;
        onChange(next);
        const pos = start + text.length;
        requestAnimationFrame(() => {
          if (!ta) return;
          if (opts?.focus !== false) ta.focus();
          ta.setSelectionRange(pos, pos);
        });
      },
      reset: () => {
        if (taRef.current) {
          taRef.current.style.height = "auto";
        }
        setSuggestions([]);
        setMentionStart(null);
      },
    }));

    // Keep the height in step with the value (drafts, emoji, mentions) - not only with typing.
    useEffect(() => {
      const ta = taRef.current;
      if (!ta || !autoResize) return;
      ta.style.height = "auto";
      if (value) ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }, [value, autoResize]);

    // Debounced search
    useEffect(() => {
      if (mentionStart === null || !user) {
        setSuggestions([]);
        return;
      }
      const t = setTimeout(async () => {
        try {
          // Room members first (matches the old RPC's room-priority behavior),
          // filtered client-side; falls back to a global search with no room.
          let candidates: Suggestion[] = [];
          if (roomId) {
            const members = await roomsApi.listRoomMembers(roomId);
            candidates = members
              .filter((m) => m.user_id !== user.id)
              .map((m) => ({ user_id: m.user_id, username: m.profile?.username ?? null, display_name: m.profile?.display_name ?? null, avatar_url: m.profile?.avatar_url ?? null }));
          } else if (query.length > 0) {
            const profiles = await profilesApi.searchProfiles(query);
            candidates = profiles.filter((p) => p.user_id !== user.id);
          }
          const q = query.toLowerCase();
          const filtered = q
            ? candidates.filter((c) => c.username?.toLowerCase().startsWith(q) || c.display_name?.toLowerCase().startsWith(q))
            : candidates;
          setSuggestions(filtered.slice(0, 6));
          setActiveIdx(0);
        } catch {
          setSuggestions([]);
        }
      }, 120);
      return () => clearTimeout(t);
      // user?.id (primitive) is used deliberately instead of the user object
      // to avoid re-running this debounced search on every auth context refresh.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, mentionStart, user?.id, roomId]);

    const detectMention = (text: string, caret: number) => {
      // Look back from caret for an @ that starts a token
      let i = caret - 1;
      while (i >= 0) {
        const ch = text[i];
        if (ch === "@") {
          const before = i === 0 ? " " : text[i - 1];
          if (/\s|^/.test(before) || i === 0) {
            const slice = text.slice(i + 1, caret);
            if (/^[a-zA-Z0-9_.]{0,30}$/.test(slice)) {
              setMentionStart(i);
              setQuery(slice);
              return;
            }
          }
          break;
        }
        if (/\s/.test(ch)) break;
        i--;
      }
      setMentionStart(null);
      setSuggestions([]);
    };

    const insertMention = (s: Suggestion) => {
      if (mentionStart === null || !taRef.current) return;
      const ta = taRef.current;
      const caret = ta.selectionStart ?? value.length;
      const handle = s.username || s.display_name?.replace(/\s+/g, "") || "user";
      const before = value.slice(0, mentionStart);
      const after = value.slice(caret);
      const insert = `@${handle} `;
      const next = before + insert + after;
      onChange(next);
      setSuggestions([]);
      setMentionStart(null);
      requestAnimationFrame(() => {
        const pos = (before + insert).length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      onChange(v);
      onTyping?.();
      if (autoResize) {
        e.target.style.height = "auto";
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
      }
      detectMention(v, e.target.selectionStart ?? v.length);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIdx((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(suggestions[activeIdx]);
          return;
        }
        if (e.key === "Escape") {
          setSuggestions([]);
          setMentionStart(null);
          return;
        }
      }
      if (onSubmit) {
        if (shiftEnterToSubmit) {
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }
    };

    return (
      <div className="relative w-full">
        <textarea
          ref={taRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className={className || "w-full resize-none bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-[120px] overflow-y-auto"}
        />
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={s.user_id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <UserAvatar url={s.avatar_url} name={s.display_name || ""} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {s.display_name || s.username || "User"}
                  </p>
                  {s.username && (
                    <p className="text-xs text-muted-foreground truncate">@{s.username}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

MentionTextarea.displayName = "MentionTextarea";
export default MentionTextarea;
