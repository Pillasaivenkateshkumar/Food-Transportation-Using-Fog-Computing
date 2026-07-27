# EdgeGuard

EdgeGuard is a distinction-oriented Fog and Edge Computing project for intelligent cold chain monitoring across vaccine and food transportation routes. The solution simulates multi-sensor telemetry, processes it through a coded fog layer, forwards enriched payloads to a scalable backend, and exposes a professional real-time dashboard for operations teams.

GitHub repository link for the report:
[https://github.com/Pillasaivenkateshkumar/Food-Transportation-Using-Fog-Computing.git
]


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
