import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time cleanup: unregister legacy ad-network service workers and purge old
// caches that left iPhone/Safari users on broken/stale builds.
(async () => {
  try {
    const FLAG = "4go-sw-cleanup-v3";
    if ("serviceWorker" in navigator && !localStorage.getItem(FLAG)) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        try {
          const scriptURL = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          // Remove the previous broken SW so the fresh /sw.js can take over cleanly
          if (scriptURL && !scriptURL.endsWith("/sw.js?v=3")) {
            await r.unregister();
          }
        } catch {}
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k === "4go-cache-v1" || k === "4go-cache-v2")
            .map((k) => caches.delete(k))
        );
      }
      localStorage.setItem(FLAG, "1");
    }
  } catch {
    // never block app boot
  }
})();

createRoot(document.getElementById("root")!).render(<App />);

// PWA service worker registration — only in production, not in iframes/preview
if ("serviceWorker" in navigator) {
  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (isInIframe) {
    // Unregister any existing service workers in iframe/preview contexts
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed
      });
    });
  }
}
