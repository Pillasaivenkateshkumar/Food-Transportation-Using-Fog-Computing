import http from "node:http";
import path from "node:path";
import { loadConfig } from "../shared/config.mjs";
import { readJsonBody, sendJson, serveStaticFile } from "../shared/http.mjs";
import { projectRoot } from "../shared/project-root.mjs";
import { AsyncQueue } from "./queue.mjs";
import { TelemetryRepository } from "./repository.mjs";
import { uploadTelemetry } from "../shared/s3.js";
import { saveTelemetry } from "../shared/dynamodb.js";
import { publishMetric } from "../shared/cloudwatch.js";
import { sendTelemetryMessage } from "../shared/sqs.js";

const config = await loadConfig();
const queue = new AsyncQueue();
const repository = new TelemetryRepository(config);
const sseClients = new Set();
const staticDirectory = path.join(projectRoot, "services", "backend", "static");

function broadcastDashboard() {
  const payload = JSON.stringify(repository.getDashboardPayload(queue.depth));

  for (const response of sseClients) {
    response.write(`data: ${payload}\n\n`);
  }
}

async function startWorker() {
  while (true) {
    const batch = await queue.dequeue();
    repository.ingestBatch(batch);
    broadcastDashboard();
  }
}

function resolveStaticPath(urlPathname) {
  const relativePath = urlPathname === "/" ? "index.html" : urlPathname.replace(/^\/+/, "");
  const resolvedPath = path.normalize(path.join(staticDirectory, relativePath));

  if (!resolvedPath.startsWith(staticDirectory)) {
    return null;
  }

  return resolvedPath;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Origin": "*"
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const shipmentRouteMatch = url.pathname.match(/^\/api\/shipments\/([^/]+)$/);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      queueDepth: queue.depth,
      status: "ok",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    sendJson(response, 200, repository.getDashboardPayload(queue.depth));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/overview") {
    sendJson(response, 200, repository.buildOverview(queue.depth));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/shipments") {
    sendJson(response, 200, repository.getShipments());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/shipments/restore-all") {
    const result = repository.restoreAllShipments();
    broadcastDashboard();
    sendJson(response, 200, result);
    return;
  }

  if (shipmentRouteMatch && request.method === "PATCH") {
    try {
      const vehicleId = decodeURIComponent(shipmentRouteMatch[1]);
      const updates = await readJsonBody(request);
      const shipment = repository.updateShipment(vehicleId, updates ?? {});
      broadcastDashboard();
      sendJson(response, 200, {
        shipment,
        updated: true
      });
    } catch (error) {
      sendJson(response, 404, { error: error.message });
    }
    return;
  }

  if (shipmentRouteMatch && request.method === "DELETE") {
    try {
      const vehicleId = decodeURIComponent(shipmentRouteMatch[1]);
      const result = repository.deleteShipment(vehicleId);
      broadcastDashboard();
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 404, { error: error.message });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/alerts") {
    sendJson(response, 200, repository.getAlerts());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/timeline") {
    sendJson(response, 200, repository.getTimeline());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/fog") {
    sendJson(response, 200, repository.getFogInsights(queue.depth));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/events") {
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8"
    });
    response.write(`data: ${JSON.stringify(repository.getDashboardPayload(queue.depth))}\n\n`);
    sseClients.add(response);

    request.on("close", () => {
      sseClients.delete(response);
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ingest") {
  try {

    const batch = await readJsonBody(request);

    // Validate payload
    if (!Array.isArray(batch.records) || !batch.records.length) {
      sendJson(response, 400, {
        error: "Ingestion payload must contain records[]"
      });
      return;
    }

    // Upload complete batch to Amazon S3
    const key = `telemetry/${Date.now()}.json`;
    await uploadTelemetry(key, batch);
    await sendTelemetryMessage(batch);
    await publishMetric("SQSMessages", 1);
    await publishMetric("TelemetryUploads", 1);

    await publishMetric(
      "TelemetryRecords",
      batch.records.length
    );

    // Save every telemetry record into DynamoDB
    for (const record of batch.records) {

      await saveTelemetry({

        vehicleId: record.vehicleId,

        timestamp: record.timestamp,

        cargoType: record.cargoType,

        shipmentPriority: record.shipmentPriority,

        temperature: record.sensors.temperatureC,

        humidity: record.sensors.humidityPct,

        vibration: record.sensors.vibrationG,

        latitude: record.sensors.latitude,

        longitude: record.sensors.longitude,

        doorOpen: record.sensors.doorOpen,

        riskScore: record.edgeAnalytics?.riskScore ?? 0,

        status: record.edgeAnalytics?.status ?? "Normal"

      });
      
      await publishMetric("DynamoDBWrites", 1); 

    }

    // Continue existing application flow
    queue.enqueue(batch);

    sendJson(response, 202, {
      accepted: true,
      queueDepth: queue.depth
    });

  } catch (error) {

    console.error("[Backend]", error);

    await publishMetric("Errors", 1);

    sendJson(response, 500, {
      error: error.message
    });

  }

  return;
}

  const staticPath = resolveStaticPath(url.pathname);
  if (!staticPath) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  await serveStaticFile(response, staticPath);
});

startWorker().catch((error) => {
  console.error(`[backend] queue worker crashed: ${error.message}`);
  process.exit(1);
});

server.listen(config.network.backendPort, config.network.backendHost, () => {
  console.log(`[backend] listening on http://${config.network.backendHost}:${config.network.backendPort}`);
});

function shutdown() {
  for (const client of sseClients) {
    client.end();
  }

  server.close(() => {
    console.log("[backend] server stopped");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
