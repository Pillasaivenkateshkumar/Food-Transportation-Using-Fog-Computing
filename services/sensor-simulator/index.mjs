import { loadConfig } from "../shared/config.mjs";
import { postJson } from "../shared/http.mjs";
import { createSeededRandom } from "../shared/random.mjs";
import { clamp, midpoint, round, sleep, uid } from "../shared/utils.mjs";

const config = await loadConfig();
const timers = new Set();

function probabilityByScenario(scenario) {
  return {
    stable: 0.03,
    watch: 0.06,
    volatile: 0.1,
    critical: 0.15
  }[scenario] ?? 0.05;
}

function createVehicleState(vehicle) {
  const random = createSeededRandom(vehicle.vehicleId);
  return {
    incident: null,
    progress: random() * 0.15,
    random,
    tick: 0
  };
}

function startIncident(vehicle, state) {
  if (state.incident) {
    return;
  }

  if (state.random() > probabilityByScenario(vehicle.scenario)) {
    return;
  }

  const incidentPools = {
    stable: ["temperature"],
    watch: ["temperature", "humidity"],
    volatile: ["temperature", "door", "vibration"],
    critical: ["temperature", "door", "humidity", "vibration"]
  };

  const pool = incidentPools[vehicle.scenario] ?? ["temperature"];
  const type = pool[Math.floor(state.random() * pool.length)];
  state.incident = {
    remaining: 2 + Math.floor(state.random() * 4),
    type
  };
}

function routeStep(vehicle, dispatchEveryMs) {
  const targetTicksPerJourney = Math.max(24, Math.round(vehicle.routeMinutes / 2.8));
  return clamp(1 / targetTicksPerJourney, 0.012, 0.05) + (dispatchEveryMs < 1000 ? 0.003 : 0);
}

function interpolateCoordinate(start, end, progress, noise) {
  return round(start + ((end - start) * progress) + noise, 6);
}

function generateTelemetry(vehicle, state) {
  const profile = config.profiles[vehicle.cargoType];
  const random = state.random;
  const profileMidTemp = midpoint(profile.temperatureC);
  const profileMidHumidity = midpoint(profile.humidityPct);
  const baselineOffsets = {
    critical: 1.4,
    stable: 0.2,
    volatile: 0.8,
    watch: 0.5
  };

  startIncident(vehicle, state);
  state.tick += 1;
  state.progress += routeStep(vehicle, vehicle.dispatchEveryMs);

  if (state.progress >= 1) {
    state.progress = 0;
    state.incident = null;
  }

  const rhythmicDrift = Math.sin(state.tick / 5) * 0.55;
  let temperatureC = profileMidTemp + rhythmicDrift + (random() - 0.5) + baselineOffsets[vehicle.scenario];
  let humidityPct = profileMidHumidity + Math.cos(state.tick / 7) * 4.5 + ((random() - 0.5) * 6);
  let vibrationG = 0.65 + (random() * 0.7) + (vehicle.scenario === "critical" ? 0.35 : 0);
  let doorOpen = random() < 0.008;

  if (state.incident) {
    if (state.incident.type === "temperature") {
      temperatureC += vehicle.cargoType === "vaccine" ? 4 + (random() * 2.5) : 3 + (random() * 2.8);
    }

    if (state.incident.type === "humidity") {
      humidityPct += 14 + (random() * 10);
    }

    if (state.incident.type === "vibration") {
      vibrationG += 1.8 + (random() * 1.5);
    }

    if (state.incident.type === "door") {
      doorOpen = true;
    }

    state.incident.remaining -= 1;
    if (state.incident.remaining <= 0) {
      state.incident = null;
    }
  }

  const noiseLat = (random() - 0.5) * 0.01;
  const noiseLon = (random() - 0.5) * 0.01;
  const latitude = interpolateCoordinate(vehicle.origin.latitude, vehicle.destination.latitude, state.progress, noiseLat);
  const longitude = interpolateCoordinate(vehicle.origin.longitude, vehicle.destination.longitude, state.progress, noiseLon);
  const routeProgressPct = round(state.progress * 100, 1);
  const estimatedEtaMinutes = Math.max(1, Math.round((1 - state.progress) * vehicle.routeMinutes));

  return {
    cargoType: vehicle.cargoType,
    eventId: uid("telemetry"),
    label: vehicle.label,
    routeId: vehicle.routeId,
    routeProgressPct,
    shipmentPriority: profile.coldChainPriority,
    timestamp: new Date().toISOString(),
    vehicleId: vehicle.vehicleId,
    sensors: {
      doorOpen,
      humidityPct: round(humidityPct, 1),
      latitude,
      longitude,
      temperatureC: round(temperatureC, 2),
      vibrationG: round(vibrationG, 3)
    },
    context: {
      destination: vehicle.destination.name,
      dispatchEveryMs: vehicle.dispatchEveryMs,
      estimatedEtaMinutes,
      frequencyHz: round(1000 / vehicle.dispatchEveryMs, 2),
      origin: vehicle.origin.name
    }
  };
}

async function dispatchTelemetry(vehicle, state) {
  const event = generateTelemetry(vehicle, state);
  await postJson(`${config.network.fogUrl}/ingest`, event);
}

async function startVehicleStream(vehicle) {
  const state = createVehicleState(vehicle);

  const run = async () => {
    try {
      await dispatchTelemetry(vehicle, state);
    } catch (error) {
      console.error(`[sensors] failed to dispatch ${vehicle.vehicleId}: ${error.message}`);
    }
  };

  await run();

  const intervalId = setInterval(run, vehicle.dispatchEveryMs);
  timers.add(intervalId);
}

function shutdown() {
  for (const timer of timers) {
    clearInterval(timer);
  }

  console.log("[sensors] simulator stopped");
  process.exit(0);
}

console.log(`[sensors] preparing ${config.fleet.length} simulated cold-chain routes`);
await sleep(config.simulation.startupDelayMs);

for (const vehicle of config.fleet) {
  await startVehicleStream(vehicle);
}

console.log(`[sensors] live streams active for ${config.fleet.map((vehicle) => vehicle.vehicleId).join(", ")}`);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
