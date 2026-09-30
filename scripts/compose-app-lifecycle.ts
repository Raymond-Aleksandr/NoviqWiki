import { spawnSync } from "node:child_process";

type ComposeAppLifecycleContext = "backup" | "restore";

export function stopComposeAppIfRunning(context: ComposeAppLifecycleContext) {
  const running = spawnSync(
    "docker",
    ["compose", "ps", "--status", "running", "--services", "app"],
    { encoding: "utf8" }
  );
  if (running.status !== 0) {
    throw new Error(`Unable to inspect the Docker Compose app before ${context}.`, {
      cause:
        running.error ??
        new Error(running.stderr?.trim() || `Docker exited with status ${running.status ?? "unknown"}.`)
    });
  }
  if (!running.stdout.split(/\s+/).includes("app")) {
    return false;
  }
  const stopped = spawnSync("docker", ["compose", "stop", "app"], {
    stdio: "inherit"
  });
  if (stopped.status !== 0) {
    throw new Error(
      context === "backup"
        ? "Unable to stop the Docker Compose app for a consistent media backup."
        : "Unable to stop the Docker Compose app before restore."
    );
  }
  return true;
}

export function startComposeApp(context: ComposeAppLifecycleContext) {
  const started = spawnSync("docker", ["compose", "start", "app"], {
    stdio: "inherit"
  });
  if (started.status !== 0) {
    throw new Error(`Unable to restart the Docker Compose app after ${context}.`, {
      cause: started.error
    });
  }
}
