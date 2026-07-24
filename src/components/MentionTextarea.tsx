import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
      reset: () => {
        if (taRef.current) {
          taRef.current.style.height = "auto";
        }
        setSuggestions([]);
        setMentionStart(null);
      },
    }));

    // Debounced search
    useEffect(() => {
      if (mentionStart === null || !user) {
        setSuggestions([]);
        return;
      }
      const t = setTimeout(async () => {
        if (query.length === 0) {
          // Show top suggestions even with empty query
        }
        const { data } = await supabase.rpc("search_mentionable_users", {
          p_user_id: user.id,
          p_query: query,
          p_room_id: roomId ?? null,
          p_limit: 6,
        });
        setSuggestions((data || []) as Suggestion[]);
        setActiveIdx(0);
      }, 120);
      return () => clearTimeout(t);
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
