import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("container fallback secret", () => {
  it("publishes one canonical value across concurrent same-PID-shell contenders", async () => {
    const secretDirectory = await mkdtemp(join(tmpdir(), "noviqwiki-secret-test-"));
    const contenderCount = 16;
    const shell = String.raw`
set -eu
. ./scripts/container-secret.sh
i=1
while [ "$i" -le ${contenderCount} ]; do
  (
    unset NOVIQWIKI_SECRET
    resolve_noviqwiki_secret
    printf '%s\n' "$NOVIQWIKI_SECRET" > "$NOVIQWIKI_SECRET_DIR/result.$i"
    printf '%s\n' "$$" > "$NOVIQWIKI_SECRET_DIR/pid.$i"
  ) &
  i=$((i + 1))
done
wait
`;

    try {
      await execFileAsync("sh", ["-c", shell], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NOVIQWIKI_SECRET: "",
          NOVIQWIKI_SECRET_DIR: secretDirectory
        }
      });

      const persistedPath = join(secretDirectory, "noviqwiki-secret");
      const persistedSecret = (await readFile(persistedPath, "utf8")).trim();
      const contenderSecrets = await Promise.all(
        Array.from({ length: contenderCount }, (_, index) =>
          readFile(join(secretDirectory, `result.${index + 1}`), "utf8").then((value) =>
            value.trim()
          )
        )
      );
      const contenderPids = await Promise.all(
        Array.from({ length: contenderCount }, (_, index) =>
          readFile(join(secretDirectory, `pid.${index + 1}`), "utf8").then((value) => value.trim())
        )
      );

      expect(persistedSecret).toMatch(/^[a-f0-9]{64}$/);
      expect(new Set(contenderPids).size).toBe(1);
      expect(new Set(contenderSecrets)).toEqual(new Set([persistedSecret]));
      expect((await stat(persistedPath)).mode & 0o777).toBe(0o600);
      expect((await readdir(secretDirectory)).filter((name) => name.includes(".tmp."))).toEqual([]);
    } finally {
      await rm(secretDirectory, { recursive: true, force: true });
    }
  });
});
