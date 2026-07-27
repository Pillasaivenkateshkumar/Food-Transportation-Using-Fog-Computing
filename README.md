# EdgeGuard

> **Intelligent Cold Chain Monitoring and Predictive Analytics for Vaccine/Food Transportation Using Fog Computing**


GitHub repository:
[https://github.com/Pillasaivenkateshkumar/Food-Transportation-Using-Fog-Computing.git](https://github.com/Pillasaivenkateshkumar/Food-Transportation-Using-Fog-Computing.git)

## Project Summary

This project was built to match a Fog and Edge Computing assessment brief requiring:

- `3-5 sensor types` with configurable dispatch rates
- `fog node processing` before backend ingestion
- `scalable backend behaviour`
- `responsive dashboards`
- `public cloud alignment`

My EdgeGuard covers those requirements with:

- `5 sensor types`: temperature, humidity, GPS, vibration, and door-state
- `4 live cold-chain routes`: vaccine, produce, seafood, and dairy transport
- `fog analytics`: smoothing, anomaly detection, risk scoring, batching, and alert generation
- `backend APIs + dashboard`: shipment health, incident feed, sensor estate status, and route timeline
- `AWS integration`: EC2, S3, DynamoDB, SQS,ElasticIP and CloudWatch

## Architecture

### 1. Sensor Layer

The simulator creates live telemetry for four vehicles:

- `VAX-101` - Children's Hospital Vaccine Run
- `FRESH-204` - South Market Produce Route
- `SEA-309` - Atlantic Seafood Corridor
- `DAIRY-412` - Midlands Dairy Express

Each route emits:

- temperature
- humidity
- GPS coordinates
- vibration
- door open/close state

### 2. Fog Layer

The fog node receives raw telemetry and performs:

- moving-window smoothing
- anomaly detection
- cold-chain risk scoring
- alert generation
- local batching before backend forwarding

This reflects the key fog-computing idea in the project: process near the source first, then forward enriched information upstream.

### 3. Backend Layer

The backend:

- accepts fog batches
- stores and transforms live shipment state
- serves REST APIs
- streams dashboard updates with Server-Sent Events
- pushes telemetry into AWS services for cloud persistence and observability

### 4. Dashboard Layer

The UI acts like a control tower for logistics monitoring and includes:

- `Fleet Board`
- `Incident Feed`
- `Fog Intelligence`
- `Sensor Mesh`
- `Route Timeline`

The Fleet Board also includes:

- `Edit` button to update shipment presentation fields
- `Delete` button to hide a shipment from the live dashboard
- `Restore Deleted` button to restore hidden shipments

## Key Features

- Professional dark operations dashboard UI
- Live real-time shipment monitoring
- Fog-layer predictive risk scoring
- Shipment compliance and ETA monitoring
- Temperature trend sparklines
- Alerting for unsafe conditions
- Edit/delete shipment controls in the Fleet Board
- AWS telemetry persistence and metrics publishing

## Tech Stack

- `Node.js`
- `Vanilla HTML/CSS/JavaScript`
- `Server-Sent Events (SSE)`
- `AWS SDK for JavaScript v3`

AWS services currently referenced in the code:

- `Amazon S3` for telemetry batch storage
- `Amazon DynamoDB` for telemetry record persistence
- `Amazon SQS` for queue-based telemetry messaging
- `Amazon CloudWatch` for application metrics

## Project Structure

```text
.
|-- config
|   |-- aws.config.js
|   `-- edgeguard.config.json
|-- infra
|   |-- aws
|   `-- docker
|-- scripts
|-- services
|   |-- backend
|   |-- fog-node
|   |-- sensor-simulator
|   `-- shared
|-- tests
|-- package.json
|-- package-lock.json
|-- README.md
```

## Prerequisites

Before running the project, make sure you have:

- `Node.js 20+`
- `npm`
- an `AWS account or AWS Academy learner lab`
- valid `AWS credentials` configured locally if you want backend ingestion to write to AWS

## Local Setup

### 1. Open the project folder

Open this directory in VS Code or terminal:


### 2. Install dependencies

```powershell
npm install
```

### 3. Start the full application

```powershell
node scripts/dev.mjs
```

This starts:

- the backend server
- the fog node
- the sensor simulator

### 4. Open the dashboard

Open:

[http://127.0.0.1:4200](http://127.0.0.1:4200)

## Available Scripts

- `npm run dev` - start backend, fog node, and simulator together
- `npm run backend` - run backend only
- `npm run fog` - run fog node only
- `npm run sensors` - run sensor simulator only
- `npm run smoke` - run end-to-end smoke test
- `npm test` - run tests
- `npm start` - start backend server

## AWS Configuration Notes

The current code expects AWS resources during backend ingestion.

### AWS values already present in the code/config

- region: `us-east-1`
- SQS queue URL: stored in [config/edgeguard.config.json](/C:/Users/saive/Documents/Food%20Transportation%20Using%20Fog%20Computing/config/edgeguard.config.json)
- S3 bucket name: `edgeguard-telemetry-2026`
- DynamoDB table: `EdgeGuardTelemetry`
- CloudWatch namespace: `EdgeGuard`


## Core API Endpoints

- `GET /health`
- `GET /api/dashboard`
- `GET /api/overview`
- `GET /api/shipments`
- `PATCH /api/shipments/:vehicleId`
- `DELETE /api/shipments/:vehicleId`
- `POST /api/shipments/restore-all`
- `GET /api/alerts`
- `GET /api/timeline`
- `GET /api/fog`
- `GET /api/events`
- `POST /api/ingest`

## How the DashBoard Data Works

The  DashBoard is not static sample text. It is built from live processed telemetry:

1. The sensor simulator generates readings for each shipment.
2. The fog node smooths and analyses those readings.
3. The fog node calculates:
   - risk score
   - shipment status
   - compliance
   - recommendations
4. The backend stores the latest processed shipment state.
5. The dashboard renders that state into cards.

Each Fleet Board card shows:

- vehicle ID
- shipment label
- risk status
- temperature
- humidity
- ETA
- route progress
- compliance
- alert count
- recent temperature trend

## Continuous Integration & Deployment

The project implements a complete CI/CD pipeline using GitHub Actions.

### Continuous Integration

- Checkout repository
- Install dependencies
- Start backend service
- Execute health checks
- Run unit tests

### Continuous Deployment

After successful validation, GitHub Actions automatically:

- Connects securely to AWS EC2 using SSH
- Pulls the latest source code
- Installs dependencies
- Restarts PM2 managed services

This ensures every push to the **main** branch is automatically deployed to the production environment.

### CONCLUSION 

EdgeGuard is a fog-computing cold-chain monitoring platform for vaccine and food transportation. It simulates multi-sensor telemetry, processes it at a virtual fog node, forwards enriched batches to a scalable backend, stores cloud telemetry in AWS services, and presents the results in a real-time operations dashboard.


## Author

- `SaivenkateshkumarPilla`
