import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3101";
const playwrightBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`;
const serverMode = process.env.NOVIQWIKI_E2E_SERVER_MODE ?? "start";
const standaloneCommand =
  process.platform === "win32"
    ? `set PORT=${playwrightPort}&& set HOSTNAME=127.0.0.1&& node .next/standalone/server.js`
    : `PORT=${playwrightPort} HOSTNAME=127.0.0.1 node .next/standalone/server.js`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: playwrightBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: serverMode === "dev" ? `pnpm exec next dev -p ${playwrightPort}` : standaloneCommand,
    url: playwrightBaseURL,
    reuseExistingServer: process.env.NOVIQWIKI_E2E_REUSE_SERVER === "1",
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
