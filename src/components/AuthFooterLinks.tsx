import { Link } from "react-router-dom";

export default function AuthFooterLinks() {
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <Link to="/about" className="hover:text-primary transition-colors">About</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
        <span>·</span>
        <Link to="/support" className="hover:text-primary transition-colors">Support</Link>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Powered by{" "}
        <span className="font-semibold text-foreground">4GO Technology LTD</span>
      </p>
    </div>
  );
}
