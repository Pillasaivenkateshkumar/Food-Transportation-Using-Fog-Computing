import { buildTimelineNarrative, summariseTrend } from "../shared/risk-engine.mjs";
import { average, round, uid } from "../shared/utils.mjs";

function statusRank(status) {
  return {
    stable: 0,
    warning: 1,
    critical: 2
  }[status] ?? 0;
}

function normaliseTextOverride(value, maximumLength = 80) {
  if (typeof value !== "string") {
    return undefined;
  }

  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return null;
  }

  return collapsed.slice(0, maximumLength);
}

function applyOverrideField(target, key, value, maximumLength = 80) {
  if (value === undefined) {
    return;
  }

  const normalised = normaliseTextOverride(value, maximumLength);
  if (normalised === null) {
    delete target[key];
    return;
  }

  if (normalised !== undefined) {
    target[key] = normalised;
  }
}

export class TelemetryRepository {
  constructor(config) {
    this.config = config;
    this.shipments = new Map();
    this.alerts = [];
    this.hiddenShipments = new Set();
    this.shipmentOverrides = new Map();
    this.timeline = [];
    this.lastFogMetrics = {};
    this.stats = {
      batchesProcessed: 0,
      edgeAlertsGenerated: 0,
      eventsProcessed: 0,
      lastBatchAt: null,
      startedAt: Date.now(),
      totalEdgeReductionPct: 0,
      totalFogLatencyMs: 0
    };
  }

  ingestBatch(batch) {
    this.stats.batchesProcessed += 1;
    this.stats.eventsProcessed += batch.records.length;
    this.stats.edgeAlertsGenerated += batch.alertsInBatch ?? 0;
    this.stats.lastBatchAt = batch.createdAt;
    this.stats.totalEdgeReductionPct += batch.edgeReductionPct ?? 0;
    this.stats.totalFogLatencyMs += batch.fogMetrics?.averageProcessingLatencyMs ?? 0;
    this.lastFogMetrics = batch.fogMetrics ?? {};

    for (const record of batch.records) {
      this.ingestRecord(record, batch);
    }
  }

  ingestRecord(record, batch) {
    const existing = this.shipments.get(record.vehicleId);
    const shipment = existing ?? {
      alerts: [],
      batchEdgeReductionPct: 0,
      cargoType: record.cargoType,
      current: null,
      history: [],
      label: record.label,
      routeId: record.routeId,
      vehicleId: record.vehicleId
    };

    const previousStatus = shipment.current?.edgeAnalytics.status;
    shipment.current = record;
    shipment.batchEdgeReductionPct = batch.edgeReductionPct ?? shipment.batchEdgeReductionPct;
    shipment.history.push(record);

    while (shipment.history.length > this.config.simulation.retainedEventsPerShipment) {
      shipment.history.shift();
    }

    if (record.edgeAnalytics.alerts.length) {
      for (const alert of record.edgeAnalytics.alerts) {
        const alertEntry = {
          ...alert,
          cargoType: record.cargoType,
          label: record.label,
          routeProgressPct: record.routeProgressPct,
          timestamp: record.timestamp,
          vehicleId: record.vehicleId
        };
        shipment.alerts.unshift(alertEntry);
        this.alerts.unshift(alertEntry);

        this.timeline.unshift({
          id: uid("timeline"),
          narrative: `${record.vehicleId} ${alert.message}`,
          severity: alert.severity,
          status: record.edgeAnalytics.status,
          timestamp: record.timestamp,
          vehicleId: record.vehicleId
        });
      }
    } else if (!previousStatus || previousStatus !== record.edgeAnalytics.status) {
      this.timeline.unshift({
        id: uid("timeline"),
        narrative: buildTimelineNarrative(record),
        severity: record.edgeAnalytics.status === "stable" ? "low" : "medium",
        status: record.edgeAnalytics.status,
        timestamp: record.timestamp,
        vehicleId: record.vehicleId
      });
    }

    shipment.alerts = shipment.alerts.slice(0, 16);
    this.alerts = this.alerts.slice(0, 80);
    this.timeline = this.timeline.slice(0, 80);
    this.shipments.set(record.vehicleId, shipment);
  }

  currentShipments() {
    return [...this.shipments.values()].filter((shipment) => shipment.current);
  }

  visibleShipments() {
    return this.currentShipments().filter((shipment) => !this.hiddenShipments.has(shipment.vehicleId));
  }

