import assert from "node:assert/strict";
import test from "node:test";
import { TelemetryRepository } from "../services/backend/repository.mjs";

function createRepository() {
  return new TelemetryRepository({
    fleet: [
      { vehicleId: "SHIP-1" }
    ],
    fog: {
      edgeNodeId: "fog-test-1"
    },
    project: {
      githubRepo: "https://github.com/example/edgeguard",
      name: "EdgeGuard",
      tagline: "Test project"
    },
    simulation: {
      retainedEventsPerShipment: 20
    }
  });
}

function createBatch() {
  return {
    alertsInBatch: 1,
    batchId: "batch-1",
    createdAt: new Date().toISOString(),
    edgeReductionPct: 75,
    fogMetrics: {
      averageProcessingLatencyMs: 4.2,
      generatedTimelinePreview: ["Preview item"],
      rawEventCount: 1
    },
    records: [
      {
        cargoType: "vaccine",
        context: {
          destination: "Temple Street Hospital",
          estimatedEtaMinutes: 17,
          origin: "Tallaght Distribution Hub"
        },
        edgeAnalytics: {
          alerts: [
            {
              alertId: "alert-1",
              category: "temperature",
              message: "Temperature exceeded the safe band.",
              recommendedAction: "Inspect cooling unit.",
              severity: "high"
            }
          ],
          compliancePct: 88,
          predictedRemainingSafeHours: 12,
          primaryRecommendation: "Inspect cooling unit.",
          riskScore: 63,
          status: "critical"
        },
        label: "Children's Hospital Vaccine Run",
        routeId: "ROUTE-1",
        routeProgressPct: 52,
        sensors: {
          doorOpen: false,
          humidityPct: 51.2,
          latitude: 53.3,
          longitude: -6.2,
          temperatureC: 9.4,
          vibrationG: 1.7
        },
        shipmentPriority: "critical",
        timestamp: new Date().toISOString(),
        vehicleId: "SHIP-1"
      }
    ]
  };
}

test("TelemetryRepository applies shipment overrides to dashboard cards", () => {
  const repository = createRepository();
  repository.ingestBatch(createBatch());

  repository.updateShipment("SHIP-1", {
    destination: "Edited Destination",
    label: "Edited Shipment",
    origin: "Edited Origin",
    shipmentPriority: "high"
  });

  const shipment = repository.getShipments()[0];
  assert.equal(shipment.label, "Edited Shipment");
  assert.equal(shipment.origin, "Edited Origin");
  assert.equal(shipment.destination, "Edited Destination");
  assert.equal(shipment.shipmentPriority, "high");
});

test("TelemetryRepository hides deleted shipments from the visible dashboard", () => {
  const repository = createRepository();
  repository.ingestBatch(createBatch());

  repository.deleteShipment("SHIP-1");

  assert.equal(repository.getShipments().length, 0);
  assert.equal(repository.getAlerts().length, 0);
  assert.equal(repository.getTimeline().length, 0);

  repository.restoreAllShipments();
  assert.equal(repository.getShipments().length, 1);
});
