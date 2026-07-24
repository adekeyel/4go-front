import { defineConfig, devices } from "@playwright/test";

// Standard Playwright config (replaces the previous Lovable-agent-managed config).
// Add e2e specs under an `e2e/` directory and adjust `testDir` if needed.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
  },
});