  presentationShipment(shipment) {
    const current = shipment.current;
    const overrides = this.shipmentOverrides.get(shipment.vehicleId) ?? {};

    return {
      alertCount: shipment.alerts.length,
      cargoType: shipment.cargoType,
      compliancePct: current.edgeAnalytics.compliancePct,
      destination: overrides.destination ?? current.context.destination,
      doorOpen: current.sensors.doorOpen,
      estimatedEtaMinutes: current.context.estimatedEtaMinutes,
      humidityPct: current.sensors.humidityPct,
      label: overrides.label ?? shipment.label,
      latitude: current.sensors.latitude,
      longitude: current.sensors.longitude,
      origin: overrides.origin ?? current.context.origin,
      predictedRemainingSafeHours: current.edgeAnalytics.predictedRemainingSafeHours,
      primaryRecommendation: current.edgeAnalytics.primaryRecommendation,
      riskScore: current.edgeAnalytics.riskScore,
      routeId: shipment.routeId,
      routeProgressPct: current.routeProgressPct,
      shipmentPriority: overrides.shipmentPriority ?? current.shipmentPriority,
      status: current.edgeAnalytics.status,
      temperatureC: current.sensors.temperatureC,
      temperatureTrend: summariseTrend(shipment.history.map((entry) => entry.sensors.temperatureC)),
      timestamp: current.timestamp,
      vehicleId: shipment.vehicleId,
      vibrationG: current.sensors.vibrationG
    };
  }

  getShipments() {
    return this.visibleShipments()
      .map((shipment) => this.presentationShipment(shipment))
      .sort((left, right) => {
        const severityDelta = statusRank(right.status) - statusRank(left.status);
        if (severityDelta !== 0) {
          return severityDelta;
        }

        return right.riskScore - left.riskScore;
      });
  }

  getAlerts() {
    return this.alerts
      .filter((alert) => !this.hiddenShipments.has(alert.vehicleId))
      .map((alert) => {
        const overrides = this.shipmentOverrides.get(alert.vehicleId) ?? {};
        return {
          ...alert,
          label: overrides.label ?? alert.label
        };
      })
      .slice(0, 10);
  }

  getSensorHealth() {
    const shipments = this.currentShipments();

    if (!shipments.length) {
      return [];
    }

    const current = shipments.map((shipment) => shipment.current);
    const temperatureAlerts = current.filter((entry) => entry.edgeAnalytics.alerts.some((alert) => alert.category === "temperature")).length;
    const humidityAlerts = current.filter((entry) => entry.edgeAnalytics.alerts.some((alert) => alert.category === "humidity")).length;
    const vibrationAlerts = current.filter((entry) => entry.edgeAnalytics.alerts.some((alert) => alert.category === "vibration")).length;
    const openDoors = current.filter((entry) => entry.sensors.doorOpen).length;

    return [
      {
        detail: "Maintains vaccine and food target bands in transit.",
        reading: `${round(average(current.map((entry) => entry.sensors.temperatureC)), 1)}C avg`,
        sensorType: "Temperature",
        status: temperatureAlerts ? "warning" : "stable"
      },
      {
        detail: "Tracks moisture tolerance and packaging exposure.",
        reading: `${round(average(current.map((entry) => entry.sensors.humidityPct)), 1)}% avg`,
        sensorType: "Humidity",
        status: humidityAlerts ? "warning" : "stable"
      },
      {
        detail: "GPS and route progress stay visible for every active shipment.",
        reading: `${current.length}/${this.config.fleet.length} routes live`,
        sensorType: "GPS",
        status: "stable"
      },
      {
        detail: "Flags harsh handling, suspension issues, and road shocks.",
        reading: `${round(average(current.map((entry) => entry.sensors.vibrationG)), 2)}g avg`,
        sensorType: "Vibration",
        status: vibrationAlerts ? "warning" : "stable"
      },
      {
        detail: "Unexpected door openings are escalated at the fog node.",
        reading: `${openDoors} open events`,
        sensorType: "Door State",
        status: openDoors ? "critical" : "stable"
      }
    ];
  }

  getTimeline() {
    return this.timeline
      .filter((item) => !this.hiddenShipments.has(item.vehicleId))
      .slice(0, 10);
  }

