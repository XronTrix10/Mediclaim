# Operations Runbook: Disaster Recovery & Data Resiliency

## 1. Recovery Objectives
- **Recovery Point Objective (RPO)**: <= 5 minutes (maximum permissible data loss window).
- **Recovery Time Objective (RTO)**: <= 15 minutes (maximum permissible service restoration time).

## 2. Backup Strategy & Scheduling

```
+----------------------------------------------------------------------------+
|                              BACKUP MATRIX                                 |
+------------------+---------------------+-----------------------------------+
| Component        | Backup Frequency    | Retention Policy                  |
+------------------+---------------------+-----------------------------------+
| PostgreSQL DB    | Hourly WAL, Daily   | 30 Days rolling off-site          |
| Uploaded Files   | Continuous Sync     | Versioned object storage / S3     |
| Docker Configs   | On Git Commit       | Git Version Controlled            |
+------------------+---------------------+-----------------------------------+
```

### 2.1 Automated Database Dump
Database backups are executed via automated pg_dump scripts:
```bash
docker exec mediclaim-postgres pg_dump -U mediclaim -d mediclaim -F c -f /backups/mediclaim_$(date +%Y%m%d_%H%M%S).dump
```

### 2.2 Uploaded Documents Sync
Medical documents residing in `/data/uploads` are synchronized to encrypted secondary storage using checksum verification to ensure blob integrity.

## 3. Step-by-Step Restoration Procedure

### Step 1: Service Quiescence
Halt inbound API traffic to prevent partial writes during recovery:
```bash
docker compose stop backend
```

### Step 2: Database Restoration
Restore the target backup archive into the PostgreSQL instance:
```bash
docker exec -i mediclaim-postgres pg_restore -U mediclaim -d mediclaim --clean --if-exists /backups/target_backup.dump
```

### Step 3: File Storage Verification
Ensure `/data/uploads` volume contains all corresponding document blobs matching `medical_documents.file_path` database records.

### Step 4: Healthcheck & Traffic Resumption
Restart backend services and verify health endpoints:
```bash
docker compose up -d backend
curl -f http://localhost:8000/health
```
