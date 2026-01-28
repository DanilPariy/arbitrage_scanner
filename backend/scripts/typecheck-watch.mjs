import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

process.title = "typecheck-watch";

const status = {
  backend: "pending",
  frontend: "pending"
};

function updateTitle() {
  const backendOk = status.backend === "ok";
  const frontendOk = status.frontend === "ok";
  const overallOk = backendOk && frontendOk;
  const summary = `backend ${status.backend}, frontend ${status.frontend}`;
  const title = `typecheck ${overallOk ? "OK" : "ERR"} (${summary})`;
  process.stdout.write(`\u001b]0;${title}\u0007`);
}

function updateStatus(label, line) {
  const match = line.match(/Found\s+(\d+)\s+errors?/i);
  if (!match) return;
  const count = Number(match[1]);
  status[label] = count === 0 ? "ok" : "err";
  updateTitle();
}

function runProcess(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  const prefix = `[${label}] `;
  const stdoutRl = createInterface({ input: child.stdout });
  const stderrRl = createInterface({ input: child.stderr });

  stdoutRl.on("line", (line) => {
    updateStatus(label, line);
    process.stdout.write(`${prefix}${line}\n`);
  });

  stderrRl.on("line", (line) => {
    process.stderr.write(`${prefix}${line}\n`);
  });

  return child;
}

const backend = runProcess("backend", "tsc", [
  "-p",
  "tsconfig.json",
  "--noEmit",
  "--watch",
  "--preserveWatchOutput"
]);

const frontend = runProcess("frontend", "tsc", [
  "-p",
  "../frontend/tsconfig.json",
  "--noEmit",
  "--watch",
  "--preserveWatchOutput"
]);

updateTitle();

function shutdown(code = 0) {
  if (!backend.killed) backend.kill("SIGTERM");
  if (!frontend.killed) frontend.kill("SIGTERM");
  process.exit(code);
}

backend.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});

frontend.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
