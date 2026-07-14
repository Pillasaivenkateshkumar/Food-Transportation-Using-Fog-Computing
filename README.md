# EdgeGuard

EdgeGuard is a distinction-oriented Fog and Edge Computing project for intelligent cold chain monitoring across vaccine and food transportation routes. The solution simulates multi-sensor telemetry, processes it through a coded fog layer, forwards enriched payloads to a scalable backend, and exposes a professional real-time dashboard for operations teams.

GitHub repository link for the report:
[https://github.com/your-username/edgeguard-cold-chain-fog](https://github.com/your-username/edgeguard-cold-chain-fog)

Replace `your-username` after pushing this project to your GitHub account.

## Why This Project Scores Well

- `Sensor and fog application (30%)`: four live shipments, five sensor types, configurable frequencies, edge analytics, alerting, batching, and offline buffering.
- `Scalable backend (30%)`: queue-based ingestion, asynchronous processing, real-time dashboard APIs, health endpoints, CI pipeline, and cloud deployment assets.
- `Technical report (20%)`: report outline, architecture notes, demo script, install instructions, and GitHub link guidance are included.
- `Presentation and demo (20%)`: polished UI, a concise 4-minute demo script, and visible critical incidents make the live walkthrough memorable.

## Project Structure

```text
.
|-- config
|-- docs
|-- infra
|-- scripts
|-- services
|   |-- backend
|   |-- fog-node
|   |-- sensor-simulator
|   `-- shared
|-- tests
|-- package.json
`-- readme.txt
```

## Quick Start

1. Install Node.js 20+.
2. Run `node scripts/dev.mjs`.
3. Open [http://127.0.0.1:4200](http://127.0.0.1:4200).
4. Run `node --test` for unit tests.
5. Run `node scripts/smoke.mjs` for an end-to-end check.

## Key Features

- Five sensor types: temperature, humidity, GPS, vibration, and door-state monitoring.
- Four cold-chain routes covering vaccine, dairy, seafood, and produce transport.
- Fog-layer smoothing, anomaly detection, risk scoring, local batching, and retry buffering.
- Backend queue processing with responsive operations dashboards and server-sent events.
- Public-cloud-ready delivery assets for Docker, GitHub Actions, and Azure Container Apps.

## Deliverables Included

- `readme.txt`: submission-ready installation instructions.
- `docs/architecture.md`: architecture, design choices, and rubric mapping.
- `docs/deployment.md`: public cloud deployment strategy.
- `docs/report-outline.md`: IEEE-style report planning notes.
- `docs/demo-script.md`: a tight 4-minute presentation and demo flow.
