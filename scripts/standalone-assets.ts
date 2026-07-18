import { access, cp, rm } from "node:fs/promises";
import path from "node:path";

export async function prepareStandaloneAssets(projectRoot = process.cwd()) {
  const nextRoot = path.join(projectRoot, ".next");
  const standaloneRoot = path.join(nextRoot, "standalone");
  const standaloneStatic = path.join(standaloneRoot, ".next/static");
  const publicRoot = path.join(projectRoot, "public");
  const standalonePublic = path.join(standaloneRoot, "public");

  await requirePath(
    path.join(standaloneRoot, "server.js"),
    "Standalone server output is missing. Run the production build first."
  );
  await requirePath(
    path.join(nextRoot, "static"),
    "Next.js static assets are missing. Run the production build first."
  );

  await rm(standaloneStatic, { recursive: true, force: true });
  await cp(path.join(nextRoot, "static"), standaloneStatic, { recursive: true });
  await rm(standalonePublic, { recursive: true, force: true });
  if (await pathExists(publicRoot)) {
    await cp(publicRoot, standalonePublic, { recursive: true });
  }

  await assertPreparedStandaloneAssets(projectRoot);
}

export async function assertPreparedStandaloneAssets(projectRoot = process.cwd()) {
  const standaloneRoot = path.join(projectRoot, ".next/standalone");
  await requirePath(
    path.join(standaloneRoot, "server.js"),
    "Prepared standalone server artifact is missing."
  );
  await requirePath(
    path.join(standaloneRoot, ".next/static"),
    "Prepared standalone static assets are missing."
  );
}

async function requirePath(targetPath: string, message: string) {
  if (!(await pathExists(targetPath))) {
    throw new Error(message);
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
