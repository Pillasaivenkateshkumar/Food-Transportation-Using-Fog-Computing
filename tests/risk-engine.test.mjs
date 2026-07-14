import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTelemetry, smoothTelemetry } from "../services/shared/risk-engine.mjs";

const vaccineProfile = {
  coldChainPriority: "critical",
  humidityPct: {
    max: 65,
    min: 35
  },
  maxSafeHours: 18,
  targetBandLabel: "2C to 8C",
  temperatureC: {
    max: 8,
    min: 2
  },
  vibrationMaxG: 2.4
};

test("evaluateTelemetry keeps healthy vaccine readings stable", () => {
  const event = {
    context: {},
    label: "Healthy shipment",
    routeProgressPct: 32,
    sensors: {
      doorOpen: false,
      humidityPct: 50,
      latitude: 53.3,
      longitude: -6.2,
      temperatureC: 4.4,
      vibrationG: 1.1
    },
    timestamp: new Date().toISOString(),
    vehicleId: "TEST-1"
  };

  const result = evaluateTelemetry(event, vaccineProfile);
  assert.equal(result.edgeAnalytics.status, "stable");
  assert.equal(result.edgeAnalytics.alerts.length, 0);
});

test("evaluateTelemetry escalates critical cold chain breaches", () => {
  const event = {
    context: {},
    label: "Critical shipment",
    routeProgressPct: 81,
    sensors: {
      doorOpen: true,
      humidityPct: 84,
      latitude: 53.3,
      longitude: -6.2,
      temperatureC: 13.2,
      vibrationG: 4.4
    },
    timestamp: new Date().toISOString(),
    vehicleId: "TEST-2"
  };

  const result = evaluateTelemetry(event, vaccineProfile);
  assert.equal(result.edgeAnalytics.status, "critical");
  assert.ok(result.edgeAnalytics.alerts.length >= 3);
});

test("smoothTelemetry averages noisy sensor values", () => {
  const event = {
    context: {},
    sensors: {
      doorOpen: false,
      humidityPct: 52,
      latitude: 53.3,
      longitude: -6.2,
      temperatureC: 6,
      vibrationG: 1.4
    }
  };

  const window = [
    {
      sensors: {
        doorOpen: false,
        humidityPct: 48,
        temperatureC: 4,
        vibrationG: 1
      }
    },
    {
      sensors: {
        doorOpen: true,
        humidityPct: 50,
        temperatureC: 5,
        vibrationG: 1.2
      }
    },
    event
  ];

  const smoothed = smoothTelemetry(event, window);
  assert.equal(smoothed.sensors.doorOpen, true);
  assert.equal(smoothed.sensors.temperatureC, 5);
  assert.equal(smoothed.sensors.humidityPct, 50);
});
