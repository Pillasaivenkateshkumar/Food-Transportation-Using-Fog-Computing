import { spawn } from "node:child_process";
import path from "node:path";
import { projectRoot } from "../services/shared/project-root.mjs";

const services = [
  {
    name: "backend",
    script: path.join(projectRoot, "services", "backend", "server.mjs")
  },
  {
    name: "fog",
    script: path.join(projectRoot, "services", "fog-node", "server.mjs")
  },
  {
    name: "sensors",
    script: path.join(projectRoot, "services", "sensor-simulator", "index.mjs")
  }
];

const children = [];
let shuttingDown = false;

function startService(service) {
  const child = spawn(process.execPath, [service.script], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev] ${service.name} exited unexpectedly with ${reason}`);
    shutdown(typeof code === "number" ? code : 1);
  });

  children.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 700);
}

console.log("[dev] starting EdgeGuard backend, fog node, and sensor simulator");
for (const service of services) {
  startService(service);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
