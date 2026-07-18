import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPreparedStandaloneAssets,
  prepareStandaloneAssets
} from "../../scripts/standalone-assets";

const temporaryRoots: string[] = [];

describe("standalone E2E assets", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryRoots.splice(0).map((target) => rm(target, { recursive: true, force: true }))
    );
  });

  it("copies static and public assets into a standalone build", async () => {
    const root = await temporaryProject();
    await mkdir(path.join(root, ".next/standalone"), { recursive: true });
    await mkdir(path.join(root, ".next/static/chunks"), { recursive: true });
    await mkdir(path.join(root, "public"), { recursive: true });
    await writeFile(path.join(root, ".next/standalone/server.js"), "server");
    await writeFile(path.join(root, ".next/static/chunks/app.js"), "chunk");
    await writeFile(path.join(root, "public/favicon.svg"), "icon");

    await prepareStandaloneAssets(root);

    await expect(assertPreparedStandaloneAssets(root)).resolves.toBeUndefined();
    await expect(
      readFile(path.join(root, ".next/standalone/.next/static/chunks/app.js"), "utf8")
    ).resolves.toBe("chunk");
    await expect(
      readFile(path.join(root, ".next/standalone/public/favicon.svg"), "utf8")
    ).resolves.toBe("icon");
  });

  it("rejects incomplete downloaded artifacts before resetting the E2E database", async () => {
    const root = await temporaryProject();
    await mkdir(path.join(root, ".next/standalone"), { recursive: true });
    await writeFile(path.join(root, ".next/standalone/server.js"), "server");

    await expect(assertPreparedStandaloneAssets(root)).rejects.toThrow(
      "Prepared standalone static assets are missing."
    );
  });
});

async function temporaryProject() {
  const root = await mkdtemp(path.join(tmpdir(), "noviqwiki-standalone-"));
  temporaryRoots.push(root);
  return root;
}
