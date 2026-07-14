# Deployment Strategy

## Local Development

- Run `node scripts/dev.mjs` to start the backend, fog node, and sensor simulator together.
- Use `node --test` for unit testing and `node scripts/smoke.mjs` for a lightweight end-to-end validation.

## Public Cloud Target

The project is structured for Azure Container Apps because it is a good fit for event-driven services, autoscaling, and rapid deployment for student projects.

### Recommended Deployment Topology

1. `edgeguard-backend`
   Publicly exposed container app serving the dashboard and REST APIs.
2. `edgeguard-fog`
   Internal container app receiving sensor traffic and forwarding enriched batches to the backend.
3. `edgeguard-sensors`
   A container app job or always-on worker that generates demo telemetry.
4. `Queue or broker`
   The local queue abstraction can be replaced by Azure Storage Queues, Service Bus, or AWS SQS in production.

## Included Deployment Assets

- `infra/docker-compose.yml`
- `infra/docker/*.Dockerfile`
- `infra/azure/main.bicep`
- `.github/workflows/ci.yml`

## What To Capture For The Report

- Cloud architecture diagram.
- Evidence of deployment endpoints and service health.
- Screenshot of the live dashboard in the cloud.
- A short note on autoscaling strategy, resilience, and observability.
