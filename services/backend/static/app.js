const elements = {
  alertsList: document.getElementById("alerts-list"),
  editCancel: document.getElementById("edit-cancel"),
  editCancelTop: document.getElementById("edit-cancel-top"),
  editDestination: document.getElementById("edit-destination"),
  editForm: document.getElementById("edit-form"),
  editLabel: document.getElementById("edit-label"),
  editModal: document.getElementById("edit-modal"),
  editOrigin: document.getElementById("edit-origin"),
  editPriority: document.getElementById("edit-priority"),
  editVehicleId: document.getElementById("edit-vehicle-id"),
  fogGrid: document.getElementById("fog-grid"),
  fogPreview: document.getElementById("fog-preview"),
  lastUpdated: document.getElementById("last-updated"),
  overviewGrid: document.getElementById("overview-grid"),
  repoLink: document.getElementById("repo-link"),
  restoreShipments: document.getElementById("restore-shipments"),
  sensorGrid: document.getElementById("sensor-grid"),
  shipmentsGrid: document.getElementById("shipments-grid"),
  subtitle: document.getElementById("subtitle"),
  timelineList: document.getElementById("timeline-list")
};

let eventSource;
let latestDashboard;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusClass(status) {
  return `status-${status}`;
}

function activeShipments() {
  return latestDashboard?.shipments ?? [];
}

function number(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-IE", {
    maximumFractionDigits
  }).format(value);
}

function timeAgo(isoDate) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.floor(minutes / 60)}h ago`;
}

function sparkline(values, stroke) {
  if (!values?.length) {
    return "";
  }

  const width = 260;
  const height = 56;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (((value - min) / range) * (height - 10)) - 5;
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="${stroke}" stroke-width="3" points="${points}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
}

function renderOverview(overview) {
  const cards = [
    {
      label: "Tracked Shipments",
      note: `${overview.stableShipments} stable, ${overview.warningShipments} warning, ${overview.criticalShipments} critical`,
      value: overview.totalShipments
    },
    {
      label: "Active Alerts",
      note: `Queue depth ${overview.queueDepth} with real-time edge escalation`,
      value: overview.activeAlerts
    },
    {
      label: "Edge Reduction",
      note: "Average payload reduction through batching at the fog node",
      value: `${number(overview.edgeReductionPct)}%`
    },
    {
      label: "Ingestion Throughput",
      note: `${number(overview.eventsProcessed, 0)} records processed across ${overview.batchesProcessed} fog batches`,
      value: `${number(overview.ingestionRatePerMinute)} / min`
    }
  ];

  elements.overviewGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(card.label)}</div>
          <div class="metric-value">${escapeHtml(card.value)}</div>
          <div class="metric-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderShipments(shipments) {
  if (!shipments.length) {
    elements.shipmentsGrid.innerHTML = '<div class="empty-state">Live shipment cards will appear here once telemetry reaches the backend.</div>';
    return;
  }

  elements.shipmentsGrid.innerHTML = shipments
    .map((shipment) => {
      const trendColor =
        shipment.status === "critical" ? "#ff7c72" : shipment.status === "warning" ? "#ffbf5f" : "#56e4d6";

      return `
        <article class="shipment-card" data-vehicle-id="${escapeHtml(shipment.vehicleId)}">
          <div class="shipment-header">
            <div class="shipment-header-main">
              <div>
                <p class="shipment-title">${escapeHtml(shipment.vehicleId)}</p>
                <div class="shipment-subtitle">${escapeHtml(shipment.label)}</div>
              </div>
              <span class="status-chip ${statusClass(shipment.status)}">${escapeHtml(shipment.status)}</span>
            </div>
          </div>

          <div class="shipment-metrics">
            <div class="mini-metric">
              <div class="mini-label">Temperature</div>
              <div class="mini-value">${number(shipment.temperatureC)}C</div>
            </div>
            <div class="mini-metric">
              <div class="mini-label">Risk Score</div>
              <div class="mini-value">${number(shipment.riskScore, 0)}</div>
            </div>
            <div class="mini-metric">
              <div class="mini-label">Humidity</div>
              <div class="mini-value">${number(shipment.humidityPct)}%</div>
            </div>
            <div class="mini-metric">
              <div class="mini-label">ETA</div>
              <div class="mini-value">${number(shipment.estimatedEtaMinutes, 0)} min</div>
            </div>
          </div>

          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-value" style="width: ${shipment.routeProgressPct}%"></div>
            </div>
            <div class="shipment-route">
              <span>${escapeHtml(shipment.origin)}</span>
              <span>${number(shipment.routeProgressPct)}%</span>
              <span>${escapeHtml(shipment.destination)}</span>
            </div>
          </div>

          <div class="shipment-meta">
            <div class="muted">Compliance ${number(shipment.compliancePct)}%</div>
            <div class="muted">Alerts ${shipment.alertCount}</div>
          </div>

          <div class="sparkline">${sparkline(shipment.temperatureTrend, trendColor)}</div>
          <p class="shipment-subtitle">${escapeHtml(shipment.primaryRecommendation)}</p>
          <div class="shipment-actions">
            <button class="card-button" type="button" data-action="edit" data-vehicle-id="${escapeHtml(shipment.vehicleId)}">Edit</button>
            <button class="card-button card-button-danger" type="button" data-action="delete" data-vehicle-id="${escapeHtml(shipment.vehicleId)}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    elements.alertsList.innerHTML = '<div class="empty-state">No critical incidents yet. The alert feed will update as soon as a route drifts outside tolerance.</div>';
    return;
  }

  elements.alertsList.innerHTML = alerts
    .map((alert) => {
      const alertStatus = alert.severity === "high" ? "critical" : alert.severity === "medium" ? "warning" : "stable";
      return `
        <article class="alert-card ${escapeHtml(alert.severity)}">
          <div class="alert-header">
            <strong>${escapeHtml(alert.vehicleId)}</strong>
            <span class="status-chip ${statusClass(alertStatus)}">${escapeHtml(alert.category)}</span>
          </div>
          <p class="alert-message">${escapeHtml(alert.message)}</p>
          <div class="alert-meta">${escapeHtml(alert.label)} - ${timeAgo(alert.timestamp)}</div>
        </article>
      `;
    })
    .join("");
}

