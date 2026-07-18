import "dotenv/config";

import { spawn } from "node:child_process";
import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { resetE2eDatabase } from "./e2e-support";

async function main() {
  const reset = await resetE2eDatabase();
  const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3101";
  const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`;
  const mediaRoot = path.resolve(process.env.NOVIQWIKI_E2E_MEDIA_ROOT ?? "test-results/e2e-media");
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const childEnv = {
    ...process.env,
    DATABASE_URL: reset.databaseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    NOVIQWIKI_BASE_URL: playwrightBaseUrl,
    NOVIQWIKI_MEDIA_ROOT: mediaRoot,
    NOVIQWIKI_SECRET:
      process.env.NOVIQWIKI_SECRET ?? "e2e-only-secret-change-before-production-000000",
    HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1",
    PORT: process.env.PORT ?? playwrightPort,
    PLAYWRIGHT_BASE_URL: playwrightBaseUrl,
    PLAYWRIGHT_PORT: playwrightPort,
    NOVIQWIKI_E2E_SERVER_MODE: process.env.NOVIQWIKI_E2E_SERVER_MODE ?? "start"
  };

  await mkdir(mediaRoot, { recursive: true });
  console.log(
    `Reset and migrated e2e database schema (${reset.databaseLabel}${
      reset.createdDatabase ? ", created database" : ""
    }).`
  );
  console.log(`Running Playwright against ${playwrightBaseUrl}.`);

  if (process.env.NOVIQWIKI_E2E_SKIP_BUILD !== "1") {
    await run(command, ["exec", "next", "build"], childEnv);
  }
  await prepareStandaloneAssets();
  await run(command, ["exec", "playwright", "test", ...process.argv.slice(2)], childEnv);
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, {
    env,
    stdio: "inherit"
  });
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with status ${code ?? "unknown"}.`));
      }
    });
  });
}

async function prepareStandaloneAssets() {
  const standaloneRoot = path.resolve(".next/standalone");
  const standaloneStatic = path.join(standaloneRoot, ".next/static");
  const standalonePublic = path.join(standaloneRoot, "public");
  const publicRoot = path.resolve("public");

  await rm(standaloneStatic, { recursive: true, force: true });
  await cp(path.resolve(".next/static"), standaloneStatic, { recursive: true });
  await rm(standalonePublic, { recursive: true, force: true });
  if (await pathExists(publicRoot)) {
    await cp(publicRoot, standalonePublic, { recursive: true });
  }
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
