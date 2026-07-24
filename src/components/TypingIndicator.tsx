interface TypingIndicatorProps {
  typingUsers: { userId: string; displayName: string }[];
}

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const names =
    typingUsers.length === 1
      ? typingUsers[0].displayName
      : typingUsers.length === 2
      ? `${typingUsers[0].displayName} and ${typingUsers[1].displayName}`
      : `${typingUsers[0].displayName} and ${typingUsers.length - 1} others`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 animate-fade-in">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground italic">
        {names} {typingUsers.length === 1 ? "is" : "are"} typing...
      </span>
    </div>
  );
}
