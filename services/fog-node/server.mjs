import http from "node:http";
import path from "node:path";
import { loadConfig } from "../shared/config.mjs";
import { postJson, readJsonBody, sendJson } from "../shared/http.mjs";
import { projectRoot } from "../shared/project-root.mjs";
import { buildTimelineNarrative, evaluateTelemetry, smoothTelemetry } from "../shared/risk-engine.mjs";
import { round, uid } from "../shared/utils.mjs";
import { FogBufferStore } from "./buffer.mjs";

const config = await loadConfig();
const bufferStore = new FogBufferStore(path.join(projectRoot, "data", "fog-buffer.json"));

const state = {
  avgFogLatencyMs: 0,
  backendFailures: 0,
  batchesBuffered: 0,
  batchesSent: 0,
  edgeAlertsGenerated: 0,
  pendingRecords: [],
  rawEventsReceived: 0,
  rollingWindows: new Map()
};

function recordLatency(milliseconds) {
  if (!state.avgFogLatencyMs) {
    state.avgFogLatencyMs = milliseconds;
    return;
  }

  state.avgFogLatencyMs = round((state.avgFogLatencyMs * 0.7) + (milliseconds * 0.3), 2);
}

function getWindowForVehicle(vehicleId) {
  if (!state.rollingWindows.has(vehicleId)) {
    state.rollingWindows.set(vehicleId, []);
  }

  return state.rollingWindows.get(vehicleId);
}

function trackWindow(event) {
  const window = getWindowForVehicle(event.vehicleId);
  window.push(event);

  while (window.length > config.fog.windowSize) {
    window.shift();
  }

  return window;
}

async function flushBufferedBatches() {
  const bufferedBatches = await bufferStore.readAll();

  if (!bufferedBatches.length) {
    return;
  }

  const unsent = [];

  for (const batch of bufferedBatches) {
    try {
      await postJson(`${config.network.backendUrl}/api/ingest`, batch);
      state.batchesSent += 1;
    } catch {
      unsent.push(batch);
    }
  }

  state.batchesBuffered = unsent.length;
  await bufferStore.writeAll(unsent);
}

async function flushPendingBatch(reason) {
  await flushBufferedBatches();

  if (!state.pendingRecords.length) {
    return;
  }

  const records = state.pendingRecords.splice(0, state.pendingRecords.length);
  const alertsInBatch = records.reduce((sum, record) => sum + record.edgeAnalytics.alerts.length, 0);
  const batch = {
    alertsInBatch,
    batchId: uid("batch"),
    createdAt: new Date().toISOString(),
    edgeNodeId: config.fog.edgeNodeId,
    edgeReductionPct: round(Math.max(0, 100 - (100 / Math.max(records.length, 1))), 1),
    fogMetrics: {
      averageProcessingLatencyMs: state.avgFogLatencyMs,
      generatedTimelinePreview: records.slice(-2).map(buildTimelineNarrative),
      rawEventCount: records.length
    },
    reason,
    records
  };

  try {
    await postJson(`${config.network.backendUrl}/api/ingest`, batch);
    state.batchesSent += 1;
  } catch (error) {
    state.backendFailures += 1;
    state.batchesBuffered = await bufferStore.append(batch);
    console.error(`[fog] backend unavailable, buffered batch ${batch.batchId}: ${error.message}`);
  }
}

async function processTelemetry(rawEvent) {
  const startedAt = performance.now();
  const window = trackWindow(rawEvent);
  const smoothed = smoothTelemetry(rawEvent, window);
  const profile = config.profiles[rawEvent.cargoType];
  const enriched = evaluateTelemetry(smoothed, profile);
  recordLatency(performance.now() - startedAt);

  state.rawEventsReceived += 1;
  state.edgeAlertsGenerated += enriched.edgeAnalytics.alerts.length;
  state.pendingRecords.push(enriched);

  if (
    state.pendingRecords.length >= config.fog.batchSize ||
    enriched.edgeAnalytics.status === "critical"
  ) {
    await flushPendingBatch(enriched.edgeAnalytics.status === "critical" ? "critical-alert" : "batch-threshold");
  }

  return enriched;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Origin": "*"
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      edgeNodeId: config.fog.edgeNodeId,
      status: "ok",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/stats") {
    sendJson(response, 200, {
      avgFogLatencyMs: state.avgFogLatencyMs,
      backendFailures: state.backendFailures,
      batchesBuffered: state.batchesBuffered,
      batchesSent: state.batchesSent,
      edgeAlertsGenerated: state.edgeAlertsGenerated,
      pendingRecords: state.pendingRecords.length,
      rawEventsReceived: state.rawEventsReceived
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/ingest") {
    try {
      const payload = await readJsonBody(request);
      if (!payload.vehicleId || !payload.sensors) {
        sendJson(response, 400, { error: "Invalid telemetry payload" });
        return;
      }

      const enriched = await processTelemetry(payload);
      sendJson(response, 202, {
        accepted: true,
        edgeStatus: enriched.edgeAnalytics.status,
        pendingRecords: state.pendingRecords.length
      });
    } catch (error) {
      sendJson(response, 500, {
        error: error.message
      });
    }
    return;
  }

  sendJson(response, 404, {
    error: "Route not found"
  });
});

const intervalId = setInterval(() => {
  flushPendingBatch("scheduled-flush").catch((error) => {
    console.error(`[fog] scheduled flush failed: ${error.message}`);
  });
}, config.fog.flushIntervalMs);

server.listen(config.network.fogPort, config.network.fogHost, () => {
  console.log(`[fog] listening on http://${config.network.fogHost}:${config.network.fogPort}`);
});

async function shutdown() {
  clearInterval(intervalId);
  await flushPendingBatch("shutdown");
  server.close(() => {
    console.log("[fog] server stopped");
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown().catch((error) => {
    console.error(`[fog] shutdown error: ${error.message}`);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown().catch((error) => {
    console.error(`[fog] shutdown error: ${error.message}`);
    process.exit(1);
  });
});
