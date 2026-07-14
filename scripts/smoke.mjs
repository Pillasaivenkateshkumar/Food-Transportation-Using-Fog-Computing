import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { loadConfig } from "../services/shared/config.mjs";
import { projectRoot } from "../services/shared/project-root.mjs";

const config = await loadConfig();
const children = [];

function startService(relativeScriptPath) {
  const child = spawn(process.execPath, [path.join(projectRoot, relativeScriptPath)], {
    cwd: projectRoot,
    stdio: "ignore"
  });

  children.push(child);
  return child;
}

async function waitForService(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the service is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}`);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed with ${response.status}`);
  }

  return response.json();
}

function buildTelemetry(index) {
  return {
    cargoType: "vaccine",
    context: {
      destination: "Temple Street Hospital",
      dispatchEveryMs: 1000,
      estimatedEtaMinutes: 25 - index,
      frequencyHz: 1,
      origin: "Tallaght Distribution Hub"
    },
    eventId: `smoke-${index}`,
    label: "Smoke Test Vaccine Run",
    routeId: "SMOKE-01",
    routeProgressPct: 20 + (index * 8),
    shipmentPriority: "critical",
    sensors: {
      doorOpen: index === 5,
      humidityPct: 48 + index,
      latitude: 53.29 + (index * 0.01),
      longitude: -6.36 + (index * 0.01),
      temperatureC: index === 5 ? 12.8 : 4.2 + (index * 0.15),
      vibrationG: index === 4 ? 3.8 : 1.1
    },
    timestamp: new Date(Date.now() + (index * 1000)).toISOString(),
    vehicleId: "SMOKE-101"
  };
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

try {
  startService(path.join("services", "backend", "server.mjs"));
  await waitForService(`${config.network.backendUrl}/health`);

  startService(path.join("services", "fog-node", "server.mjs"));
  await waitForService(`${config.network.fogUrl}/health`);

  for (let index = 0; index < 6; index += 1) {
    await postJson(`${config.network.fogUrl}/ingest`, buildTelemetry(index));
  }

  await new Promise((resolve) => setTimeout(resolve, config.fog.flushIntervalMs + 900));

  const pageResponse = await fetch(`${config.network.backendUrl}/`);
  assert.equal(pageResponse.ok, true, "dashboard HTML should respond");

  const dashboardResponse = await fetch(`${config.network.backendUrl}/api/dashboard`);
  assert.equal(dashboardResponse.ok, true, "dashboard endpoint should respond");
  const dashboard = await dashboardResponse.json();

  assert.ok(dashboard.overview.eventsProcessed >= 6, "backend should process the injected events");
  assert.ok(dashboard.overview.batchesProcessed >= 1, "at least one fog batch should be processed");
  assert.ok(dashboard.shipments.some((shipment) => shipment.vehicleId === "SMOKE-101"), "smoke route should appear in dashboard");

  await fetchJson(`${config.network.backendUrl}/api/shipments/SMOKE-101`, {
    body: JSON.stringify({
      destination: "Updated Demo Destination",
      label: "Edited Smoke Route",
      origin: "Updated Demo Origin",
      shipmentPriority: "high"
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "PATCH"
  });

  const updatedDashboard = await fetchJson(`${config.network.backendUrl}/api/dashboard`);
  const editedShipment = updatedDashboard.shipments.find((shipment) => shipment.vehicleId === "SMOKE-101");
  assert.equal(editedShipment.label, "Edited Smoke Route", "edited label should be reflected in the dashboard");

  await fetchJson(`${config.network.backendUrl}/api/shipments/SMOKE-101`, {
    method: "DELETE"
  });

  const hiddenDashboard = await fetchJson(`${config.network.backendUrl}/api/dashboard`);
  assert.equal(hiddenDashboard.shipments.some((shipment) => shipment.vehicleId === "SMOKE-101"), false, "deleted shipment should disappear from the Fleet Board");

  await postJson(`${config.network.backendUrl}/api/shipments/restore-all`, {});

  const restoredDashboard = await fetchJson(`${config.network.backendUrl}/api/dashboard`);
  assert.equal(restoredDashboard.shipments.some((shipment) => shipment.vehicleId === "SMOKE-101"), true, "restored shipment should reappear");

  console.log("[smoke] EdgeGuard smoke test passed");
} finally {
  stopChildren();
}
