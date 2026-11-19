import { defineConfig } from "@playwright/test";

// The isolated component fixture never connects to the app server, auth, or database.
export default defineConfig({
  testDir: ".",
  testMatch: "modal-keyboard.spec.ts",
  workers: 1,
  retries: 0,
  use: { viewport: { width: 375, height: 812 }, contextOptions: { reducedMotion: "reduce" } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
