import { useMemo, useState } from "react";

const CATEGORIES: { id: string; icon: string; label: string; emojis: string }[] = [
  { id: "smileys", icon: "😀", label: "Smileys", emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫡 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 🤖 🎃" },
  { id: "gestures", icon: "👍", label: "People", emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 💪 🙌 👏 🫶 🤲 ✍️ 💅 🤳 🙋 🙆 🙅 🤷 🤦 🙇 💁 🧏 👀 👁️ 👅 👄 🧠" },
  { id: "hearts", icon: "❤️", label: "Hearts", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 😻 💋 💯 💢 💥 💫 💦 💨 🕊️ ✨ ⭐ 🌟 🔥 🎉 🎊" },
  { id: "nature", icon: "🐶", label: "Nature", emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🦀 🐠 🐬 🐳 🦈 🐘 🦒 🌸 🌹 🌻 🌼 🌴 🌲 🍀 🌍 🌙 ☀️ ⛅ 🌈 ⚡ ❄️ 🌊" },
  { id: "food", icon: "🍔", label: "Food", emojis: "🍎 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥑 🍆 🥕 🌽 🌶️ 🥔 🍞 🧀 🍳 🥞 🥓 🍔 🍟 🍕 🌭 🌮 🌯 🍝 🍜 🍲 🍛 🍣 🍱 🍤 🍙 🍚 🍦 🍩 🍪 🎂 🍰 🍫 🍬 🍿 ☕ 🍵 🥤 🍺 🍻 🥂 🍷 🍹" },
  { id: "activity", icon: "⚽", label: "Activity", emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🥊 🎯 🎮 🎲 🎧 🎤 🎸 🎹 🥁 🎬 🎨 🏆 🥇 🥈 🥉 🏅" },
  { id: "travel", icon: "🚗", label: "Travel", emojis: "🚗 🚕 🚌 🏎️ 🚓 🚑 🚒 🚚 🏍️ 🚲 ✈️ 🚀 🚁 🚢 ⚓ 🏠 🏢 🏫 🏥 ⛪ 🕌 🗼 🗽 🌆 🌅 🏖️ 🏝️ ⛰️ 🗺️ 🧭" },
  { id: "objects", icon: "💡", label: "Objects", emojis: "📱 💻 ⌨️ 🖥️ 📷 📹 🎥 📞 ☎️ 📺 ⏰ 💡 🔋 🔌 💰 💵 💳 💎 🔧 🔨 🔑 🔒 🔓 📦 ✉️ 📧 📝 📚 📌 📎 ✂️ 🎁 🎈 🧸 🛒 🕯️" },
  { id: "symbols", icon: "🔣", label: "Symbols", emojis: "✅ ❌ ❎ ⭕ ❗ ❓ ‼️ ⚠️ 🚫 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ➕ ➖ ➗ ✖️ ♻️ 🔞 🆗 🆒 🆕 🆓 🔝 ➡️ ⬅️ ⬆️ ⬇️ 🔄 💲" },
];

const RECENT_KEY = "chat.recentEmojis";

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecents().filter((e) => e !== emoji)].slice(0, 24);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable: recents just won't persist */ }
  return next;
}

interface EmojiPanelProps {
  onPick: (emoji: string) => void;
}

export default function EmojiPanel({ onPick }: EmojiPanelProps) {
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const tabs = useMemo(
    () => (recents.length ? [{ id: "recent", icon: "🕘", label: "Recent", emojis: recents.join(" ") }, ...CATEGORIES] : CATEGORIES),
    [recents]
  );
  const [active, setActive] = useState(recents.length ? "recent" : "smileys");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const list = useMemo(() => current.emojis.split(" ").filter(Boolean), [current]);

  return (
    // mouse-down is cancelled so tapping an emoji doesn't steal focus from the text box
    <div className="mt-2 rounded-xl bg-card border border-border overflow-hidden animate-fade-in" onMouseDown={(e) => e.preventDefault()}>
      <div className="flex items-center border-b border-border px-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setActive(t.id)}
            className={`flex-1 py-2 text-lg leading-none border-b-2 transition-colors ${t.id === current.id ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="h-56 overflow-y-auto p-2 grid grid-cols-8 gap-0.5 content-start">
        {list.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => { setRecents(saveRecent(emoji)); onPick(emoji); }}
            className="aspect-square flex items-center justify-center text-2xl rounded-lg hover:bg-muted active:scale-90 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