  updateShipment(vehicleId, updates) {
    const shipment = this.shipments.get(vehicleId);
    if (!shipment?.current) {
      throw new Error(`Shipment ${vehicleId} was not found`);
    }

    const nextOverrides = {
      ...(this.shipmentOverrides.get(vehicleId) ?? {})
    };

    applyOverrideField(nextOverrides, "label", updates.label, 90);
    applyOverrideField(nextOverrides, "origin", updates.origin, 90);
    applyOverrideField(nextOverrides, "destination", updates.destination, 90);

    if (updates.shipmentPriority !== undefined) {
      const normalisedPriority = normaliseTextOverride(updates.shipmentPriority, 24);
      if (normalisedPriority === null) {
        delete nextOverrides.shipmentPriority;
      } else if (normalisedPriority !== undefined) {
        nextOverrides.shipmentPriority = normalisedPriority.toLowerCase();
      }
    }

    if (Object.keys(nextOverrides).length) {
      this.shipmentOverrides.set(vehicleId, nextOverrides);
    } else {
      this.shipmentOverrides.delete(vehicleId);
    }

    this.hiddenShipments.delete(vehicleId);
    return this.presentationShipment(shipment);
  }

  deleteShipment(vehicleId) {
    const shipment = this.shipments.get(vehicleId);
    if (!shipment?.current) {
      throw new Error(`Shipment ${vehicleId} was not found`);
    }

    this.hiddenShipments.add(vehicleId);
    return {
      hidden: true,
      vehicleId
    };
  }

  restoreAllShipments() {
    this.hiddenShipments.clear();
    return {
      hiddenCount: this.hiddenShipments.size,
      restored: true
    };
  }

  getFleetManagement() {
    return {
      hiddenCount: this.hiddenShipments.size,
      overriddenCount: this.shipmentOverrides.size
    };
  }

  getFogInsights(queueDepth) {
    const averageBatchSize = this.stats.batchesProcessed
      ? round(this.stats.eventsProcessed / this.stats.batchesProcessed, 1)
      : 0;
    const averageReductionPct = this.stats.batchesProcessed
      ? round(this.stats.totalEdgeReductionPct / this.stats.batchesProcessed, 1)
      : 0;
    const averageFogLatencyMs = this.stats.batchesProcessed
      ? round(this.stats.totalFogLatencyMs / this.stats.batchesProcessed, 2)
      : 0;

    return {
      averageBatchSize,
      averageFogLatencyMs,
      backendQueueDepth: queueDepth,
      edgeAlertsGenerated: this.stats.edgeAlertsGenerated,
      edgeNodeId: this.config.fog.edgeNodeId,
      lastBatchAt: this.stats.lastBatchAt,
      previewNarratives: this.lastFogMetrics.generatedTimelinePreview ?? [],
      transmissionReductionPct: averageReductionPct
    };
  }

  buildOverview(queueDepth) {
    const shipments = this.getShipments();
    const elapsedMinutes = Math.max(1, (Date.now() - this.stats.startedAt) / 60000);
    const criticalShipments = shipments.filter((shipment) => shipment.status === "critical").length;
    const warningShipments = shipments.filter((shipment) => shipment.status === "warning").length;

    return {
      activeAlerts: this.getAlerts().length,
      averageCompliancePct: shipments.length ? round(average(shipments.map((shipment) => shipment.compliancePct)), 1) : 0,
      averageRiskScore: shipments.length ? round(average(shipments.map((shipment) => shipment.riskScore)), 1) : 0,
      batchesProcessed: this.stats.batchesProcessed,
      criticalShipments,
      edgeReductionPct: this.stats.batchesProcessed ? round(this.stats.totalEdgeReductionPct / this.stats.batchesProcessed, 1) : 0,
      eventsProcessed: this.stats.eventsProcessed,
      ingestionRatePerMinute: round(this.stats.eventsProcessed / elapsedMinutes, 1),
      queueDepth,
      stableShipments: shipments.length - criticalShipments - warningShipments,
      totalShipments: shipments.length,
      warningShipments
    };
  }

  getDashboardPayload(queueDepth = 0) {
    return {
      alerts: this.getAlerts(),
      fleetManagement: this.getFleetManagement(),
      fogInsights: this.getFogInsights(queueDepth),
      generatedAt: new Date().toISOString(),
      githubRepo: this.config.project.githubRepo,
      overview: this.buildOverview(queueDepth),
      project: this.config.project,
      sensorHealth: this.getSensorHealth(),
      shipments: this.getShipments(),
      timeline: this.getTimeline()
    };
  }
}
