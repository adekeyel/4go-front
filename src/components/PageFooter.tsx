import { Link } from "react-router-dom";
import { Home } from "lucide-react";

interface PageFooterProps {
  /** When true, shows a prominent "Back to Home" button (used on info pages). */
  showBackHome?: boolean;
}

/**
 * Shared site footer. Displays "Powered by 4GO Technology LTD" on every page
 * and an optional Back-to-Home button for static info pages.
 */
export default function PageFooter({ showBackHome = false }: PageFooterProps) {
  return (
    <footer className="mt-8 border-t border-border bg-card/50">
      <div className="max-w-lg mx-auto px-4 py-5 flex flex-col items-center gap-3">
        {showBackHome && (
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full gradient-primary text-primary-foreground text-sm font-semibold shadow-card"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <Link to="/about" className="hover:text-primary transition-colors">About 4GO</Link>
          <span aria-hidden>·</span>
          <Link to="/founder" className="hover:text-primary transition-colors">Founder</Link>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <span aria-hidden>·</span>
          <Link to="/cookies" className="hover:text-primary transition-colors">Cookies</Link>
          <span aria-hidden>·</span>
          <Link to="/support" className="hover:text-primary transition-colors">Support</Link>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          Powered by{" "}
          <span className="font-semibold text-foreground">4GO Technology LTD</span>
        </p>
      </div>
    </footer>
  );
}
