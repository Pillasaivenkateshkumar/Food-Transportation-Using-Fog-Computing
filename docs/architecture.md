# EdgeGuard Architecture Notes

## Rubric Mapping

- `Sensors and fog application`: The simulator emits five configurable sensor types for four active cold-chain shipments. The fog layer smooths noisy data, performs alerting, calculates risk scores, batches payloads, and buffers when the backend is unavailable.
- `Scalable backend application`: The backend accepts fog payloads asynchronously, places them into an ingestion queue, processes them in a worker loop, and exposes responsive APIs plus real-time dashboard streaming.
- `Technical report`: This project folder includes architecture notes, deployment notes, a report outline, and a GitHub link placeholder for the report implementation section.
- `Presentation and demo`: The UI is built to show clear operational value in under four minutes, including alerts, risk rankings, and fog-computing benefits.

## Architecture Summary

1. `Sensor layer`
   Mock IoT assets simulate cold-chain telemetry for vaccines, produce, seafood, and dairy. Each shipment emits temperature, humidity, GPS, vibration, and door-state data on configurable intervals.
2. `Fog layer`
   The fog node receives raw telemetry, performs moving-window smoothing, enriches payloads with predictive risk analytics, generates early warnings, compresses transmission through batching, and stores buffered batches when cloud connectivity is degraded.
3. `Backend layer`
   The backend API accepts fog batches, places them on a queue abstraction, processes them asynchronously, updates a live operational store, and serves dashboards through REST and server-sent events.
4. `Presentation layer`
   A modern, responsive operations dashboard shows route health, SLA compliance, active incidents, and quantified fog benefits such as bandwidth reduction and early alerting.

## Why Fog Computing Matters Here

- Time-sensitive alerts are generated close to the transport route rather than waiting for cloud round-trips.
- Bandwidth is reduced by sending enriched batches instead of every raw point as a standalone message.
- Local buffering improves resilience when backend connectivity drops.
- The backend remains simpler to scale because the fog layer absorbs noise and burstiness.

## Scalable Design Choices

- Queue-based ingestion decouples bursty fog traffic from persistence and analytics.
- Server-sent events deliver lightweight real-time dashboards without polling overload.
- Stateless HTTP services make horizontal scaling straightforward in cloud platforms.
- Docker and Azure Container Apps assets support container-based deployment and autoscaling.

## Suggested Report Figures

- End-to-end architecture diagram from sensors to fog to backend UI.
- Screenshot of the live dashboard with critical alerts highlighted.
- Sequence diagram showing event flow, enrichment, buffering, queue ingestion, and UI updates.
