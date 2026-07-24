import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Zap } from "lucide-react";

const NEON_BG: React.CSSProperties = {
  background:
    "radial-gradient(circle at 12% 50%, hsl(220 80% 22% / 0.9), transparent 45%), radial-gradient(circle at 88% 50%, hsl(330 85% 28% / 0.85), transparent 45%), linear-gradient(90deg, hsl(232 55% 8%), hsl(262 55% 11%) 50%, hsl(330 65% 12%))",
};

export default function PromoBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <button
      type="button"
      onClick={() => navigate(user ? "/about" : "/signup")}
      aria-label="Join 4GO — Create, Share, Earn"
      className="relative w-full h-[60px] flex items-center justify-between gap-2 px-3 overflow-hidden text-white cursor-pointer group rounded-md"
      style={NEON_BG}
    >
      {/* dotted texture */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />
      {/* diagonal speed line left */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-6 top-0 h-full w-24 opacity-60"
        style={{
          background:
            "linear-gradient(75deg, transparent 40%, hsl(199 100% 60% / 0.5) 50%, transparent 60%)",
        }}
      />
      {/* diagonal speed line right */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 top-0 h-full w-28 opacity-70"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, hsl(330 100% 60% / 0.55) 50%, transparent 60%)",
        }}
      />

      {/* Left: 4GO logo */}
      <span className="relative z-10 flex items-center gap-2 shrink-0">
        <span
          className="font-display font-extrabold text-lg tracking-tight bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(135deg, hsl(199 100% 60%), hsl(280 95% 65%), hsl(330 95% 60%))",
          }}
        >
          4GO
        </span>
        <span className="h-7 w-px bg-white/25" />
        <Zap className="w-4 h-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" fill="currentColor" />
      </span>

      {/* Center: tagline */}
      <span className="relative z-10 flex flex-col items-center min-w-0 flex-1 px-1">
        <span className="text-[11px] sm:text-[13px] font-extrabold tracking-wide leading-none whitespace-nowrap">
          <span style={{ color: "hsl(199 100% 65%)" }}>CREATE</span>
          <span className="mx-1 text-white/70">•</span>
          <span style={{ color: "hsl(300 95% 70%)" }}>SHARE</span>
          <span className="mx-1 text-white/70">•</span>
          <span style={{ color: "hsl(35 100% 60%)" }}>EARN</span>
        </span>
        <span className="text-[9px] sm:text-[10px] text-white/70 mt-0.5 leading-none truncate max-w-full">
          Your Content. Your Community. Your Way.
        </span>
      </span>

      {/* Right: CTA */}
      <span
        className="relative z-10 inline-flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-wide text-white shadow-[0_0_18px_hsl(330_95%_60%/0.55)] group-hover:shadow-[0_0_22px_hsl(330_95%_60%/0.75)] transition-shadow"
        style={{
          background:
            "linear-gradient(90deg, hsl(330 95% 58%), hsl(20 100% 58%))",
        }}
      >
        JOIN 4GO <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