function renderFog(fogInsights) {
  const cards = [
    {
      detail: "Average number of enriched records sent per backend batch.",
      label: "Batch Size",
      value: fogInsights.averageBatchSize
    },
    {
      detail: "Processing time from reception to enrichment at the fog node.",
      label: "Fog Latency",
      value: `${number(fogInsights.averageFogLatencyMs, 2)} ms`
    },
    {
      detail: "Average message reduction achieved before cloud transmission.",
      label: "Bandwidth Saved",
      value: `${number(fogInsights.transmissionReductionPct)}%`
    },
    {
      detail: "Current asynchronous backlog inside the backend ingestion queue.",
      label: "Queue Depth",
      value: fogInsights.backendQueueDepth
    }
  ];

  elements.fogGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="fog-card fog-stat">
          <div class="metric-label">${escapeHtml(card.label)}</div>
          <div class="fog-value">${escapeHtml(card.value)}</div>
          <div class="fog-detail">${escapeHtml(card.detail)}</div>
        </article>
      `
    )
    .join("");

  elements.fogPreview.innerHTML = (fogInsights.previewNarratives?.length
    ? fogInsights.previewNarratives
    : ["Fog-generated route narratives will appear here as batches are forwarded."])
    .map((item) => `<div class="preview-item">${escapeHtml(item)}</div>`)
    .join("");
}

function renderSensors(sensorHealth) {
  if (!sensorHealth.length) {
    elements.sensorGrid.innerHTML = '<div class="empty-state">Sensor coverage details will appear after the first shipment updates arrive.</div>';
    return;
  }

  elements.sensorGrid.innerHTML = sensorHealth
    .map(
      (sensor) => `
        <article class="sensor-card">
          <div class="shipment-header">
            <strong>${escapeHtml(sensor.sensorType)}</strong>
            <span class="status-chip ${statusClass(sensor.status)}">${escapeHtml(sensor.status)}</span>
          </div>
          <div class="sensor-reading">${escapeHtml(sensor.reading)}</div>
          <div class="sensor-detail">${escapeHtml(sensor.detail)}</div>
        </article>
      `
    )
    .join("");
}

function renderTimeline(timeline) {
  if (!timeline.length) {
    elements.timelineList.innerHTML = '<div class="empty-state">The route narrative will populate as events and alerts are processed.</div>';
    return;
  }

  elements.timelineList.innerHTML = timeline
    .map(
      (item) => `
        <article class="timeline-card">
          <div class="timeline-head">
            <strong>${escapeHtml(item.vehicleId)}</strong>
            <span class="status-chip ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
          </div>
          <p class="timeline-message">${escapeHtml(item.narrative)}</p>
          <div class="timeline-meta">${timeAgo(item.timestamp)}</div>
        </article>
      `
    )
    .join("");
}

function renderDashboard(payload) {
  latestDashboard = payload;
  elements.subtitle.textContent = payload.project.tagline;
  elements.repoLink.href = "none";
  elements.lastUpdated.textContent = `Updated ${new Date(payload.generatedAt).toLocaleTimeString("en-IE")}`;

  const hiddenCount = payload.fleetManagement?.hiddenCount ?? 0;
  elements.restoreShipments.disabled = hiddenCount === 0;
  elements.restoreShipments.textContent = hiddenCount > 0
    ? `Restore Deleted (${hiddenCount})`
    : "Restore Deleted";

  renderOverview(payload.overview);
  renderShipments(payload.shipments);
  renderAlerts(payload.alerts);
  renderFog(payload.fogInsights);
  renderSensors(payload.sensorHealth);
  renderTimeline(payload.timeline);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    let errorMessage = `Request failed with ${response.status}`;
    try {
      const errorPayload = await response.json();
      errorMessage = errorPayload.error ?? errorMessage;
    } catch {
      // Keep the default message when the error payload is not JSON.
    }

    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function fetchDashboard() {
  const response = await fetch("/api/dashboard");
  if (!response.ok) {
    throw new Error(`Dashboard request failed with ${response.status}`);
  }

  return response.json();
}

async function refreshDashboard() {
  try {
    const payload = await fetchDashboard();
    renderDashboard(payload);
  } catch (error) {
    console.error(error);
  }
}

function openEditModal(vehicleId) {
  const shipment = activeShipments().find((entry) => entry.vehicleId === vehicleId);
  if (!shipment) {
    return;
  }

  elements.editVehicleId.value = shipment.vehicleId;
  elements.editLabel.value = shipment.label;
  elements.editOrigin.value = shipment.origin;
  elements.editDestination.value = shipment.destination;
  elements.editPriority.value = shipment.shipmentPriority ?? "high";
  elements.editModal.classList.remove("hidden");
  elements.editModal.setAttribute("aria-hidden", "false");
  elements.editLabel.focus();
}

function closeEditModal() {
  elements.editModal.classList.add("hidden");
  elements.editModal.setAttribute("aria-hidden", "true");
  elements.editForm.reset();
}

async function handleShipmentDelete(vehicleId) {
  const shipment = activeShipments().find((entry) => entry.vehicleId === vehicleId);
  if (!shipment) {
    return;
  }

  const confirmed = window.confirm(`Hide ${shipment.vehicleId} from the Fleet Board and live alerts?`);
  if (!confirmed) {
    return;
  }

  await requestJson(`/api/shipments/${encodeURIComponent(vehicleId)}`, {
    method: "DELETE"
  });
  await refreshDashboard();
}

async function restoreDeletedShipments() {
  await requestJson("/api/shipments/restore-all", {
    body: "{}",
    method: "POST"
  });
  await refreshDashboard();
}

function connectStream() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource("/api/events");
  eventSource.onmessage = (event) => {
    renderDashboard(JSON.parse(event.data));
  };
  eventSource.onerror = () => {
    eventSource.close();
    window.setTimeout(connectStream, 3000);
  };
}

elements.shipmentsGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const { action, vehicleId } = button.dataset;
  if (!vehicleId) {
    return;
  }

  try {
    if (action === "edit") {
      openEditModal(vehicleId);
      return;
    }

    if (action === "delete") {
      await handleShipmentDelete(vehicleId);
    }
  } catch (error) {
    window.alert(error.message);
  }
});

elements.restoreShipments.addEventListener("click", async () => {
  try {
    await restoreDeletedShipments();
  } catch (error) {
    window.alert(error.message);
  }
});

elements.editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const vehicleId = elements.editVehicleId.value;
  try {
    await requestJson(`/api/shipments/${encodeURIComponent(vehicleId)}`, {
      body: JSON.stringify({
        destination: elements.editDestination.value,
        label: elements.editLabel.value,
        origin: elements.editOrigin.value,
        shipmentPriority: elements.editPriority.value
      }),
      method: "PATCH"
    });

    closeEditModal();
    await refreshDashboard();
  } catch (error) {
    window.alert(error.message);
  }
});

for (const element of [elements.editCancel, elements.editCancelTop]) {
  element.addEventListener("click", closeEditModal);
}

elements.editModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
    closeEditModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.editModal.classList.contains("hidden")) {
    closeEditModal();
  }
});

await refreshDashboard();
connectStream();
window.setInterval(refreshDashboard, 15000);
