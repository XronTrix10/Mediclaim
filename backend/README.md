# Mediclaim Authentication API

FastAPI implementation of **Section 2 (Authentication & Onboarding)** of the supplied `api-contract.md`:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/login`

No patient profile, records, upload, timeline, consent, emergency, audit, or correction endpoints are implemented.

## Run locally

Python 3.12+ recommended.

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
# Set a strong secret before running (PowerShell example):
$env:JWT_SECRET = "replace-with-a-long-random-secret"
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs.

## Run with Docker

Set a secret first:

```bash
# macOS/Linux
export JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"

# PowerShell
$env:JWT_SECRET = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Build and start:

```bash
docker compose up --build -d
docker compose logs -f mediclaim-auth
```

Stop:

```bash
docker compose down
```

The SQLite database is stored in the named Docker volume `mediclaim_auth_data`, so it survives container replacement. `docker compose down -v` deletes that database volume.

## Test the flow

### 1. Register

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Ananya Rao",
    "dateOfBirth": "1994-05-12",
    "phone": "+919876543210",
    "aadhaarNumber": "482193061175",
    "password": "SecurePassword123!"
  }'
```

The development OTP and generated Mediclaim ID are printed in container logs:

```bash
docker compose logs mediclaim-auth
```

The OTP is six digits. It expires after 300 seconds.

### 2. Verify OTP

Use `userId` from the registration response and the OTP from development logs:

```bash
curl -X POST http://localhost:8000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"userId":"usr-...","otp":"123456"}'
```

### 3. Login

Use the generated Mediclaim ID from development logs. Spaces are accepted in the ID:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mediclaimId":"1234 5678 9012","password":"SecurePassword123!"}'
```

## Contract notes and deliberate limitations

1. The registration response in the supplied contract does **not** contain `mediclaimId`, although the contract says registration issues one and login requires it. To preserve the specified JSON response, this implementation does not add that field. In development, the ID is printed to the application logs. Before production, decide how the patient securely receives the ID (for example, add it to the registration response after updating the contract).
2. The supplied contract does not define an SMS vendor or Aadhaar authentication provider. This project generates a phone OTP and prints it only in development mode. It does **not** perform Aadhaar identity verification and must not be represented as doing so. Integrate an authorized provider before production.
3. `OTP_DEBUG=true` is a development-only adapter. Do not deploy with it enabled. A real SMS adapter must dispatch the OTP before the API reports `otpSent: true`.
4. Aadhaar is stored as plaintext in this starter implementation solely to support the specified duplicate check and linkage. That is not suitable for production. Minimize retention; use a lawful authorized verification flow, encryption/tokenization, strict access controls, and a reviewed retention policy.
5. SQLite is suitable for local development/demo use. For production and concurrent registration, use PostgreSQL and database migrations. Add rate limiting, audit logging, key rotation, monitoring, HTTPS, and security review.
6. JWT signing secret must be a strong secret supplied through the environment. Never commit it.
7. `adminVerified` remains `false`; this API does not implement an admin verification workflow.

## Error handling

FastAPI/Pydantic validation errors use HTTP 422 by default. Business errors return FastAPI `detail` objects with an error `code`; duplicate account is HTTP 409, invalid credentials HTTP 401, and invalid/expired OTP HTTP 400. The contract's RFC 7807-style envelope is not globally imposed here because the supplied examples do not define a complete per-endpoint error schema.

## Health check

`GET /health` returns `{"status":"ok"}`.
