import { average, clamp, midpoint, round, uid } from "./utils.mjs";

function rangeSeverity(value, range) {
  if (value >= range.min && value <= range.max) {
    return 0;
  }

  const distance = value < range.min ? range.min - value : value - range.max;
  const tolerance = Math.max(1, (range.max - range.min) * 0.65);
  return clamp(distance / tolerance, 0, 1);
}

function maxSeverity(value, limit) {
  if (value <= limit) {
    return 0;
  }

  const tolerance = Math.max(1, limit * 0.8);
  return clamp((value - limit) / tolerance, 0, 1);
}

function resolveStatus(riskScore) {
  if (riskScore >= 60) {
    return "critical";
  }

  if (riskScore >= 30) {
    return "warning";
  }

  return "stable";
}

function severityLabel(score) {
  if (score >= 0.75) {
    return "high";
  }

  if (score >= 0.35) {
    return "medium";
  }

  return "low";
}

function buildRecommendation(primaryCategory) {
  const actions = {
    door: "Inspect access control and verify seals before unloading.",
    humidity: "Check airflow and pallet spacing to stabilise moisture levels.",
    temperature: "Inspect the reefer unit and move sensitive stock away from warm zones.",
    vibration: "Reduce harsh handling and inspect suspension or road conditions."
  };

  return actions[primaryCategory] ?? "Review the shipment route and inspect the refrigeration equipment.";
}

function buildAlerts(event, profile, temperatureSeverity, humiditySeverity, vibrationSeverity) {
  const alerts = [];

  if (temperatureSeverity > 0.15) {
    alerts.push({
      alertId: uid("alert"),
      category: "temperature",
      severity: severityLabel(temperatureSeverity),
      message: `Temperature ${round(event.sensors.temperatureC, 1)}C is outside the ${profile.targetBandLabel} band.`,
      recommendedAction: buildRecommendation("temperature")
    });
  }

  if (humiditySeverity > 0.25) {
    alerts.push({
      alertId: uid("alert"),
      category: "humidity",
      severity: severityLabel(humiditySeverity),
      message: `Humidity ${round(event.sensors.humidityPct, 1)}% is drifting beyond target tolerance.`,
      recommendedAction: buildRecommendation("humidity")
    });
  }

  if (vibrationSeverity > 0.2) {
    alerts.push({
      alertId: uid("alert"),
      category: "vibration",
      severity: severityLabel(vibrationSeverity),
      message: `Vibration ${round(event.sensors.vibrationG, 2)}g suggests handling stress on the load.`,
      recommendedAction: buildRecommendation("vibration")
    });
  }

  if (event.sensors.doorOpen) {
    alerts.push({
      alertId: uid("alert"),
      category: "door",
      severity: "high",
      message: "Door sensor reports an unexpected open state during transit.",
      recommendedAction: buildRecommendation("door")
    });
  }

  return alerts;
}

export function smoothTelemetry(event, telemetryWindow) {
  const readings = telemetryWindow.length ? telemetryWindow : [event];
  const temperatures = readings.map((entry) => entry.sensors.temperatureC);
  const humidities = readings.map((entry) => entry.sensors.humidityPct);
  const vibrations = readings.map((entry) => entry.sensors.vibrationG);
  const doors = readings.map((entry) => entry.sensors.doorOpen);

  return {
    ...event,
    sensors: {
      ...event.sensors,
      temperatureC: round(average(temperatures), 2),
      humidityPct: round(average(humidities), 2),
      vibrationG: round(average(vibrations), 3),
      doorOpen: doors.some(Boolean)
    },
    context: {
      ...event.context,
      smoothingWindow: readings.length
    }
  };
}

export function evaluateTelemetry(event, profile) {
  const temperatureSeverity = rangeSeverity(event.sensors.temperatureC, profile.temperatureC);
  const humiditySeverity = rangeSeverity(event.sensors.humidityPct, profile.humidityPct);
  const vibrationSeverity = maxSeverity(event.sensors.vibrationG, profile.vibrationMaxG);
  const doorSeverity = event.sensors.doorOpen ? 0.85 : 0;

  const riskScore = clamp(
    round(
      (temperatureSeverity * 48) +
        (humiditySeverity * 18) +
        (vibrationSeverity * 16) +
        (doorSeverity * 18)
    ),
    0,
    100
  );

  const status = resolveStatus(riskScore);
  const alerts = buildAlerts(event, profile, temperatureSeverity, humiditySeverity, vibrationSeverity);
  const compliancePct = round(clamp(100 - riskScore * 0.78, 0, 100), 1);
  const refrigerationStressPct = round(
    clamp((temperatureSeverity * 65) + (humiditySeverity * 15) + (vibrationSeverity * 10) + (doorSeverity * 10), 0, 100),
    1
  );
  const predictedRemainingSafeHours = round(
    Math.max(0.5, profile.maxSafeHours - (riskScore / 7) - (event.sensors.doorOpen ? 1.4 : 0)),
    1
  );

  return {
    ...event,
    edgeAnalytics: {
      alerts,
      compliancePct,
      predictedRemainingSafeHours,
      primaryRecommendation: alerts[0]?.recommendedAction ?? "Shipment remains within acceptable transport limits.",
      refrigerationStressPct,
      riskScore,
      status
    }
  };
}

export function buildTimelineNarrative(record) {
  const { vehicleId, label, routeProgressPct, sensors, edgeAnalytics } = record;
  const leadAlert = edgeAnalytics.alerts[0];

  if (leadAlert) {
    return `${vehicleId} (${label}) raised a ${leadAlert.category} alert at ${routeProgressPct}% route completion.`;
  }

  return `${vehicleId} remains ${edgeAnalytics.status} with ${round(sensors.temperatureC, 1)}C and ${round(sensors.humidityPct, 0)}% humidity.`;
}

export function summariseTrend(values) {
  if (!values.length) {
    return [];
  }

  return values.slice(-10).map((value) => round(value, 1));
}

export function targetTemperature(profile) {
  return round(midpoint(profile.temperatureC), 1);
}
