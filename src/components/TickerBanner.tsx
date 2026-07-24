import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const NEON_BG: React.CSSProperties = {
  background:
    "radial-gradient(circle at 12% 50%, hsl(220 80% 22% / 0.9), transparent 45%), radial-gradient(circle at 88% 50%, hsl(330 85% 28% / 0.85), transparent 45%), linear-gradient(90deg, hsl(232 55% 8%), hsl(262 55% 11%) 50%, hsl(330 65% 12%))",
};

export default function TickerBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="relative w-full h-[60px] flex items-center overflow-hidden text-white"
      style={NEON_BG}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />
      <button
        onClick={() => navigate("/about")}
        className="relative z-10 flex-1 h-full overflow-hidden text-left"
        aria-label="Learn more about 4GO"
      >
        <div className="whitespace-nowrap inline-block animate-promo-scroll text-[13px] font-medium">
          ⚡ Create. Share. Earn. &nbsp;|&nbsp; 💬 Discover Rooms &nbsp;|&nbsp; 💰 Support Creators &nbsp;|&nbsp; Join 4GO →
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        aria-label="Dismiss banner"
        className="relative z-10 shrink-0 px-3 h-full flex items-center text-white/80 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
