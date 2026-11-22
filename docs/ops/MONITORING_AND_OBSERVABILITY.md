# Operations: Monitoring, Observability & Health Telemetry

## 1. Observability Architecture
Mediclaim incorporates structured JSON logging, application health checks, and database connection pool telemetry to ensure high availability and rapid incident response.

```
[Application Events]  --->  [Structured Logger]  --->  [Stdout / JSON Collector]
[Database Health]     --->  [/health/ready]       --->  [Container Orchestrator]
[User Interventions]  --->  [audit_events Table]  --->  [Compliance Dashboards]
```

## 2. Healthcheck Endpoints

### 2.1 Liveness Probe (`GET /health`)
- Verifies that the ASGI HTTP server is running and accepting connections.
- Returns `200 OK` with payload:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-22T22:00:00Z"
}
```

### 2.2 Readiness Probe (`GET /health/ready`)
- Executes an active ping (`SELECT 1`) against the PostgreSQL database.
- Checks availability of writable storage under `/data/uploads`.
- Returns `200 OK` when ready to serve user traffic, or `503 Service Unavailable` if dependencies fail.

## 3. Structured Audit Logging
Every security-relevant operation is logged with structured metadata:
- **Timestamp**: ISO 8601 UTC.
- **Actor User ID & Role**: Identified caller (`patient`, `doctor`, `hospital`, `admin`).
- **Action Type**: `view`, `upload`, `revoke`, `approve`, `grant`, `emergency`.
- **Target Patient ID**: Associated patient record.
- **Client IP & User-Agent**: Network origin metadata.

## 4. Anomaly Alerting Thresholds
- **Failed OTP Spikes**: > 5 consecutive failed OTP attempts triggers temporary IP rate-limiting.
- **Unauthorized Scope Access**: Attempts to query non-consented clinical scopes trigger security audit alerts.
- **Break-Glass Usage**: Any emergency access event triggers an immediate high-priority audit notification.
