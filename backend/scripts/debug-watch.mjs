import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { resolve } from "node:path";

const cwd = resolve(import.meta.dirname, "..");
const watchRoots = ["src", "../shared"].map((path) => resolve(cwd, path));
const restartDelayMs = 500;
const debounceMs = 150;

let child = null;
let restartTimer = null;
let restarting = false;

function start() {
  child = spawn(
    process.execPath,
    [
      "--inspect=9229",
      "--enable-source-maps",
      "--import",
      "tsx",
      "src/main.ts"
    ],
    {
      cwd,
      stdio: "inherit",
      env: process.env
    }
  );

  child.on("exit", () => {
    child = null;
  });
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    void restart();
  }, debounceMs);
}

async function restart() {
  if (restarting) return;
  restarting = true;

  if (child && child.exitCode === null) {
    await new Promise((resolveExit) => {
      child.once("exit", resolveExit);
      child.kill("SIGTERM");
    });
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, restartDelayMs));
  start();
  restarting = false;
}

for (const root of watchRoots) {
  watch(root, { recursive: true }, (_eventType, filename) => {
    if (!filename || !filename.endsWith(".ts")) return;
    scheduleRestart();
  });
}

process.on("SIGINT", () => {
  child?.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGTERM", () => {
  child?.kill("SIGTERM");
  process.exit(0);
});

start();
