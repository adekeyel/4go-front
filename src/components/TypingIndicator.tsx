interface TypingIndicatorProps {
  typingUsers: { userId: string; displayName: string }[];
}

/** Small "…" bubble at the bottom of the chat while someone types. The header carries the "typing…" text. */
export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;
  return (
    <div className="mt-2 flex justify-start animate-fade-in" role="status" aria-label="Typing">
      <div className="bubble-received bubble-tail-in rounded-lg rounded-tl-none px-3 py-2.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative">
        <div className="flex gap-1 items-center h-2">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
