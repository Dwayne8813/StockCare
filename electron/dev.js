// Launch the desktop app with dev tools enabled, without extra npm packages.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronBin = process.platform === "win32" ? "electron.cmd" : "electron";

const child = spawn(electronBin, [root], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" }
});

child.on("error", (err) => {
  console.error("Could not start Electron:", err.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
