# Operations: Production Deployment & Hardening Checklist

## 1. Pre-Deployment Configuration Verification
Before deploying Mediclaim to staging or production environments, verify the following configuration gates:

- [ ] **Secret Keys**: Ensure `JWT_SECRET` is generated using a cryptographically secure random generator (>= 256 bits entropy) and distinct from development defaults.
- [ ] **OTP Debug Mode**: Ensure `OTP_DEBUG=false` in production so verification codes are dispatched exclusively via SMS/Email gateways.
- [ ] **Database Credentials**: PostgreSQL password (`POSTGRES_PASSWORD`) must be complex and stored in secure secret storage.
- [ ] **Gemini API Key**: `GEMINI_API_KEY` configured with valid Google AI Studio quota for document extraction.
- [ ] **Storage Mount**: Ensure persistent volumes (`postgres_data`, `backend_data`) are mounted on resilient, backed-up storage disks.

## 2. Container & OS Hardening
- [ ] Run containers as unprivileged users where applicable.
- [ ] Ensure Docker daemon socket (`/var/run/docker.sock`) is never mounted inside web application containers.
- [ ] Restrict container network communication to internal bridge `mediclaim-network`.
- [ ] Verify file upload directory permissions (`STORAGE_DIR=/data/uploads`) allow read/write only for the backend process.

## 3. Reverse Proxy & TLS Configuration
- [ ] Mandate HTTPS with TLS 1.3.
- [ ] Configure `client_max_body_size 15M;` in Nginx to match backend upload size limits.
- [ ] Enable Gzip or Brotli compression for static frontend assets.
- [ ] Configure security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options.

## 4. Post-Deployment Smoke Tests
- [ ] Run automated database schema validation tests (`python -m unittest discover -s tests`).
- [ ] Execute patient registration and OTP verification test.
- [ ] Verify document upload, AI OCR extraction, and tabular PDF download.
- [ ] Verify doctor access request and consent approval flow.
